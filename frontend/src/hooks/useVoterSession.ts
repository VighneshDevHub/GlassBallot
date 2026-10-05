"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Cookies from "js-cookie";
import { getVoterMe } from "@/lib/api/voter";
import type { VoterProfileResponse } from "@/lib/api/voter";

const VOTER_COOKIE = "gb_voter_session";
const FALLBACK_COOKIE = "voter_session";
const TOKEN_COOKIE = "voter_token";

interface VoterInfo {
  student_id: string;
  display_name: string;
  email?: string | null;
  department?: string | null;
  year?: string | null;
}

export function useVoterSession() {
  const [authenticated, setAuthenticatedState] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [voterInfo, setVoterInfo] = useState<VoterInfo | null>(null);
  const [voterProfile, setVoterProfile] = useState<VoterProfileResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const hasCookie = useCallback(() => {
    return !!(
      Cookies.get(VOTER_COOKIE) ||
      Cookies.get(FALLBACK_COOKIE) ||
      Cookies.get(TOKEN_COOKIE) ||
      window.localStorage.getItem("voter_session")
    );
  }, []);

  const readInfoFromStorage = useCallback(() => {
    try {
      const saved = window.localStorage.getItem("voter_info");
      if (saved) setVoterInfo(JSON.parse(saved));
    } catch {
      /* ignore */
    }
    const t = Cookies.get(VOTER_COOKIE) || Cookies.get(TOKEN_COOKIE) || window.localStorage.getItem("voter_session");
    if (t) setToken(t);
  }, []);

  const refresh = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      // Only call the backend if we have a real JS-readable cookie.
      // localStorage alone is not enough — the actual signed cookie must be present.
      const cookiePresent = !!(
        Cookies.get(VOTER_COOKIE) ||
        Cookies.get(FALLBACK_COOKIE) ||
        Cookies.get(TOKEN_COOKIE)
      );
      if (!cookiePresent) {
        // Clean up stale localStorage artefacts
        window.localStorage.removeItem("voter_session");
        window.localStorage.removeItem("voter_info");
        setAuthenticatedState(false);
        setVoterProfile(null);
        setToken(null);
        setVoterInfo(null);
        return;
      }
      readInfoFromStorage();
      const me = await getVoterMe();
      if (me && me.voter_id) {
        setAuthenticatedState(true);
        setVoterProfile(me);
        const info: VoterInfo = {
          student_id: me.voter_external_id,
          display_name: me.display_name,
          email: me.email,
          department: me.course,
          year: me.year,
        };
        setVoterInfo(info);
        window.localStorage.setItem("voter_info", JSON.stringify(info));
      } else {
        setAuthenticatedState(false);
        setVoterProfile(null);
      }
    } catch (err: unknown) {
      // On 401 — session expired. Clear everything silently.
      setAuthenticatedState(false);
      setVoterProfile(null);
      Cookies.remove(VOTER_COOKIE, { path: "/" });
      Cookies.remove(FALLBACK_COOKIE, { path: "/" });
      Cookies.remove(TOKEN_COOKIE, { path: "/" });
      window.localStorage.removeItem("voter_session");
      window.localStorage.removeItem("voter_info");
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [readInfoFromStorage]);

  useEffect(() => {
    refresh();
    // Poll at a reasonable 30-second interval (not 2s) to avoid hammering the backend
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  const setAuthenticated = useCallback(
    (val: boolean, tok?: string | null, info?: VoterInfo | null) => {
      if (!val) {
        Cookies.remove(VOTER_COOKIE, { path: "/" });
        Cookies.remove(FALLBACK_COOKIE, { path: "/" });
        Cookies.remove(TOKEN_COOKIE, { path: "/" });
        window.localStorage.removeItem("voter_session");
        window.localStorage.removeItem("voter_info");
        setAuthenticatedState(false);
        setVoterInfo(null);
        setVoterProfile(null);
        setToken(null);
        return;
      }
      if (tok) {
        // 30-minute expiry matching backend session token lifetime
        Cookies.set(VOTER_COOKIE, tok, { path: "/", expires: 1 / 48 });
        Cookies.set(TOKEN_COOKIE, tok, { path: "/", expires: 1 / 48 });
        window.localStorage.setItem("voter_session", tok);
        setToken(tok);
      }
      if (info) {
        window.localStorage.setItem("voter_info", JSON.stringify(info));
        setVoterInfo(info);
      }
      setAuthenticatedState(true);
    },
    []
  );

  const clear = useCallback(() => {
    setAuthenticated(false);
  }, [setAuthenticated]);

  return {
    hasSession: authenticated,
    authenticated,
    loading,
    clear,
    setAuthenticated,
    voterInfo,
    voterProfile,
    token,
    refresh,
  };
}
