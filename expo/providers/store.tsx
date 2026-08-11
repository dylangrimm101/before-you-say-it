import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CHALLENGE_TOTAL_DAYS } from "@/constants/challenge";
import { curriculumModuleForDay, isModuleId, type ModuleId } from "@/constants/modules";
import { SCENARIOS } from "@/constants/scenarios";
import type { AccessState, Entitlement } from "@/lib/access";
import { deleteAllBaselineAudio, deleteBaselineAudio } from "@/lib/baselineAudio";
import {
  DEFAULT_CONSENT,
  needsMigrationNotice,
  normalizeConsent,
  withMigrationNoticeSeen,
  type ConsentState,
} from "@/lib/consent";
import { clearLiveSessionContent } from "@/lib/ephemeral";
import {
  activityDayKeys,
  averageScores,
  completedRecords,
  dayKey,
  firstOpenDay,
  streakFromDays,
} from "@/lib/progress";
import { useIsPro } from "@/lib/purchases";
import { errorShape, safeLog } from "@/lib/redact";
import { cancelChallengeNudge, cancelDailyReminder, requestReminderPermission, scheduleDailyReminder, syncChallengeNudge } from "@/lib/reminders";
import { capRecords, migrateSessions } from "@/lib/sessionMigration";
import {
  associatePracticeSessionUser,
  normalizePracticeSession,
  protectImmutablePracticeRecords,
  type ActivePracticeSession,
} from "@/lib/practiceSession";
import type { ChallengeLogEntry, DrillResult, FreezeState, Profile, ReminderSetting, Scenario, Session } from "@/types/convo";
import type { SessionRecord } from "@/types/privacy";
import { PILOT_PROGRAM, currentPilotDay as deriveCurrentPilotDay } from "@/lib/pilotCurriculum";
import type { PilotModule, PilotProgressEntry } from "@/types/pilotCurriculum";

const KEYS = {
  profile: "cc.profile.v1",
  /** Legacy session history with full transcripts. Read once, then removed. */
  sessionsLegacy: "cc.sessions.v1",
  sessions: "cc.sessions.v2",
  custom: "cc.custom.v1",
  drills: "cc.drills.v1",
  reminder: "cc.reminder.v1",
  challenge: "cc.challenge.v1",
  freeze: "cc.freeze.v1",
  consent: "cc.consent.v1",
  pilotProgress: "cc.pilotProgress.v1",
  anonymousUserId: "cc.anonymousUserId.v1",
  activePracticeSession: "cc.activePracticeSession.v1",
  nativeJourneyStarted: "cc.nativeJourneyStarted.v1",
  /** Development-only entitlement override. Never read in a release build. */
  devPro: "cc.devpro.v1",
} as const;

const DEFAULT_FREEZE: FreezeState = { available: 1, usedDates: [], lastMilestone: 0 };
const MAX_FREEZES = 2;

function newAnonymousUserId(): string {
  return `anon-${Date.now().toString(36)}-${Math.floor(Math.random() * 0x100000000).toString(36)}`;
}

/**
 * Strip the free-text fields before the profile is written to disk. They stay
 * in memory for the current app run so prefills keep working, and are gone on
 * the next launch.
 */
function persistableProfile(profile: Profile): Profile {
  const { dread: _dread, outcome: _outcome, ...rest } = profile;
  return rest;
}

