"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Lock,
  Vote,
  Search,
  Award,
  ShieldCheck,
  UserPlus,
  LogIn,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  FileCheck2,
  Zap,
  Layers,
  Activity,
  KeyRound,
  FileText,
  BarChart3,
  HelpCircle,
  Eye,
  Sparkles,
  LayoutDashboard,
  LogOut,
  User,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useVoterSession } from "@/hooks/useVoterSession";
import { useAdminSession } from "@/hooks/useAdminSession";
import { cn } from "@/lib/utils";

function scrollTo(id: string) {
  const el = document.getElementById(id.replace("#", ""));
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const isHome = pathname === "/";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { authenticated: isVoter, voterInfo, clear: clearVoter } = useVoterSession();
  const { authenticated: isAdmin, adminInfo, clear: clearAdmin } = useAdminSession();

  const isLoggedIn = isVoter || isAdmin;
  const showLoggedIn = mounted && isLoggedIn;
  const displayName = isVoter
    ? (voterInfo?.display_name || "Student Voter")
    : (adminInfo?.username || "Officer Console");
  const subDetail = isVoter
    ? (voterInfo?.student_id ? `Roll #${voterInfo.student_id}` : (voterInfo?.department || "Student"))
    : (adminInfo?.role || "Administrator");
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || (isVoter ? "SV" : "AD");
  const dashboardUrl = isVoter ? "/dashboard" : "/admin";

  const handleLogout = () => {
    if (isVoter) clearVoter();
    if (isAdmin) clearAdmin();
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-[#202124] flex flex-col">

      {/* ── TOP NAV (Floating Modern Capsule) ────────────────── */}
      <header className="sticky top-0 z-50 pt-2 sm:pt-3 px-3 sm:px-6 transition-all">
        <div className="max-w-6xl mx-auto h-14 sm:h-15 rounded-full bg-white/90 backdrop-blur-2xl border border-[#EAEAE5] shadow-[0_8px_30px_rgb(0,0,0,0.06)] px-3.5 sm:px-5 flex items-center justify-between gap-3 transition-all">

          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#DAF39F] to-[#C6E66C] border border-[#BCE163] flex items-center justify-center shadow-soft group-hover:scale-105 group-hover:rotate-1 transition-all">
              <Lock className="w-4 h-4 text-[#202124]" strokeWidth={2.5} />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base sm:text-lg tracking-tight text-[#202124] group-hover:text-[#3E5A0E] transition-colors leading-none">
                GlassBallot
              </span>
              <span className="hidden xl:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#DAF39F]/50 text-[#3E5A0E] text-[10px] font-black border border-[#DAF39F]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF7A] animate-pulse" />
                RGIT 2026
              </span>
            </div>
          </Link>

          {/* Center Segmented Island Navigation */}
          {isHome ? (
            <nav className="hidden lg:flex items-center bg-[#F5F5F4]/90 border border-[#EAEAE5] rounded-full p-1 shadow-2xs">
              {/* How it works */}
              <button
                onClick={() => scrollTo("how-it-works")}
                className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold text-[#5C7089] hover:text-[#202124] hover:bg-white transition-all"
              >
                How It Works
              </button>

              {/* Try Demo button with badge */}
              <button
                onClick={() => scrollTo("interactive-demo")}
                className="whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-[#202124] bg-white border border-[#EAEAE5] shadow-2xs hover:border-[#DAF39F] transition-all"
              >
                <Sparkles className="w-3 h-3 text-[#3E5A0E] fill-[#DAF39F]" />
                Try Demo
              </button>

              {/* Why GlassBallot */}
              <button
                onClick={() => scrollTo("comparison")}
                className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold text-[#5C7089] hover:text-[#202124] hover:bg-white transition-all"
              >
                Why GlassBallot
              </button>

              {/* Who It's For (Stakeholders) */}
              <button
                onClick={() => scrollTo("portals")}
                className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold text-[#5C7089] hover:text-[#202124] hover:bg-white transition-all"
              >
                Who It's For
              </button>

              {/* Independent Watchdogs */}
              <button
                onClick={() => scrollTo("witnesses-status")}
                className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold text-[#5C7089] hover:text-[#202124] hover:bg-white transition-all"
              >
                Watchdogs
              </button>

              {/* Portals Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="whitespace-nowrap inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-[#5C7089] hover:text-[#202124] hover:bg-white transition-all outline-none">
                    Portals <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56 p-1.5 rounded-2xl bg-white border border-[#EAEAE5] shadow-soft">
                  <DropdownMenuLabel className="text-[10px] font-black uppercase text-[#9AA7B8] tracking-wider px-2 py-1">
                    Direct Portals
                  </DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/vote"
                      className="rounded-xl px-2.5 py-2 text-xs font-bold text-[#202124] hover:bg-[#F5F5F4] cursor-pointer flex items-center gap-2"
                    >
                      <Vote className="w-3.5 h-3.5 text-[#3E5A0E]" />
                      <div>
                        <div>Voting Booth</div>
                        <div className="text-[10px] font-normal text-[#5C7089]">Cast your sealed ballot</div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/dashboard"
                      className="rounded-xl px-2.5 py-2 text-xs font-bold text-[#202124] hover:bg-[#F5F5F4] cursor-pointer flex items-center gap-2"
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-[#5B3D86]" />
                      <div>
                        <div>Student Hub</div>
                        <div className="text-[10px] font-normal text-[#5C7089]">View your digital receipts</div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/results"
                      className="rounded-xl px-2.5 py-2 text-xs font-bold text-[#202124] hover:bg-[#F5F5F4] cursor-pointer flex items-center gap-2"
                    >
                      <Award className="w-3.5 h-3.5 text-[#1F5689]" />
                      <div>
                        <div>Election Results</div>
                        <div className="text-[10px] font-normal text-[#5C7089]">Certified outcome tally</div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/admin"
                      className="rounded-xl px-2.5 py-2 text-xs font-bold text-[#202124] hover:bg-[#F5F5F4] cursor-pointer flex items-center gap-2"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-[#845913]" />
                      <div>
                        <div>Officer Console</div>
                        <div className="text-[10px] font-normal text-[#5C7089]">Election management</div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* FAQ link */}
              <button
                onClick={() => scrollTo("faq")}
                className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold text-[#5C7089] hover:text-[#202124] hover:bg-white transition-all"
              >
                FAQ
              </button>
            </nav>
          ) : (
            /* Sub-page Desktop Navigation */
            <nav className="hidden lg:flex items-center bg-[#F5F5F4]/90 border border-[#EAEAE5] rounded-full p-1 shadow-2xs">
              <Link
                href="/"
                className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold text-[#5C7089] hover:text-[#202124] hover:bg-white transition-all"
              >
                Home
              </Link>
              <Link
                href="/vote"
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  pathname.startsWith("/vote")
                    ? "bg-white text-[#202124] shadow-2xs border border-[#EAEAE5]"
                    : "text-[#5C7089] hover:text-[#202124] hover:bg-white"
                }`}
              >
                Cast Ballot
              </Link>
              <Link
                href="/verify"
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  pathname.startsWith("/verify")
                    ? "bg-white text-[#202124] shadow-2xs border border-[#EAEAE5]"
                    : "text-[#5C7089] hover:text-[#202124] hover:bg-white"
                }`}
              >
                Verify
              </Link>
              <Link
                href="/results"
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  pathname.startsWith("/results")
                    ? "bg-white text-[#202124] shadow-2xs border border-[#EAEAE5]"
                    : "text-[#5C7089] hover:text-[#202124] hover:bg-white"
                }`}
              >
                Results
              </Link>
              <Link
                href="/integrity"
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  pathname.startsWith("/integrity")
                    ? "bg-white text-[#202124] shadow-2xs border border-[#EAEAE5]"
                    : "text-[#5C7089] hover:text-[#202124] hover:bg-white"
                }`}
              >
                Integrity
              </Link>
            </nav>
          )}

          {/* Right Action CTAs */}
          <div className="flex items-center gap-2">
            {/* Quick verify button */}
            <Link
              href="/verify/0"
              className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-[#5C7089] hover:text-[#202124] hover:bg-[#F5F5F4] transition-all whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5 text-[#9AA7B8]" />
              Verify
            </Link>

            {showLoggedIn ? (
              <>
                {/* Direct Dashboard Link */}
                <Link
                  href={dashboardUrl}
                  className="whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-[#202124] bg-[#DAF39F] hover:bg-[#C6E66C] border border-[#BCE163] shadow-soft transition-all"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-[#202124]" />
                  <span>{isVoter ? "Dashboard" : "Admin Panel"}</span>
                </Link>

                {/* Profile Avatar & Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="whitespace-nowrap shrink-0 flex items-center gap-2 py-1 px-1.5 sm:pr-2.5 rounded-full bg-[#F5F5F4] hover:bg-white border border-[#EAEAE5] transition-all shadow-2xs outline-none group cursor-pointer"
                      title={displayName}
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#202124] to-[#3B3D44] text-[#DAF39F] flex items-center justify-center font-black text-[11px] shadow-2xs shrink-0">
                        {initials}
                      </div>
                      <div className="hidden sm:flex flex-col text-left leading-none max-w-[100px]">
                        <span className="font-bold text-xs text-[#202124] truncate">{displayName}</span>
                        <span className="text-[10px] text-[#5C7089] truncate">{subDetail}</span>
                      </div>
                      <ChevronDown className="w-3 h-3 text-[#5C7089] group-hover:text-[#202124] transition-colors shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl bg-white border border-[#EAEAE5] shadow-xl">
                    {/* User Profile Card Header */}
                    <div className="flex items-center gap-2.5 px-2.5 py-2.5 mb-1.5 rounded-xl bg-[#F5F5F4]/80 border border-[#EAEAE5]">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#202124] to-[#3B3D44] text-[#DAF39F] flex items-center justify-center font-black text-xs shadow-2xs shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-[#202124] truncate">{displayName}</div>
                        <div className="text-[10px] text-[#5C7089] truncate flex items-center gap-1.5 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF7A]" />
                          <span>{subDetail}</span>
                        </div>
                      </div>
                    </div>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem asChild>
                      <Link
                        href={dashboardUrl}
                        className="rounded-xl px-2.5 py-2 text-xs font-bold text-[#202124] hover:bg-[#F5F5F4] cursor-pointer flex items-center gap-2.5"
                      >
                        <LayoutDashboard className="w-4 h-4 text-[#3E5A0E]" />
                        <div>
                          <div>{isVoter ? "Student Dashboard" : "Officer Console"}</div>
                          <div className="text-[10px] font-normal text-[#5C7089]">View your status & receipts</div>
                        </div>
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem asChild>
                      <Link
                        href="/vote"
                        className="rounded-xl px-2.5 py-2 text-xs font-bold text-[#202124] hover:bg-[#F5F5F4] cursor-pointer flex items-center gap-2.5"
                      >
                        <Vote className="w-4 h-4 text-[#1F5689]" />
                        <div>
                          <div>Voting Booth</div>
                          <div className="text-[10px] font-normal text-[#5C7089]">Browse elections & cast vote</div>
                        </div>
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem asChild>
                      <Link
                        href="/verify/0"
                        className="rounded-xl px-2.5 py-2 text-xs font-bold text-[#202124] hover:bg-[#F5F5F4] cursor-pointer flex items-center gap-2.5"
                      >
                        <Search className="w-4 h-4 text-[#5B3D86]" />
                        <div>
                          <div>Audit Receipt</div>
                          <div className="text-[10px] font-normal text-[#5C7089]">Verify ballot inclusion</div>
                        </div>
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem asChild>
                      <Link
                        href="/results"
                        className="rounded-xl px-2.5 py-2 text-xs font-bold text-[#202124] hover:bg-[#F5F5F4] cursor-pointer flex items-center gap-2.5"
                      >
                        <Award className="w-4 h-4 text-[#845913]" />
                        <div>
                          <div>Election Results</div>
                          <div className="text-[10px] font-normal text-[#5C7089]">Live outcome & audit proofs</div>
                        </div>
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="rounded-xl px-2.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer flex items-center gap-2.5 focus:bg-red-50 focus:text-red-700"
                    >
                      <LogOut className="w-4 h-4 text-red-500" />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                {/* Sign in */}
                <Link
                  href="/auth/student/login"
                  className="hidden sm:inline-flex whitespace-nowrap shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-[#202124] bg-[#F5F5F4] hover:bg-white border border-[#EAEAE5] transition-all shadow-2xs"
                >
                  <LogIn className="w-3.5 h-3.5 text-[#5C7089]" />
                  <span>Sign in</span>
                </Link>

                {/* Register */}
                <Link href="/auth/student/register" className="shrink-0 whitespace-nowrap">
                  <Button className="rounded-full bg-[#202124] hover:bg-[#2D2E33] text-white shadow-soft text-xs font-bold px-4 h-9 flex items-center gap-1.5 group transition-all whitespace-nowrap shrink-0">
                    <UserPlus className="w-3.5 h-3.5 text-[#DAF39F] group-hover:scale-110 transition-transform" />
                    <span>Register</span>
                  </Button>
                </Link>
              </>
            )}

            {/* Mobile Hamburger */}
            <button
              className="lg:hidden p-2 rounded-full text-[#5C7089] hover:text-[#202124] hover:bg-[#F5F5F4] border border-[#EAEAE5] transition-all"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Dropdown Floating Sheet */}
        {mobileOpen && (
          <div className="lg:hidden max-w-6xl mx-auto mt-2 rounded-3xl border border-[#EAEAE5] bg-white/95 backdrop-blur-2xl px-5 pb-6 pt-4 space-y-3 shadow-xl animate-fadeIn">
            {isHome ? (
              <div className="space-y-1">
                <div className="text-[11px] font-black uppercase text-[#9AA7B8] tracking-wider px-3 py-1">
                  Election Platform
                </div>
                <button
                  onClick={() => { scrollTo("how-it-works"); setMobileOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-[#202124] hover:bg-[#F5F5F4] flex items-center justify-between"
                >
                  <span>How It Works</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#9AA7B8]" />
                </button>
                <button
                  onClick={() => { scrollTo("interactive-demo"); setMobileOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-[#202124] hover:bg-[#F5F5F4] flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#3E5A0E]" />
                    Try 30-Second Demo
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#9AA7B8]" />
                </button>
                <button
                  onClick={() => { scrollTo("comparison"); setMobileOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-[#202124] hover:bg-[#F5F5F4] flex items-center justify-between"
                >
                  <span>Why GlassBallot</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#9AA7B8]" />
                </button>
                <button
                  onClick={() => { scrollTo("portals"); setMobileOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-[#202124] hover:bg-[#F5F5F4] flex items-center justify-between"
                >
                  <span>Who It's For (Stakeholders)</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#9AA7B8]" />
                </button>
                <button
                  onClick={() => { scrollTo("witnesses-status"); setMobileOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-[#202124] hover:bg-[#F5F5F4] flex items-center justify-between"
                >
                  <span>Three Independent Watchdogs</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#9AA7B8]" />
                </button>
                <button
                  onClick={() => { scrollTo("faq"); setMobileOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-[#202124] hover:bg-[#F5F5F4] flex items-center justify-between"
                >
                  <span>Common Questions Answered</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#9AA7B8]" />
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <Link
                  href="/"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2 rounded-xl text-xs font-bold text-[#202124] hover:bg-[#F5F5F4]"
                >
                  Home
                </Link>
                <Link
                  href="/vote"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2 rounded-xl text-xs font-bold text-[#202124] hover:bg-[#F5F5F4]"
                >
                  Cast Ballot
                </Link>
                <Link
                  href="/verify"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2 rounded-xl text-xs font-bold text-[#202124] hover:bg-[#F5F5F4]"
                >
                  Verify Ballot
                </Link>
                <Link
                  href="/results"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2 rounded-xl text-xs font-bold text-[#202124] hover:bg-[#F5F5F4]"
                >
                  Election Results
                </Link>
                <Link
                  href="/integrity"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2 rounded-xl text-xs font-bold text-[#202124] hover:bg-[#F5F5F4]"
                >
                  Integrity Dashboard
                </Link>
              </div>
            )}

            {showLoggedIn ? (
              <div className="pt-3 border-t border-[#EAEAE5] space-y-2.5">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#F5F5F4] border border-[#EAEAE5]">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#202124] to-[#3B3D44] text-[#DAF39F] flex items-center justify-center font-black text-sm shadow-2xs shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-[#202124] truncate">{displayName}</div>
                    <div className="text-[11px] text-[#5C7089] truncate flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF7A]" />
                      <span>{subDetail}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={dashboardUrl}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-[#202124] bg-[#DAF39F] border border-[#C6E66C] shadow-2xs whitespace-nowrap"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      handleLogout();
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign out
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-[#EAEAE5] grid grid-cols-2 gap-2">
                <Link
                  href="/auth/student/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-[#202124] bg-[#F5F5F4] border border-[#EAEAE5] whitespace-nowrap"
                >
                  <LogIn className="w-3.5 h-3.5" /> Sign in
                </Link>
                <Link
                  href="/auth/student/register"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-white bg-[#202124] border border-[#202124] shadow-2xs whitespace-nowrap"
                >
                  <UserPlus className="w-3.5 h-3.5 text-[#DAF39F]" /> Register
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── PAGE BODY ──────────────────────────────────────── */}
      <main className="flex-1">{children}</main>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer className="mt-20 bg-white border-t border-[#EAEAE5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">

            {/* Brand */}
            <div className="col-span-2 md:col-span-1 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#DAF39F] to-[#C6E66C] flex items-center justify-center shadow-soft">
                  <Lock className="w-5 h-5 text-[#202124]" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="font-extrabold text-lg tracking-tight">GlassBallot</div>
                  <div className="text-[11px] text-[#5C7089]">Student Election System</div>
                </div>
              </div>
              <p className="text-sm text-[#5C7089] leading-relaxed max-w-xs">
                Built for RGIT Mumbai Student Council elections. Transparent to verify — private to vote.
              </p>
              <p className="text-xs text-[#9AA7B8]">
                Prototype · Independent audit required before production use.
              </p>
            </div>

            {/* For Voters */}
            <div className="space-y-4">
              <h4 className="font-bold text-[#202124] text-sm">For Voters</h4>
              <ul className="space-y-2.5">
                {[
                  { href: "/auth/student/register", label: "Register to Vote" },
                  { href: "/auth/student/login",    label: "Sign In" },
                  { href: "/vote",                  label: "Cast Your Ballot" },
                  { href: "/results",               label: "See Results" },
                  { href: "/verify/0",              label: "Verify a Ballot" },
                ].map((x) => (
                  <li key={x.href}>
                    <Link href={x.href} className="text-sm text-[#5C7089] hover:text-[#202124] transition-colors flex items-center gap-1.5">
                      {x.label} <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* For Officials */}
            <div className="space-y-4">
              <h4 className="font-bold text-[#202124] text-sm">For Officials</h4>
              <ul className="space-y-2.5">
                {[
                  { href: "/admin",       label: "Officer Console" },
                  { href: "/integrity",   label: "Integrity Dashboard" },
                  { href: "/witnesses",   label: "Candidate Witnesses" },
                  { href: "/admin/trustees", label: "Trustee Panel" },
                ].map((x) => (
                  <li key={x.href}>
                    <Link href={x.href} className="text-sm text-[#5C7089] hover:text-[#202124] transition-colors flex items-center gap-1.5">
                      {x.label} <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Our promise */}
            <div className="space-y-4">
              <h4 className="font-bold text-[#202124] text-sm">Our Promise</h4>
              <div className="space-y-3">
                {[
                  "No one — not even the admin — can see how you voted.",
                  "Every vote is publicly checkable without revealing identities.",
                  "Any tampering is automatically detected and flagged.",
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-2 text-[13px] text-[#5C7089]">
                    <FileCheck2 className="w-4 h-4 text-[#4CAF7A] mt-0.5 shrink-0" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-[#EAEAE5] flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-xs text-[#5C7089]">
              © {new Date().getFullYear()} GlassBallot · Built for CodeAstra 2.0 · RGIT Mumbai
            </div>
            <div className="text-[11px] text-[#9AA7B8]">
              Cybersecurity & Blockchain Track · Problem Statement 3
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
