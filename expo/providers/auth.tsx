import {nativeBilling} from '@/lib/nativeBillingRuntime';
import {normalResults} from '@/lib/normalResultsRuntime';
import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createOwnerPracticeStorage, type OwnerPracticeStorage } from "@/lib/ownerPracticeStorage";
import { createGuestContinuationRuntime } from "@/lib/guestContinuationRuntime";
import { Platform } from "react-native";
import { clearLiveSessionContent } from "@/lib/ephemeral";
import { createStagingPracticeAccess, type StagingPracticeAccess } from "@/lib/stagingPracticeAccess";
import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { accountLoginAllowed, createNativeSessionStarter } from "@/lib/nativeAuth";
import { identifyPurchasesUser } from "@/lib/purchases";
import { accountDeletionAvailable, cleanupDeletedAccountOwner, quarantineDeletedAccountOwner, checkReceiptlessAccountDeletionNotice, enrollReceiptlessDeletionNotice, receiptlessDeletionJournal } from "@/lib/accountLifecycleRuntime";
import {createReceiptlessDeletionCoordinator} from "@/lib/receiptlessDeletionJournal";
import { authEnvironment, isAuthConfigured, supabase } from "@/lib/supabase";
import { createStagingWebBridge, REVIEWED_STAGING_BRIDGE, type StagingWebBridge } from "@/lib/stagingWebBridge";
declare const require: ((name: string) => unknown) | undefined;

interface LoginResult {
  success: boolean;
  message?: string;
  userId?: string;
  continuationId?: string;
  continuationProblem?: boolean;
}