function hasProfileFreeText(raw: unknown): boolean {
  if (raw === null || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return typeof o.dread === "string" || typeof o.outcome === "string";
}

export const [StoreProvider, useStore] = createContextHook(() => {
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [customScenarios, setCustomScenarios] = useState<Scenario[]>([]);
  const [drillLog, setDrillLog] = useState<DrillResult[]>([]);
  const [reminder, setReminderState] = useState<ReminderSetting | null>(null);
  const [challengeLog, setChallengeLog] = useState<ChallengeLogEntry[]>([]);
  const [freeze, setFreeze] = useState<FreezeState>(DEFAULT_FREEZE);
  const [consent, setConsent] = useState<ConsentState>(DEFAULT_CONSENT);
  const [migrationNotice, setMigrationNotice] = useState<boolean>(false);
  const [pilotProgress, setPilotProgress] = useState<PilotProgressEntry[]>([]);
  const [anonymousUserId, setAnonymousUserId] = useState<string>("");
  const [activePracticeSession, setActivePracticeSession] = useState<ActivePracticeSession | null>(null);
  const [nativeJourneyStarted, setNativeJourneyStarted] = useState<boolean>(false);
  const [devPro, setDevPro] = useState<boolean>(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [p, sv2, sv1, c, d, r, ch, f, cs, pp, anonymousId, practiceSession, journeyStarted, dp] = await Promise.all([
          AsyncStorage.getItem(KEYS.profile),
          AsyncStorage.getItem(KEYS.sessions),
          AsyncStorage.getItem(KEYS.sessionsLegacy),
          AsyncStorage.getItem(KEYS.custom),
          AsyncStorage.getItem(KEYS.drills),
          AsyncStorage.getItem(KEYS.reminder),
          AsyncStorage.getItem(KEYS.challenge),
          AsyncStorage.getItem(KEYS.freeze),
          AsyncStorage.getItem(KEYS.consent),
          AsyncStorage.getItem(KEYS.pilotProgress),
          AsyncStorage.getItem(KEYS.anonymousUserId),
          AsyncStorage.getItem(KEYS.activePracticeSession),
          AsyncStorage.getItem(KEYS.nativeJourneyStarted),
          __DEV__ ? AsyncStorage.getItem(KEYS.devPro) : Promise.resolve(null),
        ]);
        if (!alive) return;

        if (__DEV__ && dp === "1") setDevPro(true);
        setNativeJourneyStarted(journeyStarted === "1");
        const stableAnonymousId = anonymousId?.trim() || newAnonymousUserId();
        setAnonymousUserId(stableAnonymousId);
        if (!anonymousId) await AsyncStorage.setItem(KEYS.anonymousUserId, stableAnonymousId);
        if (practiceSession) {
          const normalized = normalizePracticeSession(JSON.parse(practiceSession) as unknown);
          setActivePracticeSession(normalized);
          if (!normalized) await AsyncStorage.removeItem(KEYS.activePracticeSession);
          else if (
            (JSON.parse(practiceSession) as { schemaVersion?: unknown }).schemaVersion !== normalized.schemaVersion
            || JSON.stringify(JSON.parse(practiceSession)) !== JSON.stringify(normalized)
          ) {
            await AsyncStorage.setItem(KEYS.activePracticeSession, JSON.stringify(normalized));
          }
        }

        const storedConsent = normalizeConsent(cs);
        let removedContent = false;

        // --- Sessions: minimize, then delete the legacy key outright. ---
        const primary = migrateSessions(sv2 ?? "[]");
        let records = primary.records;
        if (sv1 !== null) {
          const legacy = migrateSessions(sv1);
          if (sv2 === null) records = legacy.records;
          if (legacy.removedContentFrom > 0) removedContent = true;
          // Write the minimized set before removing the source, so a crash in
          // between leaves the old data recoverable rather than half-deleted.
          await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(records));
          await AsyncStorage.removeItem(KEYS.sessionsLegacy);
          safeLog("[store] session content removed", {
            removed: legacy.removedContentFrom,
            kept: records.length,
            schemaVersion: 2,
          });
        } else if (primary.removedContentFrom > 0) {
          removedContent = true;
          await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(records));
        }
        setSessions(records);

        // --- Profile: keep the coarse fields, drop the free text. ---
        if (p) {
          const parsed = JSON.parse(p) as Profile;
          if (hasProfileFreeText(parsed)) {
            removedContent = true;
            await AsyncStorage.setItem(KEYS.profile, JSON.stringify(persistableProfile(parsed)));
          }
          setProfile(persistableProfile(parsed));
        }

        // --- Custom scenarios: exact text is opt-in, and was never opted into. ---
        if (c) {
          const parsed = JSON.parse(c) as Scenario[];
          if (storedConsent.saveCustomScenarioText) {
            setCustomScenarios(Array.isArray(parsed) ? parsed : []);
          } else {
            if (Array.isArray(parsed) && parsed.length > 0) removedContent = true;
            await AsyncStorage.removeItem(KEYS.custom);
          }
        }

        if (d) setDrillLog(JSON.parse(d) as DrillResult[]);
        if (r) setReminderState(JSON.parse(r) as ReminderSetting);
        if (ch) setChallengeLog(JSON.parse(ch) as ChallengeLogEntry[]);
        if (f) setFreeze(JSON.parse(f) as FreezeState);
        setConsent(storedConsent);
        if (pp) {
          const parsed = JSON.parse(pp) as unknown;
          if (Array.isArray(parsed)) {
            const valid = parsed.filter((entry): entry is PilotProgressEntry => {
              if (!entry || typeof entry !== "object") return false;
              const value = entry as Partial<PilotProgressEntry>;
              return value.curriculumVersion === PILOT_PROGRAM.curriculum_version
                && (value.moduleId === undefined || isModuleId(value.moduleId))
                && Number.isInteger(value.day)
                && typeof value.behaviorId === "string"
                && typeof value.date === "string"
                && typeof value.completedAt === "number";
            });
            const migrated = valid.map((entry): PilotProgressEntry => {
              const mappedModuleId = entry.moduleId ?? curriculumModuleForDay(entry.day)?.id;
              return mappedModuleId ? { ...entry, moduleId: mappedModuleId } : entry;
            });
            setPilotProgress(migrated);
            if (JSON.stringify(valid) !== JSON.stringify(migrated)) {
              await AsyncStorage.setItem(KEYS.pilotProgress, JSON.stringify(migrated));
            }
          }
        }
        setMigrationNotice(needsMigrationNotice(storedConsent, removedContent));
      } catch (e) {
        safeLog("[store] hydrate failed", errorShape(e));
      } finally {
        if (alive) setHydrated(true);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  const writeConsent = useCallback(async (next: ConsentState) => {
    setConsent(next);
    try {
      await AsyncStorage.setItem(KEYS.consent, JSON.stringify(next));
    } catch (e) {
      safeLog("[store] consent save failed", errorShape(e));
    }
  }, []);

  const setKeepBaselineAudio = useCallback(
    async (enabled: boolean) => {
      if (!enabled) await deleteAllBaselineAudio();
      setConsent((prev) => {
        const next = { ...prev, keepBaselineAudio: enabled };
        AsyncStorage.setItem(KEYS.consent, JSON.stringify(next)).catch((e) =>
          safeLog("[store] consent save failed", errorShape(e)),
        );
        return next;
      });
    },
    [],
  );

  const setSaveCustomScenarioText = useCallback(
    async (enabled: boolean) => {
      if (!enabled) {
        setCustomScenarios([]);
        await AsyncStorage.removeItem(KEYS.custom).catch(() => {});
      }
      setConsent((prev) => {
        const next = { ...prev, saveCustomScenarioText: enabled };
        AsyncStorage.setItem(KEYS.consent, JSON.stringify(next)).catch((e) =>
          safeLog("[store] consent save failed", errorShape(e)),
        );
        return next;
      });
    },
    [],
  );

  const dismissMigrationNotice = useCallback(async () => {
    setMigrationNotice(false);
    setConsent((prev) => {
      const next = withMigrationNoticeSeen(prev, Date.now());
      AsyncStorage.setItem(KEYS.consent, JSON.stringify(next)).catch((e) =>
        safeLog("[store] consent save failed", errorShape(e)),
      );
      return next;
    });
  }, []);

  /** Marks that Entry routed this installation into the native acquisition journey. */
  const beginNativeJourney = useCallback(async (): Promise<void> => {
    setNativeJourneyStarted(true);
    try {
      await AsyncStorage.setItem(KEYS.nativeJourneyStarted, "1");
    } catch (e) {
      safeLog("[store] entry state save failed", errorShape(e));
    }
  }, []);

  const saveProfile = useCallback(async (next: Profile) => {
    setProfile(next);
    try {
      await AsyncStorage.setItem(KEYS.profile, JSON.stringify(persistableProfile(next)));
    } catch (e) {
      safeLog("[store] profile save failed", errorShape(e));
    }
  }, []);

  /** Persist the single active onboarding-to-Day-1 handoff. */
  const saveActivePracticeSession = useCallback(async (session: ActivePracticeSession | null): Promise<void> => {
    const protectedSession = session && activePracticeSession
      ? protectImmutablePracticeRecords(activePracticeSession, session)
      : session;
    setActivePracticeSession(protectedSession);
    try {
      if (protectedSession) await AsyncStorage.setItem(KEYS.activePracticeSession, JSON.stringify(protectedSession));
      else await AsyncStorage.removeItem(KEYS.activePracticeSession);
    } catch (e) {
      safeLog("[store] active practice session save failed", errorShape(e));
    }
  }, [activePracticeSession]);

  /** Attach the active anonymous session when an account identity becomes available. */
  const associateActivePracticeSessionWithUser = useCallback(async (userId: string): Promise<void> => {
    if (!activePracticeSession) return;
    await saveActivePracticeSession(associatePracticeSessionUser(activePracticeSession, userId));
  }, [activePracticeSession, saveActivePracticeSession]);

  /** Persist a minimized session record. Content never reaches this function. */
  const upsertSession = useCallback(async (record: SessionRecord) => {
    let snapshot: SessionRecord[] = [];
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === record.id);
      const next =
        idx === -1 ? [record, ...prev] : prev.map((s) => (s.id === record.id ? record : s));
      snapshot = capRecords(next);
      return snapshot;
    });
    try {
      await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(snapshot));
    } catch (e) {
      safeLog("[store] session save failed", errorShape(e));
    }
  }, []);

  /** Delete one saved session, along with any recording kept for it. */
  const deleteSession = useCallback(async (id: string) => {
    let snapshot: SessionRecord[] = [];
    setSessions((prev) => {
      snapshot = prev.filter((s) => s.id !== id);
      return snapshot;
    });
    clearLiveSessionContent(id);
    await deleteBaselineAudio(id);
    try {
      await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(snapshot));
    } catch (e) {
      safeLog("[store] session delete failed", errorShape(e));
    }
  }, []);

  /** Delete all practice history. Streaks derived from drills/days survive. */
  const deleteAllSessions = useCallback(async () => {
    setSessions([]);
    clearLiveSessionContent();
    await deleteAllBaselineAudio();
    try {
      await AsyncStorage.removeItem(KEYS.sessions);
    } catch (e) {
      safeLog("[store] history delete failed", errorShape(e));
    }
  }, []);

  const addCustomScenario = useCallback(
    async (scenario: Scenario) => {
      let snapshot: Scenario[] = [];
      setCustomScenarios((prev) => {
        snapshot = [scenario, ...prev].slice(0, 40);
        return snapshot;
      });
      // Exact scenario text is only written to disk when explicitly opted in.
      if (!consent.saveCustomScenarioText) return;
      try {
        await AsyncStorage.setItem(KEYS.custom, JSON.stringify(snapshot));
      } catch (e) {
        safeLog("[store] custom save failed", errorShape(e));
      }
    },
    [consent.saveCustomScenarioText],
  );

  const deleteCustomScenario = useCallback(
    async (id: string) => {
      let snapshot: Scenario[] = [];
      setCustomScenarios((prev) => {
        snapshot = prev.filter((s) => s.id !== id);
        return snapshot;
      });
      if (!consent.saveCustomScenarioText) return;
      try {
        await AsyncStorage.setItem(KEYS.custom, JSON.stringify(snapshot));
      } catch (e) {
        safeLog("[store] custom delete failed", errorShape(e));
      }
    },
    [consent.saveCustomScenarioText],
  );

  const deleteAllCustomScenarios = useCallback(async () => {
    setCustomScenarios([]);
    try {
      await AsyncStorage.removeItem(KEYS.custom);
    } catch (e) {
      safeLog("[store] custom delete failed", errorShape(e));
    }
  }, []);

  const logDrill = useCallback(async (result: DrillResult) => {
    let snapshot: DrillResult[] = [];
    setDrillLog((prev) => {
      snapshot = [result, ...prev].slice(0, 90);
      return snapshot;
    });
    try {
      await AsyncStorage.setItem(KEYS.drills, JSON.stringify(snapshot));
    } catch (e) {
      safeLog("[store] drill save failed", errorShape(e));
    }
  }, []);

  /** Mark a challenge day complete (idempotent) and persist the log. */
  const markChallengeDayDone = useCallback(async (day: number) => {
    if (!Number.isInteger(day) || day < 1 || day > CHALLENGE_TOTAL_DAYS) return;
    let snapshot: ChallengeLogEntry[] = [];
    let changed = false;
    setChallengeLog((prev) => {
      if (prev.some((e) => e.day === day)) {
        snapshot = prev;
        return prev;
      }
      changed = true;
      snapshot = [...prev, { day, date: dayKey(Date.now()), completedAt: Date.now() }];
      return snapshot;
    });
    if (!changed) return;
    try {
      await AsyncStorage.setItem(KEYS.challenge, JSON.stringify(snapshot));
    } catch (e) {
      safeLog("[store] challenge save failed", errorShape(e));
    }
    // They just finished a rep — the friendliest moment to ask for permission
    // so tomorrow's 6 PM nudge can be delivered.
    requestReminderPermission().catch(() => {});
  }, []);

  /**
   * Enable/update or disable the daily drill reminder. Handles the
   * notification permission prompt and (re)scheduling. Returns false when
   * the user denied notification permission.
   */
  const setReminder = useCallback(async (next: ReminderSetting): Promise<boolean> => {
    if (next.enabled) {
      const granted = await requestReminderPermission();
      if (!granted) return false;
      await scheduleDailyReminder(next.hour, next.minute);
    } else {
      await cancelDailyReminder();
    }
    setReminderState(next);
    try {
      await AsyncStorage.setItem(KEYS.reminder, JSON.stringify(next));
    } catch (e) {
      safeLog("[store] reminder save failed", errorShape(e));
    }
    return true;
  }, []);

  /** Wipe everything this app has stored on the device. */
  const reset = useCallback(async () => {
    setProfile(null);
    setDevPro(false);
    setSessions([]);
    setCustomScenarios([]);
    setDrillLog([]);
    setReminderState(null);
    setChallengeLog([]);
    setFreeze(DEFAULT_FREEZE);
    setConsent(DEFAULT_CONSENT);
    setMigrationNotice(false);
    setPilotProgress([]);
    setActivePracticeSession(null);
    setNativeJourneyStarted(false);
    clearLiveSessionContent();
    cancelDailyReminder().catch(() => {});
    cancelChallengeNudge().catch(() => {});
    await deleteAllBaselineAudio();
    try {
      await AsyncStorage.multiRemove([
        KEYS.profile,
        KEYS.sessions,
        KEYS.sessionsLegacy,
        KEYS.custom,
        KEYS.drills,
        KEYS.reminder,
        KEYS.challenge,
        KEYS.freeze,
        KEYS.consent,
        KEYS.pilotProgress,
        KEYS.activePracticeSession,
        KEYS.nativeJourneyStarted,
        KEYS.anonymousUserId,
        KEYS.devPro,
      ]);
    } catch (e) {
      safeLog("[store] reset failed", errorShape(e));
    }
  }, []);

  const findScenario = useCallback(
    (id: string): Scenario | undefined => {
      const found = SCENARIOS.find((scenario) => scenario.id === id) ?? customScenarios.find((scenario) => scenario.id === id);
      if (found) return found;
      if (activePracticeSession?.scenarioId !== id) return undefined;
      return {
        id,
        category: activePracticeSession.category,
        title: "Your conversation",
        counterpart: activePracticeSession.counterpart,
        situation: activePracticeSession.topic,
        persona: `Respond as ${activePracticeSession.counterpart} in this private rehearsal.`,
        goal: activePracticeSession.usefulOutcome,
        openingLine: "",
        opensWith: "user",
        minutes: 5,
        isCustom: true,
      };
    },
    [activePracticeSession, customScenarios],
  );

  const completed = useMemo(() => completedRecords(sessions), [sessions]);

  const pilotDoneDays = useMemo(
    () => new Set(pilotProgress.map((entry) => entry.day)),
    [pilotProgress],
  );

  const currentPilotDay = useMemo(
    () => deriveCurrentPilotDay(pilotDoneDays),
    [pilotDoneDays],
  );

  const markPilotDayDone = useCallback(async (module: PilotModule, moduleId?: ModuleId): Promise<void> => {
    let snapshot: PilotProgressEntry[] = [];
    let changed = false;
    setPilotProgress((previous) => {
      if (previous.some((entry) => moduleId ? entry.moduleId === moduleId : entry.day === module.day)) {
        snapshot = previous;
        return previous;
      }
      changed = true;
      const completedAt = Date.now();
      snapshot = [...previous, {
        curriculumVersion: PILOT_PROGRAM.curriculum_version,
        ...(moduleId ? { moduleId } : {}),
        day: module.day,
        behaviorId: module.primary_behavior_id,
        date: dayKey(completedAt),
        completedAt,
      }];
      return snapshot;
    });
    if (!changed) return;
    try {
      await AsyncStorage.setItem(KEYS.pilotProgress, JSON.stringify(snapshot));
    } catch (e) {
      safeLog("[store] pilot progress save failed", errorShape(e));
    }
  }, []);

  const modularDoneIds = useMemo(
    () => new Set(pilotProgress.map((entry) => entry.moduleId).filter((id): id is ModuleId => Boolean(id))),
    [pilotProgress],
  );

  const todayDrillDone = useMemo(
    () => drillLog.some((d) => d.date === dayKey(Date.now())),
    [drillLog],
  );

  const streak = useMemo(
    () => streakFromDays(new Set(sessions.filter((s) => s.endedAt).map((s) => dayKey(s.endedAt ?? 0)))),
    [sessions],
  );

  /** Every YYYY-MM-DD with any training activity: drills, rehearsals or challenge days. */
  const activityDays = useMemo(() => {
    const days = activityDayKeys(sessions, drillLog, challengeLog);
    pilotProgress.forEach((entry) => days.add(entry.date));
    return days;
  }, [sessions, drillLog, challengeLog, pilotProgress]);

  /** Frozen days as a set for quick lookups. */
  const frozenDays = useMemo(() => new Set(freeze.usedDates), [freeze.usedDates]);

  /** Activity plus frozen days — the set the streak is computed over. */
  const streakDays = useMemo(() => {
    const days = new Set(activityDays);
    frozenDays.forEach((d) => days.add(d));
    return days;
  }, [activityDays, frozenDays]);

  /** Streak across ALL activity — a daily drill keeps it alive, not just rehearsals. */
  const activityStreak = useMemo(() => streakFromDays(streakDays), [streakDays]);

  /**
   * A freeze can rescue the streak when exactly yesterday was missed and
   * there was a live chain the day before.
   */
  const canFreeze = useMemo(() => {
    if (freeze.available <= 0) return false;
    const oneDay = 86400000;
    const yesterday = dayKey(Date.now() - oneDay);
    const dayBefore = dayKey(Date.now() - 2 * oneDay);
    return !streakDays.has(yesterday) && streakDays.has(dayBefore);
  }, [freeze.available, streakDays]);

  /**
   * Spend one freeze on yesterday, reconnecting the streak. Returns success.
   * Deliberately not named `use*`: it is an action, not a React hook.
   */
  const spendStreakFreeze = useCallback(async (): Promise<boolean> => {
    const oneDay = 86400000;
    const yesterday = dayKey(Date.now() - oneDay);
    let snapshot: FreezeState | null = null;
    setFreeze((prev) => {
      if (prev.available <= 0 || prev.usedDates.includes(yesterday)) return prev;
      snapshot = {
        ...prev,
        available: prev.available - 1,
        usedDates: [...prev.usedDates, yesterday].slice(-60),
      };
      return snapshot;
    });
    if (!snapshot) return false;
    try {
      await AsyncStorage.setItem(KEYS.freeze, JSON.stringify(snapshot));
    } catch (e) {
      safeLog("[store] freeze save failed", errorShape(e));
    }
    return true;
  }, []);

  // Earn a new freeze (max 2 banked) each time the streak crosses a fresh
  // multiple of 7 — consistency refills the safety net.
  useEffect(() => {
    if (!hydrated) return;
    const milestone = Math.floor(activityStreak / 7) * 7;
    if (milestone <= 0 || milestone <= freeze.lastMilestone) return;
    let snapshot: FreezeState | null = null;
    setFreeze((prev) => {
      if (milestone <= prev.lastMilestone) return prev;
      snapshot = {
        ...prev,
        available: Math.min(MAX_FREEZES, prev.available + 1),
        lastMilestone: milestone,
      };
      return snapshot;
    });
    if (snapshot) {
      AsyncStorage.setItem(KEYS.freeze, JSON.stringify(snapshot)).catch((e) =>
        safeLog("[store] freeze grant save failed", errorShape(e)),
      );
    }
  }, [hydrated, activityStreak, freeze.lastMilestone]);

  const challengeDoneDays = useMemo(
    () => new Set(challengeLog.map((e) => e.day)),
    [challengeLog],
  );

  /**
   * First incomplete challenge day; one past the end when everything is done.
   * Length comes from the curriculum data, never a literal.
   */
  const currentChallengeDay = useMemo(
    () => firstOpenDay(challengeDoneDays, CHALLENGE_TOTAL_DAYS),
    [challengeDoneDays],
  );

  // Keep the 6 PM challenge nudge in sync: skip it once today's rep is done,
  // move it to tomorrow, and stop entirely when the program is finished.
  useEffect(() => {
    if (!hydrated || !profile) return;
    const todayDone = challengeLog.some((e) => e.date === dayKey(Date.now()));
    syncChallengeNudge(todayDone, currentChallengeDay).catch((e) =>
      safeLog("[store] nudge sync failed", errorShape(e)),
    );
  }, [hydrated, profile, challengeLog, currentChallengeDay]);

  const averages = useMemo(() => averageScores(completed), [completed]);

  const purchasedPro = useIsPro();

  /**
   * The dev override exists because RevenueCat's native module is absent in
   * Expo Go, which makes the paid path impossible to exercise during
   * development. It is compiled behind `__DEV__` and cannot unlock anything in
   * a release build.
   */
  const toggleDevPro = useCallback(async (enabled: boolean) => {
    if (!__DEV__) return;
    setDevPro(enabled);
    try {
      if (enabled) await AsyncStorage.setItem(KEYS.devPro, "1");
      else await AsyncStorage.removeItem(KEYS.devPro);
    } catch (e) {
      safeLog("[store] dev entitlement save failed", errorShape(e));
    }
  }, []);

  const entitlement: Entitlement = purchasedPro || (__DEV__ && devPro) ? "pro" : "free";

  /** Single source of truth for every free/paid decision. */
  const access = useMemo<AccessState>(
    () => ({ entitlement, completedReps: completed.length + pilotProgress.length }),
    [entitlement, completed.length, pilotProgress.length],
  );

  return {
    hydrated,
    profile,
    sessions,
    completed,
    customScenarios,
    drillLog,
    todayDrillDone,
    streak,
    activityDays,
    activityStreak,
    frozenDays,
    freezesAvailable: freeze.available,
    canFreeze,
    spendStreakFreeze,
    averages,
    access,
    entitlement,
    devProEnabled: devPro,
    toggleDevPro,
    reminder,
    setReminder,
    challengeLog,
    challengeDoneDays,
    currentChallengeDay,
    markChallengeDayDone,
    pilotProgress,
    pilotDoneDays,
    modularDoneIds,
    anonymousUserId,
    activePracticeSession,
    nativeJourneyStarted,
    beginNativeJourney,
    saveActivePracticeSession,
    associateActivePracticeSessionWithUser,
    currentPilotDay,
    markPilotDayDone,
    saveProfile,
    upsertSession,
    deleteSession,
    deleteAllSessions,
    addCustomScenario,
    deleteCustomScenario,
    deleteAllCustomScenarios,
    logDrill,
    findScenario,
    consent,
    setKeepBaselineAudio,
    setSaveCustomScenarioText,
    writeConsent,
    migrationNotice,
    dismissMigrationNotice,
    reset,
  };
});

export type { Session };
