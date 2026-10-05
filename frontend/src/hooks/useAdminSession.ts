"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Cookies from "js-cookie";
import { adminMe } from "@/lib/api/auth";
import type { AdminMeResponse } from "@/lib/api/auth";

const ADMIN_COOKIE = "gb_admin_session";
const FALLBACK_COOKIE = "admin_session";
const TOKEN_COOKIE = "admin_token";

interface AdminInfo {
  username: string;
  role?: string;
  email?: string | null;
}

export function useAdminSession() {
  const [authenticated, setAuthenticatedState] = useState<boolean>(false);
  const [user, setUser] = useState<AdminMeResponse | null>(null);
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const fetchingRef = useRef(false);

  const hasCookie = useCallback(() => {
    return !!(
      Cookies.get(ADMIN_COOKIE) ||
      Cookies.get(FALLBACK_COOKIE) ||
      Cookies.get(TOKEN_COOKIE) ||
      window.localStorage.getItem("admin_session")
    );
  }, []);

  const readInfoFromStorage = useCallback(() => {
    try {
      const saved = window.localStorage.getItem("admin_info");
      if (saved) setAdminInfo(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      // Always attempt /admin/me — the browser sends httpOnly cookies automatically.
      // Only skip if we're sure there's nothing (no JS-readable cookie AND no localStorage).
      readInfoFromStorage();
      const me = await adminMe();
      if (me && me.authenticated && me.user_id) {
        setAuthenticatedState(true);
        setUser(me);
        const info: AdminInfo = {
          username: me.username || "",
          role: me.roles?.[0],
          email: me.email,
        };
        setAdminInfo(info);
        window.localStorage.setItem("admin_info", JSON.stringify(info));
      } else {
        setAuthenticatedState(false);
        setUser(null);
        setAdminInfo(null);
      }
    } catch (err) {
      setAuthenticatedState(false);
      setUser(null);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [readInfoFromStorage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setAuthenticated = useCallback(
    (val: boolean, tok?: string | null, info?: AdminInfo | null) => {
      if (!val) {
        Cookies.remove(ADMIN_COOKIE, { path: "/" });
        Cookies.remove(FALLBACK_COOKIE, { path: "/" });
        Cookies.remove(TOKEN_COOKIE, { path: "/" });
        window.localStorage.removeItem("admin_session");
        window.localStorage.removeItem("admin_info");
        setAuthenticatedState(false);
        setUser(null);
        setAdminInfo(null);
        return;
      }
      if (tok) {
        Cookies.set(ADMIN_COOKIE, tok, { path: "/", expires: 1 });
        Cookies.set(TOKEN_COOKIE, tok, { path: "/", expires: 1 });
        window.localStorage.setItem("admin_session", tok);
      }
      if (info) {
        window.localStorage.setItem("admin_info", JSON.stringify(info));
        setAdminInfo(info);
      }
      setAuthenticatedState(true);
    },
    []
  );

  const clear = useCallback(() => {
    setAuthenticated(false);
  }, [setAuthenticated]);

  return { authenticated, user, loading, refresh, clear, setAuthenticated, adminInfo };
}