function loginMessage(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "That email and password don’t match an account.";
  if (normalized.includes("email not confirmed")) return "Confirm your email address before logging in.";
  if (normalized.includes("network") || normalized.includes("fetch")) return "We couldn’t reach your account. Check your connection and try again.";
  return "We couldn’t log you in. Check your details and try again.";
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [stagingPracticeAccess, setStagingPracticeAccess] = useState<StagingPracticeAccess>(null);
  useEffect(() => {
    const access = supabase && authEnvironment ? createStagingPracticeAccess({ developmentBuild: __DEV__, staging: authEnvironment.staging, authUrl: authEnvironment.url, key: authEnvironment.key, auth: supabase.auth }) : null;
    setStagingPracticeAccess(access);
    return () => access?.dispose();
  }, []);
  const [stagingWebBridge, setStagingWebBridge] = useState<StagingWebBridge>(null);
  useEffect(() => {
    const bridge = createStagingWebBridge({
      developmentBuild: __DEV__, reviewed: authEnvironment?.staging ? REVIEWED_STAGING_BRIDGE : null,
      auth: supabase?.auth ?? null, authUrl: authEnvironment?.url,
    });
    setStagingWebBridge(bridge);
    return () => bridge?.dispose();
  }, []);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const purchasesGeneration = useRef(0);
  const loginPending = useRef(false);
  const loginVerified = useRef(false);
  const loginCancelled = useRef(false);
  const authRevision = useRef(0);
  const [practiceOwner, setPracticeOwner] = useState<{ key: string; storage: OwnerPracticeStorage } | null>(null);
  const ownerRef = useRef<{ identity: string | null; guest: boolean; key: string; storage: OwnerPracticeStorage } | null>(null);
  const continuation = useMemo(() => createGuestContinuationRuntime(AsyncStorage, Platform.OS, JSON.stringify([authEnvironment?.url ?? "local", authEnvironment?.keychainService ?? "beforeyousayit.supabase"])), []);
  const [, setContinuationRevision] = useState(0);
  const [continuationIssue, setContinuationIssue] = useState("");
  const [restoredGuestContinuationId, setRestoredGuestContinuationId] = useState<string | null>(null);
  const presentationPending = useRef(false);
  const ownerGeneration = useRef(0);
  const logoutPending = useRef(false);
  const [logoutError, setLogoutError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [deletionNotice, setDeletionNotice] = useState("");
  const deniedOwners = useRef(new Set<string>());
  const journalReady=useRef(!accountDeletionAvailable);
  const mutations = useRef<Promise<unknown>>(Promise.resolve());
  const serializeMutation = useCallback(<Result,>(work:()=>Promise<Result>):Promise<Result> => {
    const next=mutations.current.then(work,work);mutations.current=next.catch(()=>{});return next;
  }, []);
  const ownerBlocked = useCallback((owner:string|null)=>Boolean(accountDeletionAvailable && owner && (deniedOwners.current.has(owner)||receiptlessDeletionJournal.blocked(owner))), []);
  const applySession = useCallback((next: Session | null, verifiedGuestSource?: OwnerPracticeStorage, deferPublication = false, preserveContinuation = false) => {
    if (logoutPending.current && next) return;
    if(next && !journalReady.current)return;
    const identity = next?.user.id ?? null;
    if (next && !next.user.is_anonymous) normalResults?.resume();
    else normalResults?.suspend();
    if (identity && ownerBlocked(identity)) return;
    const guest = next?.user.is_anonymous === true;
    if (!ownerRef.current || !ownerRef.current.storage.isActive() || ownerRef.current.identity !== identity || ownerRef.current.guest !== guest) {
      if (ownerRef.current && !verifiedGuestSource && !preserveContinuation) void Promise.resolve(continuation.invalidate()).catch(() => setContinuationIssue("Device handoff could not be cleared. Keep this device locked and retry sign out."));
      setContinuationIssue("");
      ownerRef.current?.storage.invalidate();
      setRestoredGuestContinuationId(null);
      clearLiveSessionContent();
      void queryClient.cancelQueries();
      queryClient.clear();
      // Signed-out practice is deliberately a new, unclaimed namespace. Old guest
      // and legacy shared records are quarantined, not relabeled as the next buyer.
      const key = `${authEnvironment?.url ?? "local"}:${identity ?? `unclaimed-${Date.now()}-${Math.random()}`}`;
      const owner = { identity, guest, key: `${key}:mount-${++ownerGeneration.current}`, storage: createOwnerPracticeStorage(AsyncStorage, key) };
      ownerRef.current = owner;
      if (verifiedGuestSource) continuation.bind(verifiedGuestSource, owner.storage);
      if (!deferPublication) setPracticeOwner(owner);
    }
    if (!deferPublication) setSession(next);
  }, [queryClient, continuation, ownerBlocked]);
  const ensureNativeSession = useMemo(() => createNativeSessionStarter(supabase?.auth ?? null), []);

  const syncPurchases = useCallback(async (nextSession: Session | null): Promise<void> => {
    const generation = ++purchasesGeneration.current;
    // Never turn a disposable Supabase guest into a registered RevenueCat ID.
    // Preserve the SDK's anonymous purchase identity until explicit account login.
    const userId = nextSession?.user.is_anonymous === true ? null : nextSession?.user.id ?? null;
    const pending = identifyPurchasesUser(userId);
    void queryClient.cancelQueries({ queryKey: ["rc", "customerInfo"] });
    // Notify mounted observers too: removing a query alone can leave old observer data.
    queryClient.setQueryData(["rc", "customerInfo"], null);
    queryClient.removeQueries({ queryKey: ["rc", "customerInfo"] });
    const customerInfo = await pending;
    if (generation !== purchasesGeneration.current) return;
    if (customerInfo) queryClient.setQueryData(["rc", "customerInfo"], customerInfo);
  }, [queryClient]);

  const quarantineDeletedOwner = useCallback((owner:string) => {
    deniedOwners.current.add(owner);
    quarantineDeletedAccountOwner(owner);
    if(ownerRef.current?.identity!==owner)return;
    ++purchasesGeneration.current;
    normalResults?.suspend();nativeBilling?.suspend();stagingWebBridge?.clear();stagingPracticeAccess?.invalidate();
    ownerRef.current.storage.invalidate();
    clearLiveSessionContent();void queryClient.cancelQueries();queryClient.clear();
    applySession(null,undefined,false,true);
  }, [applySession, queryClient, stagingWebBridge, stagingPracticeAccess]);
  const logoutAfterReceiptlessDeletion = useCallback((owner:string):Promise<LoginResult> => serializeMutation(async()=>{
    if(!supabase)return {success:true};
    const before=await supabase.auth.getSession();
    if(before.error)return {success:false};
    const sdkOwner=before.data.session?.user.id??null;
    if(sdkOwner && sdkOwner!==owner)return {success:true};
    if(ownerRef.current?.identity===owner)applySession(null,undefined,false,true);
    if(!sdkOwner)return {success:true};
    await syncPurchases(null);
    const readback=await supabase.auth.getSession();
    if(readback.error)return {success:false};
    if(readback.data.session?.user.id!==owner)return {success:true};
    const result=await supabase.auth.signOut({scope:"local"});
    if(result.error)return {success:false};
    const after=await supabase.auth.getSession();
    return {success:!after.error && after.data.session?.user.id!==owner};
  }), [applySession, serializeMutation, syncPurchases]);
  const lifecycleHooks=useRef({quarantineDeletedOwner,logoutAfterReceiptlessDeletion});
  lifecycleHooks.current={quarantineDeletedOwner,logoutAfterReceiptlessDeletion};
  const coordinator=useMemo(()=>accountDeletionAvailable?createReceiptlessDeletionCoordinator({
    journal:receiptlessDeletionJournal,
    check:owner=>checkReceiptlessAccountDeletionNotice(owner),
    enroll:owner=>enrollReceiptlessDeletionNotice(owner),
    quarantine:owner=>lifecycleHooks.current.quarantineDeletedOwner(owner),
    cleanup:cleanupDeletedAccountOwner,
    logout:owner=>lifecycleHooks.current.logoutAfterReceiptlessDeletion(owner),
    notice:setDeletionNotice,
  }):null, []);
  const initializeJournal=useCallback(async()=>{await coordinator?.initialize();journalReady.current=true;},[coordinator]);
  const checkAccountStatus=useCallback(async()=>{
    try{await initializeJournal();await coordinator?.check(ownerRef.current?.guest?null:ownerRef.current?.identity??null);}
    catch{setDeletionNotice('Protected account status could not be read. Unlock this device and check account status to retry.');}
  }, [coordinator,initializeJournal]);

  useEffect(() => {
    if (!supabase) {
      applySession(null);
      setIsAuthLoading(false);
      void syncPurchases(null);
      return;
    }

    let isMounted = true;
    const restoreRevision = authRevision.current;
    let restoring = true;
    (async()=>{await initializeJournal();return supabase!.auth.getSession();})().then(async ({ data, error }) => {
      if (!isMounted || authRevision.current !== restoreRevision) return;
      const restored = error || ownerBlocked(data.session?.user.id??null) ? null : data.session;
      applySession(restored, undefined, true);
      const lease = ownerRef.current?.storage;
      void checkAccountStatus();
      if (lease && restored?.user.is_anonymous === true) {
        try { await continuation.restore(lease); }
        catch {
          if (isMounted && authRevision.current === restoreRevision) setContinuationIssue("Device continuation could not be verified. No rehearsal was restarted or account practice overwritten. Continue an existing saved rehearsal if present. Original guest records remain separate; this screen cannot recover an unconfirmed save. An uncertain save is never retried automatically.");
        }
      } else if (lease && restored && continuation.durable) {
        let verifiedOwner: { id: string; email?: string | null } | null = null;
        try {
          const verified = await supabase!.auth.getUser(restored.access_token);
          const readback = await supabase!.auth.getSession();
          const user = verified.data.user;
          if (verified.error || readback.error || !user || user.is_anonymous === true || user.id !== restored.user.id
            || !user.email || readback.data.session?.user.id !== user.id
            || readback.data.session.access_token !== restored.access_token || authRevision.current !== restoreRevision) throw new Error("Account verification changed");
          verifiedOwner = { id: user.id, email: user.email };
        } catch {
          if (isMounted && authRevision.current === restoreRevision) {
          await serializeMutation(async()=>{
            if(!isMounted||authRevision.current!==restoreRevision||ownerRef.current?.identity!==restored.user.id)return;
            applySession(null);
            await syncPurchases(null);
            const live=await supabase!.auth.getSession();
            if(live.data.session?.user.id===restored.user.id)await supabase!.auth.signOut({scope:"local"}).catch(()=>{});
          });
          setContinuationIssue("Account could not be verified on this device. This uncertain save was not restored; sign in again before account practice is restored.");
          setIsAuthLoading(false);
          return;
          }
        }
        if (verifiedOwner) {
          try {
            const recovered = await continuation.resumeVerified(lease, verifiedOwner.email!.trim().toLowerCase());
            if (recovered && isMounted && authRevision.current === restoreRevision && lease.isActive()) setRestoredGuestContinuationId(JSON.parse(recovered).id);
          } catch {
            if (isMounted && authRevision.current === restoreRevision) setContinuationIssue("Device continuation could not be verified. No rehearsal was restarted or account practice overwritten. Continue an existing saved rehearsal if present. Original guest records remain separate; this screen cannot recover an unconfirmed save. An uncertain save is never retried automatically.");
          }
        }
      }
      if (!isMounted || authRevision.current !== restoreRevision || ownerRef.current?.storage !== lease || !lease?.isActive()) return;
      restoring = false;
      setPracticeOwner(ownerRef.current);
      setSession(ownerBlocked(restored?.user.id??null)?null:restored);
      setContinuationRevision(value => value + 1);
      setIsAuthLoading(false);
      if (!error) void syncPurchases(data.session);
    }).catch(() => {
      if (isMounted && authRevision.current === restoreRevision) { applySession(null); setIsAuthLoading(false); }
    }).finally(()=>{
      if(isMounted){restoring=false;setIsAuthLoading(false);}
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if(restoring)return;
      if(nextSession&&!journalReady.current){setTimeout(()=>{void checkAccountStatus();},0);return;}
      if(ownerBlocked(nextSession?.user.id??null)){
        setTimeout(()=>{void checkAccountStatus();},0);return;
      }
      ++authRevision.current;
      if (loginPending.current && !loginVerified.current) return;
      applySession(nextSession);setIsAuthLoading(false);
      if (!logoutPending.current) void syncPurchases(nextSession);
      if(nextSession)setTimeout(()=>{void checkAccountStatus();},0);
    });

    return () => {
      isMounted = false;
      // Intentionally invalidate the latest async generation, not a captured DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++purchasesGeneration.current;
      listener.subscription.unsubscribe();
      ownerRef.current?.storage.invalidate();
      continuation.dispose();
    };
  }, [applySession, syncPurchases, continuation, initializeJournal, checkAccountStatus, ownerBlocked, serializeMutation]);

  useEffect(() => {
    if(!coordinator)return;
    let appState: { addEventListener?: (type: string, listener: (state: string) => void) => { remove(): void } } | undefined;
    try { appState = typeof require === "function" ? (require("react-native") as { AppState?: typeof appState }).AppState : undefined; } catch { appState = undefined; }
    const subscription=appState?.addEventListener?.("change",state=>{if(state==="active")void checkAccountStatus();});
    const timer=setInterval(()=>{void checkAccountStatus();},30000);
    return ()=>{clearInterval(timer);subscription?.remove();coordinator.dispose();};
  }, [coordinator,checkAccountStatus]);

  const startNativeSession = useCallback(async () => {
    const before = authRevision.current;
    const result = await ensureNativeSession();
    if (logoutPending.current || before !== authRevision.current) return { success: false as const, message: "Account changed while starting practice. Please try again." };
    if (result.success) applySession(result.session);
    return result;
  }, [applySession, ensureNativeSession]);

  const login = useCallback(async (email: string, password: string, saveCurrentResult = false): Promise<LoginResult> => {
    if (!supabase) return { success: false, message: "Account login isn’t configured for this build." };
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) return { success: false, message: "Enter your email and password." };
    if (logoutPending.current) return { success: false, message: "Finish signing out before logging in." };
    try{await initializeJournal();}catch{return {success:false,message:"Protected account status could not be read. Unlock this device and retry."};}
    return serializeMutation(async()=>{
    if(!supabase)return {success:false,message:"Account login isn’t configured for this build."};
    if (loginPending.current) return { success: false, message: "A login is already in progress." };
    loginPending.current = true;
    loginCancelled.current = false;
    try {
      const consentSource = saveCurrentResult && ownerRef.current?.guest ? ownerRef.current.storage : undefined;
      if (saveCurrentResult) {
        if (!consentSource || !continuation.pending(consentSource)) return { success: false, message: "This current rehearsal is no longer available to save. No account data was changed." };
        await continuation.prepare(consentSource, normalizedEmail);
      }
      let current = await supabase.auth.getSession();
      if (current.error) return { success: false, message: "We couldn’t verify the current account. Please try again." };
      if(ownerBlocked(current.data.session?.user.id??null)){
        const signedOut=await supabase.auth.signOut({scope:"local"});
        current=await supabase.auth.getSession();
        if(signedOut.error||current.error||current.data.session)return {success:false,message:"Deleted account sign out could not be confirmed. Unlock this device and retry."};
      }
      if (!accountLoginAllowed(current.data.session?.user ?? null, normalizedEmail)) {
        return { success: false, message: "This device has another account’s practice. Switching accounts isn’t available yet; continue with the current account." };
      }
      if (loginCancelled.current) return { success: false, message: "Login cancelled. Your rehearsal was not attached." };
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (loginCancelled.current) return { success: false, message: "Login cancelled. Your rehearsal was not attached." };
      if (error || !data.session) return { success: false, message: loginMessage(error?.message ?? "Login failed") };
      if (logoutPending.current) return { success: false, message: "Signing out." };
      const revision = authRevision.current;
      const verified = await supabase!.auth.getUser(data.session.access_token);
      const readback = await supabase!.auth.getSession();
      const owner = verified.data.user;
      if (loginCancelled.current) return { success: false, message: "Login cancelled. Your rehearsal was not attached." };
      if (verified.error || readback.error || !owner || owner.is_anonymous === true
        || owner.id !== data.session.user.id || owner.email?.trim().toLowerCase() !== normalizedEmail
        || readback.data.session?.user.id !== owner.id
        || readback.data.session?.access_token !== data.session.access_token
        || revision !== authRevision.current || logoutPending.current) {
        applySession(null);
        await syncPurchases(null);
        return { success: false, message: "We couldn’t verify this account after login. No guest practice was attached. Please log in again." };
      }
      if (ownerBlocked(owner.id)) {
        setTimeout(()=>{void checkAccountStatus();},0);
        return {success:false,message:"This account has been deleted. Check account status to finish device cleanup."};
      }
      if(accountDeletionAvailable)void enrollReceiptlessDeletionNotice(owner.id);
      const guestSource = saveCurrentResult ? consentSource : undefined;
      applySession(data.session, guestSource, saveCurrentResult);
      loginVerified.current = true;
      const verifiedLease = ownerRef.current?.storage;
      await syncPurchases(data.session);
      if (revision !== authRevision.current || ownerRef.current?.storage !== verifiedLease || !verifiedLease?.isActive()) {
        await continuation.invalidate();
        return { success: false, message: "Account changed after verification. No continuation is available; log in again." };
      }
      let continuationId: string | undefined;
      let continuationProblem = false;
      if (saveCurrentResult && verifiedLease) {
        try {
          const raw = await continuation.claim(verifiedLease);
          continuationId = (JSON.parse(raw) as { id: string }).id;
          if (continuation.durable) setRestoredGuestContinuationId(continuationId);
        } catch {
          continuationProblem = true;
          setContinuationIssue("You are signed in, but saving this rehearsal was not confirmed. Existing account practice was not overwritten. Retry if offered, or continue the saved rehearsal if it is present. This save did not restart the assessment; an unconfirmed write cannot be retried safely.");
        }
        if (revision !== authRevision.current || ownerRef.current?.storage !== verifiedLease || !verifiedLease.isActive()) {
          await continuation.invalidate();
          return { success: false, message: "Account changed while saving. Continue only after logging in again." };
        }
        // Hydrate only after the single-key claim settles, never race a mounted
        // account store reading an empty slot against the transfer commit.
        setPracticeOwner(ownerRef.current);
        setSession(data.session);
      }
      return { success: true, userId: data.session.user.id, continuationId, continuationProblem };
    } catch {
      return { success: false, message: "We couldn’t reach your account. Check your connection and try again." };
    } finally {
      loginVerified.current = false;
      loginPending.current = false;
    }
    });
  }, [applySession, syncPurchases, continuation, initializeJournal, serializeMutation, ownerBlocked, checkAccountStatus]);

  const cancelLogin = useCallback(() => {
    if (!loginPending.current) return;
    loginCancelled.current = true;
    void continuation.cancelConsent().catch(() => setContinuationIssue("Cancelled login, but device handoff revocation was not confirmed. Retry sign out before leaving this device."));
    ++authRevision.current;
    if (loginVerified.current) applySession(null);
  }, [applySession, continuation]);

  const logout = useCallback((): Promise<LoginResult> => serializeMutation(async()=>{
    if (loginPending.current) return { success: false, message: "Wait for login to finish, then sign out." };
    if (isLoggingOut) return { success: false, message: "Signing out." };
    setIsLoggingOut(true);
    setLogoutError("");
    logoutPending.current = true;
    normalResults?.suspend();
    nativeBilling?.suspend();
    ++authRevision.current;
    stagingWebBridge?.clear();
    stagingPracticeAccess?.invalidate();
    applySession(null);
    try {
      await continuation.invalidate();
      await syncPurchases(null);
      if (supabase) {
        const result = await supabase.auth.signOut({ scope: "local" });
        if (result.error) throw result.error;
        const current = await supabase.auth.getSession();
        if (current.error || current.data.session) throw new Error("Sign out not confirmed");
      }
      logoutPending.current = false;
      return { success: true };
    } catch {
      // Remain quarantined on failure; the visible control permits another try.
      const message = "Sign out could not be confirmed. Practice is locked; try signing out again.";
      setLogoutError(message);
      return { success: false, message };
    } finally {
      setIsLoggingOut(false);
    }
  }), [applySession, isLoggingOut, stagingPracticeAccess, stagingWebBridge, syncPurchases, continuation, serializeMutation]);

  const beginCurrentGuestPractice = useCallback(async (source: OwnerPracticeStorage, id: string) => {
    if (ownerRef.current?.guest && ownerRef.current.storage === source && source.isActive()) await continuation.begin(source, id);
  }, [continuation]);
  const sealCurrentGuestPractice = useCallback(async (source: OwnerPracticeStorage, id: string) => {
    if (!ownerRef.current?.guest || ownerRef.current.storage !== source || !source.isActive()) return;
    await continuation.seal(source, id);
    setContinuationRevision(value => value + 1);
  }, [continuation]);
  const acknowledgeGuestContinuation = useCallback(async (id: string) => {
    const lease=ownerRef.current?.storage;
    if (!lease || ownerRef.current?.guest || presentationPending.current || id !== restoredGuestContinuationId) return;
    presentationPending.current=true;
    try {
      await continuation.acknowledge(lease,id);
      if (ownerRef.current?.storage === lease && lease.isActive()) setRestoredGuestContinuationId(null);
    } catch {
      setContinuationIssue("Your saved rehearsal is present, but finishing device handoff cleanup was not confirmed. Keep this device secure; retry sign out to clear the handoff.");
    } finally {presentationPending.current=false;}
  }, [continuation, restoredGuestContinuationId]);
  const stageCurrentGuestAssessment = useCallback(async (source: OwnerPracticeStorage, id: string, raw: string) => {
    if (ownerRef.current?.guest && ownerRef.current.storage === source && source.isActive()) {
      try { await continuation.stageApproval(source, id, raw); }
      catch {
        // A failed optional handoff must not discard an already generated result.
        // Revoke synchronously (including source observers) before the ordinary
        // owner-scoped write. Even a failed tombstone leaves old proof unable to
        // authorize the changed source; never create a plaintext capability.
        try { await continuation.invalidate(); } catch { /* secure device remains unavailable */ }
        setContinuationIssue("Device handoff is unavailable. Your assessment can still be saved as separate guest practice on this device, but cannot be attached to an account. No plaintext transfer capability was created.");
        setContinuationRevision(value => value + 1);
      }
    }
  }, [continuation]);
  const attachCurrentGuestPractice = useCallback(async (destination: OwnerPracticeStorage) => {
    if (ownerRef.current?.storage !== destination || ownerRef.current.guest || logoutPending.current || loginPending.current) throw new Error("Verified account changed");
    try {
      const raw = await continuation.claim(destination);
      setContinuationIssue("");
      if (continuation.durable) setRestoredGuestContinuationId(JSON.parse(raw).id);
      return raw;
    }
    finally { setContinuationRevision(value => value + 1); }
  }, [continuation]);

  return {
    deletionNotice,
    checkAccountStatus,
    accountStatusAvailable: accountDeletionAvailable,
    cancelLogin,
    continuationIssue,
    durableGuestContinuation: continuation.durable,
    restoredGuestContinuationId,
    acknowledgeGuestContinuation,
    beginCurrentGuestPractice,
    sealCurrentGuestPractice,
    stageCurrentGuestAssessment,
    attachCurrentGuestPractice,
    hasCurrentGuestPractice: Boolean(practiceOwner && continuation.pending(practiceOwner.storage)),
    canAttachCurrentGuestPractice: Boolean(practiceOwner && continuation.available(practiceOwner.storage)),
    practiceOwner,
    stagingPracticeAccess,
    logout,
    // Confirmed deletion receipts use the same serialized exact-SDK-owner
    // boundary as receiptless cleanup; never sign out a later account.
    logoutDeletedOwner: logoutAfterReceiptlessDeletion,
    logoutError,
    isLoggingOut,
    stagingWebBridge,
    normalResults,
    isAuthConfigured,
    isAuthLoading,
    session,
    // Existing consumers use `user` to mean a registered account, not guest auth.
    user: (session?.user.is_anonymous === true ? null : session?.user ?? null) as User | null,
    login,
    startNativeSession,
  };
});
