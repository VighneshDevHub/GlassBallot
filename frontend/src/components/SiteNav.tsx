"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, Vote, CheckCircle2, Eye, Award, Lock, LayoutDashboard, UserCheck, KeyRound, ArrowRight, UserPlus, Zap, Users } from "lucide-react";

export function SiteNav() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Protocol", icon: Lock },
    { href: "/dashboard", label: "Student Hub", icon: LayoutDashboard },
    { href: "/vote", label: "Cast Ballot", icon: Vote },
    { href: "/verify", label: "Verifier", icon: CheckCircle2 },
    { href: "/trustees", label: "Trustees", icon: Users },
    { href: "/simulator", label: "Simulator", icon: Zap },
    { href: "/integrity", label: "Integrity", icon: ShieldCheck },
    { href: "/witnesses", label: "Witnesses", icon: Eye },
    { href: "/results", label: "Results", icon: Award },
    { href: "/admin", label: "Officer Console", icon: KeyRound },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200/90 text-slate-900 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo & Tagline */}
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 border border-teal-400 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-all">
            <Lock className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-black text-lg tracking-tight text-slate-900 group-hover:text-teal-700 transition-colors">
                GlassBallot
              </span>
              <span className="hidden lg:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                RGIT Mumbai 2026
              </span>
            </div>
            <span className="text-[10px] text-slate-700 font-medium tracking-wider uppercase hidden sm:block">
              Zero-Knowledge Academic Voting Protocol
            </span>
          </div>
        </Link>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto py-1 no-scrollbar">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  isActive
                    ? "bg-teal-50 text-teal-800 border border-teal-200/90 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-teal-700" : "text-slate-500"}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Auth CTA Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/login"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all"
          >
            <UserCheck className="w-3.5 h-3.5 text-slate-500" />
            <span>Sign In</span>
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-2xs hover:shadow-xs transition-all"
          >
            <UserPlus className="w-3.5 h-3.5 text-teal-100" />
            <span>Register</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
