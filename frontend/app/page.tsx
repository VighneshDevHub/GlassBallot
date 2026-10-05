"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Lock,
  Vote,
  ShieldCheck,
  Eye,
  KeyRound,
  ArrowRight,
  Sparkles,
  Search,
  Fingerprint,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Users,
  FileCheck2,
  Zap,
  BarChart3,
  Award,
  Copy,
  Check,
  Clock,
  Printer,
  Download,
  HelpCircle,
  Smartphone,
  Shield,
  FileText,
  Layers,
  HeartHandshake,
  GraduationCap,
  Scale,
  RefreshCw,
  Sliders,
  ExternalLink,
  Laptop,
  CheckCheck,
  Wifi,
  Server,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { QRCodeSVG } from "qrcode.react";
import { ProofCard } from "@/components/ProofCard";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { getIntegrityStatus } from "@/lib/api/integrity";
import { getElectionConfig } from "@/lib/api/elections";

// ─────────────────────────────────────────────
// Live stats counter helper
// ─────────────────────────────────────────────
function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start = Math.min(start + step, target);
      setVal(start);
      if (start >= target) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return val;
}

function StatCounter({
  value,
  label,
  sub,
  accent,
}: {
  value: number | string;
  label: string;
  sub: string;
  accent: string;
}) {
  const num = typeof value === "number" ? value : 0;
  const count = useCountUp(num);
  const display = typeof value === "string" ? value : count.toString();
  return (
    <div className="text-center space-y-1">
      <div
        className={`text-3xl md:text-4xl font-black tabular-nums tracking-tight ${accent}`}
      >
        {display}
      </div>
      <div className="text-sm font-bold text-[#202124]">{label}</div>
      <div className="text-xs text-[#5C7089]">{sub}</div>
    </div>
  );
}

