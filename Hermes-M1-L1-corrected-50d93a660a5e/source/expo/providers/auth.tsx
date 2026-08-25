import createContextHook from "@nkzw/create-context-hook";
import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

import { identifyPurchasesUser } from "@/lib/purchases";
import { isAuthConfigured, supabase } from "@/lib/supabase";

interface LoginResult {
  success: boolean;
  message?: string;
  userId?: string;
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
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  const syncPurchases = useCallback(async (userId: string): Promise<void> => {
    const customerInfo = await identifyPurchasesUser(userId);
    if (customerInfo) queryClient.setQueryData(["rc", "customerInfo"], customerInfo);
  }, [queryClient]);

  useEffect(() => {
    if (!supabase) {
      setIsAuthLoading(false);
      return;
    }

    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      setIsAuthLoading(false);
      if (data.session?.user.id) void syncPurchases(data.session.user.id);
    }).catch(() => {
      if (isMounted) setIsAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsAuthLoading(false);
      if (nextSession?.user.id) void syncPurchases(nextSession.user.id);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [syncPurchases]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    if (!supabase) return { success: false, message: "Account login isn’t configured for this build." };
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) return { success: false, message: "Enter your email and password." };

    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error || !data.session) return { success: false, message: loginMessage(error?.message ?? "Login failed") };
    setSession(data.session);
    await syncPurchases(data.session.user.id);
    return { success: true, userId: data.session.user.id };
  }, [syncPurchases]);

  return {
    isAuthConfigured,
    isAuthLoading,
    session,
    user: (session?.user ?? null) as User | null,
    login,
  };
});
