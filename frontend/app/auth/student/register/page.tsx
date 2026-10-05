"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerVoter, requestDemoOTP, requestOTP } from "@/lib/api/auth";
import { toast } from "sonner";
import {
  Lock,
  Vote,
  ArrowRight,
  ShieldCheck,
  UserCircle,
  Sparkles,
  Eye,
  FileCheck2,
  Fingerprint,
  Mail,
  GraduationCap,
  Calendar,
  ChevronLeft,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function StudentRegister() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    student_id: "RGIT26001",
    display_name: "Siddharth Verma",
    email: "rgit26001@mctrgit.ac.in",
    department: "CSE",
    year_of_study: "FY",
  });

  const features = [
    { icon: Vote,        text: "Vote in under 60 seconds",                    color: "pastel-peach" },
    { icon: FileCheck2,  text: "Get a receipt you can verify publicly",       color: "pastel-lavender" },
    { icon: Fingerprint, text: "Your name is never linked to your vote",      color: "pastel-lime" },
    { icon: ShieldCheck, text: "Any tampering is automatically detected",     color: "pastel-sky" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await registerVoter({
        student_id: form.student_id.trim(),
        display_name: form.display_name.trim(),
        email: form.email.trim(),
        department: form.department,
        year_of_study: form.year_of_study,
      });
      try {
        await requestOTP({ voter_id: form.student_id.trim() });
      } catch { /* demo fallback */ }
      // res is the RegisterVoterResponse directly (http.ts unwraps the Envelope)
      const name = res?.display_name ?? form.display_name.trim();
      const sid  = res?.voter_external_id ?? form.student_id.trim();
      toast.success(`Enrolled ${name} (${sid}). Redirecting to OTP login...`);
      setTimeout(() => router.push("/auth/student/login"), 800);
    } catch (err) {
      toast.error((err as Error).message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "h-12 rounded-2xl bg-[#F5F5F4] border-[#EAEAE5] focus-visible:ring-2 focus-visible:ring-[#DAF39F] text-sm font-medium";

  return (
    <PublicLayout>
      <section className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-6xl bg-white rounded-3xl shadow-soft border border-[#EAEAE5] overflow-hidden grid grid-cols-1 lg:grid-cols-5">
          {/* Illustration */}
          <div className="lg:col-span-2 p-8 md:p-10 pastel-card pastel-sky !rounded-none hidden lg:flex flex-col justify-between">
            <div className="space-y-8">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="w-11 h-11 rounded-2xl bg-white/70 flex items-center justify-center shadow-card group-hover:scale-105 transition-all">
                  <Lock className="w-5 h-5 text-[#202124]" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="font-extrabold text-xl tracking-tight leading-none">GlassBallot</div>
                  <div className="text-[11px] text-[#1F5689] mt-0.5">Student Registration</div>
                </div>
              </Link>
              <div className="space-y-4">
                <Badge
                  variant="outline"
                  className="bg-white/60 border-white text-[#1F5689] rounded-full text-[11px] font-bold px-3.5 py-1"
                >
                  <Sparkles className="w-3 h-3 mr-1 inline align-sub" /> Voter Enrollment
                </Badge>
                <h2 className="text-3xl font-extrabold text-[#202124] leading-tight tracking-tight">
                  Register once. Vote securely.
                </h2>
                <p className="text-[14px] text-[#1F5689]/85 leading-relaxed">
                  We check you're on the eligible student list, then completely separate your 
                  identity from your ballot — so no one, including us, can ever see how you voted.
                </p>
              </div>
              <ul className="space-y-3">
                {features.map((f, i) => {
                  const I = f.icon;
                  return (
                    <li key={i} className={`p-3.5 rounded-2xl ${f.color}`}>
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
            <div className="mt-10 pt-6 border-t border-[#1F5689]/10 flex items-center justify-between">
              <div className="text-[11px] text-[#1F5689]/70 font-mono">
                One-time ballot token
                <br />
                Pseudonymized issuance
              </div>
              <div className="w-10 h-10 rounded-full bg-white shadow-card flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-[#1F5689]" />
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-3 p-7 md:p-10 lg:p-12 flex flex-col justify-center">
            <div className="max-w-md w-full mx-auto space-y-7">
              <div>
                <Link
                  href="/auth"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5C7089] hover:text-[#202124] transition-colors mb-5"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to role select
                </Link>
                <h1 className="text-3xl md:text-4xl font-extrabold text-[#202124] tracking-tight leading-tight">
                  Create your Voter Account
                </h1>
                <p className="text-sm text-[#5C7089] mt-2.5">
                  Verified against college rolls. All fields required.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-1">
                    <Label className="text-sm font-bold text-[#202124]">College Student ID</Label>
                    <div className="relative">
                      <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C7089]" />
                      <Input
                        required
                        value={form.student_id}
                        onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                        placeholder="RGIT26001"
                        className={`${inputClass} pl-11`}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 sm:col-span-1">
                    <Label className="text-sm font-bold text-[#202124]">Display Name</Label>
                    <div className="relative">
                      <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C7089]" />
                      <Input
                        required
                        value={form.display_name}
                        onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                        placeholder="Your Full Name"
                        className={`${inputClass} pl-11`}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-bold text-[#202124]">Institutional Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C7089]" />
                    <Input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="rgit@mctrgit.ac.in"
                      className={`${inputClass} pl-11`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-bold text-[#202124]">Department</Label>
                    <Select
                      value={form.department}
                      onValueChange={(v) => setForm({ ...form, department: v })}
                    >
                      <SelectTrigger className={inputClass}>
                        <SelectValue placeholder="Choose department" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl p-1 border-[#EAEAE5]">
                        {["CSE", "IT", "ECE", "EXTC", "AI/ML", "Mechanical", "Electrical"].map(
                          (d) => (
                            <SelectItem key={d} value={d} className="rounded-xl font-medium text-sm">
                              {d}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-bold text-[#202124]">Year of Study</Label>
                    <Select
                      value={form.year_of_study}
                      onValueChange={(v) => setForm({ ...form, year_of_study: v })}
                    >
                      <SelectTrigger className={inputClass}>
                        <SelectValue placeholder="Choose year" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl p-1 border-[#EAEAE5]">
                        {[
                          ["FY", "First Year"],
                          ["SY", "Second Year"],
                          ["TY", "Third Year"],
                          ["Final", "Final Year"],
                          ["PG", "Postgraduate"],
                        ].map(([v, l]) => (
                          <SelectItem key={v} value={v} className="rounded-xl font-medium text-sm">
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-2xl pastel-card pastel-lime !p-4 space-y-1.5">
                  <div className="flex items-start gap-2.5">
                    <Eye className="w-4 h-4 text-[#3E5A0E] mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[12px] font-bold text-[#3E5A0E]">Demo Quick-Start</div>
                      <div className="text-[12px] text-[#202124]/80 leading-relaxed">
                        Prefilled RGIT26001 / Siddharth Verma works with the bypass OTP flow. After registration
                        you'll be directed to complete OTP verification.
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-2xl bg-[#202124] hover:bg-[#2D2E33] text-white font-bold shadow-soft text-sm"
                >
                  {loading ? "Enrolling into Register..." : "Enroll as Voter"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>

              <div className="pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#5C7089]">Already enrolled?</span>
                  <Link
                    href="/auth/student/login"
                    className="font-bold text-[#243056] hover:underline underline-offset-2"
                  >
                    Sign in with OTP →
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