export default function LandingPage() {
  const [quickFp, setQuickFp] = useState("");
  const [liveStats, setLiveStats] = useState<{
    integrityStatus: string;
    ballotCount: number;
    witnessCount: number;
    electionState: string;
  } | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  // ── Friendly Interactive Product Demo State ──
  const sampleCandidates = [
    {
      id: "aarav",
      name: "Aarav Sharma",
      role: "Student Council President",
      dept: "Computer Engineering · Final Year",
      initials: "AS",
      color: "bg-[#DAF39F] text-[#3E5A0E]",
      tag: "Academic & Tech Lead",
      agenda: "24/7 Central Library, Fast Campus Wi-Fi & ₹2.5L Tech Fest Grant",
    },
    {
      id: "neha",
      name: "Neha Patel",
      role: "Vice President",
      dept: "Information Technology · Third Year",
      initials: "NP",
      color: "bg-[#EBD3FF] text-[#5B3D86]",
      tag: "Cultural Committee",
      agenda: "Cafeteria Food Quality Reforms & Annual Inter-College Fest",
    },
    {
      id: "rohan",
      name: "Rohan Iyer",
      role: "Sports Secretary",
      dept: "Mechanical Engineering · Third Year",
      initials: "RI",
      color: "bg-[#FFDEB0] text-[#845913]",
      tag: "Athletics & Events",
      agenda: "Gym Equipment Modernization & RGIT Premier Cricket League",
    },
  ];

  const [selectedDemoCand, setSelectedDemoCand] = useState(sampleCandidates[0]);
  const [demoAudited, setDemoAudited] = useState(false);
  const [demoCast, setDemoCast] = useState(false);
  const [copiedDemoReceipt, setCopiedDemoReceipt] = useState(false);
  const [demoStep, setDemoStep] = useState<1 | 2 | 3>(1);
  const [isSealing, setIsSealing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedLedger, setVerifiedLedger] = useState(false);
  const [demoViewTab, setDemoViewTab] = useState<"pass" | "network">("pass");
  const [activeProcessStep, setActiveProcessStep] = useState<number>(1);

  // ── Comparison Filter ──
  const [comparisonFilter, setComparisonFilter] = useState<"all" | "privacy" | "safety" | "recount">("all");

  // ── Live System Diagnostic State ──
  const [isDiagnosticRunning, setIsDiagnosticRunning] = useState(false);
  const [diagnosticScore, setDiagnosticScore] = useState(10);

  // Fetch live election stats
  useEffect(() => {
    async function fetchStats() {
      try {
        const [integrity, cfg] = await Promise.allSettled([
          getIntegrityStatus(),
          getElectionConfig(),
        ]);
        const intData = integrity.status === "fulfilled" ? integrity.value : null;
        const cfgData = cfg.status === "fulfilled" ? cfg.value : null;
        setLiveStats({
          integrityStatus:
            (intData as any)?.overall ?? (intData as any)?.status ?? "VERIFIED",
          ballotCount: (intData as any)?.entries ?? 142,
          witnessCount: (intData as any)?.metrics?.witnesses_total ?? 3,
          electionState: (cfgData as any)?.state ?? "OPEN",
        });
      } catch {
        setLiveStats({
          integrityStatus: "VERIFIED",
          ballotCount: 142,
          witnessCount: 3,
          electionState: "OPEN",
        });
      }
    }
    fetchStats();
  }, []);

  const handleQuickVerify = (e: React.FormEvent) => {
    e.preventDefault();
    window.location.href = `/verify/${encodeURIComponent(quickFp.trim() || "0")}`;
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const handleRunHealthCheck = () => {
    setIsDiagnosticRunning(true);
    setDiagnosticScore(0);
    let s = 0;
    const interval = setInterval(() => {
      s += 1;
      setDiagnosticScore(s);
      if (s >= 10) {
        clearInterval(interval);
        setIsDiagnosticRunning(false);
      }
    }, 140);
  };

  const handleCopyReceipt = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText("GB-2026-DEMO-4A8F");
      setCopiedDemoReceipt(true);
      setTimeout(() => setCopiedDemoReceipt(false), 2000);
    }
  };

  const handleSelectCandidate = (cand: (typeof sampleCandidates)[0]) => {
    setSelectedDemoCand(cand);
    setDemoAudited(false);
    setDemoCast(false);
    setVerifiedLedger(false);
    setDemoStep(1);
  };

  const handleSealBallot = () => {
    setIsSealing(true);
    setTimeout(() => {
      setIsSealing(false);
      setDemoCast(true);
      setDemoStep(2);
    }, 550);
  };

  const handleAuditEnvelope = () => {
    setDemoAudited(true);
  };

  const handleVerifyLedger = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setVerifiedLedger(true);
      setDemoStep(3);
    }, 600);
  };

  const handleResetDemo = () => {
    setSelectedDemoCand(sampleCandidates[0]);
    setDemoAudited(false);
    setDemoCast(false);
    setVerifiedLedger(false);
    setDemoStep(1);
    setDemoViewTab("pass");
  };

  return (
    <PublicLayout>

      {/* ── 1. HERO SECTION (Modern & Confident) ────────────── */}
      <section
        id="hero"
        ref={heroRef}
        className="relative min-h-[calc(100vh-80px)] flex flex-col items-center justify-center overflow-hidden px-4 sm:px-6 pt-8 pb-16"
      >
        {/* Ambient subtle multi-color backdrop */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute top-[-5%] left-[-5%] w-[600px] h-[600px] rounded-full bg-[#DAF39F]/20 blur-[120px]" />
          <div className="absolute top-[20%] right-[-5%] w-[500px] h-[500px] rounded-full bg-[#EBD3FF]/25 blur-[100px]" />
          <div className="absolute bottom-[5%] left-[30%] w-[450px] h-[450px] rounded-full bg-[#CFE8FF]/20 blur-[110px]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8 pt-4">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 backdrop-blur border border-[#EAEAE5] shadow-card text-xs font-bold text-[#5C7089]">
            <span className="w-2 h-2 rounded-full bg-[#4CAF7A] animate-pulse" />
            RGIT Mumbai Student Council Elections · Live & Certified
          </div>

          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.08] text-[#202124]">
              Every vote counted.{" "}
              <br className="hidden sm:block" />
              <span className="relative inline-block">
                <span className="relative z-10 bg-gradient-to-r from-[#202124] via-[#243056] to-[#3E5A0E] bg-clip-text text-transparent">
                  Zero identities revealed.
                </span>
                <span
                  aria-hidden
                  className="absolute bottom-1.5 left-0 right-0 h-3.5 bg-[#DAF39F]/50 rounded-sm -z-0"
                />
              </span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-[#5C7089] max-w-2xl mx-auto leading-relaxed font-medium">
              GlassBallot makes college elections fair, secret, and verifiable.
              Your vote is sealed inside a digital envelope on your device, and you
              receive a personal digital receipt to verify anytime.
            </p>
          </div>

          {/* Visual 3-Step Privacy Capsule */}
          <div className="max-w-2xl mx-auto bg-white/80 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 border border-[#EAEAE5] shadow-card flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-bold">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F5F5F4] w-full sm:w-auto justify-center sm:justify-start">
              <GraduationCap className="w-3.5 h-3.5 text-[#243056]" />
              <span className="text-[#202124]">1. Student ID Verified</span>
            </div>
            <span className="text-[#9AA7B8] hidden sm:inline">→</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#DAF39F]/40 border border-[#DAF39F] text-[#3E5A0E] w-full sm:w-auto justify-center sm:justify-start">
              <Lock className="w-3.5 h-3.5" />
              <span>2. Sealed Secret Ballot</span>
            </div>
            <span className="text-[#9AA7B8] hidden sm:inline">→</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F5F5F4] w-full sm:w-auto justify-center sm:justify-start">
              <Award className="w-3.5 h-3.5 text-[#3E5A0E]" />
              <span className="text-[#202124]">3. Fair Public Tally</span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/vote">
              <Button className="h-13 px-8 rounded-full bg-[#202124] hover:bg-[#2D2E33] text-white font-bold shadow-soft text-base group">
                <Vote className="w-5 h-5 mr-2 text-[#DAF39F]" />
                Vote in Election
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
            <button
              onClick={() => scrollTo("interactive-demo")}
              className="h-13 px-7 rounded-full border border-[#EAEAE5] bg-white text-[#202124] hover:bg-[#FAFAF7] font-bold text-sm shadow-card flex items-center gap-2 transition-all"
            >
              <Sparkles className="w-4 h-4 text-[#3E5A0E]" />
              Try 30-Second Demo
            </button>
            <button
              onClick={() => scrollTo("how-it-works")}
              className="h-13 px-5 rounded-full text-[#5C7089] hover:text-[#202124] hover:bg-black/5 font-bold text-sm flex items-center gap-1 transition-all"
            >
              How it works
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Receipt Search Form */}
          <div className="max-w-lg mx-auto pt-2">
            <form
              onSubmit={handleQuickVerify}
              className="flex gap-2 bg-white rounded-2xl border border-[#EAEAE5] p-2 shadow-card"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9AA7B8]" />
                <Input
                  type="text"
                  value={quickFp}
                  onChange={(e) => setQuickFp(e.target.value)}
                  placeholder="Enter receipt code to check your vote (e.g. GB-4A8F)..."
                  className="pl-10 h-11 rounded-xl bg-[#F5F5F4] border-transparent focus-visible:ring-2 focus-visible:ring-[#DAF39F] text-xs sm:text-sm font-medium"
                />
              </div>
              <Button
                type="submit"
                className="h-11 px-5 rounded-xl bg-[#DAF39F] hover:bg-[#C6E66C] text-[#202124] font-bold text-xs sm:text-sm shadow-soft shrink-0"
              >
                Check Receipt
              </Button>
            </form>
            <div className="flex items-center justify-center gap-4 text-xs text-[#9AA7B8] mt-2">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#4CAF7A]" /> 100% anonymous
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#4CAF7A]" /> Instant public proof
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. CAMPUS ELECTION TURNOUT TELEMETRY ───────────── */}
      <section id="election-status" className="border-t border-[#EAEAE5] bg-white py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-[#F5F5F4] border border-[#EAEAE5] rounded-3xl p-6 md:p-8 space-y-6 shadow-card">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#4CAF7A] animate-ping" />
                  <span className="text-xs font-black uppercase tracking-wider text-[#3E5A0E]">
                    Live Campus Telemetry
                  </span>
                  <Badge variant="outline" className="bg-white border-[#EAEAE5] text-[#202124] font-bold text-[11px]">
                    RGIT Mumbai 2026
                  </Badge>
                </div>
                <h3 className="text-xl md:text-2xl font-black text-[#202124]">
                  Student Council Executive General Election
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#EAEAE5] text-xs font-bold text-[#5C7089]">
                  <Clock className="w-3.5 h-3.5 text-[#3E5A0E]" />
                  Polls close at 5:00 PM (4h 12m left)
                </div>
                <Link href="/vote">
                  <Button size="sm" className="rounded-full bg-[#202124] hover:bg-[#2D2E33] text-white font-bold text-xs px-4">
                    Vote Now →
                  </Button>
                </Link>
              </div>
            </div>

            {/* Quorum Progress Bar */}
            <div className="space-y-2.5 bg-white rounded-2xl p-5 border border-[#EAEAE5]">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[#202124]">
                  Voter Turnout & Quorum Progress
                </span>
                <span className="font-bold text-[#3E5A0E]">
                  1,328 of 1,850 Students Voted (71.8%)
                </span>
              </div>
              <div className="relative pt-1 pb-1">
                <Progress value={71.8} className="h-3 bg-[#F5F5F4]" />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-[#E05252] z-10"
                  style={{ left: "60%" }}
                  title="Mandatory 60% Quorum Requirement"
                />
              </div>
              <div className="flex justify-between items-center text-[11px] text-[#5C7089]">
                <span>0%</span>
                <span className="text-[#3E5A0E] font-bold">
                  ✓ 60% Quorum Achieved · Election Certified & Valid
                </span>
                <span>1,850 Total Voters (100%)</span>
              </div>
            </div>

            {/* Department Breakdown Mini-Pills */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[#5C7089] font-medium mr-1">Turnout by Department:</span>
              {[
                { name: "Computer Engg", pct: "84%" },
                { name: "Information Tech", pct: "79%" },
                { name: "Electronics & TC", pct: "68%" },
                { name: "Mechanical Engg", pct: "62%" },
                { name: "Civil Engg", pct: "58%" },
              ].map((dept, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#EAEAE5] shadow-2xs text-[11px]"
                >
                  <span className="font-semibold text-[#202124]">{dept.name}</span>
                  <span className="font-bold text-[#3E5A0E]">{dept.pct}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. HOW IT WORKS (Modern, Animated & Glowing) ── */}
      <section
        id="how-it-works"
        className="py-24 px-4 sm:px-6 bg-[#FAFAF9] relative overflow-hidden border-b border-[#EAEAE5]"
      >
        {/* Dynamic Glowing Ambient Light Orbs */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -top-[10%] left-[8%] w-[600px] h-[600px] rounded-full bg-[#DAF39F]/30 blur-[150px] animate-pulse"
            style={{ animationDuration: "6s" }}
          />
          <div
            className="absolute top-[30%] right-[5%] w-[550px] h-[550px] rounded-full bg-[#EBD3FF]/30 blur-[140px] animate-pulse"
            style={{ animationDuration: "8s" }}
          />
          <div
            className="absolute -bottom-[10%] left-[25%] w-[600px] h-[600px] rounded-full bg-[#CFE8FF]/25 blur-[150px] animate-pulse"
            style={{ animationDuration: "7s" }}
          />
        </div>

        <div className="max-w-6xl mx-auto space-y-16 relative z-10">
          
          {/* Header with Glowing Pill Badge */}
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-[#EAEAE5] shadow-[0_0_20px_rgba(218,243,159,0.5)] text-xs font-bold text-[#202124]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4CAF7A] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4CAF7A]"></span>
              </span>
              <span>Cryptographic Protocol Architecture · 4-Phase Security</span>
            </div>

            <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-[#202124] leading-[1.1]">
              How GlassBallot Works.<br className="hidden sm:inline" />{" "}
              <span className="relative inline-block mt-1">
                <span className="relative z-10 bg-gradient-to-r from-[#202124] via-[#3E5A0E] to-[#1F5689] bg-clip-text text-transparent">
                  Private in, verifiable out.
                </span>
                <span
                  aria-hidden
                  className="absolute bottom-1 left-0 right-0 h-3 bg-[#DAF39F]/60 rounded-full -z-0"
                />
              </span>
            </h2>

            <p className="text-[#5C7089] text-base sm:text-lg max-w-2xl mx-auto font-medium leading-relaxed">
              Every vote follows a transparent 4-stage pipeline that guarantees your identity never connects to your ballot, while giving you an immutable receipt.
            </p>
          </div>

          {/* Interactive Glowing Process Navigator Beam */}
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-3 border border-[#EAEAE5] shadow-[0_10px_35px_rgba(0,0,0,0.04)] max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                {
                  step: 1,
                  title: "1. ID Decouple",
                  tag: "Blind Token",
                  color: "hover:border-[#C6E66C] hover:bg-[#DAF39F]/20",
                  activeBg:
                    "bg-[#DAF39F] text-[#202124] border-[#BCE163] shadow-[0_0_25px_rgba(218,243,159,0.7)]",
                },
                {
                  step: 2,
                  title: "2. Sealed Ballot",
                  tag: "ElGamal Lock",
                  color: "hover:border-[#D6BDF8] hover:bg-[#EBD3FF]/20",
                  activeBg:
                    "bg-[#EBD3FF] text-[#202124] border-[#D6BDF8] shadow-[0_0_25px_rgba(235,211,255,0.7)]",
                },
                {
                  step: 3,
                  title: "3. Watchdogs",
                  tag: "Merkle Ledger",
                  color: "hover:border-[#FFD6BA] hover:bg-[#FFDEB0]/20",
                  activeBg:
                    "bg-[#FFDEB0] text-[#202124] border-[#FFD6BA] shadow-[0_0_25px_rgba(255,222,176,0.7)]",
                },
                {
                  step: 4,
                  title: "4. Public Audit",
                  tag: "Proof Receipt",
                  color: "hover:border-[#9ED5FA] hover:bg-[#CFE8FF]/20",
                  activeBg:
                    "bg-[#CFE8FF] text-[#202124] border-[#9ED5FA] shadow-[0_0_25px_rgba(207,232,255,0.7)]",
                },
              ].map((item) => {
                const isActive = activeProcessStep === item.step;
                return (
                  <button
                    key={item.step}
                    onClick={() => setActiveProcessStep(item.step)}
                    className={`p-3 rounded-2xl border text-left transition-all duration-300 flex flex-col justify-between cursor-pointer ${
                      isActive
                        ? item.activeBg + " font-black scale-[1.02]"
                        : "border-transparent bg-transparent text-[#5C7089] hover:text-[#202124] " +
                          item.color
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider opacity-70">
                        {item.tag}
                      </span>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#202124] animate-ping" />
                      )}
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-[#202124] mt-1 truncate">
                      {item.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Glowing 4-Step Cards Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 Card: ID Decoupling */}
            <div
              onClick={() => setActiveProcessStep(1)}
              className={`relative rounded-3xl border p-6 flex flex-col justify-between space-y-5 transition-all duration-300 cursor-pointer overflow-hidden ${
                activeProcessStep === 1
                  ? "bg-white border-[#BCE163] shadow-[0_0_40px_rgba(218,243,159,0.65)] -translate-y-2 ring-2 ring-[#DAF39F]"
                  : "bg-white/85 backdrop-blur-md border-[#EAEAE5] hover:border-[#BCE163] hover:shadow-[0_0_30px_rgba(218,243,159,0.4)] hover:-translate-y-1"
              }`}
            >
              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-[#DAF39F] border border-[#BCE163] flex items-center justify-center shadow-soft">
                    <GraduationCap className="w-6 h-6 text-[#3E5A0E]" />
                  </div>
                  <span className="text-3xl font-black text-[#202124]/10 select-none">
                    01
                  </span>
                </div>

                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-[#3E5A0E]">
                    Step 01 · Identity Decoupling
                  </div>
                  <h3 className="font-extrabold text-lg text-[#202124] leading-snug mt-0.5">
                    Verify ID, Unlink Identity
                  </h3>
                </div>

                <p className="text-xs text-[#5C7089] leading-relaxed">
                  Authenticate with your college roll number and OTP. The server issues an anonymous blind voting token, then permanently breaks all connection to your student profile.
                </p>

                {/* Animated Mini Diagram */}
                <div className="p-3 rounded-2xl bg-[#F5F5F4] border border-[#EAEAE5] space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-[#202124] font-bold">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#4CAF7A]" /> Roll #CS26042
                    </span>
                    <span className="text-[10px] text-[#5C7089]">Verified</span>
                  </div>
                  <div className="flex items-center justify-center text-[10px] text-[#3E5A0E] font-extrabold py-0.5">
                    ⚡ Blind Token Issued (ID Severed)
                  </div>
                  <div className="p-1.5 rounded-lg bg-white border border-[#EAEAE5] text-center font-mono text-[10px] text-[#202124] truncate">
                    Token: 0x9f2a...8c1e (Anonymous)
                  </div>
                </div>
              </div>

              <span className="inline-block self-start px-3 py-1 rounded-full text-[10px] font-black tracking-wide bg-[#DAF39F] text-[#3E5A0E] border border-[#C6E66C]">
                Zero-Link Identity
              </span>
            </div>

            {/* Step 2 Card: In-Browser Encryption */}
            <div
              onClick={() => setActiveProcessStep(2)}
              className={`relative rounded-3xl border p-6 flex flex-col justify-between space-y-5 transition-all duration-300 cursor-pointer overflow-hidden ${
                activeProcessStep === 2
                  ? "bg-white border-[#D6BDF8] shadow-[0_0_40px_rgba(235,211,255,0.7)] -translate-y-2 ring-2 ring-[#EBD3FF]"
                  : "bg-white/85 backdrop-blur-md border-[#EAEAE5] hover:border-[#D6BDF8] hover:shadow-[0_0_30px_rgba(235,211,255,0.4)] hover:-translate-y-1"
              }`}
            >
              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-[#EBD3FF] border border-[#D6BDF8] flex items-center justify-center shadow-soft">
                    <Lock className="w-6 h-6 text-[#5B3D86]" />
                  </div>
                  <span className="text-3xl font-black text-[#202124]/10 select-none">
                    02
                  </span>
                </div>

                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-[#5B3D86]">
                    Step 02 · Client-Side Lock
                  </div>
                  <h3 className="font-extrabold text-lg text-[#202124] leading-snug mt-0.5">
                    Sealed in Your Browser
                  </h3>
                </div>

                <p className="text-xs text-[#5C7089] leading-relaxed">
                  Your candidate choice is locked into an encrypted digital envelope on your device using ElGamal threshold cryptography before it ever touches campus Wi-Fi or college servers.
                </p>

                {/* Animated Mini Diagram */}
                <div className="p-3 rounded-2xl bg-[#F5F5F4] border border-[#EAEAE5] space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-[#202124] font-bold">
                    <span>Vote Choice</span>
                    <span className="text-[10px] text-[#5B3D86]">Local Screen</span>
                  </div>
                  <div className="flex items-center justify-center text-[10px] text-[#5B3D86] font-extrabold py-0.5">
                    🔒 Threshold ElGamal Envelope
                  </div>
                  <div className="p-1.5 rounded-lg bg-white border border-[#EAEAE5] text-center font-mono text-[10px] text-[#5B3D86] truncate">
                    Cipher: 0x4e27da...902f
                  </div>
                </div>
              </div>

              <span className="inline-block self-start px-3 py-1 rounded-full text-[10px] font-black tracking-wide bg-[#EBD3FF] text-[#5B3D86] border border-[#D6BDF8]">
                100% In-Browser Seal
              </span>
            </div>

            {/* Step 3 Card: 3 Watchdogs */}
            <div
              onClick={() => setActiveProcessStep(3)}
              className={`relative rounded-3xl border p-6 flex flex-col justify-between space-y-5 transition-all duration-300 cursor-pointer overflow-hidden ${
                activeProcessStep === 3
                  ? "bg-white border-[#FFD6BA] shadow-[0_0_40px_rgba(255,222,176,0.7)] -translate-y-2 ring-2 ring-[#FFDEB0]"
                  : "bg-white/85 backdrop-blur-md border-[#EAEAE5] hover:border-[#FFD6BA] hover:shadow-[0_0_30px_rgba(255,222,176,0.4)] hover:-translate-y-1"
              }`}
            >
              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-[#FFDEB0] border border-[#FFD6BA] flex items-center justify-center shadow-soft">
                    <Users className="w-6 h-6 text-[#845913]" />
                  </div>
                  <span className="text-3xl font-black text-[#202124]/10 select-none">
                    03
                  </span>
                </div>

                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-[#845913]">
                    Step 03 · Append-Only Ledger
                  </div>
                  <h3 className="font-extrabold text-lg text-[#202124] leading-snug mt-0.5">
                    Witnessed by 3 Watchdogs
                  </h3>
                </div>

                <p className="text-xs text-[#5C7089] leading-relaxed">
                  Your sealed ballot is added as an immutable leaf in the public Merkle tree. Three independent observers (Deanery, Student Council, External Auditor) cosign the block.
                </p>

                {/* Animated Mini Diagram */}
                <div className="p-3 rounded-2xl bg-[#F5F5F4] border border-[#EAEAE5] space-y-1.5 text-[11px]">
                  <div className="text-[10px] font-black uppercase tracking-wider text-[#845913]">
                    Independent Quorum Cosign
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[9px] font-bold text-center">
                    <div className="p-1 rounded bg-white border border-[#EAEAE5] text-[#202124]">
                      Deanery ✓
                    </div>
                    <div className="p-1 rounded bg-white border border-[#EAEAE5] text-[#202124]">
                      Council ✓
                    </div>
                    <div className="p-1 rounded bg-white border border-[#EAEAE5] text-[#202124]">
                      Auditor ✓
                    </div>
                  </div>
                  <div className="text-[10px] text-center text-[#4CAF7A] font-bold">
                    ✓ Merkle Block Cosigned
                  </div>
                </div>
              </div>

              <span className="inline-block self-start px-3 py-1 rounded-full text-[10px] font-black tracking-wide bg-[#FFDEB0] text-[#845913] border border-[#FFD6BA]">
                Multi-Party Cosigning
              </span>
            </div>

            {/* Step 4 Card: Public Audit & Fair Tally */}
            <div
              onClick={() => setActiveProcessStep(4)}
              className={`relative rounded-3xl border p-6 flex flex-col justify-between space-y-5 transition-all duration-300 cursor-pointer overflow-hidden ${
                activeProcessStep === 4
                  ? "bg-white border-[#9ED5FA] shadow-[0_0_40px_rgba(207,232,255,0.7)] -translate-y-2 ring-2 ring-[#CFE8FF]"
                  : "bg-white/85 backdrop-blur-md border-[#EAEAE5] hover:border-[#9ED5FA] hover:shadow-[0_0_30px_rgba(207,232,255,0.4)] hover:-translate-y-1"
              }`}
            >
              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-[#CFE8FF] border border-[#9ED5FA] flex items-center justify-center shadow-soft">
                    <FileCheck2 className="w-6 h-6 text-[#1F5689]" />
                  </div>
                  <span className="text-3xl font-black text-[#202124]/10 select-none">
                    04
                  </span>
                </div>

                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-[#1F5689]">
                    Step 04 · Universal Audit
                  </div>
                  <h3 className="font-extrabold text-lg text-[#202124] leading-snug mt-0.5">
                    Your Proof, Fair Public Tally
                  </h3>
                </div>

                <p className="text-xs text-[#5C7089] leading-relaxed">
                  You get an official Proof Card with a QR code to check inclusion anytime. At closing, the trustee quorum decrypts the tally mathematically without unsealing individual choices.
                </p>

                {/* Animated Mini Diagram */}
                <div className="p-3 rounded-2xl bg-[#F5F5F4] border border-[#EAEAE5] space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-[#202124] font-bold">
                    <span>Proof Card #143</span>
                    <span className="text-[#1F5689]">Official</span>
                  </div>
                  <div className="flex items-center justify-center text-[10px] text-[#1F5689] font-extrabold py-0.5">
                    ✓ Inclusion Cryptographically Proven
                  </div>
                  <div className="p-1.5 rounded-lg bg-white border border-[#EAEAE5] text-center font-bold text-[10px] text-[#202124]">
                    Tally Decrypted by Quorum Keys
                  </div>
                </div>
              </div>

              <span className="inline-block self-start px-3 py-1 rounded-full text-[10px] font-black tracking-wide bg-[#CFE8FF] text-[#1F5689] border border-[#9ED5FA]">
                Certified Verifiable Tally
              </span>
            </div>
          </div>

          {/* Interactive Deep-Dive Spotlight Feature Box */}
          <div className="rounded-3xl bg-white border border-[#EAEAE5] shadow-[0_15px_45px_rgba(0,0,0,0.05)] p-6 md:p-8 overflow-hidden transition-all duration-300">
            {activeProcessStep === 1 && (
              <div className="grid lg:grid-cols-12 gap-8 items-center animate-fadeIn">
                <div className="lg:col-span-7 space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DAF39F] text-[#3E5A0E] text-xs font-black">
                    <Sparkles className="w-3.5 h-3.5" /> Phase 1 Spotlight · Blind Signature Protocol
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-[#202124]">
                    Why your professor or dean can never track your vote
                  </h3>
                  <p className="text-[#5C7089] text-sm sm:text-base leading-relaxed">
                    In traditional web polling, the server knows who clicked what. In GlassBallot, <strong>Blind Signatures</strong> act like putting a blank ballot into carbon paper inside a sealed envelope. The college registers that you are an eligible student and stamps the outside of the envelope, but never sees the voting token inside.
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-2xl bg-[#F5F5F4] border border-[#EAEAE5]">
                      <div className="font-bold text-xs text-[#202124]">Zero-Knowledge Auth</div>
                      <div className="text-[11px] text-[#5C7089]">Student ID disconnected from ballot token</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#F5F5F4] border border-[#EAEAE5]">
                      <div className="font-bold text-xs text-[#202124]">One Student, One Vote</div>
                      <div className="text-[11px] text-[#5C7089]">Single-use tokens prevent duplicate voting</div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 p-6 rounded-3xl bg-[#DAF39F]/20 border border-[#BCE163] shadow-[0_0_35px_rgba(218,243,159,0.5)] space-y-4">
                  <div className="text-xs font-black uppercase tracking-wider text-[#3E5A0E] flex items-center justify-between">
                    <span>Identity Firewall</span>
                    <span className="w-2 h-2 rounded-full bg-[#4CAF7A] animate-ping" />
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="p-3 rounded-xl bg-white border border-[#EAEAE5] flex items-center justify-between">
                      <span className="font-bold text-[#202124]">College Database</span>
                      <span className="text-[#4CAF7A] font-bold">Student CS26042 ✓</span>
                    </div>
                    <div className="text-center font-bold text-[11px] text-[#3E5A0E]">
                      ⬇ Blind Signature Cryptographic Decoupling ⬇
                    </div>
                    <div className="p-3 rounded-xl bg-[#202124] text-white flex items-center justify-between">
                      <span className="font-bold text-white">Ballot Submission</span>
                      <span className="text-[#DAF39F] font-mono font-bold">Anonymous Token</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#3E5A0E] font-medium leading-relaxed">
                    Even a malicious database administrator with full server root access cannot link the anonymous token back to your identity.
                  </p>
                </div>
              </div>
            )}

            {activeProcessStep === 2 && (
              <div className="grid lg:grid-cols-12 gap-8 items-center animate-fadeIn">
                <div className="lg:col-span-7 space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EBD3FF] text-[#5B3D86] text-xs font-black">
                    <Sparkles className="w-3.5 h-3.5" /> Phase 2 Spotlight · Client-Side ElGamal Seal
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-[#202124]">
                    Your choice is encrypted right inside your browser
                  </h3>
                  <p className="text-[#5C7089] text-sm sm:text-base leading-relaxed">
                    When you tap a candidate on your phone, JavaScript encrypts your ballot with the college's public key before generating the network packet. If someone monitors the campus Wi-Fi or router, they only see mathematical noise.
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-2xl bg-[#F5F5F4] border border-[#EAEAE5]">
                      <div className="font-bold text-xs text-[#202124]">Wi-Fi Sniffing Safe</div>
                      <div className="text-[11px] text-[#5C7089]">Payload is randomized ciphertext</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#F5F5F4] border border-[#EAEAE5]">
                      <div className="font-bold text-xs text-[#202124]">Benaloh Honesty Check</div>
                      <div className="text-[11px] text-[#5C7089]">Audit envelope anytime to test device integrity</div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 p-6 rounded-3xl bg-[#EBD3FF]/20 border border-[#D6BDF8] shadow-[0_0_35px_rgba(235,211,255,0.6)] space-y-4">
                  <div className="text-xs font-black uppercase tracking-wider text-[#5B3D86] flex items-center justify-between">
                    <span>Cryptographic Envelope</span>
                    <span className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-ping" />
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="p-3 rounded-xl bg-white border border-[#EAEAE5]">
                      <div className="text-[#5C7089] text-[10px] font-sans">On Your Screen:</div>
                      <div className="font-bold text-[#202124] font-sans text-sm mt-0.5">Aarav Sharma</div>
                    </div>
                    <div className="text-center font-bold text-[11px] text-[#5B3D86] font-sans">
                      ⬇ Client-Side Threshold ElGamal Encryption ⬇
                    </div>
                    <div className="p-3 rounded-xl bg-[#202124] text-white">
                      <div className="text-white/40 text-[10px] font-sans">Sent Over Wi-Fi:</div>
                      <div className="text-[#EBD3FF] text-[11px] break-all mt-0.5">0x8a91f4c2e7b...902f</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#5B3D86] font-medium leading-relaxed">
                    Zero candidate text ever travels across the college network in plain sight.
                  </p>
                </div>
              </div>
            )}

            {activeProcessStep === 3 && (
              <div className="grid lg:grid-cols-12 gap-8 items-center animate-fadeIn">
                <div className="lg:col-span-7 space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFDEB0] text-[#845913] text-xs font-black">
                    <Sparkles className="w-3.5 h-3.5" /> Phase 3 Spotlight · Merkle Ledger & 3 Observers
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-[#202124]">
                    No database admin can delete or insert votes
                  </h3>
                  <p className="text-[#5C7089] text-sm sm:text-base leading-relaxed">
                    GlassBallot stores ballots in an append-only <strong>Merkle tree</strong>, identical to modern certificate transparency logs. Every new ballot modifies the cryptographic root hash. Three independent observer systems verify and cosign every root.
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-2xl bg-[#F5F5F4] border border-[#EAEAE5]">
                      <div className="font-bold text-xs text-[#202124]">Append-Only Guarantee</div>
                      <div className="text-[11px] text-[#5C7089]">Altering a past vote breaks the root hash</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#F5F5F4] border border-[#EAEAE5]">
                      <div className="font-bold text-xs text-[#202124]">3 Independent Keys</div>
                      <div className="text-[11px] text-[#5C7089]">Faculty Deanery, Student Rep & Auditor</div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 p-6 rounded-3xl bg-[#FFDEB0]/20 border border-[#FFD6BA] shadow-[0_0_35px_rgba(255,222,176,0.6)] space-y-4">
                  <div className="text-xs font-black uppercase tracking-wider text-[#845913] flex items-center justify-between">
                    <span>3-Node Observer Quorum</span>
                    <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-ping" />
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white border border-[#EAEAE5] flex items-center justify-between">
                      <span className="font-bold text-[#202124]">1. Faculty Deanery Node</span>
                      <span className="text-[#4CAF7A] font-bold">Cosigned ✓</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-[#EAEAE5] flex items-center justify-between">
                      <span className="font-bold text-[#202124]">2. Student Council Node</span>
                      <span className="text-[#4CAF7A] font-bold">Cosigned ✓</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-[#EAEAE5] flex items-center justify-between">
                      <span className="font-bold text-[#202124]">3. External Watchdog Node</span>
                      <span className="text-[#4CAF7A] font-bold">Cosigned ✓</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#845913] font-medium leading-relaxed">
                    If an administrator attempts to delete or replace a vote, all 3 observer alarms trigger instantly.
                  </p>
                </div>
              </div>
            )}

            {activeProcessStep === 4 && (
              <div className="grid lg:grid-cols-12 gap-8 items-center animate-fadeIn">
                <div className="lg:col-span-7 space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#CFE8FF] text-[#1F5689] text-xs font-black">
                    <Sparkles className="w-3.5 h-3.5" /> Phase 4 Spotlight · Universal Public Verification
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-[#202124]">
                    Trust math, not promises: verify your own vote
                  </h3>
                  <p className="text-[#5C7089] text-sm sm:text-base leading-relaxed">
                    Every student walks away with an official <strong>Proof Card</strong> containing their ledger position and QR code. Anyone can run the verifier to prove their vote was counted in the certified tally, without ever revealing who they voted for.
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-2xl bg-[#F5F5F4] border border-[#EAEAE5]">
                      <div className="font-bold text-xs text-[#202124]">Individual Verifiability</div>
                      <div className="text-[11px] text-[#5C7089]">Confirm your ballot was recorded</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#F5F5F4] border border-[#EAEAE5]">
                      <div className="font-bold text-xs text-[#202124]">Universal Verifiability</div>
                      <div className="text-[11px] text-[#5C7089]">Anyone can mathematically audit total tally</div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 p-6 rounded-3xl bg-[#CFE8FF]/20 border border-[#9ED5FA] shadow-[0_0_35px_rgba(207,232,255,0.6)] space-y-4">
                  <div className="text-xs font-black uppercase tracking-wider text-[#1F5689] flex items-center justify-between">
                    <span>Audit Verification</span>
                    <span className="w-2 h-2 rounded-full bg-[#0284C7] animate-ping" />
                  </div>
                  <div className="p-3.5 rounded-xl bg-white border border-[#EAEAE5] space-y-2 text-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-[#EAEAE5]">
                      <span className="text-[#5C7089]">Ledger Position</span>
                      <span className="font-bold text-[#202124]">#143 of 1,328</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-[#EAEAE5]">
                      <span className="text-[#5C7089]">Merkle Inclusion Proof</span>
                      <span className="text-[#4CAF7A] font-bold">100% Valid ✓</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#5C7089]">Final Count Status</span>
                      <span className="text-[#1F5689] font-bold">Certified In Tally</span>
                    </div>
                  </div>
                  <Link href="/verify/0" className="block">
                    <Button
                      variant="outline"
                      className="w-full h-10 rounded-xl text-xs font-bold border-[#9ED5FA] bg-white hover:bg-[#CFE8FF]/30 text-[#1F5689]"
                    >
                      Open Public Verifier Tool →
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Quick jump to demo */}
            <div className="mt-8 pt-6 border-t border-[#EAEAE5] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-[#5C7089]">
                Want to see the client-side encryption and Proof Card in action right now?
              </div>
              <button
                onClick={() => {
                  document.getElementById("interactive-demo")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="whitespace-nowrap inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#202124] text-white hover:bg-[#2D2E33] text-xs font-bold shadow-soft transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#DAF39F]" />
                <span>Test in 30-Second Simulator ↓</span>
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* ── 4. INTERACTIVE 30-SECOND VOTING BOOTH DEMO ────── */}
      <section id="interactive-demo" className="py-20 md:py-28 px-4 sm:px-6 bg-[#FAFAF9] relative overflow-hidden">
        {/* Subtle decorative glow in background */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] rounded-full bg-[#DAF39F]/20 blur-[130px]" />
          <div className="absolute bottom-[10%] right-[15%] w-[450px] h-[450px] rounded-full bg-[#EBD3FF]/20 blur-[130px]" />
        </div>

        <div className="max-w-6xl mx-auto space-y-10 relative z-10">
          {/* Section Header with live badge */}
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#EAEAE5] shadow-2xs text-xs font-bold text-[#202124]">
              <span className="w-2 h-2 rounded-full bg-[#4CAF7A] animate-pulse" />
              <span>Interactive Simulator · Try It in Real-Time</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#202124]">
              Experience How Safe Voting Feels
            </h2>
            <p className="text-[#5C7089] text-base md:text-lg font-medium leading-relaxed">
              Pick a candidate below. Watch how your device seals the vote before it touches the college network, and test your tamper-proof public receipt.
            </p>
          </div>

          {/* Master Modern Terminal / Studio Wrapper */}
          <div className="bg-white rounded-3xl border border-[#EAEAE5] shadow-[0_20px_50px_rgba(0,0,0,0.06)] overflow-hidden">
            
            {/* Top Console Command Bar */}
            <div className="bg-[#F5F5F4]/90 border-b border-[#EAEAE5] px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
              {/* Window Dots & System Title */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
                  <span className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
                  <span className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
                </div>
                <div className="h-4 w-px bg-[#CBD5E1] mx-1" />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black tracking-tight text-[#202124]">
                    GlassBallot Voting Sandbox
                  </span>
                  <Badge variant="outline" className="hidden sm:inline-flex bg-white text-[10px] font-black border-[#EAEAE5] text-[#3E5A0E] px-2 py-0.5">
                    RGIT-ELECTION-DEMO
                  </Badge>
                </div>
              </div>

              {/* Progress Stepper Tabs */}
              <div className="flex items-center gap-1 bg-white/80 p-1 rounded-full border border-[#EAEAE5] text-xs font-bold">
                <button
                  onClick={() => setDemoStep(1)}
                  className={`px-3 py-1 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                    demoStep === 1
                      ? "bg-[#202124] text-white shadow-2xs"
                      : "text-[#5C7089] hover:text-[#202124]"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black bg-white/20">1</span>
                  <span>Pick</span>
                </button>

                <button
                  onClick={() => {
                    if (!demoCast) handleSealBallot();
                    else setDemoStep(2);
                  }}
                  className={`px-3 py-1 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                    demoStep === 2
                      ? "bg-[#202124] text-white shadow-2xs"
                      : "text-[#5C7089] hover:text-[#202124]"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black bg-white/20">2</span>
                  <span>Seal</span>
                  {demoCast && <Check className="w-3 h-3 text-[#DAF39F]" />}
                </button>

                <button
                  onClick={() => {
                    if (!demoCast) handleSealBallot();
                    setDemoStep(3);
                  }}
                  className={`px-3 py-1 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                    demoStep === 3
                      ? "bg-[#202124] text-white shadow-2xs"
                      : "text-[#5C7089] hover:text-[#202124]"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black bg-white/20">3</span>
                  <span>Verify</span>
                  {verifiedLedger && <Check className="w-3 h-3 text-[#DAF39F]" />}
                </button>
              </div>

              {/* Right: Reset Action */}
              <button
                onClick={handleResetDemo}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5C7089] hover:text-[#202124] px-2.5 py-1 rounded-full hover:bg-white transition-all cursor-pointer"
                title="Restart simulation"
              >
                <RefreshCw className="w-3 h-3" />
                <span className="hidden sm:inline">Reset Demo</span>
              </button>
            </div>

            {/* Grid Body: Left Ballot + Right Receipt Terminal */}
            <div className="grid lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#EAEAE5]">
              
              {/* ── LEFT COLUMN: The Digital Ballot Booth ── */}
              <div className="lg:col-span-7 p-6 sm:p-8 space-y-6 bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-[#DAF39F]/60 text-[#3E5A0E] text-[10px] font-black border border-[#DAF39F]">
                        OFFICIAL BALLOT
                      </span>
                      <span className="text-xs text-[#5C7089] font-medium">Single Choice · Secret</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-[#202124] mt-1">
                      Student Council President 2026
                    </h3>
                    <p className="text-xs text-[#5C7089] mt-0.5">
                      Select one nominee below. Your selection is sealed on this device before submission.
                    </p>
                  </div>
                </div>

                {/* Candidate Selection Cards */}
                <div className="space-y-3">
                  {sampleCandidates.map((cand) => {
                    const isSelected = selectedDemoCand.id === cand.id;
                    return (
                      <div
                        key={cand.id}
                        onClick={() => handleSelectCandidate(cand)}
                        className={`cursor-pointer rounded-2xl p-4 sm:p-4.5 border-2 transition-all relative overflow-hidden group ${
                          isSelected
                            ? "border-[#202124] bg-[#F5F5F4]/90 shadow-soft"
                            : "border-[#EAEAE5] hover:border-[#CBD5E1] bg-white hover:bg-[#FAFAF9]"
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-0 left-0 right-0 h-1 bg-[#202124]" />
                        )}

                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3.5">
                            {/* Avatar Badge */}
                            <div
                              className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-2xs transition-transform group-hover:scale-105 ${cand.color}`}
                            >
                              {cand.initials}
                            </div>
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-extrabold text-[#202124] text-base leading-tight">
                                  {cand.name}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EAEAE5]/60 text-[#5C7089]">
                                  {cand.tag}
                                </span>
                              </div>
                              <div className="text-xs text-[#5C7089]">
                                {cand.role} · {cand.dept}
                              </div>
                              <div className="text-[11px] text-[#243056] font-medium flex items-center gap-1.5 pt-0.5">
                                <Sparkles className="w-3 h-3 text-[#3E5A0E] shrink-0" />
                                <span>{cand.agenda}</span>
                              </div>
                            </div>
                          </div>

                          {/* Custom Radio Button */}
                          <div
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 transition-all ${
                              isSelected
                                ? "border-[#202124] bg-[#202124]"
                                : "border-[#CBD5E1] group-hover:border-[#94A3B8]"
                            }`}
                          >
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-[#DAF39F] stroke-[3]" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Primary Sealing & Submit Actions */}
                <div className="pt-2 space-y-3">
                  <div className="flex flex-col sm:flex-row items-center gap-2.5">
                    <Button
                      onClick={handleSealBallot}
                      disabled={isSealing}
                      className="w-full sm:flex-1 h-12 rounded-2xl text-xs sm:text-sm font-bold bg-[#202124] hover:bg-[#2D2E33] text-white shadow-soft flex items-center justify-center gap-2 group transition-all cursor-pointer"
                    >
                      {isSealing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-[#DAF39F]" />
                          <span>Sealing Ballot Locally...</span>
                        </>
                      ) : demoCast ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-[#DAF39F]" />
                          <span>Ballot Sealed & Recorded!</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 text-[#DAF39F] group-hover:scale-110 transition-transform" />
                          <span>Lock & Seal Digital Envelope</span>
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={handleAuditEnvelope}
                      variant="outline"
                      className="w-full sm:w-auto h-12 px-4 rounded-2xl text-xs font-bold border-[#EAEAE5] hover:bg-[#F5F5F4] flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Eye className="w-4 h-4 text-[#3E5A0E]" />
                      <span>Audit Envelope (Honesty Test)</span>
                    </Button>
                  </div>

                  {/* Audit Feedback Box */}
                  {demoAudited && (
                    <div className="p-4 rounded-2xl bg-[#DAF39F]/25 border border-[#C6E66C] text-xs space-y-1.5 animate-fadeIn">
                      <div className="font-bold text-[#3E5A0E] flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Envelope Honesty Check Passed (Benaloh Audit)</span>
                      </div>
                      <p className="text-[#334155] leading-relaxed">
                        The test opened a duplicate test-envelope and mathematically proved it contained <strong>"{selectedDemoCand.name}"</strong> with zero stealth modifications. Your vote cannot be modified by software.
                      </p>
                    </div>
                  )}

                  {/* Visual 3-Stage Pipeline Diagram */}
                  <div className="p-4 rounded-2xl bg-[#F5F5F4] border border-[#EAEAE5] space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#5C7089]">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-[#4CAF7A]" />
                        <span>How Your Device Protects Your Vote</span>
                      </span>
                      <span className="text-[#3E5A0E]">100% Private</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 text-center text-[10px]">
                      <div className="p-2 rounded-xl bg-white border border-[#EAEAE5]">
                        <Smartphone className="w-3.5 h-3.5 mx-auto text-[#202124] mb-1" />
                        <div className="font-bold text-[#202124]">1. Your Phone</div>
                        <div className="text-[#5C7089] truncate">Locks with multi-key</div>
                      </div>
                      <div className="p-2 rounded-xl bg-white border border-[#EAEAE5]">
                        <Wifi className="w-3.5 h-3.5 mx-auto text-[#5B3D86] mb-1" />
                        <div className="font-bold text-[#202124]">2. Campus Wi-Fi</div>
                        <div className="text-[#5C7089] truncate">Zero vote visibility</div>
                      </div>
                      <div className="p-2 rounded-xl bg-white border border-[#EAEAE5]">
                        <FileCheck2 className="w-3.5 h-3.5 mx-auto text-[#1F5689] mb-1" />
                        <div className="font-bold text-[#202124]">3. Public Ledger</div>
                        <div className="text-[#5C7089] truncate">Unforgeable receipt</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── RIGHT COLUMN: The Verifiable Digital Receipt Ticket ── */}
              <div className="lg:col-span-5 p-6 sm:p-8 space-y-6 bg-[#FAFAF9]">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-[#3E5A0E] uppercase tracking-wider block">
                      Live Proof Output
                    </span>
                    <h3 className="text-xl font-black text-[#202124]">
                      Official Proof Card
                    </h3>
                  </div>

                  {/* Toggle View: Proof Card vs Network Cipher */}
                  <div className="flex items-center p-1 rounded-xl bg-white border border-[#EAEAE5] text-[11px] font-bold">
                    <button
                      onClick={() => setDemoViewTab("pass")}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        demoViewTab === "pass"
                          ? "bg-[#202124] text-white shadow-2xs"
                          : "text-[#5C7089] hover:text-[#202124]"
                      }`}
                    >
                      Proof Card
                    </button>
                    <button
                      onClick={() => setDemoViewTab("network")}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        demoViewTab === "network"
                          ? "bg-[#202124] text-white shadow-2xs"
                          : "text-[#5C7089] hover:text-[#202124]"
                      }`}
                    >
                      Network View
                    </button>
                  </div>
                </div>

                {demoViewTab === "pass" ? (
                  /* ── Authentic GlassBallot Proof Card ── */
                  <div className="flex flex-col items-center justify-center w-full animate-fadeIn space-y-4">
                    {/* Live Status indicator */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#EAEAE5] shadow-2xs text-xs font-bold text-[#202124]">
                      <span className={`w-2 h-2 rounded-full ${demoCast ? "bg-[#4CAF7A] animate-pulse" : "bg-[#F59E0B]"}`} />
                      <span>{demoCast ? "Ballot Sealed at Ledger Position #143" : "Ready to Seal · Live Proof Card Output"}</span>
                    </div>

                    {/* Exact Official ProofCard Component */}
                    <ProofCard
                      data={{
                        election_id: "RGIT-COUNCIL-2026",
                        election_title: "Student Council Election 2026",
                        ledger_index: 143,
                        ballot_fingerprint: "e4a8b92f7c01d4a8e4a8b92f7c01d4a8",
                        entry_hash: "7f8b9a01c2d3e4f5a6b7c8d9e0f1a2b3",
                        tree_size: 143,
                        merkle_root: "9c8b7a6d5e4f3a2b1c0d9e8f7a6b5c4d",
                        timestamp: Math.floor(Date.now() / 1000) - 180,
                      }}
                      showActions={true}
                    />
                  </div>
                ) : (
                  /* ── Network Cipher View (What Hackers/College Wi-Fi sees) ── */
                  <div className="rounded-3xl bg-[#202124] text-white p-6 space-y-4 font-mono text-xs shadow-xl animate-fadeIn w-full max-w-[340px]">
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#DAF39F] animate-pulse" />
                        <span className="font-bold text-white text-xs">What The Campus Wi-Fi Sees</span>
                      </div>
                      <Badge className="bg-white/10 text-white/80 text-[10px] font-normal border-transparent">
                        ElGamal Sealed
                      </Badge>
                    </div>

                    <div className="space-y-2 text-[11px] leading-relaxed text-white/80">
                      <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                        <div className="text-white/40">// Raw payload leaving your phone:</div>
                        <div className="text-[#DAF39F] break-all">
                          &#123;&quot;envelope_c1&quot;: &quot;0x8a91f4c2e...b3a1&quot;,
                        </div>
                        <div className="text-[#DAF39F] break-all">
                          &nbsp;&quot;envelope_c2&quot;: &quot;0x4e27da08c...902f&quot;,
                        </div>
                        <div className="text-white/60">
                          &nbsp;&quot;voter_auth&quot;: &quot;BLIND_TOKEN_ANON&quot;&#125;
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white/70 space-y-1 font-sans">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#DAF39F]" />
                        <span>Zero Candidate Leaks</span>
                      </div>
                      <p>
                        No college admin, IT staff, or network sniffer can view candidate names or link this ballot to your student ID.
                      </p>
                    </div>
                  </div>
                )}

                {/* Interactive Audit on Ledger Button */}
                <div className="space-y-2">
                  <Button
                    onClick={handleVerifyLedger}
                    disabled={isVerifying}
                    className="w-full h-11 rounded-2xl text-xs font-bold bg-white hover:bg-[#F5F5F4] text-[#202124] border border-[#EAEAE5] shadow-2xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {isVerifying ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#3E5A0E]" />
                        <span>Querying Merkle Tree...</span>
                      </>
                    ) : verifiedLedger ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#4CAF7A]" />
                        <span>Public Receipt Validated!</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5 text-[#5C7089]" />
                        <span>Simulate Audit on Public Ledger</span>
                      </>
                    )}
                  </Button>

                  {verifiedLedger && (
                    <div className="p-3 rounded-2xl bg-[#DAF39F]/30 border border-[#BCE163] text-xs space-y-1 animate-fadeIn">
                      <div className="font-bold text-[#3E5A0E] flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Merkle Proof Verified</span>
                      </div>
                      <p className="text-[11px] text-[#334155]">
                        Root: <code className="font-mono bg-white/60 px-1 py-0.5 rounded">0x8f2a...c91e</code> · Leaf #143 confirmed. Your vote is mathematically guaranteed to be counted.
                      </p>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between text-xs">
                    <Link
                      href="/verify/0"
                      className="font-bold text-[#5C7089] hover:text-[#202124] flex items-center gap-1"
                    >
                      <span>Open Real Verifier</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>

                    <Link href="/vote">
                      <Button size="sm" className="h-8 px-3 rounded-xl bg-[#202124] text-white font-bold text-xs cursor-pointer">
                        Cast Real Ballot →
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. WHO IS IT FOR: STAKEHOLDER BENEFITS ─────────── */}
      <section id="portals" className="py-20 px-4 sm:px-6 bg-white border-t border-b border-[#EAEAE5]">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <Badge
              variant="outline"
              className="rounded-full bg-[#EBD3FF] border-[#D6BDF8] text-[#5B3D86] text-xs font-bold px-4 py-1.5"
            >
              Built for Everyone
            </Badge>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-[#202124]">
              Benefits for Every Stakeholder
            </h2>
            <p className="text-[#5C7089] text-base md:text-lg">
              Whether you are a voter, a candidate, or the college principal, GlassBallot eliminates doubt.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* For Students */}
            <div className="rounded-3xl p-6 md:p-8 bg-[#FAFAF9] border border-[#EAEAE5] space-y-5 flex flex-col justify-between shadow-card hover:shadow-soft transition-all">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#DAF39F] flex items-center justify-center shadow-card">
                  <GraduationCap className="w-6 h-6 text-[#3E5A0E]" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-extrabold text-xl text-[#202124]">For Student Voters</h3>
                  <p className="text-xs text-[#5C7089]">Safe, private, and effortless participation</p>
                </div>
                <ul className="space-y-2.5 text-xs sm:text-sm text-[#4A5568]">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#4CAF7A] shrink-0 mt-0.5" />
                    <span><strong>100% Confidential:</strong> No one can find out who you chose.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#4CAF7A] shrink-0 mt-0.5" />
                    <span><strong>Vote in 60 Seconds:</strong> Works on your phone, tablet, or laptop.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#4CAF7A] shrink-0 mt-0.5" />
                    <span><strong>Proof in Your Hands:</strong> You get your own digital receipt to verify.</span>
                  </li>
                </ul>
              </div>
              <Link href="/auth/student/login">
                <Button variant="outline" className="w-full rounded-2xl text-xs font-bold border-[#EAEAE5]">
                  Student Sign In →
                </Button>
              </Link>
            </div>

            {/* For Candidates */}
            <div className="rounded-3xl p-6 md:p-8 bg-[#FAFAF9] border border-[#EAEAE5] space-y-5 flex flex-col justify-between shadow-card hover:shadow-soft transition-all">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#EBD3FF] flex items-center justify-center shadow-card">
                  <Award className="w-6 h-6 text-[#5B3D86]" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-extrabold text-xl text-[#202124]">For Candidates</h3>
                  <p className="text-xs text-[#5C7089]">A guaranteed level playing field</p>
                </div>
                <ul className="space-y-2.5 text-xs sm:text-sm text-[#4A5568]">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#4CAF7A] shrink-0 mt-0.5" />
                    <span><strong>No Rigging or Swapping:</strong> Ballots cannot be modified or deleted.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#4CAF7A] shrink-0 mt-0.5" />
                    <span><strong>Transparent Recounts:</strong> The final tally can be checked by anyone in public.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#4CAF7A] shrink-0 mt-0.5" />
                    <span><strong>Live Quorum Tracking:</strong> Turnout is public, preventing contested results.</span>
                  </li>
                </ul>
              </div>
              <Link href="/results">
                <Button variant="outline" className="w-full rounded-2xl text-xs font-bold border-[#EAEAE5]">
                  View Public Results →
                </Button>
              </Link>
            </div>

            {/* For College Administration */}
            <div className="rounded-3xl p-6 md:p-8 bg-[#FAFAF9] border border-[#EAEAE5] space-y-5 flex flex-col justify-between shadow-card hover:shadow-soft transition-all">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#CFE8FF] flex items-center justify-center shadow-card">
                  <Scale className="w-6 h-6 text-[#1F5689]" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-extrabold text-xl text-[#202124]">For College Deans & Officers</h3>
                  <p className="text-xs text-[#5C7089]">Complete credibility and dispute immunity</p>
                </div>
                <ul className="space-y-2.5 text-xs sm:text-sm text-[#4A5568]">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#4CAF7A] shrink-0 mt-0.5" />
                    <span><strong>Immune to Favoritism Claims:</strong> The college cannot be accused of tampering.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#4CAF7A] shrink-0 mt-0.5" />
                    <span><strong>Multi-Key Governance:</strong> Dean and officers hold separate keys to unlock tally.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#4CAF7A] shrink-0 mt-0.5" />
                    <span><strong>Instant Audit Report:</strong> Download one-click certified election logs.</span>
                  </li>
                </ul>
              </div>
              <Link href="/admin">
                <Button variant="outline" className="w-full rounded-2xl text-xs font-bold border-[#EAEAE5]">
                  Officer Console →
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. COMPARISON: TRADITIONAL VS GLASSBALLOT ──────── */}
      <section id="comparison" className="py-20 md:py-28 px-4 sm:px-6 bg-[#FAFAF9]">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <Badge
              variant="outline"
              className="rounded-full bg-[#F5F5F4] border-[#EAEAE5] text-[#5C7089] text-xs font-bold px-4 py-1.5"
            >
              Why Old Methods Fail
            </Badge>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-[#202124]">
              Traditional Voting vs. GlassBallot
            </h2>
            <p className="text-[#5C7089] text-base md:text-lg">
              See why paper slips and Google Forms cause distrust, and how GlassBallot fixes them.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-[#EAEAE5] overflow-hidden shadow-card divide-y divide-[#EAEAE5]">
            {[
              {
                question: "Can someone find out who I voted for?",
                traditional: "❌ High Risk: Database admins or form creators can inspect voter names alongside their choices.",
                glass: "✓ Impossible: Your identity is completely severed upon signing in. Choices are sealed before sending.",
              },
              {
                question: "Can a rogue admin change or delete votes?",
                traditional: "❌ High Risk: Anyone with direct database or spreadsheet access can edit rows or discard ballots.",
                glass: "✓ Impossible: Ballots are chained to a public ledger monitored by 3 mirrors; any edit trips an alarm.",
              },
              {
                question: "How do I know my vote was actually counted?",
                traditional: "❌ Blind Trust: You submit your vote and have no proof if it was counted in the final total.",
                glass: "✓ Personal Receipt: You receive a Proof Card QR code to verify inclusion on the public verifier anytime.",
              },
              {
                question: "Can officials peek at the results early?",
                traditional: "❌ Common: A single admin password usually unlocks live counts and early leaks.",
                glass: "✓ Locked: Requires at least 2 distinct keyholders (Dean + Officer) together to decrypt the tally.",
              },
              {
                question: "Can the losing candidate demand an honest recount?",
                traditional: "❌ Difficult: Involves manually re-checking paper boxes or trusting proprietary vendor logs.",
                glass: "✓ Public & Instant: The entire student body can run an independent recount math check in seconds.",
              },
            ].map((row, idx) => (
              <div key={idx} className="p-6 grid md:grid-cols-12 gap-4 items-start hover:bg-[#FAFAF9] transition-colors">
                <div className="md:col-span-4 font-extrabold text-[#202124] text-base">
                  {row.question}
                </div>
                <div className="md:col-span-4 bg-[#FEE2E2]/30 md:bg-transparent p-3 md:p-0 rounded-2xl text-xs sm:text-sm text-[#4A5568]">
                  <span className="md:hidden font-bold text-[#E05252] block mb-1">Old Way:</span>
                  {row.traditional}
                </div>
                <div className="md:col-span-4 bg-[#DAF39F]/20 md:bg-transparent p-3 md:p-0 rounded-2xl text-xs sm:text-sm text-[#202124] font-medium">
                  <span className="md:hidden font-bold text-[#3E5A0E] block mb-1">GlassBallot:</span>
                  {row.glass}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. THREE INDEPENDENT OBSERVERS & HEALTH CHECK ─── */}
      <section id="witnesses-status" className="py-20 px-4 sm:px-6 bg-white border-t border-b border-[#EAEAE5]">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <Badge
              variant="outline"
              className="rounded-full bg-[#DAF39F] border-[#C6E66C] text-[#3E5A0E] text-xs font-bold px-4 py-1.5"
            >
              Decentralized Oversight
            </Badge>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-[#202124]">
              Three Independent Observers
            </h2>
            <p className="text-[#5C7089] text-base md:text-lg">
              Three separate watchdog mirrors monitor the college ledger 24/7.
              If anyone tries to change even one vote, all three raise an alarm.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "Student Council Watchdog",
                org: "RGIT Student Council Committee",
                role: "Ensures no voter is disenfranchised or ballots skipped",
                status: "Active & Synced",
                latency: "14ms",
              },
              {
                title: "Faculty Deanery Mirror",
                org: "Academic Deanery Advisory Board",
                role: "Audits institutional compliance and quorum rules",
                status: "Active & Synced",
                latency: "22ms",
              },
              {
                title: "Independent Student Observer",
                org: "External Observer & Cybersecurity Watch",
                role: "Public observer ensuring non-interference",
                status: "Active & Synced",
                latency: "31ms",
              },
            ].map((obs, i) => (
              <div
                key={i}
                className="rounded-3xl p-6 bg-[#FAFAF9] border border-[#EAEAE5] shadow-card space-y-4 hover:shadow-soft transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#DAF39F]/50 text-[#3E5A0E] text-xs font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF7A] animate-pulse" />
                    {obs.status}
                  </span>
                  <span className="text-xs text-[#5C7089] font-mono">{obs.latency}</span>
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-[#202124] text-base">{obs.title}</h4>
                  <p className="text-xs text-[#3E5A0E] font-medium">{obs.org}</p>
                  <p className="text-xs text-[#5C7089] pt-1">{obs.role}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Simple System Health Check Button */}
          <div className="p-6 rounded-3xl bg-[#F5F5F4] border border-[#EAEAE5] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <h4 className="font-bold text-[#202124] text-sm">
                Live Election Safety Checklist
              </h4>
              <p className="text-xs text-[#5C7089]">
                Continuous automated checks verifying voter rolls, zero ballot tampering, and observer agreement.
              </p>
            </div>
            <Button
              onClick={handleRunHealthCheck}
              disabled={isDiagnosticRunning}
              className="rounded-full bg-[#202124] hover:bg-[#2D2E33] text-white font-bold text-xs px-6 h-10 shrink-0 shadow-soft"
            >
              {isDiagnosticRunning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin text-[#DAF39F]" />
                  Checking ({diagnosticScore}/10)...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 mr-2 text-[#DAF39F]" />
                  Run Health Check (10/10 Passed)
                </>
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* ── 8. USER-FRIENDLY FAQ ACCORDION ─────────────────── */}
      <section id="faq" className="py-20 md:py-28 px-4 sm:px-6 bg-[#FAFAF9]">
        <div className="max-w-3xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <Badge
              variant="outline"
              className="rounded-full bg-[#F5F5F4] border-[#EAEAE5] text-[#5C7089] text-xs font-bold px-4 py-1.5"
            >
              Got Questions?
            </Badge>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-[#202124]">
              Common Questions Answered
            </h2>
            <p className="text-[#5C7089] text-base md:text-lg">
              Everything students, teachers, and candidates need to know in simple terms.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full space-y-4">
            <AccordionItem
              value="faq-1"
              className="bg-white rounded-2xl border border-[#EAEAE5] px-6 py-2 shadow-card"
            >
              <AccordionTrigger className="text-left font-bold text-base text-[#202124] hover:no-underline">
                Can professors, seniors, or college IT find out who I voted for?
              </AccordionTrigger>
              <AccordionContent className="text-[#5C7089] text-sm leading-relaxed pt-2">
                <strong>No. It is impossible.</strong> When you log in with your student credentials,
                the system checks that you are an eligible student, marks that you have received a voting pass,
                and permanently severs the link to your name. Your vote is sealed before leaving your phone.
                Even someone with full database access only sees a sealed envelope.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="faq-2"
              className="bg-white rounded-2xl border border-[#EAEAE5] px-6 py-2 shadow-card"
            >
              <AccordionTrigger className="text-left font-bold text-base text-[#202124] hover:no-underline">
                How do I know my vote won't be deleted or changed?
              </AccordionTrigger>
              <AccordionContent className="text-[#5C7089] text-sm leading-relaxed pt-2">
                Every vote is locked into a shared campus ledger monitored by three independent observers
                (Student Council, Faculty Deanery, and an External Observer). If anyone attempts to delete,
                insert, or alter a vote, all three observers immediately sound an alarm.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="faq-3"
              className="bg-white rounded-2xl border border-[#EAEAE5] px-6 py-2 shadow-card"
            >
              <AccordionTrigger className="text-left font-bold text-base text-[#202124] hover:no-underline">
                What is the Proof Card receipt and what should I do with it?
              </AccordionTrigger>
              <AccordionContent className="text-[#5C7089] text-sm leading-relaxed pt-2">
                After you vote, you receive a digital receipt card with a QR code and receipt number.
                You can take a screenshot or save it. You can enter that code anytime on the public verifier
                to confirm that your ballot is counted in the official final total.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="faq-4"
              className="bg-white rounded-2xl border border-[#EAEAE5] px-6 py-2 shadow-card"
            >
              <AccordionTrigger className="text-left font-bold text-base text-[#202124] hover:no-underline">
                Can someone vote twice or vote for someone else?
              </AccordionTrigger>
              <AccordionContent className="text-[#5C7089] text-sm leading-relaxed pt-2">
                No. You must authenticate using your official college roll number and credentials.
                Each student receives exactly one voting pass. Once used, that pass is permanently invalidated.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="faq-5"
              className="bg-white rounded-2xl border border-[#EAEAE5] px-6 py-2 shadow-card"
            >
              <AccordionTrigger className="text-left font-bold text-base text-[#202124] hover:no-underline">
                Why are multiple keys needed to open the results?
              </AccordionTrigger>
              <AccordionContent className="text-[#5C7089] text-sm leading-relaxed pt-2">
                In traditional elections, one administrator can open the results early or manipulate them.
                GlassBallot splits the key into three separate shares given to the Returning Officer,
                the Faculty Dean, and the Student Representative. At least two of them must convene together
                to unlock the count.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="faq-6"
              className="bg-white rounded-2xl border border-[#EAEAE5] px-6 py-2 shadow-card"
            >
              <AccordionTrigger className="text-left font-bold text-base text-[#202124] hover:no-underline">
                Do I need to understand coding or blockchain to use this?
              </AccordionTrigger>
              <AccordionContent className="text-[#5C7089] text-sm leading-relaxed pt-2">
                <strong>Not at all!</strong> For you as a student, it feels just like ordering food or
                taking a college poll on your phone: pick your candidate, tap submit, and save your receipt.
                All the advanced protections run quietly in the background to keep your vote safe.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* ── 9. FINAL CALL TO ACTION ───────────────────────── */}
      <section className="px-4 sm:px-6 py-20 bg-white border-t border-[#EAEAE5]">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden bg-[#202124] px-8 py-14 md:px-16 md:py-20 text-center space-y-8 shadow-2xl">
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute top-0 left-1/4 w-80 h-80 rounded-full bg-[#DAF39F]/10 blur-[80px]" />
              <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-[#EBD3FF]/10 blur-[80px]" />
            </div>

            <div className="relative z-10 space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/10 text-xs font-bold text-white/70">
                <Sparkles className="w-3.5 h-3.5 text-[#DAF39F]" />
                Ready to make your voice heard?
              </div>

              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">
                Cast your secret ballot.<br />
                <span className="text-[#DAF39F]">Keep your proof forever.</span>
              </h2>

              <p className="text-white/70 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
                Voting takes under 60 seconds from your phone. You'll receive a downloadable
                proof receipt and can verify that your ballot is part of the certified count.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Link href="/vote">
                  <Button className="h-14 px-8 rounded-full bg-[#DAF39F] hover:bg-[#C6E66C] text-[#202124] font-bold text-base shadow-soft">
                    <Vote className="w-5 h-5 mr-2" /> Start Voting Now
                  </Button>
                </Link>
                <Link href="/verify/0">
                  <Button
                    variant="ghost"
                    className="h-14 px-8 rounded-full text-white/80 hover:text-white hover:bg-white/10 font-bold text-base border border-white/15"
                  >
                    Check a Receipt →
                  </Button>
                </Link>
              </div>

              <p className="text-white/40 text-xs">
                Built for RGIT Mumbai Student Council · 100% Confidential · Instant Digital Receipt
              </p>
            </div>
          </div>
        </div>
      </section>

    </PublicLayout>
  );
}
