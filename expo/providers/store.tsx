import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CHALLENGE_TOTAL_DAYS } from "@/constants/challenge";
import { CURRICULUM_MODULES, isModuleId, type ModuleId } from "@/constants/modules";
import { SCENARIOS } from "@/constants/scenarios";
import type { AccessState, Entitlement } from "@/lib/access";
import {
  activeRunRevision,
  archiveActiveScenarioRunCAS,
  clearActiveScenarioRunCAS,
  readActiveScenarioRunStrict,
  replaceActiveScenarioRunCAS,
  type ActiveRunRevision,
} from "@/lib/activeScenarioRunRepository";
import { deleteAllBaselineAudioStrict, deleteBaselineAudioStrict } from "@/lib/baselineAudio";
import {
  DEFAULT_CONSENT,
  needsMigrationNotice,
  normalizeConsent,
  withMigrationNoticeSeen,
  type ConsentState,
} from "@/lib/consent";
import { clearLiveSessionContent } from "@/lib/ephemeral";
import { hydrateJsonEntry } from "@/lib/hydration";
import { completedReviewPracticeIds, migrateLegacyPilotProgress } from "@/lib/curriculumMigration";
import { normalizeConvertedLessonProgress, type ConvertedLessonProgress } from "@/lib/convertedLesson";
import {
  resetConvertedLessonProgress,
  restoreConvertedLessonProgress,
} from "@/lib/convertedProgressRepository";
import {
  markPendingPrivateContentDeleted,
  promotePendingConvertedCompletion,
  recoverPendingConvertedCompletion,
  writePendingConvertedCompletion,
} from "@/lib/convertedCompletionJournal";
import { REVIEW_CURRICULUM_VERSION, isInternalReviewModuleComplete } from "@/lib/modularCurriculum";
import {
  activityDayKeys,
  averageScores,
  completedRecords,
  dayKey,
  firstOpenDay,
  streakFromDays,
} from "@/lib/progress";
import { clearPurchasesIdentity, useIsPro } from "@/lib/purchases";
import { sanitizeActivePracticeSessionForPersistence, sanitizeActiveScenarioRunForPersistence, sanitizeSessionForPersistence } from "@/lib/privacyPersistence";
import { errorShape, safeLog } from "@/lib/redact";
import { normalizeScenarioPracticeRun, type PersistedScenarioPracticeRun } from "@/lib/scenarioPractice";
import { appendScoredPracticeRecord, normalizeScoredPracticeHistory, type ScoredPracticeRecord } from "@/lib/scoredPracticeHistory";
import { cancelChallengeNudge, cancelDailyReminder, requestReminderPermission, syncChallengeNudge } from "@/lib/reminders";
import { capRecords } from "@/lib/sessionMigration";
import { migrateSessionStorage } from "@/lib/sessionStorageMigration";
import { resetAllDataStrict } from "@/lib/resetAllData";
import { supabase } from "@/lib/supabase";
import { deleteGeneratedVoiceCacheStrict } from "@/lib/voice";
import {
  associatePracticeSessionUser,
  normalizePracticeSession,
  protectImmutablePracticeRecords,
  type ActivePracticeSession,
} from "@/lib/practiceSession";
import type { ChallengeLogEntry, DrillResult, FreezeState, Profile, Scenario, Session } from "@/types/convo";
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
  scoredPracticeHistory: "cc.scoredPracticeHistory.v1",
  anonymousUserId: "cc.anonymousUserId.v1",
  activePracticeSession: "cc.activePracticeSession.v1",
  activeScenarioRun: "cc.activeScenarioRun.v1",
  archivedScenarioRuns: "cc.archivedScenarioRuns.v1",
  quarantinedScenarioRun: "cc.quarantinedScenarioRun.v1",
  convertedLessonProgress: "cc.convertedLessonProgress.v1",
  convertedCompletionPending: "cc.convertedCompletionPending.v1",
  nativeJourneyStarted: "cc.nativeJourneyStarted.v1",
  /** Development-only entitlement overrides. Never read in a release build. */
  devPro: "cc.devpro.v1",
  devForceUnpaid: "cc.devForceUnpaid.v1",
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
  const queryClient = useQueryClient();
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [customScenarios, setCustomScenarios] = useState<Scenario[]>([]);
  const [drillLog, setDrillLog] = useState<DrillResult[]>([]);
  const [challengeLog, setChallengeLog] = useState<ChallengeLogEntry[]>([]);
  const [freeze, setFreeze] = useState<FreezeState>(DEFAULT_FREEZE);
  const [consent, setConsent] = useState<ConsentState>(DEFAULT_CONSENT);
  const [migrationNotice, setMigrationNotice] = useState<boolean>(false);
  const [pilotProgress, setPilotProgress] = useState<PilotProgressEntry[]>([]);
  const [scoredPracticeHistory, setScoredPracticeHistory] = useState<ScoredPracticeRecord[]>([]);
  const [anonymousUserId, setAnonymousUserId] = useState<string>("");
  const [activePracticeSession, setActivePracticeSession] = useState<ActivePracticeSession | null>(null);
  const [activeScenarioRun, setActiveScenarioRun] = useState<PersistedScenarioPracticeRun | null>(null);
  const [convertedLessonProgress, setConvertedLessonProgress] = useState<ConvertedLessonProgress[]>([]);
  const [nativeJourneyStarted, setNativeJourneyStarted] = useState<boolean>(false);
  const [devPro, setDevPro] = useState<boolean>(false);
  const [devForceUnpaid, setDevForceUnpaid] = useState<boolean>(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [p, _sv2, sv1, c, d, r, ch, f, cs, pp, scoredHistory, anonymousId, practiceSession, scenarioRun, convertedProgress, journeyStarted, dp, devUnpaid] = await Promise.all([
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
          AsyncStorage.getItem(KEYS.scoredPracticeHistory),
          AsyncStorage.getItem(KEYS.anonymousUserId),
          AsyncStorage.getItem(KEYS.activePracticeSession),
          AsyncStorage.getItem(KEYS.activeScenarioRun),
          AsyncStorage.getItem(KEYS.convertedLessonProgress),
          AsyncStorage.getItem(KEYS.nativeJourneyStarted),
          __DEV__ ? AsyncStorage.getItem(KEYS.devPro) : Promise.resolve(null),
          __DEV__ ? AsyncStorage.getItem(KEYS.devForceUnpaid) : Promise.resolve(null),
        ]);
        if (!alive) return;
        const hydrationFailure = (key: string, error: unknown): void => safeLog("[store] malformed hydration key", { key, ...errorShape(error) });
        const storedConsent = normalizeConsent(cs);

        if (__DEV__ && dp === "1") setDevPro(true);
        if (__DEV__ && devUnpaid === "1") setDevForceUnpaid(true);
        setNativeJourneyStarted(journeyStarted === "1");
        const stableAnonymousId = anonymousId?.trim() || newAnonymousUserId();
        setAnonymousUserId(stableAnonymousId);
        if (!anonymousId) await AsyncStorage.setItem(KEYS.anonymousUserId, stableAnonymousId);
        // Completion recovery owns the active bytes while its journal exists. It must
        // resume strict audio deletion before generic parsing can quarantine identity.
        const recoveredProgress = await recoverPendingConvertedCompletion(AsyncStorage);
        let normalizedScenarioRun: PersistedScenarioPracticeRun | null = null;
        if (!recoveredProgress) {
          try {
            normalizedScenarioRun = await readActiveScenarioRunStrict(AsyncStorage);
          } catch (error: unknown) {
            safeLog("[store] malformed active run quarantined", errorShape(error));
          }
        }
        setActiveScenarioRun(normalizedScenarioRun);
        if (convertedProgress && !recoveredProgress) {
          const parsedConvertedProgress = hydrateJsonEntry<unknown>(convertedProgress, [], KEYS.convertedLessonProgress, hydrationFailure);
          const normalizedConvertedProgress = normalizeConvertedLessonProgress(parsedConvertedProgress);
          setConvertedLessonProgress(normalizedConvertedProgress);
          if (JSON.stringify(parsedConvertedProgress) !== JSON.stringify(normalizedConvertedProgress)) {
            await AsyncStorage.setItem(KEYS.convertedLessonProgress, JSON.stringify(normalizedConvertedProgress));
          }
        }
        if (recoveredProgress) setConvertedLessonProgress(recoveredProgress);
        if (practiceSession) {
          const parsedPracticeSession = hydrateJsonEntry<unknown>(practiceSession, null, KEYS.activePracticeSession, hydrationFailure);
          const normalized = normalizePracticeSession(parsedPracticeSession);
          const privacySafeSession = normalized ? sanitizeActivePracticeSessionForPersistence(normalized, storedConsent) : null;
          setActivePracticeSession(privacySafeSession);
          if (!normalized) await AsyncStorage.removeItem(KEYS.activePracticeSession);
          else if (
            (parsedPracticeSession as { schemaVersion?: unknown } | null)?.schemaVersion !== normalized.schemaVersion
            || JSON.stringify(parsedPracticeSession) !== JSON.stringify(privacySafeSession)
          ) {
            await AsyncStorage.setItem(KEYS.activePracticeSession, JSON.stringify(privacySafeSession));
          }
        }

        let removedContent = false;

        // --- Sessions: choose a usable source and retire v1 only after a
        // canonical v2 write has been read back and verified. ---
        const migratedSessions = await migrateSessionStorage(AsyncStorage, KEYS.sessionsLegacy, KEYS.sessions, {
          preserveCustomScenarioText: storedConsent.saveCustomScenarioText,
        });
        const records = migratedSessions.records;
        if (migratedSessions.removedContentFrom > 0) removedContent = true;
        if (sv1 !== null || migratedSessions.removedContentFrom > 0) {
          safeLog("[store] session content removed", {
            removed: migratedSessions.removedContentFrom,
            kept: records.length,
            schemaVersion: 2,
          });
        }
        setSessions(records);

        // --- Profile: keep the coarse fields, drop the free text. ---
        if (p) {
          const parsed = hydrateJsonEntry<Profile | null>(p, null, KEYS.profile, hydrationFailure);
          if (parsed) {
          if (hasProfileFreeText(parsed)) {
            removedContent = true;
            await AsyncStorage.setItem(KEYS.profile, JSON.stringify(persistableProfile(parsed)));
          }
          setProfile(persistableProfile(parsed));
          }
        }

        // --- Custom scenarios: exact text is opt-in, and was never opted into. ---
        if (c) {
          const parsed = hydrateJsonEntry<unknown>(c, [], KEYS.custom, hydrationFailure);
          if (storedConsent.saveCustomScenarioText) {
            setCustomScenarios(Array.isArray(parsed) ? parsed : []);
          } else {
            if (Array.isArray(parsed) && parsed.length > 0) removedContent = true;
            await AsyncStorage.removeItem(KEYS.custom);
          }
        }

        if (d) setDrillLog(hydrateJsonEntry<DrillResult[]>(d, [], KEYS.drills, hydrationFailure));
        if (r) {
          await cancelDailyReminder();
          await AsyncStorage.removeItem(KEYS.reminder);
        }
        if (ch) setChallengeLog(hydrateJsonEntry<ChallengeLogEntry[]>(ch, [], KEYS.challenge, hydrationFailure));
        if (f) setFreeze(hydrateJsonEntry<FreezeState>(f, DEFAULT_FREEZE, KEYS.freeze, hydrationFailure));
        setConsent(storedConsent);
        if (pp) {
          const parsed = hydrateJsonEntry<unknown>(pp, [], KEYS.pilotProgress, hydrationFailure);
          if (Array.isArray(parsed)) {
            const valid = parsed.filter((entry): entry is PilotProgressEntry => {
              if (!entry || typeof entry !== "object") return false;
              const value = entry as Partial<PilotProgressEntry>;
              return typeof value.curriculumVersion === "string"
                && (value.moduleId === undefined || isModuleId(value.moduleId))
                && Number.isInteger(value.day)
                && typeof value.behaviorId === "string"
                && typeof value.date === "string"
                && typeof value.completedAt === "number";
            });
            const migrated = migrateLegacyPilotProgress(valid);
            setPilotProgress(migrated);
            if (JSON.stringify(valid) !== JSON.stringify(migrated)) {
              await AsyncStorage.setItem(KEYS.pilotProgress, JSON.stringify(migrated));
            }
          }
        }
        if (scoredHistory) {
          const parsedHistory = hydrateJsonEntry<unknown>(scoredHistory, [], KEYS.scoredPracticeHistory, hydrationFailure);
          const normalizedHistory = normalizeScoredPracticeHistory(parsedHistory);
          setScoredPracticeHistory(normalizedHistory);
          if (JSON.stringify(parsedHistory) !== JSON.stringify(normalizedHistory)) {
            if (normalizedHistory.length > 0) await AsyncStorage.setItem(KEYS.scoredPracticeHistory, JSON.stringify(normalizedHistory));
            else await AsyncStorage.removeItem(KEYS.scoredPracticeHistory);
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
      if (!enabled) await deleteAllBaselineAudioStrict();
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
        const privateConsent = { ...consent, saveCustomScenarioText: false };
        const sanitizedSessions = sessions.map((record) => sanitizeSessionForPersistence(record, privateConsent));
        const sanitizedRun = activeScenarioRun
          ? sanitizeActiveScenarioRunForPersistence(activeScenarioRun, privateConsent)
          : null;
        const sanitizedPracticeSession = activePracticeSession
          ? sanitizeActivePracticeSessionForPersistence(activePracticeSession, privateConsent)
          : null;
        setCustomScenarios([]);
        setSessions(sanitizedSessions);
        setActiveScenarioRun(sanitizedRun);
        setActivePracticeSession(sanitizedPracticeSession);
        await AsyncStorage.removeItem(KEYS.custom);
        await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(sanitizedSessions));
        if (sanitizedRun) await AsyncStorage.setItem(KEYS.activeScenarioRun, JSON.stringify(sanitizedRun));
        if (sanitizedPracticeSession) await AsyncStorage.setItem(KEYS.activePracticeSession, JSON.stringify(sanitizedPracticeSession));
      }
      setConsent((prev) => {
        const next = { ...prev, saveCustomScenarioText: enabled };
        AsyncStorage.setItem(KEYS.consent, JSON.stringify(next)).catch((e) =>
          safeLog("[store] consent save failed", errorShape(e)),
        );
        return next;
      });
    },
    [activePracticeSession, activeScenarioRun, consent, sessions],
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
    const privacySafeSession = protectedSession ? sanitizeActivePracticeSessionForPersistence(protectedSession, consent) : null;
    // Keep exact custom context only in memory for the current app run.
    setActivePracticeSession(protectedSession);
    try {
      if (privacySafeSession) await AsyncStorage.setItem(KEYS.activePracticeSession, JSON.stringify(privacySafeSession));
      else await AsyncStorage.removeItem(KEYS.activePracticeSession);
    } catch (e) {
      safeLog("[store] active practice session save failed", errorShape(e));
    }
  }, [activePracticeSession, consent]);

  /** Creates a run only when the durable active slot is empty. */
  const createActiveScenarioRunStrict = useCallback(async (value: PersistedScenarioPracticeRun): Promise<void> => {
    const normalized = await replaceActiveScenarioRunCAS(AsyncStorage, sanitizeActiveScenarioRunForPersistence(value, consent), null);
    setActiveScenarioRun(consent.saveCustomScenarioText ? normalized : (normalizeScenarioPracticeRun(value) ?? normalized));
  }, [consent]);

  /** Compare-and-swap writes a valid active run against the latest durable revision. */
  const replaceActiveScenarioRunStrict = useCallback(async (value: PersistedScenarioPracticeRun, expected: ActiveRunRevision | null): Promise<void> => {
    const normalized = await replaceActiveScenarioRunCAS(AsyncStorage, sanitizeActiveScenarioRunForPersistence(value, consent), expected);
    setActiveScenarioRun(consent.saveCustomScenarioText ? normalized : (normalizeScenarioPracticeRun(value) ?? normalized));
  }, [consent]);

  /** Strictly deletes retained run audio, then CAS-clears only the expected durable run. */
  const clearActiveScenarioRunStrict = useCallback(async (expected: ActiveRunRevision, afterPrivateCleanup?: () => Promise<void>): Promise<void> => {
    await clearActiveScenarioRunCAS(AsyncStorage, expected, async (current) => {
      await deleteBaselineAudioStrict(current.run.id);
    }, afterPrivateCleanup ? async () => afterPrivateCleanup() : undefined);
    setActiveScenarioRun(null);
  }, []);

  /** CAS-archives a mismatched/cross-practice run before opening the active slot. */
  const archiveActiveScenarioRunStrict = useCallback(async (expected: ActiveRunRevision): Promise<void> => {
    await archiveActiveScenarioRunCAS(AsyncStorage, expected);
    setActiveScenarioRun(null);
  }, []);

  const writePendingConvertedLessonCompletion = useCallback(async (record: ConvertedLessonProgress, expected: ActiveRunRevision): Promise<void> => {
    await writePendingConvertedCompletion(AsyncStorage, record, expected);
  }, []);

  const markPendingConvertedLessonPrivateContentDeleted = useCallback(async (expectedRunId: string): Promise<void> => {
    await markPendingPrivateContentDeleted(AsyncStorage, expectedRunId);
  }, []);

  const promotePendingConvertedLessonCompletion = useCallback(async (expectedRunId: string): Promise<void> => {
    const next = await promotePendingConvertedCompletion(AsyncStorage, expectedRunId);
    setConvertedLessonProgress(next);
  }, []);

  /** Clears one lesson's completion and any exact active rehearsal; deleted private content is never restored by Undo. */
  const resetConvertedLesson = useCallback(async (identity: {
    lessonId: ConvertedLessonProgress["lessonId"];
    moduleId: string;
    practiceId: string;
  }): Promise<ConvertedLessonProgress[]> => {
    const active = activeScenarioRun;
    if (active?.run.convertedModuleId === identity.moduleId && active.run.practiceId === identity.practiceId) {
      const expected = activeRunRevision(active);
      if (!expected) throw new Error("Active rehearsal identity is unavailable");
      await clearActiveScenarioRunStrict(expected);
    }
    const result = await resetConvertedLessonProgress(AsyncStorage, identity.lessonId);
    setConvertedLessonProgress(result.next);
    return result.removed;
  }, [activeScenarioRun, clearActiveScenarioRunStrict]);

  /** Restores only the minimized completion facts captured by a recent lesson reset. */
  const undoConvertedLessonReset = useCallback(async (
    lessonId: ConvertedLessonProgress["lessonId"],
    snapshot: readonly ConvertedLessonProgress[],
  ): Promise<void> => {
    const next = await restoreConvertedLessonProgress(AsyncStorage, lessonId, snapshot);
    setConvertedLessonProgress(next);
  }, []);

  /** Attach the active anonymous session when an account identity becomes available. */
  const associateActivePracticeSessionWithUser = useCallback(async (userId: string): Promise<void> => {
    if (!activePracticeSession) return;
    await saveActivePracticeSession(associatePracticeSessionUser(activePracticeSession, userId));
  }, [activePracticeSession, saveActivePracticeSession]);

  /** Persist a minimized session record. Content never reaches this function. */
  const upsertSession = useCallback(async (record: SessionRecord) => {
    const persistableRecord = sanitizeSessionForPersistence(record, consent);
    let snapshot: SessionRecord[] = [];
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === persistableRecord.id);
      const next =
        idx === -1 ? [persistableRecord, ...prev] : prev.map((s) => (s.id === persistableRecord.id ? persistableRecord : s));
      snapshot = capRecords(next);
      return snapshot;
    });
    try {
      await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(snapshot));
    } catch (e) {
      safeLog("[store] session save failed", errorShape(e));
    }
  }, [consent]);

  /** Delete one saved session, along with any recording kept for it. */
  const deleteSession = useCallback(async (id: string) => {
    await deleteBaselineAudioStrict(id);
    let snapshot: SessionRecord[] = [];
    setSessions((prev) => {
      snapshot = prev.filter((s) => s.id !== id);
      return snapshot;
    });
    clearLiveSessionContent(id);
    try {
      await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(snapshot));
    } catch (e) {
      safeLog("[store] session delete failed", errorShape(e));
    }
  }, []);

  /** Delete all practice history. Streaks derived from drills/days survive. */
  const deleteAllSessions = useCallback(async () => {
    await deleteAllBaselineAudioStrict();
    setSessions([]);
    clearLiveSessionContent();
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

  /** Persists one immutable scored result; duplicate rehearsal IDs are idempotent. */
  const saveScoredPracticeRecord = useCallback(async (record: ScoredPracticeRecord | null): Promise<void> => {
    if (!record) return;
    let snapshot: ScoredPracticeRecord[] = [];
    let changed = false;
    setScoredPracticeHistory((previous) => {
      snapshot = appendScoredPracticeRecord(previous, record);
      changed = snapshot.length !== previous.length;
      return snapshot;
    });
    if (!changed) return;
    try {
      await AsyncStorage.setItem(KEYS.scoredPracticeHistory, JSON.stringify(snapshot));
    } catch (e) {
      safeLog("[store] scored practice save failed", errorShape(e));
    }
  }, []);

  /** Wipe and verify app data, auth identities, refresh tokens, and audio caches. */
  const reset = useCallback(async () => {
    const nextAnonymousId = await resetAllDataStrict({
      storage: AsyncStorage,
      appKeys: [KEYS.activePracticeSession, ...Object.values(KEYS)],
      anonymousKey: KEYS.anonymousUserId,
      newAnonymousId: newAnonymousUserId,
      signOutSupabase: async () => {
        if (!supabase) return;
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) throw error;
      },
      logOutPurchases: clearPurchasesIdentity,
      deletePrivateAudio: deleteAllBaselineAudioStrict,
      deleteGeneratedVoiceCache: deleteGeneratedVoiceCacheStrict,
    });
    setProfile(null);
    setDevPro(false);
    setDevForceUnpaid(false);
    setSessions([]);
    setCustomScenarios([]);
    setDrillLog([]);
    setChallengeLog([]);
    setFreeze(DEFAULT_FREEZE);
    setConsent(DEFAULT_CONSENT);
    setMigrationNotice(false);
    setPilotProgress([]);
    setScoredPracticeHistory([]);
    setAnonymousUserId(nextAnonymousId);
    setActivePracticeSession(null);
    setActiveScenarioRun(null);
    setConvertedLessonProgress([]);
    setNativeJourneyStarted(false);
    clearLiveSessionContent();
    queryClient.clear();
    await Promise.allSettled([cancelDailyReminder(), cancelChallengeNudge()]);
  }, [queryClient]);

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
      const stableModuleId = module.module_id ?? moduleId;
      if (previous.some((entry) => module.practice_id ? entry.practiceId === module.practice_id : stableModuleId ? entry.moduleId === stableModuleId && !entry.practiceId : entry.day === module.day)) {
        snapshot = previous;
        return previous;
      }
      changed = true;
      const completedAt = Date.now();
      snapshot = [...previous, {
        curriculumVersion: module.practice_id ? REVIEW_CURRICULUM_VERSION : PILOT_PROGRAM.curriculum_version,
        ...(stableModuleId ? { moduleId: stableModuleId } : {}),
        ...(module.practice_id ? { practiceId: module.practice_id, contentVersion: module.content_version, legacyClassification: "practice_completion" as const } : {}),
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

  const completedPracticeIds = useMemo(() => completedReviewPracticeIds(pilotProgress), [pilotProgress]);

  const modularDoneIds = useMemo(
    () => new Set(CURRICULUM_MODULES.filter((module) => isInternalReviewModuleComplete(module.id, completedPracticeIds)).map((module) => module.id)),
    [completedPracticeIds],
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
    setDevForceUnpaid(false);
    try {
      await AsyncStorage.removeItem(KEYS.devForceUnpaid);
      if (enabled) await AsyncStorage.setItem(KEYS.devPro, "1");
      else await AsyncStorage.removeItem(KEYS.devPro);
    } catch (e) {
      safeLog("[store] dev entitlement save failed", errorShape(e));
    }
  }, []);

  const forceDevUnpaid = useCallback(async (): Promise<void> => {
    if (!__DEV__) return;
    setDevPro(false);
    setDevForceUnpaid(true);
    try {
      await AsyncStorage.removeItem(KEYS.devPro);
      await AsyncStorage.setItem(KEYS.devForceUnpaid, "1");
    } catch (e) {
      safeLog("[store] dev unpaid state save failed", errorShape(e));
    }
  }, []);

  const entitlement: Entitlement = __DEV__ && devForceUnpaid
    ? "free"
    : purchasedPro || (__DEV__ && devPro)
      ? "pro"
      : "free";

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
    devUnpaidEnabled: devForceUnpaid,
    toggleDevPro,
    forceDevUnpaid,
    challengeLog,
    challengeDoneDays,
    currentChallengeDay,
    markChallengeDayDone,
    pilotProgress,
    scoredPracticeHistory,
    saveScoredPracticeRecord,
    pilotDoneDays,
    modularDoneIds,
    completedPracticeIds,
    anonymousUserId,
    activePracticeSession,
    activeScenarioRun,
    convertedLessonProgress,
    nativeJourneyStarted,
    beginNativeJourney,
    saveActivePracticeSession,
    createActiveScenarioRunStrict,
    replaceActiveScenarioRunStrict,
    clearActiveScenarioRunStrict,
    archiveActiveScenarioRunStrict,
    writePendingConvertedLessonCompletion,
    markPendingConvertedLessonPrivateContentDeleted,
    promotePendingConvertedLessonCompletion,
    resetConvertedLesson,
    undoConvertedLessonReset,
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
