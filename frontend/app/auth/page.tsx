"use client";

import Link from "next/link";
import {
  Lock,
  Vote,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  UserCircle,
  Building2,
  Sparkles,
} from "lucide-react";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AuthRoleSelect() {
  return (
    <PublicLayout>
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-4">
          <Badge
            variant="outline"
            className="bg-[#DAF39F]/40 border-[#DAF39F]/60 text-[#3E5A0E] rounded-full px-4 py-1.5 text-[12px] font-bold"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 inline align-sub" />
            Role-Based Access Control
          </Badge>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.1]">
            Choose your access portal.
          </h1>
          <p className="text-sm md:text-base text-[#5C7089]">
            GlassBallot enforces strict cryptographic privilege boundaries. Select the correct role for your credentials.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8 max-w-4xl mx-auto">
          {/* Student */}
          <Link href="/auth/student/login" className="group">
            <div className="pastel-card pastel-lime h-full group-hover:shadow-soft group-hover:-translate-y-0.5 transition-all p-7 md:p-8 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-white/70 flex items-center justify-center">
                  <UserCircle className="w-7 h-7 text-[#202124]" strokeWidth={2.2} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-extrabold text-[#202124] leading-tight">
                    Student Voter
                  </h2>
                  <p className="text-[14px] text-[#3E5A0E] leading-relaxed">
                    College ID + OTP authentication. Cast sealed ballots, verify proofs, and monitor election integrity.
                  </p>
                </div>
                <ul className="space-y-2">
                  {[
                    "Client-side sealed envelope voting",
                    "Ballot receipts + Merkle proofs",
                    "Personal voting dashboard",
                  ].map((x) => (
                    <li key={x} className="flex items-start gap-2 text-[13px] text-[#202124]/85">
                      <CheckCircle2 className="w-4 h-4 text-[#3E5A0E] mt-0.5 shrink-0" />
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-8 flex items-center justify-between pt-5 border-t border-[#202124]/10">
                <span className="text-sm font-bold text-[#202124]">Student Portal</span>
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-card group-hover:bg-[#202124] group-hover:text-white transition-all">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </Link>

          {/* Admin */}
          <Link href="/auth/admin/login" className="group">
            <div className="pastel-card pastel-lavender h-full group-hover:shadow-soft group-hover:-translate-y-0.5 transition-all p-7 md:p-8 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-white/70 flex items-center justify-center">
                  <Building2 className="w-7 h-7 text-[#5B3D86]" strokeWidth={2.2} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-extrabold text-[#202124] leading-tight">
                    Election Officer
                  </h2>
                  <p className="text-[14px] text-[#5B3D86]/90 leading-relaxed">
                    Credentialed returning officer access. Election phases, audit log, trustee tally, and attack simulator.
                  </p>
                </div>
                <ul className="space-y-2">
                  {[
                    "Govern election state machine",
                    "Trustee 2-of-3 threshold tally",
                    "Live audit & security simulation",
                  ].map((x) => (
                    <li key={x} className="flex items-start gap-2 text-[13px] text-[#202124]/85">
                      <CheckCircle2 className="w-4 h-4 text-[#5B3D86] mt-0.5 shrink-0" />
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-8 flex items-center justify-between pt-5 border-t border-[#202124]/10">
                <span className="text-sm font-bold text-[#202124]">Officer Console</span>
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-card group-hover:bg-[#202124] group-hover:text-white transition-all">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </Link>
        </div>

        <div className="text-center mt-14 text-xs text-[#5C7089]">
          <span className="font-semibold">New to GlassBallot?</span>{" "}
          <Link href="/auth/student/register" className="font-bold text-[#243056] underline underline-offset-2">
            Enroll as a student voter →
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
