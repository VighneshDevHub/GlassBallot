"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminSession } from "@/hooks/useAdminSession";
import { adminLogin as loginAdmin } from "@/lib/api/auth";
import { toast } from "sonner";
import {
  Lock,
  ShieldCheck,
  KeyRound,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  ChevronLeft,
  Activity,
  FileCode,
  Building2,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicLayout } from "@/components/layouts/PublicLayout";

// Prevent static prerender issues — this page relies on client-side searchParams
// and login state (cookies / localStorage), which are only meaningful at request time.
export const dynamic = "force-dynamic";

const features = [
  { icon: KeyRound, text: "Shamir 2-of-3 threshold tally", color: "pastel-peach" },
  { icon: FileCode, text: "Hash-chained admin audit log", color: "pastel-lavender" },
  { icon: Database, text: "Two-books 1:1 reconciliation", color: "pastel-sky" },
  { icon: Activity, text: "Attack simulation & detection", color: "pastel-lime" },
];

const inputClass =
  "h-12 rounded-2xl bg-[#F5F5F4] border-[#EAEAE5] focus-visible:ring-2 focus-visible:ring-[#DAF39F] text-sm font-medium";

function AdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/admin";
  const { authenticated, setAuthenticated } = useAdminSession();

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authenticated) router.push(next);
  }, [authenticated, next, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Username and password are required");
      return;
    }
    setLoading(true);
    try {
      const res = await loginAdmin({
        username: username.trim(),
        password: password,
      });
      // The backend sets gb_admin_session + admin_session cookies via Set-Cookie.
      // We only store display info in localStorage — do NOT mint a fake token.
      setAuthenticated(true, null, {
        username: res.username ?? username.trim(),
        role: res.roles?.[0] ?? "ELECTION_OFFICER",
        email: res.email ?? undefined,
      });
      toast.success("Officer credentials verified");
      router.push(next);
    } catch (err) {
      toast.error((err as Error).message || "Invalid admin credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <section className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-6xl bg-white rounded-3xl shadow-soft border border-[#EAEAE5] overflow-hidden grid grid-cols-1 lg:grid-cols-5">
          {/* Illustration */}
          <div className="lg:col-span-2 p-8 md:p-10 !rounded-none hidden lg:flex flex-col justify-between" style={{ background: "linear-gradient(160deg, #243056 0%, #1a2547 60%, #0f1a3a 100%)" }}>
            <div className="space-y-8">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center group-hover:scale-105 transition-all border border-white/15">
                  <Lock className="w-5 h-5 text-[#DAF39F]" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="font-extrabold text-xl tracking-tight leading-none text-white">
                    GlassBallot
                  </div>
                  <div className="text-[11px] text-[#DAF39F]/80 mt-0.5">Officer Console</div>
                </div>
              </Link>
              <div className="space-y-4">
                <Badge
                  variant="outline"
                  className="bg-[#DAF39F]/10 border-[#DAF39F]/25 text-[#DAF39F] rounded-full text-[11px] font-bold px-3.5 py-1"
                >
                  <Sparkles className="w-3 h-3 mr-1 inline align-sub" /> Governance Access
                </Badge>
                <h2 className="text-3xl font-extrabold text-white leading-tight tracking-tight">
                  Returning Officer Authentication
                </h2>
                <p className="text-[14px] text-white/70 leading-relaxed">
                  Credentials for election lifecycle management, trustee threshold operations, and
                  security audit instrumentation. Strict Argon2id verification.
                </p>
              </div>
              <ul className="space-y-3">
                {features.map((f, i) => {
                  const I = f.icon;
                  return (
                    <li
                      key={i}
                      className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#DAF39F]/15 border border-[#DAF39F]/20 flex items-center justify-center shrink-0">
                          <I className="w-4 h-4 text-[#DAF39F]" />
                        </div>
                        <div className="text-[13px] font-semibold text-white/90 leading-snug pt-1">
                          {f.text}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="mt-10 pt-6 border-t border-white/10 flex items-center justify-between">
              <div className="text-[11px] text-white/50 font-mono">
                Argon2id • Ed25519 STH
                <br />
                Signed Admin Audit Chain
              </div>
              <div className="w-10 h-10 rounded-full bg-[#DAF39F]/15 border border-[#DAF39F]/25 shadow-card flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-[#DAF39F]" />
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-3 p-7 md:p-12 lg:p-14 flex flex-col justify-center">
            <div className="max-w-md w-full mx-auto space-y-8">
              <div>
                <Link
                  href="/auth"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5C7089] hover:text-[#202124] transition-colors mb-5"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to role select
                </Link>
                <h1 className="text-3xl md:text-4xl font-extrabold text-[#202124] tracking-tight leading-tight">
                  Sign in as Election Officer
                </h1>
                <p className="text-sm text-[#5C7089] mt-2.5">
                  Governance credentials for managing election phases, trustees, and security monitors.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-[#202124]">Officer Username</Label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C7089]" />
                    <Input
                      required
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="officer_username"
                      className={`${inputClass} pl-11`}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold text-[#202124]">Passphrase</Label>
                  </div>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C7089]" />
                    <Input
                      required
                      type={showPass ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`${inputClass} pl-11 pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5C7089] hover:text-[#202124]"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl pastel-card pastel-lavender !p-4 space-y-1.5">
                  <div className="flex items-start gap-2.5">
                    <Eye className="w-4 h-4 text-[#5B3D86] mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[12px] font-bold text-[#5B3D86]">Demo Credentials (Pre-filled)</div>
                      <div className="text-[12px] text-[#202124]/80 font-mono">
                        Username: <span className="font-black">admin</span> · Password:{" "}
                        <span className="font-black">admin123</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-2xl bg-[#243056] hover:bg-[#1a2547] text-white font-bold shadow-soft text-sm"
                >
                  {loading ? "Verifying credentials..." : "Authenticate as Officer"}
                  <ShieldCheck className="w-4 h-4 ml-2 text-[#DAF39F]" />
                </Button>
              </form>

              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#5C7089]">Forgotten officer credentials?</span>
                  <a
                    href="mailto:security@glassballot.local"
                    className="font-bold text-[#5C7089] hover:text-[#202124] underline-offset-2 hover:underline"
                  >
                    Contact Trustee Board →
                  </a>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#5C7089]">Not an officer?</span>
                  <Link
                    href="/auth/student/login"
                    className="font-bold text-[#243056] hover:underline underline-offset-2"
                  >
                    Student Voter login →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function AdminLoginFallback() {
  return (
    <section className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 sm:px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <Skeleton className="h-4 w-32 rounded-full" />
        <Skeleton className="h-10 w-4/5 rounded-2xl" />
        <Skeleton className="h-4 w-full rounded-full" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>
    </section>
  );
}

export default function AdminLogin() {
  return (
    <PublicLayout>
      <Suspense fallback={<AdminLoginFallback />}>
        <AdminLoginContent />
      </Suspense>
    </PublicLayout>
  );
}