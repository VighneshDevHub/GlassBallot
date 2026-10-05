"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useVoterSession } from "@/hooks/useVoterSession";
import { requestOTP, verifyOTP, requestDemoOTP } from "@/lib/api/auth";
import { toast } from "sonner";
import {
  Lock,
  Vote,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  UserCircle,
  Sparkles,
  Eye,
  FileCheck2,
  Fingerprint,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PublicLayout } from "@/components/layouts/PublicLayout";

export default function StudentLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const { authenticated, setAuthenticated } = useVoterSession();
  const [step, setStep] = useState<1 | 2>(1);
  const [studentId, setStudentId] = useState("RGIT26001");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<string>("");

  useEffect(() => {
    if (authenticated) router.push(next);
  }, [authenticated, next, router]);

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim()) {
      toast.error("Please enter your College ID");
      return;
    }
    setLoading(true);
    try {
      await requestOTP({ voter_id: studentId.trim() });
      const demo = await requestDemoOTP(studentId.trim());
      setGenerated(demo.otp || "");
      toast.success(demo.otp ? "OTP sent successfully! (Demo bypass enabled)" : "OTP requested — check your delivery channel.");
      setStep(2);
    } catch (err) {
      toast.error((err as Error).message || "Failed to request OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 4) {
      toast.error("Enter the 6-digit OTP");
      return;
    }
    setLoading(true);
    try {
      const res = await verifyOTP({
        voter_id: studentId.trim(),
        otp: otp.trim(),
      });
      const token = res.voter_session_token || (res as any).token || (res as any).voter_session_token;
      if (token) {
        // Store the token cookie with max-age matching the backend's 30-minute session
        // (do NOT set gb_voter_session here — the backend's Set-Cookie already does that)
        document.cookie = `voter_token=${token}; path=/; max-age=1800`;
      }
      setAuthenticated(true, token, {
        student_id: studentId.trim(),
        display_name: (res as any).voter_external_id || studentId.trim(),
      });
      toast.success("Voter authenticated successfully");
      router.push(next);
    } catch (err) {
      toast.error((err as Error).message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Vote, text: "Sealed envelope voting in your browser", color: "pastel-peach" },
    { icon: FileCheck2, text: "Merkle proof receipt & verification", color: "pastel-lavender" },
    { icon: Fingerprint, text: "Zero-link identity ↔ ballot design", color: "pastel-lime" },
    { icon: ShieldCheck, text: "4-Architectural-Lock guarantee", color: "pastel-sky" },
  ];

  return (
    <PublicLayout>
      <section className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-6xl bg-white rounded-3xl shadow-soft border border-[#EAEAE5] overflow-hidden grid grid-cols-1 lg:grid-cols-5">
          {/* Illustration panel */}
          <div className="lg:col-span-2 p-8 md:p-10 pastel-card pastel-lavender !rounded-none hidden lg:flex flex-col justify-between">
            <div className="space-y-8">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="w-11 h-11 rounded-2xl bg-white/70 flex items-center justify-center shadow-card group-hover:scale-105 transition-all">
                  <Lock className="w-5 h-5 text-[#202124]" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="font-extrabold text-xl tracking-tight leading-none">
                    GlassBallot
                  </div>
                  <div className="text-[11px] text-[#5B3D86] mt-0.5">Student Voting Protocol</div>
                </div>
              </Link>
              <div className="space-y-4">
                <Badge
                  variant="outline"
                  className="bg-white/60 border-white text-[#5B3D86] rounded-full text-[11px] font-bold px-3.5 py-1"
                >
                  <Sparkles className="w-3 h-3 mr-1 inline align-sub" /> Voter Portal
                </Badge>
                <h2 className="text-3xl font-extrabold text-[#202124] leading-tight tracking-tight">
                  Vote in 60 seconds. Verify for a lifetime.
                </h2>
                <p className="text-[14px] text-[#5B3D86]/85 leading-relaxed">
                  GlassBallot mathematically guarantees your ballot is counted — while cryptographically
                  ensuring no one can ever link the vote back to you.
                </p>
              </div>
              <ul className="space-y-3">
                {features.map((f, i) => {
                  const I = f.icon;
                  return (
                    <li key={i} className={`p-3.5 rounded-2xl ${f.color} bg-opacity-70`}>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-white/70 flex items-center justify-center shrink-0">
                          <I className="w-4 h-4 text-[#202124]" />
                        </div>
                        <div className="text-[13px] font-semibold text-[#202124] leading-snug pt-1">
                          {f.text}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="mt-10 pt-6 border-t border-[#5B3D86]/10 flex items-center justify-between">
              <div className="text-[11px] text-[#5B3D86]/70 font-mono">
                P-256 ECDH • AES-256-GCM
                <br />
                RFC 6962 • Shamir 2-of-3
              </div>
              <div className="w-10 h-10 rounded-full bg-white shadow-card flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-[#5B3D86]" />
              </div>
            </div>
          </div>

          {/* Form panel */}
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
                  Sign in as a Student Voter
                </h1>
                <p className="text-sm text-[#5C7089] mt-2.5">
                  {step === 1
                    ? "Enter your college ID. A one-time code will be issued against the eligibility register."
                    : "Verify the 6-digit OTP sent via demo secure channel."}
                </p>
              </div>

              {step === 1 ? (
                <form onSubmit={handleRequestOTP} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#202124]">College Student ID</label>
                    <div className="relative">
                      <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C7089]" />
                      <Input
                        type="text"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        placeholder="e.g. RGIT26001"
                        className="pl-11 h-12 rounded-2xl bg-[#F5F5F4] border-[#EAEAE5] focus-visible:ring-2 focus-visible:ring-[#DAF39F] text-sm font-medium"
                      />
                    </div>
                    <div className="rounded-2xl pastel-card pastel-lime !p-3.5 space-y-1.5">
                      <div className="flex items-start gap-2">
                        <Eye className="w-4 h-4 text-[#3E5A0E] mt-0.5 shrink-0" />
                        <div>
                          <div className="text-[12px] font-bold text-[#3E5A0E]">Demo Credentials</div>
                          <div className="text-[12px] text-[#202124]/80 font-mono">
                            Use <span className="font-black">RGIT26001</span> for the bypass flow
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-2xl bg-[#202124] hover:bg-[#2D2E33] text-white font-bold shadow-soft text-sm"
                  >
                    {loading ? "Issuing OTP token..." : "Request One-Time Code"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOTP} className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-[#202124]">6-Digit One-Time Code</label>
                      <button
                        type="button"
                        onClick={() => {
                          setStep(1);
                          setGenerated("");
                        }}
                        className="text-xs font-bold text-[#5C7089] hover:text-[#202124]"
                      >
                        Change College ID
                      </button>
                    </div>
                    <div className="relative">
                      <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C7089]" />
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="000000"
                        className="pl-11 h-14 rounded-2xl bg-[#F5F5F4] border-[#EAEAE5] focus-visible:ring-2 focus-visible:ring-[#DAF39F] text-center tracking-[0.5em] font-mono text-xl font-black"
                      />
                    </div>
                    {generated && (
                      <div className="rounded-2xl pastel-card pastel-peach !p-4 space-y-1">
                        <div className="flex items-start gap-2.5">
                          <Sparkles className="w-4 h-4 text-[#845913] mt-0.5 shrink-0" />
                          <div>
                            <div className="text-[12px] font-bold text-[#845913]">
                              Demo OTP Display (sticky-bypass)
                            </div>
                            <div className="font-mono text-2xl font-black text-[#202124] tracking-[0.2em] mt-1">
                              {generated}
                            </div>
                            <div className="text-[11px] text-[#202124]/70 mt-0.5">
                              Demo only — real elections use email/SMS.
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-2xl bg-[#DAF39F] hover:bg-[#C6E66C] text-[#202124] font-bold shadow-soft text-sm"
                  >
                    {loading ? "Verifying code..." : "Verify & Enter Voting Portal"}
                    <CheckCircle2 className="w-4 h-4 ml-2 text-[#3E5A0E]" />
                  </Button>
                </form>
              )}

              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#5C7089]">Need to enroll?</span>
                  <Link
                    href="/auth/student/register"
                    className="font-bold text-[#243056] hover:underline underline-offset-2"
                  >
                    Create a Voter Account →
                  </Link>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#5C7089]">Election Officer?</span>
                  <Link
                    href="/auth/admin/login"
                    className="font-bold text-[#5C7089] hover:text-[#202124] underline-offset-2 hover:underline"
                  >
                    Officer console →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
