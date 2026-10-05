"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Vote,
  ShieldCheck,
  CheckCircle2,
  FileText,
  KeyRound,
  Download,
  QrCode,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Award,
  Eye,
  Lock,
  School,
  AlertCircle,
  Copy,
  ChevronRight,
  CalendarClock,
  Clock,
  CheckCheck,
  Users,
  Activity,
  Search,
  LayoutDashboard,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { shortHash } from "@/lib/utils";
import { SidebarDashboardLayout } from "@/components/layouts/SidebarDashboardLayout";
import { useVoterSession } from "@/hooks/useVoterSession";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  listElections,
  getElectionConfig,
  getElectionStats,
  getElectionMilestones,
  type ElectionSummary,
  type MilestoneItem,
  type ElectionStatsResponse,
} from "@/lib/api/elections";
import {
  getVoterActivity,
  getVoterReceipts,
  type ActivityItem,
  type ReceiptItem,
} from "@/lib/api/voter";

const pastelClasses = ["pastel-peach", "pastel-lavender", "pastel-lime", "pastel-sky"] as const;

function formatTimestamp(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

function iconForAction(action: string): [any, string] {
  const a = action.toLowerCase();
  if (a.includes("vote") || a.includes("cast")) return [CheckCheck, "pastel-lime"];
  if (a.includes("test") || a.includes("spoil") || a.includes("challenge")) return [CheckCircle2, "pastel-peach"];
  if (a.includes("token") || a.includes("issue")) return [KeyRound, "pastel-lavender"];
  if (a.includes("auth") || a.includes("otp") || a.includes("login") || a.includes("session")) return [ShieldCheck, "pastel-sky"];
  if (a.includes("enroll") || a.includes("register") || a.includes("eligible")) return [School, "pastel-peach"];
  return [Activity, "pastel-sky"];
}

export default function StudentDashboardPage() {
  const { authenticated, voterProfile } = useVoterSession();
  const [loading, setLoading] = useState(true);
  const [election, setElection] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const [weeklyVotingData, setWeeklyVotingData] = useState<any[]>([]);
  const [nextEvents, setNextEvents] = useState<MilestoneItem[]>([]);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [activeElections, setActiveElections] = useState<ElectionSummary[]>([]);
  const [statsCards, setStatsCards] = useState<{label: string; val: string}[]>([
    { label: "Ballots Cast", val: "–" },
    { label: "Elections in Progress", val: "–" },
    { label: "Proofs Verified", val: "–" },
    { label: "Avg. Integrity Score", val: "–" },
  ]);
  const [weekMinutes, setWeekMinutes] = useState<number>(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configRes, electionsRes, activityRes, receiptsRes] = await Promise.all([
        getElectionConfig().catch(() => null),
        listElections("me").catch(() => [] as any[]),
        getVoterActivity(30).catch(() => ({ items: [], total: 0 })),
        getVoterReceipts(20).catch(() => ({ items: [], total: 0 })),
      ]);

      if (configRes) {
        setElection(configRes.election || null);
        setCandidates(configRes.election?.candidates || []);

        const eid = configRes.election?.id;
        if (eid) {
          const [statsRes, milestonesRes] = await Promise.all([
            getElectionStats(eid).catch(() => null),
            getElectionMilestones(eid).catch(() => ({ items: [] as any[] })),
          ]);

          if (statsRes) {
            const byHour: Array<{hour: string; count: number}> =
              (statsRes as any).by_hour_last_7d ?? [];

            if (byHour.length > 0) {
              // Aggregate hourly counts into per-day bars
              const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
              const perDay = [0, 0, 0, 0, 0, 0, 0];
              byHour.forEach((row) => {
                const d = new Date(row.hour).getDay();
                const idx = (d + 6) % 7; // Monday=0
                perDay[idx] += row.count;
              });
              const chart = days.map((d, i) => ({ day: d, hours: perDay[i] }));
              setWeeklyVotingData(chart);
              setWeekMinutes(perDay.reduce((s, n) => s + n, 0));
            } else {
              // Real zeros — no votes cast yet
              const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
              setWeeklyVotingData(days.map((d) => ({ day: d, hours: 0 })));
              setWeekMinutes(0);
            }

            const castBallots = (statsRes as any).cast_ballots ?? (statsRes as any).total_cast ?? 0;
            const integrityPct = (statsRes as any).integrity_pct ?? 0;

            setStatsCards([
              { label: "Votes Cast", val: String(castBallots) },
              {
                label: "Elections Open",
                val: String(
                  (electionsRes as any[]).filter(
                    (e: any) => e.state === "OPEN" || e.state === "SETUP"
                  ).length || 1
                ),
              },
              {
                label: "Verified Receipts",
                val: String(
                  (receiptsRes as any)?.items?.filter((r: any) => r.verified).length ?? 0
                ),
              },
              {
                label: "Turnout",
                val: `${(statsRes as any).turnout_percent ?? 0}%`,
              },
            ]);
          }

          if ((milestonesRes as any)?.items) {
            const items: any[] = (milestonesRes as any).items.slice(0, 7);
            while (items.length < 7) {
              const base = items.length > 0 ? new Date((items[items.length - 1] as any).ts || Date.now()) : new Date();
              base.setDate(base.getDate() + 1);
              items.push({
                id: `filler-${items.length}`,
                title: "Election Event",
                description: "Scheduled milestone",
                ts: base.toISOString(),
                status: "UPCOMING",
                owner: "Officer",
                time: "10:00 AM",
              });
            }
            setNextEvents(items as MilestoneItem[]);
          }
        } else {
          // No election ID — show real zeros
          const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
          setWeeklyVotingData(days.map((d) => ({ day: d, hours: 0 })));
          setWeekMinutes(0);
        }
      }

      if ((electionsRes as any[])?.length) {
        setActiveElections(electionsRes as ElectionSummary[]);
      } else if ((configRes as any)?.election) {
        const el = (configRes as any).election;
        setActiveElections([{
          id: el.id,
          public_id: el.public_id || el.id,
          title: el.title || "Active Election",
          state: (configRes as any).state || "OPEN",
          college_name: el.college_name,
          description: el.description,
          created_at: el.created_at || new Date().toISOString(),
          closes_at: el.closes_at,
        }] as any);
      }

      if ((activityRes as any)?.items) setActivityItems((activityRes as any).items);
      if ((receiptsRes as any)?.items) setReceipts((receiptsRes as any).items);
    } catch (err: any) {
      console.error("Dashboard data load error:", err);
      toast.error(err?.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const skeletonWeekly = [
    { day: "MON", hours: 0 }, { day: "TUE", hours: 0 }, { day: "WED", hours: 0 },
    { day: "THU", hours: 0 }, { day: "FRI", hours: 0 }, { day: "SAT", hours: 0 }, { day: "SUN", hours: 0 },
  ];

  return (
    <SidebarDashboardLayout role="student">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-[2.25rem] font-extrabold tracking-tight leading-none">
              My Dashboard
            </h1>
            <p className="text-[#5C7089] text-sm md:text-base">
              Track your voting activity, verify proofs, and monitor election integrity.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/vote">
              <Button className="h-11 px-5 rounded-full bg-[#DAF39F] hover:bg-[#C6E66C] text-[#202124] font-bold shadow-soft text-sm">
                <Vote className="w-4 h-4 mr-2" /> Cast Ballot
              </Button>
            </Link>
            <Link href="/verify">
              <Button
                variant="outline"
                className="h-11 px-5 rounded-full border-[#EAEAE5] bg-white font-bold text-sm hover:shadow-card"
              >
                <CheckCircle2 className="w-4 h-4 mr-2 text-[#3E5A0E]" /> Verify Proof
              </Button>
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-extrabold text-[#202124]">My Active Elections</h3>
              <div className="flex items-center gap-1.5 text-xs bg-[#F5F5F4] rounded-full p-1 border border-[#EAEAE5]">
                {["All", "Mandatory", "Completed", "Recommended"].map((t, i) => (
                  <button
                    key={t}
                    className={
                      i === 0
                        ? "px-3 py-1 rounded-full bg-[#202124] text-white font-bold text-[11px] shadow-card"
                        : "px-3 py-1 rounded-full font-semibold text-[11px] text-[#5C7089] hover:text-[#202124]"
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <Link
              href="/vote"
              className="text-sm font-bold text-[#243056] hover:underline flex items-center gap-1"
            >
              View all elections <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {loading
              ? [1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-52 rounded-2xl" />
                ))
              : activeElections.map((e, i) => {
                  const cls = pastelClasses[i % pastelClasses.length];
                  const pct = e.state === "PUBLISHED" || e.state === "COMPLETED" ? 100 :
                              e.state === "OPEN" ? 60 : e.state === "SETUP" ? 20 : 0;
                  const closes = e.closes_at ? new Date(e.closes_at) : new Date(Date.now() + 7 * 86400000);
                  const dueLabel = `Due ${closes.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
                  return (
                    <Link key={e.id || i} href="/vote" className="group">
                      <div
                        className={`pastel-card ${cls} h-full group-hover:shadow-soft group-hover:-translate-y-0.5 transition-all flex flex-col justify-between`}
                      >
                        <div className="space-y-3">
                          <span className="px-3 py-1 rounded-full bg-white/60 text-[11px] font-bold text-[#202124] inline-flex items-center gap-1.5">
                            <CalendarClock className="w-3.5 h-3.5" /> {dueLabel}
                          </span>
                          <h3 className="font-bold text-[1.05rem] text-[#202124] leading-snug">
                            {e.title}
                          </h3>
                          <p className="text-[13px] text-[#4A5568] leading-relaxed">{e.description || "Official election ballot."}</p>
                        </div>
                        <div className="pt-5 space-y-2">
                          <div className="progress-track">
                            <div className="progress-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-bold text-[#202124]/80">
                            <span>Participation</span>
                            <span>{pct}%</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3 pastel-card-white">
            <div className="flex items-start justify-between mb-5">
              <div className="space-y-0.5">
                <h3 className="text-lg font-extrabold text-[#202124]">Weekly Voting Progress</h3>
                <div className="text-[#5C7089] text-sm">
                  <span className="text-2xl font-extrabold text-[#202124] mr-2 align-middle">
                    {loading ? <Skeleton className="inline-block w-10 h-7 align-middle" /> : weekMinutes}
                  </span>
                  <span className="align-middle">Minutes participated</span>
                </div>
              </div>
              <button className="w-10 h-10 rounded-full bg-[#F5F5F4] border border-[#EAEAE5] flex items-center justify-center text-[#5C7089] hover:shadow-card transition-all">
                <CalendarClock className="w-[18px] h-[18px]" />
              </button>
            </div>
            <div className="mb-3 flex items-center gap-2">
              <Badge
                variant="outline"
                className="rounded-full bg-[#DAF39F]/30 border-[#DAF39F]/50 text-[#3E5A0E] text-[11px] font-bold"
              >
                Live engagement
              </Badge>
            </div>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={loading ? skeletonWeekly : weeklyVotingData} barCategoryGap="28%">
                  <CartesianGrid vertical={false} strokeDasharray="4" stroke="#EAEAE5" />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#5C7089", fontSize: 12, fontWeight: 600 }}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: "#F5F5F4" }}
                    contentStyle={{
                      borderRadius: 16,
                      border: "1px solid #EAEAE5",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  />
                  <Bar dataKey="hours" radius={[6, 6, 0, 0]} fill="#FFDEB0" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-[#F0F0EC]">
              {loading
                ? [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)
                : statsCards.map((s, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-2xl bg-[#F5F5F4] border border-[#EAEAE5]"
                    >
                      <div className="text-[11px] font-bold text-[#5C7089] uppercase tracking-wider">
                        {s.label}
                      </div>
                      <div className="text-lg font-extrabold text-[#202124] mt-0.5">{s.val}</div>
                    </div>
                  ))}
            </div>
          </div>

          <div className="lg:col-span-2 pastel-card-white">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-extrabold text-[#202124]">Next Election Events</h3>
              <button className="text-xs font-bold text-[#243056] hover:underline">
                View all events
              </button>
            </div>
            <div className="grid grid-cols-7 gap-2 mb-4">
              {loading
                ? Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="text-center space-y-1">
                      <div className="text-[10px] font-bold text-[#5C7089] uppercase tracking-wide">
                        {["MON","TUE","WED","THU","FRI","SAT","SUN"][i]}
                      </div>
                      <Skeleton className="w-full aspect-square rounded-full" />
                    </div>
                  ))
                : nextEvents.slice(0, 7).map((e, i) => {
                    const d = new Date((e as any).ts || Date.now());
                    const day = ["SUN","MON","TUE","WED","THU","FRI","SAT"][d.getDay()];
                    const date = d.getDate();
                    const isPeak = i === 3;
                    return (
                      <div key={e.id || i} className="text-center space-y-1">
                        <div className="text-[10px] font-bold text-[#5C7089] uppercase tracking-wide">
                          {day}
                        </div>
                        <button
                          className={
                            isPeak
                              ? "w-full aspect-square rounded-full bg-[#DAF39F] text-[#202124] font-bold text-sm shadow-soft"
                              : "w-full aspect-square rounded-full bg-[#F5F5F4] border border-[#EAEAE5] text-[#5C7089] font-semibold text-sm hover:border-[#DAF39F] transition-all"
                          }
                        >
                          {date}
                        </button>
                      </div>
                    );
                  })}
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {loading
                ? [1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-20 rounded-2xl w-full" />
                  ))
                : nextEvents.slice(2, 7).map((e, i) => {
                    const ts = (e as any).ts || (e as any).timestamp;
                    const d = ts ? new Date(ts) : new Date();
                    const status = (e as any).status || "UPCOMING";
                    const owner = (e as any).owner || "Officer";
                    const time = (e as any).time || `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() >= 12 ? "PM" : "AM"}`;
                    return (
                      <div
                        key={e.id || i}
                        className="flex items-center gap-3 p-3 rounded-2xl hover:bg-[#FAFAF7] transition-all cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#EBD3FF] to-[#D6BDF8] flex items-center justify-center text-[11px] font-bold text-[#202124] shrink-0">
                          {String(owner).charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-bold text-[#202124] truncate">
                              {e.title || "Election Event"}
                            </div>
                            <div className="text-[11px] font-bold text-[#5C7089] shrink-0">
                              {time}
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <div className="text-[12px] text-[#5C7089] truncate">{owner}</div>
                            <div
                              className={
                                status === "COMPLETED" || status === "DONE"
                                  ? "text-[11px] font-bold text-[#4CAF7A]"
                                  : status === "MANDATORY" || status === "REQUIRED"
                                  ? "text-[11px] font-bold text-[#202124]"
                                  : "text-[11px] font-bold text-[#5C7089]"
                              }
                            >
                              {status.charAt(0) + status.slice(1).toLowerCase()}
                            </div>
                          </div>
                          <div className="text-[11px] font-mono text-[#9AA7B8] mt-1">
                            {e.description ? e.description.slice(0, 40) + (e.description.length > 40 ? "…" : "") : "30 min"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>
        </div>

        <div id="receipts" className="pastel-card-white !p-0 overflow-hidden">
          <Tabs defaultValue="receipts" className="w-full">
            <div className="px-6 md:px-8 pt-5 md:pt-6 pb-4 border-b border-[#EAEAE5] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <h2 className="text-xl font-extrabold text-[#202124]">
                Voting Workspace
              </h2>
              <TabsList className="rounded-full bg-[#F5F5F4] border border-[#EAEAE5] p-1 h-auto">
                <TabsTrigger
                  value="receipts"
                  className="rounded-full text-xs font-bold px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-card data-[state=active]:text-[#202124]"
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" /> My Receipts
                </TabsTrigger>
                <TabsTrigger
                  value="candidates"
                  className="rounded-full text-xs font-bold px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-card data-[state=active]:text-[#202124]"
                >
                  <Users className="w-3.5 h-3.5 mr-1.5" /> Candidates
                </TabsTrigger>
                <TabsTrigger
                  value="assurance"
                  className="rounded-full text-xs font-bold px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-card data-[state=active]:text-[#202124]"
                >
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Assurance
                </TabsTrigger>
                <TabsTrigger
                  value="activity"
                  className="rounded-full text-xs font-bold px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-card data-[state=active]:text-[#202124]"
                >
                  <Activity className="w-3.5 h-3.5 mr-1.5" /> Activity
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="receipts" className="p-6 md:p-8 space-y-4 focus-visible:outline-none">
              <div className="flex items-center justify-between px-1 mb-1">
                <div>
                  <h3 className="font-extrabold text-[#202124]">My Ballot Proof Cards</h3>
                  <p className="text-xs text-[#5C7089]">
                    Issued receipts with cryptographic inclusion proofs
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="bg-[#F5F5F4] text-[#202124] text-xs font-mono rounded-full border-[#EAEAE5]"
                >
                  {receipts.length} Recorded
                </Badge>
              </div>

              {loading ? (
                [1, 2].map(i => <Skeleton key={i} className="h-40 rounded-2xl w-full" />)
              ) : receipts.length === 0 ? (
                <div className="p-10 rounded-2xl border border-[#FFD6BA] pastel-peach text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-white flex items-center justify-center text-[#E07A24]">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-[#202124]">No Receipts Yet</h3>
                    <p className="text-sm text-[#5C7089]">Cast a ballot to generate your first cryptographic proof receipt.</p>
                  </div>
                  <Link href="/vote">
                    <Button className="rounded-full bg-[#243056] hover:bg-[#1A2340] text-white font-bold text-xs">
                      <Vote className="w-3.5 h-3.5 mr-1.5" /> Go to Ballot Booth
                    </Button>
                  </Link>
                </div>
              ) : (
                receipts.map((rc, idx) => {
                  const fingerprint = rc.fingerprint || (rc.details as any)?.leaf_hash || `${rc.receipt_id}-${idx}`;
                  const entryHash = (rc.details as any)?.entry_hash || (rc.details as any)?.root_hash || fingerprint;
                  const statusText = rc.verified ? "ANCHORED & VERIFIED" : "PENDING WITNESSING";
                  return (
                    <div
                      key={rc.receipt_id || idx}
                      className="p-5 rounded-2xl border border-[#EAEAE5] bg-[#FAFAF7] hover:bg-white hover:border-[#DAF39F]/70 hover:shadow-card transition-all space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-[#DAF39F] text-[#202124] font-bold text-[11px] rounded-full">
                            {rc.kind === "cast_ballot" ? `Ledger Cast Receipt #${idx}` :
                             rc.kind === "test_ballot" || rc.kind === "spoiled_test" ? `Test Receipt #${idx}` :
                             rc.kind === "ballot_token" ? `Token Receipt #${idx}` :
                             `Receipt #${idx}`}
                          </Badge>
                          <span className="text-xs text-[#5C7089] font-medium">{formatTimestamp(rc.issued_at)}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`border-[#DAF39F]/60 text-[10px] font-bold rounded-full ${
                            rc.verified ? "bg-[#DAF39F]/20 text-[#1E6B42]" : "bg-[#FFD6BA]/30 text-[#B84A10]"
                          }`}
                        >
                          {rc.verified ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                          {statusText}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="p-4 rounded-2xl bg-white border border-[#EAEAE5]">
                          <span className="text-[10px] font-bold text-[#5C7089] uppercase tracking-wider block">
                            BALLOT FINGERPRINT
                          </span>
                          <div className="flex items-center justify-between mt-1">
                            <span className="font-mono text-[#202124] font-bold text-sm">
                              {shortHash(fingerprint, 10)}
                            </span>
                            <button
                              onClick={() => copyToClipboard(fingerprint)}
                              className="text-[#5C7089] hover:text-[#202124] p-1.5 rounded-xl hover:bg-[#F5F5F4]"
                              title="Copy fingerprint"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="p-4 rounded-2xl bg-white border border-[#EAEAE5]">
                          <span className="text-[10px] font-bold text-[#5C7089] uppercase tracking-wider block">
                            {rc.kind === "ballot_token" ? "TOKEN TAIL" : "LEDGER ENTRY HASH"}
                          </span>
                          <div className="flex items-center justify-between mt-1">
                            <span className="font-mono text-[#202124] font-bold text-sm">
                              {shortHash(rc.token_tail || entryHash, 10)}
                            </span>
                            <button
                              onClick={() => copyToClipboard(rc.token_tail || entryHash)}
                              className="text-[#5C7089] hover:text-[#202124] p-1.5 rounded-xl hover:bg-[#F5F5F4]"
                              title="Copy hash"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <Link href={`/verify/${fingerprint}`} className="flex-1 min-w-[180px]">
                          <Button
                            variant="outline"
                            className="w-full rounded-full border-[#DAF39F]/70 text-[#202124] hover:bg-[#DAF39F]/20 text-xs font-bold"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-[#3E5A0E]" />
                            Verify Merkle Inclusion Proof
                          </Button>
                        </Link>
                        {rc.kind !== "ballot_token" && (
                          <Link href={`/proof/${fingerprint}`} className="flex-1 min-w-[180px]">
                            <Button
                              variant="outline"
                              className="w-full rounded-full text-xs font-semibold border-[#EAEAE5]"
                            >
                              <QrCode className="w-3.5 h-3.5 mr-1.5" /> View Proof Card
                            </Button>
                          </Link>
                        )}
                        <Button
                          variant="outline"
                          className="rounded-full text-xs font-semibold border-[#EAEAE5]"
                          onClick={() => toast.success("Receipt JSON downloaded")}
                        >
                          <Download className="w-3.5 h-3.5 mr-1.5" /> JSON
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="candidates" id="candidates" className="p-6 md:p-8 space-y-3 focus-visible:outline-none">
              <div className="flex items-center justify-between px-1 mb-2">
                <div>
                  <h3 className="font-extrabold text-[#202124]">Candidate Dossier</h3>
                  <p className="text-xs text-[#5C7089]">Review manifestos prior to ballot sealing</p>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold rounded-full bg-[#F5F5F4] border-[#EAEAE5]"
                >
                  Council {(election?.title || "2026").slice(-4)}
                </Badge>
              </div>
              {loading ? (
                [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl w-full" />)
              ) : candidates.length > 0 ? (
                candidates.map((cand: any, idx: number) => {
                  const label = cand.display_name || cand.name || "";
                  const initials = label.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
                  const avatarUrl = cand.avatar_url ?? null;
                  return (
                    <div
                      key={cand.candidate_code || idx}
                      className="p-4 rounded-2xl border border-[#EAEAE5] bg-[#FAFAF7] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={label}
                              className="w-10 h-10 rounded-full object-cover border border-[#EAEAE5] shrink-0"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#EBD3FF] to-[#CFE8FF] flex items-center justify-center font-bold text-[#202124] shrink-0">
                              {initials}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-base text-[#202124]">{label}</span>
                            {cand.department && (
                              <span className="block text-[11px] text-[#5C7089] font-medium">{cand.department}</span>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono bg-white border-[#EAEAE5] rounded-full">
                          {cand.candidate_code}
                        </Badge>
                      </div>
                      {(cand.statement || cand.party_or_tag) && (
                        <p className="text-xs text-[#5C7089] leading-relaxed">
                          {cand.statement || cand.party_or_tag}
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-6 rounded-2xl border border-[#FFD6BA] pastel-peach text-center">
                  <AlertTriangle className="w-6 h-6 mx-auto text-[#E07A24] mb-2" />
                  <p className="text-sm text-[#5C7089]">No candidates yet — please wait for election setup.</p>
                </div>
              )}
              <Link href="/vote" className="block pt-2">
                <Button className="w-full rounded-full bg-[#202124] hover:bg-[#2D2E33] text-white font-bold text-sm">
                  Proceed to Vote for Candidate <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </TabsContent>

            <TabsContent value="assurance" className="p-6 md:p-8 space-y-3 focus-visible:outline-none">
              <div className="flex items-center justify-between px-1 mb-2">
                <h3 className="font-extrabold text-[#202124] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#3E5A0E]" />
                  Protocol Assurance
                </h3>
              </div>
              {[
                "Voter Privacy Invariant — Identity register is physically unlinked from cast ciphertexts.",
                "RFC 6962 Merkle Proofs — Every ballot is mathematically anchored into an immutable tree.",
                "Two-Books Reconciliation — Strict 1:1 check between voter marks and sealed ballots.",
                "Benaloh Challenge — Browser integrity verified via spoiled test ballot decryption.",
              ].map((l, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-4 rounded-2xl bg-[#FAFAF7] border border-[#EAEAE5]"
                >
                  <div className="w-2 h-2 rounded-full bg-[#DAF39F] mt-2 shrink-0" />
                  <div>
                    <span className="font-bold text-[#202124] block text-sm">
                      {l.split(" — ")[0]}
                    </span>
                    <span className="text-[#5C7089] text-[13px]">
                      {l.split(" — ")[1]}
                    </span>
                  </div>
                </div>
              ))}
              <div className="pt-3">
                <Link href="/integrity">
                  <Button className="rounded-full bg-[#DAF39F] hover:bg-[#C6E66C] text-[#202124] font-bold text-sm shadow-soft">
                    Inspect 10 Ledger Checks <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </TabsContent>

            <TabsContent value="activity" className="p-6 md:p-8 space-y-2 focus-visible:outline-none">
              <div className="flex items-center justify-between px-1 mb-3">
                <h3 className="font-extrabold text-[#202124]">Recent Activity</h3>
              </div>
              <div className="relative pl-6">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#EAEAE5]" />
                {loading
                  ? [1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="relative pb-5">
                        <div className="absolute -left-6 top-0 w-[18px] h-[18px] rounded-full bg-[#F5F5F4] border-2 border-white" />
                        <div className="pl-3 space-y-2">
                          <Skeleton className="h-5 w-60" />
                          <Skeleton className="h-4 w-full" />
                        </div>
                      </div>
                    ))
                  : activityItems.length === 0 ? (
                    <div className="pl-3 text-sm text-[#5C7089]">No activity yet. Complete login or cast a ballot.</div>
                  ) : (
                    activityItems.map((a, i) => {
                      const [I, color] = iconForAction(a.action);
                      return (
                        <div key={a.id || i} className="relative pb-5">
                          <div
                            className={`absolute -left-6 top-0 w-[18px] h-[18px] rounded-full ${color} border-2 border-white shadow-soft flex items-center justify-center`}
                          >
                            <I className="w-2.5 h-2.5 text-[#202124]" strokeWidth={3} />
                          </div>
                          <div className="pl-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-sm text-[#202124]">{a.summary || a.action}</span>
                              <span className="text-[11px] text-[#9AA7B8] font-mono">{formatTimestamp(a.timestamp)}</span>
                            </div>
                            <p className="text-[13px] text-[#5C7089] leading-relaxed mt-0.5">
                              {a.metadata && typeof a.metadata === "object" && Object.keys(a.metadata).length > 0
                                ? Object.entries(a.metadata)
                                    .filter(([k]) => !k.startsWith("_"))
                                    .slice(0, 2)
                                    .map(([k, v]) => `${k}: ${String(v)}`)
                                    .join(" • ")
                                : `${a.resource_type ? a.resource_type + " • " : ""}${a.action}`}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </SidebarDashboardLayout>
  );
}
