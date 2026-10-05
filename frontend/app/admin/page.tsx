"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminSession } from "@/hooks/useAdminSession";
import { adminLogout } from "@/lib/api/auth";
import { getElectionConfig, getElectionStats, listElections, ElectionConfigResponse, type ElectionSummary } from "@/lib/api/elections";
import { getIntegrityStatus } from "@/lib/api/integrity";
import {
  getAuditEvents,
  verifyAuditChain,
  getSecurityAlerts,
  closeElection,
  startTally,
  getTrustees,
  getTallySessions,
  approveTally,
  seedDemoVotes,
  runDemoAttack,
  setDemoDevice,
  resetDemo,
  AuditEventOut,
  SecurityAlertOut,
  TrusteeOut,
  TallySessionOut,
  DemoAttackResponse,
} from "@/lib/api/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { shortHash } from "@/lib/utils";
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  LogOut,
  KeyRound,
  FileCode,
  Zap,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Play,
  RotateCcw,
  Users,
  Award,
  FileText,
  Database,
  Eye,
  BarChart3,
  Activity,
  ChevronRight,
  CalendarClock,
} from "lucide-react";
import { SidebarDashboardLayout } from "@/components/layouts/SidebarDashboardLayout";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const systemHealth = [
  {
    cls: "pastel-peach",
    tag: "Due Jun 25",
    title: "Election Phase Monitor",
    desc: "Current state: OPEN. Voting accepted until cut-off. Next transition: closing.",
    pct: 65,
  },
  {
    cls: "pastel-lavender",
    tag: "Due Jul 5",
    title: "Two-Books Reconciliation",
    desc: "1:1 strict ratio. 0 phantom ballots detected. Continuous check engine.",
    pct: 100,
  },
  {
    cls: "pastel-lime",
    tag: "Due Jul 12",
    title: "Witness Mirror Consensus",
    desc: "3/3 independent witnesses synchronized. Ed25519 STH fully validated.",
    pct: 100,
  },
  {
    cls: "pastel-sky",
    tag: "Due Aug 15",
    title: "Threshold Key Custodians",
    desc: "2-of-3 Shamir shares. Tally private key reconstructed only in memory.",
    pct: 33,
  },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const { authenticated, loading: sessionLoading } = useAdminSession();

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<ElectionConfigResponse | null>(null);
  const [elections, setElections] = useState<ElectionSummary[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventOut[]>([]);
  const [auditStatus, setAuditStatus] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlertOut[]>([]);
  const [trustees, setTrustees] = useState<TrusteeOut[]>([]);
  const [tallySessions, setTallySessions] = useState<TallySessionOut[]>([]);
  const [attackResult, setAttackResult] = useState<DemoAttackResponse | null>(null);
  const [attackLoading, setAttackLoading] = useState(false);
  const [compromisedDevice, setCompromisedDevice] = useState(false);

  // Live system health — populated from real API data
  const [systemHealth, setSystemHealth] = useState([
    { cls: "pastel-peach",   title: "Election Phase",          desc: "Loading…", pct: 0, tag: "Live" },
    { cls: "pastel-lavender", title: "Two-Books Reconciliation", desc: "Loading…", pct: 0, tag: "Live" },
    { cls: "pastel-lime",    title: "Witness Consensus",        desc: "Loading…", pct: 0, tag: "Live" },
    { cls: "pastel-sky",     title: "Threshold Key Custodians", desc: "2-of-3 Shamir shares. Tally private key reconstructed only in memory.", pct: 33, tag: "Config" },
  ]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [cfg, evs, alr, trs, tss, elecs] = await Promise.all([
        getElectionConfig(),
        getAuditEvents().catch(() => []),
        getSecurityAlerts().catch(() => []),
        getTrustees().catch(() => []),
        getTallySessions().catch(() => []),
        listElections().catch(() => [] as ElectionSummary[]),
      ]);
      setConfig(cfg);
      setAuditEvents(evs);
      setAlerts(alr);
      setTrustees(trs);
      setTallySessions(tss);
      setElections(elecs as ElectionSummary[]);

      // Load real stats + integrity to populate system health cards
      const eid = cfg?.election?.id;
      if (eid) {
        const [statsRes, integrityRes] = await Promise.allSettled([
          getElectionStats(eid).catch(() => null),
          getIntegrityStatus().catch(() => null),
        ]);
        const stats = statsRes.status === "fulfilled" ? statsRes.value : null;
        const integrity = integrityRes.status === "fulfilled" ? integrityRes.value : null;

        const stateRaw = String(cfg?.state || "OPEN").toUpperCase();
        const castBallots = (stats as any)?.cast_ballots ?? 0;
        const eligibleVoters = (stats as any)?.eligible_voters ?? 0;
        const turnout = (stats as any)?.turnout_percent ?? 0;
        const intStatus = (integrity as any)?.overall ?? (integrity as any)?.status ?? "UNKNOWN";
        const reconStatus = (integrity as any)?.reconciliation?.status ?? "UNKNOWN";
        const witnessTotal = (integrity as any)?.metrics?.witnesses_total ?? 0;
        const witnessSynced = (integrity as any)?.metrics?.witnesses_synced ?? 0;
        const activeAlerts = (alr as SecurityAlertOut[]).filter((a) => a.is_active).length;

        setSystemHealth([
          {
            cls: "pastel-peach",
            title: "Election Phase Monitor",
            desc: `State: ${stateRaw}. ${castBallots} votes cast from ${eligibleVoters} eligible. Turnout: ${turnout}%.${activeAlerts > 0 ? ` ${activeAlerts} active alert(s).` : ""}`,
            pct: Math.min(100, Math.round(turnout)),
            tag: stateRaw,
          },
          {
            cls: "pastel-lavender",
            title: "Two-Books Reconciliation",
            desc: reconStatus === "PASS"
              ? `1:1 match — ${castBallots} ballots verified. No phantom entries detected.`
              : reconStatus === "FAIL"
              ? `Reconciliation FAILED — discrepancy detected. Check integrity dashboard.`
              : "Reconciliation status unknown. Run an integrity check.",
            pct: reconStatus === "PASS" ? 100 : reconStatus === "FAIL" ? 0 : 50,
            tag: reconStatus === "PASS" ? "PASS" : reconStatus === "FAIL" ? "FAIL" : "—",
          },
          {
            cls: "pastel-lime",
            title: "Witness Mirror Consensus",
            desc: witnessTotal > 0
              ? `${witnessSynced}/${witnessTotal} witnesses synchronized. ${intStatus === "VERIFIED" ? "Ed25519 STH valid." : "Check witness status."}`
              : "No witnesses registered yet.",
            pct: witnessTotal > 0 ? Math.round((witnessSynced / witnessTotal) * 100) : 0,
            tag: witnessTotal > 0 ? `${witnessSynced}/${witnessTotal}` : "None",
          },
          {
            cls: "pastel-sky",
            title: "Threshold Key Custodians",
            desc: `2-of-3 Shamir shares. ${tss.length > 0 ? `${tss.length} tally session(s) recorded.` : "No tally sessions yet."} Key reconstructed only in memory.`,
            pct: tss.length > 0 ? 66 : 33,
            tag: tss.length > 0 ? "Active" : "Standby",
          },
        ]);
      }
    } catch (err: unknown) {
      const e = err as Error;
      toast.error(e.message || "Failed to load admin dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionLoading && !authenticated) {
      router.push("/auth/admin/login");
    } else if (authenticated) {
      loadAllData();
    }
  }, [authenticated, sessionLoading, router]);

  const ok = (msg: string) => toast.success(msg);
  const err = (e: any) => toast.error((e as Error)?.message || "Operation failed");

  const handleCloseElection = async (electionId?: string) => {
    const eid = electionId || config?.election?.id;
    if (!eid) return;
    try {
      await closeElection(eid);
      ok("Election voting closed successfully.");
      await loadAllData();
    } catch (e) { err(e); }
  };

  const handleVerifyAudit = async () => {
    try {
      const res = await verifyAuditChain();
      setAuditStatus(
        res.ok
          ? `Audit Chain Valid (${res.total_events} events)`
          : `Audit Tampered at event #${res.first_bad_id}`
      );
      ok(res.ok ? "Audit chain verified." : "Tampering detected!");
    } catch (e) { err(e); }
  };

  const handleStartTally = async (electionId?: string) => {
    const eid = electionId || config?.election?.id;
    if (!eid) return;
    try {
      await startTally(eid);
      ok("Tally session started. Require 2 trustee approvals.");
      await loadAllData();
    } catch (e) { err(e); }
  };

  const handleApproveTally = async (sessionId: string, shareData: Record<string, unknown>) => {
    try {
      await approveTally(sessionId, { trustee_share: shareData });
      ok("Trustee key share submitted!");
      await loadAllData();
    } catch (e) { err(e); }
  };

  const handleSeedVotes = async () => {
    try {
      await seedDemoVotes(10);
      ok("Seeded 10 demo votes successfully.");
      await loadAllData();
    } catch (e) { err(e); }
  };

  const handleRunAttack = async (kind: string) => {
    setAttackLoading(true);
    setAttackResult(null);
    try {
      const res = await runDemoAttack(kind);
      setAttackResult(res);
      toast.warning(`Attack executed: ${kind}`);
      await loadAllData();
    } catch (e) { err(e); }
    finally {
      setAttackLoading(false);
    }
  };

  const handleToggleDevice = async () => {
    try {
      const res = await setDemoDevice(!compromisedDevice);
      setCompromisedDevice(res.compromised_device);
      ok(`Compromised Device Simulation: ${res.compromised_device ? "ON" : "OFF"}`);
    } catch (e) { err(e); }
  };

  const handleResetDemo = async () => {
    try {
      await resetDemo();
      ok("Demo state reset to clean baseline.");
      setAttackResult(null);
      await loadAllData();
    } catch (e) { err(e); }
  };

  if (sessionLoading || loading) {
    return (
      <SidebarDashboardLayout role="admin">
        <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#243056]" />
          <p className="text-sm text-[#5C7089]">
            Authenticating and fetching election state...
          </p>
        </div>
      </SidebarDashboardLayout>
    );
  }

  const stateRaw = String(config?.state || "open").toLowerCase();
  const stateColor =
    stateRaw === "open"
      ? "pastel-lime"
      : stateRaw === "closed"
      ? "pastel-lavender"
      : "pastel-peach";

  return (
    <SidebarDashboardLayout role="admin">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={`${stateColor} text-[#202124] border-transparent rounded-full text-[11px] font-bold px-3.5 py-1 shadow-card`}
              >
                <Lock className="w-3.5 h-3.5 mr-1.5 inline align-sub" />
                ELECTION OFFICER CONSOLE
              </Badge>
              <Badge
                variant="outline"
                className="bg-[#F5F5F4] border-[#EAEAE5] rounded-full text-[11px] font-bold px-3.5 py-1"
              >
                STATE: {stateRaw.toUpperCase()}
              </Badge>
            </div>
            <h1 className="text-[2.25rem] font-extrabold tracking-tight leading-none">
              Governance Center
            </h1>
            <p className="text-[#5C7089] text-sm md:text-base">
              {config?.election?.title || "Student Council Election"} • Threshold Cryptography & Audit Engine
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="h-11 rounded-full border-[#EAEAE5] bg-white font-bold text-sm hover:shadow-card"
              onClick={loadAllData}
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
            <Button
              variant="destructive"
              className="h-11 rounded-full font-bold text-sm bg-[#E05252] hover:bg-[#CC4242]"
              onClick={async () => {
                await adminLogout().catch(() => {});
                router.push("/");
              }}
            >
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </Button>
          </div>
        </div>

        {/* System Health 4 pastel card row */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xl font-extrabold text-[#202124]">System Health at a Glance</h3>
            <Badge variant="outline" className="bg-[#F5F5F4] border-[#EAEAE5] rounded-full text-[11px] font-bold px-3 py-1">
              Live Monitors
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {systemHealth.map((h, i) => (
              <div key={i} className={`pastel-card ${h.cls} hover:shadow-soft hover:-translate-y-0.5 transition-all`}>
                <div className="space-y-3">
                  <span className="px-3 py-1 rounded-full bg-white/60 text-[11px] font-bold text-[#202124] inline-flex items-center gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5" /> {h.tag}
                  </span>
                  <h3 className="font-bold text-[1.05rem] text-[#202124] leading-snug">
                    {h.title}
                  </h3>
                  <p className="text-[13px] text-[#4A5568] leading-relaxed">{h.desc}</p>
                </div>
                <div className="pt-5 space-y-2">
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${h.pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#202124]/80">
                    <span>Health</span>
                    <span>{h.pct}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Elections Management — per-election close/tally controls */}
        {elections.length > 0 && (
          <div className="pastel-card-white !p-0 overflow-hidden">
            <div className="px-6 md:px-8 pt-5 md:pt-6 pb-4 border-b border-[#EAEAE5] flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-lg text-[#202124]">Elections Management</h3>
                <p className="text-xs text-[#5C7089] mt-0.5">Close voting and initiate tally for each election</p>
              </div>
              <Badge variant="outline" className="bg-[#F5F5F4] border-[#EAEAE5] rounded-full text-xs font-bold px-3">
                {elections.length} election{elections.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <div className="divide-y divide-[#F5F5F4]">
              {elections.map((el: any) => {
                const es = String(el.state || "DRAFT").toUpperCase();
                const isOpen = es === "OPEN";
                const isClosed = es === "CLOSED";
                return (
                  <div key={el.id} className="px-6 md:px-8 py-4 flex flex-wrap items-center gap-3 justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isOpen ? "bg-[#4CAF7A] animate-pulse" : isClosed ? "bg-[#9AA7B8]" : "bg-[#F59E0B]"}`} />
                      <div className="min-w-0">
                        <div className="font-bold text-[#202124] truncate">{el.title}</div>
                        <div className="text-xs text-[#5C7089] font-mono">{el.public_id}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`rounded-full text-[10px] font-bold px-2.5 ${
                          isOpen ? "bg-[#E8F6EE] border-[#4CAF7A]/30 text-[#3E5A0E]" :
                          isClosed ? "bg-[#F5F5F4] border-[#EAEAE5] text-[#5C7089]" :
                          "bg-[#FFF8E1] border-[#FFDEB0] text-[#845913]"
                        }`}
                      >
                        {es}
                      </Badge>
                      {isOpen && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full border-[#EAEAE5] font-bold text-xs h-8"
                          onClick={() => handleCloseElection(el.id)}
                        >
                          <Lock className="w-3.5 h-3.5 mr-1.5" /> Close Voting
                        </Button>
                      )}
                      {isClosed && (
                        <Button
                          size="sm"
                          className="rounded-full bg-[#DAF39F] hover:bg-[#C6E66C] text-[#202124] font-bold text-xs h-8 shadow-soft"
                          onClick={() => handleStartTally(el.id)}
                        >
                          <Play className="w-3.5 h-3.5 mr-1.5" /> Start Tally
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="rounded-full text-xs h-8 text-[#5C7089]"
                      >
                        <a href={`/results`}>View Results →</a>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="pastel-card-white !p-5 md:!p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-lg text-[#202124]">Governance Quick Actions</h3>
            <p className="text-[13px] text-[#5C7089] mt-1">
              State-machine transitions, demo seeding, and threshold operations.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {stateRaw === "open" && (
              <Button
                variant="outline"
                className="rounded-full h-10 border-[#EAEAE5] font-bold text-sm"
                onClick={handleCloseElection}
              >
                <Lock className="w-4 h-4 mr-1.5" /> Close Voting
              </Button>
            )}
            {stateRaw === "closed" && (
              <Button
                className="rounded-full h-10 bg-[#DAF39F] hover:bg-[#C6E66C] text-[#202124] font-bold text-sm shadow-soft"
                onClick={handleStartTally}
              >
                <Play className="w-4 h-4 mr-1.5" /> Start Tally Session
              </Button>
            )}
            <Button
              variant="outline"
              className="rounded-full h-10 border-[#EAEAE5] font-bold text-sm"
              onClick={handleSeedVotes}
            >
              + Seed 10 Votes
            </Button>
            <Button
              variant="outline"
              className="rounded-full h-10 border-[#E05252]/40 text-[#E05252] hover:bg-[#FDEDED] font-bold text-sm"
              onClick={handleResetDemo}
            >
              <RotateCcw className="w-4 h-4 mr-1.5" /> Reset Demo
            </Button>
          </div>
        </div>

        {/* Main workspace tabs */}
        <div className="pastel-card-white !p-0 overflow-hidden">
          <Tabs defaultValue="demo" className="w-full">
            <div className="px-6 md:px-8 pt-5 md:pt-6 pb-4 border-b border-[#EAEAE5] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <h2 className="text-xl font-extrabold text-[#202124]">Governance Workspace</h2>
              <TabsList className="rounded-full bg-[#F5F5F4] border border-[#EAEAE5] p-1 h-auto">
                <TabsTrigger
                  value="demo"
                  className="rounded-full text-xs font-bold px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-card data-[state=active]:text-[#202124]"
                >
                  <Zap className="w-3.5 h-3.5 mr-1.5" /> Demo Center
                </TabsTrigger>
                <TabsTrigger
                  value="trustees"
                  className="rounded-full text-xs font-bold px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-card data-[state=active]:text-[#202124]"
                >
                  <KeyRound className="w-3.5 h-3.5 mr-1.5" /> Trustee Tally
                </TabsTrigger>
                <TabsTrigger
                  value="audit"
                  className="rounded-full text-xs font-bold px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-card data-[state=active]:text-[#202124]"
                >
                  <FileCode className="w-3.5 h-3.5 mr-1.5" /> Audit Log Chain
                </TabsTrigger>
                <TabsTrigger
                  value="activity"
                  className="rounded-full text-xs font-bold px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-card data-[state=active]:text-[#202124]"
                >
                  <Activity className="w-3.5 h-3.5 mr-1.5" /> Live Activity
                </TabsTrigger>
              </TabsList>
            </div>

            {/* DEMO */}
            <TabsContent value="demo" className="p-6 md:p-8 space-y-6 focus-visible:outline-none">
              <div
                className={`p-5 md:p-6 rounded-2xl ${compromisedDevice ? "bg-[#FFE5E5] border border-[#E05252]/40" : "bg-[#FFF6E0] border border-[#FFDEB0]"}`}
              >
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-5 h-5 text-[#B58900]" />
                      <h3 className="text-xl font-extrabold text-[#202124]">
                        Hackathon Tamper & Attack Simulator
                      </h3>
                    </div>
                    <p className="text-[13px] text-[#6B5316] max-w-2xl leading-relaxed">
                      Simulate real-world election security attacks to demonstrate instant detection and sticky
                      witness alarms. Perfect for academic demonstrations.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="rounded-full h-10 border-[#EAEAE5] bg-white font-bold text-xs"
                      onClick={handleSeedVotes}
                    >
                      + Seed 10 Votes
                    </Button>
                    <Button
                      variant="destructive"
                      className="rounded-full h-10 bg-[#E05252] hover:bg-[#CC4242] font-bold text-xs"
                      onClick={handleResetDemo}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset Demo
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { title: "1. Stuff Ballot", desc: "Inject unissued vote", kind: "stuff_ballot", color: "pastel-peach" },
                  { title: "2. Tamper History", desc: "Modify past ciphertext", kind: "tamper_history", color: "pastel-lavender" },
                  { title: "3. Tamper Audit", desc: "Break hash-chained log", kind: "tamper_audit", color: "pastel-lime" },
                  { title: "4. Double Vote", desc: "Token replay attempt", kind: "double_vote", color: "pastel-sky" },
                  { title: "5. Fork Witness", desc: "Rewrite STH sticky alarm", kind: "fork_witness", color: "pastel-peach" },
                  { title: "6. Cast Tested", desc: "Spoiled ballot attempt", kind: "cast_tested", color: "pastel-lavender" },
                  { title: "7. Bad Signature", desc: "Invalid IV / payload", kind: "bad_signature", color: "pastel-lime" },
                ].map((a, i) => (
                  <AttackButton
                    key={i}
                    title={a.title}
                    desc={a.desc}
                    kind={a.kind}
                    color={a.color}
                    onClick={handleRunAttack}
                    loading={attackLoading}
                  />
                ))}
                <Button
                  variant="outline"
                  onClick={handleToggleDevice}
                  className={`h-auto min-h-[82px] p-3 rounded-2xl flex flex-col items-start justify-between text-left border ${
                    compromisedDevice
                      ? "border-[#E05252] bg-[#FFE5E5] hover:bg-[#FFD6D6]"
                      : "border-[#EAEAE5] bg-white pastel-sky hover:shadow-card"
                  }`}
                >
                  <span className="font-bold text-xs text-[#202124]">8. Compromised Device</span>
                  <span className="text-[11px] text-[#4A5568] mt-1">
                    Malware simulation: {compromisedDevice ? "ACTIVE" : "OFF"}
                  </span>
                </Button>
              </div>

              {attackResult && (
                <div className="p-5 rounded-2xl border border-[#E05252]/50 bg-[#FFE5E5]/80 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge
                      variant="destructive"
                      className="font-bold rounded-full px-3.5 py-1"
                    >
                      ATTACK EXECUTED: {attackResult.kind.toUpperCase()}
                    </Badge>
                    <span className="text-[11px] font-mono text-[#E05252]">
                      Affected Index: #{attackResult.affected_index ?? "N/A"}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-[#202124]">{attackResult.note}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono bg-white p-4 rounded-2xl border border-[#E05252]/30">
                    <div>
                      <span className="text-[#9AA7B8] uppercase tracking-wider block text-[10px] font-bold">
                        Before Integrity
                      </span>
                      <span className="font-bold text-[#4CAF7A] text-sm">
                        {attackResult.before_integrity || "VERIFIED"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#9AA7B8] uppercase tracking-wider block text-[10px] font-bold">
                        After Integrity
                      </span>
                      <span className="font-bold text-[#E05252] text-sm">
                        {attackResult.after_integrity || "COMPROMISED"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TRUSTEES */}
            <TabsContent value="trustees" className="p-6 md:p-8 space-y-6 focus-visible:outline-none">
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <KeyRound className="w-5 h-5 text-[#243056]" />
                    <h3 className="text-xl font-extrabold text-[#202124]">
                      Shamir 2-of-3 Key Reconstruction
                    </h3>
                  </div>
                  <p className="text-[13px] text-[#5C7089] max-w-2xl">
                    Election private key split across 3 trustees. Reconstructed strictly in memory during tallying.
                  </p>
                </div>
                <div className="flex gap-2">
                  {stateRaw === "open" && (
                    <Button
                      variant="outline"
                      className="rounded-full h-10 border-[#EAEAE5] bg-white font-bold text-xs"
                      onClick={handleCloseElection}
                    >
                      <Lock className="w-3.5 h-3.5 mr-1.5" /> Close Voting
                    </Button>
                  )}
                  {stateRaw === "closed" && (
                    <Button
                      className="rounded-full h-10 bg-[#DAF39F] hover:bg-[#C6E66C] text-[#202124] font-bold text-xs shadow-soft"
                      onClick={handleStartTally}
                    >
                      <Play className="w-3.5 h-3.5 mr-1.5" /> Start Tally Session
                    </Button>
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-[#EAEAE5]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F5F5F4] border-b border-[#EAEAE5]">
                      <TableHead className="text-[11px] font-bold text-[#5C7089] uppercase tracking-wider">Role</TableHead>
                      <TableHead className="text-[11px] font-bold text-[#5C7089] uppercase tracking-wider">Display Name</TableHead>
                      <TableHead className="text-[11px] font-bold text-[#5C7089] uppercase tracking-wider">Threshold Group</TableHead>
                      <TableHead className="text-right text-[11px] font-bold text-[#5C7089] uppercase tracking-wider">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trustees.map((t) => (
                      <TableRow key={t.role_code} className="border-b border-[#F0F0EC] last:border-0">
                        <TableCell className="font-bold text-xs uppercase text-[#202124]">{t.role_code}</TableCell>
                        <TableCell className="text-sm">{t.display_name}</TableCell>
                        <TableCell className="text-xs font-mono text-[#243056]">{t.threshold_group}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={tallySessions.length === 0}
                            onClick={() =>
                              handleApproveTally(tallySessions[0]?.id || "", {
                                trustee_code: t.role_code,
                                share: "demo-share-data",
                              })
                            }
                            className="rounded-full font-bold text-xs"
                          >
                            Submit Share
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-extrabold text-[#202124]">Tally Sessions</h4>
                {tallySessions.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-[#F5F5F4] text-sm text-[#5C7089]">
                    No active tally session. Close voting to initiate threshold decryption.
                  </div>
                ) : (
                  tallySessions.map((s) => (
                    <div
                      key={s.id}
                      className="p-5 rounded-2xl border border-[#EAEAE5] bg-[#FAFAF7] flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold text-[#202124]">Session #{shortHash(s.id || "", 8)}</div>
                        <p className="text-[13px] text-[#5C7089]">Status: {s.status.toUpperCase()}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-[#DAF39F]/40 border-[#DAF39F]/60 text-[#3E5A0E] font-bold rounded-full px-3.5 py-1 self-start md:self-center"
                      >
                        {s.approvals_received} / {s.approvals_required} Key Shares Submitted
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* AUDIT */}
            <TabsContent value="audit" className="p-6 md:p-8 space-y-6 focus-visible:outline-none">
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileCode className="w-5 h-5 text-[#243056]" />
                    <h3 className="text-xl font-extrabold text-[#202124]">Hash-Chained Audit Trail</h3>
                  </div>
                  <p className="text-[13px] text-[#5C7089] max-w-2xl">
                    Immutable log chain linking every critical admin and voting operation.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="rounded-full h-10 border-[#EAEAE5] bg-white font-bold text-xs self-start"
                  onClick={handleVerifyAudit}
                >
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Verify Chain Integrity
                </Button>
              </div>

              {auditStatus && (
                <div
                  className={`p-4 rounded-2xl border ${
                    auditStatus.includes("Valid")
                      ? "border-[#4CAF7A]/40 bg-[#E8F6EE]"
                      : "border-[#E05252]/40 bg-[#FFE5E5]"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {auditStatus.includes("Valid") ? (
                      <ShieldCheck className="w-5 h-5 text-[#4CAF7A] mt-0.5" />
                    ) : (
                      <ShieldAlert className="w-5 h-5 text-[#E05252] mt-0.5" />
                    )}
                    <div>
                      <div className="text-sm font-bold text-[#202124]">Audit Verification Result</div>
                      <div className="text-xs font-mono mt-0.5">{auditStatus}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-2xl border border-[#EAEAE5]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F5F5F4] border-b border-[#EAEAE5]">
                      <TableHead className="text-[11px] font-bold text-[#5C7089] uppercase tracking-wider">Time</TableHead>
                      <TableHead className="text-[11px] font-bold text-[#5C7089] uppercase tracking-wider">Action</TableHead>
                      <TableHead className="text-[11px] font-bold text-[#5C7089] uppercase tracking-wider">Actor</TableHead>
                      <TableHead className="text-[11px] font-bold text-[#5C7089] uppercase tracking-wider hidden md:table-cell">Prev Hash</TableHead>
                      <TableHead className="text-[11px] font-bold text-[#5C7089] uppercase tracking-wider">Event Hash</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditEvents.slice(0, 15).map((ev) => (
                      <TableRow key={ev.id} className="border-b border-[#F0F0EC] last:border-0">
                        <TableCell className="text-xs text-[#9AA7B8]">
                          {new Date(ev.created_at).toLocaleTimeString()}
                        </TableCell>
                        <TableCell className="font-bold text-xs text-[#202124]">{ev.action}</TableCell>
                        <TableCell className="text-xs text-[#5C7089]">{ev.actor_type}</TableCell>
                        <TableCell className="font-mono text-xs text-[#9AA7B8] hidden md:table-cell">
                          {shortHash(ev.previous_hash, 10)}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-[#243056]">
                          {shortHash(ev.event_hash, 10)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ACTIVITY */}
            <TabsContent value="activity" className="p-6 md:p-8 space-y-4 focus-visible:outline-none">
              <div className="flex items-center justify-between px-1 mb-2">
                <h3 className="font-extrabold text-[#202124]">Live Activity Feed</h3>
              </div>
              <div className="relative pl-6">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#EAEAE5]" />
                {auditEvents.slice(0, 12).map((ev, i) => {
                  const colors = ["pastel-peach", "pastel-lavender", "pastel-lime", "pastel-sky"];
                  const color = colors[i % 4];
                  return (
                    <div key={ev.id} className="relative pb-5">
                      <div
                        className={`absolute -left-6 top-0 w-[18px] h-[18px] rounded-full ${color} border-2 border-white shadow-soft flex items-center justify-center`}
                      >
                        <Activity className="w-2.5 h-2.5 text-[#202124]" strokeWidth={3} />
                      </div>
                      <div className="pl-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-sm text-[#202124]">{ev.action}</span>
                          <span className="text-[11px] font-mono text-[#9AA7B8]">
                            {new Date(ev.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-[13px] text-[#5C7089] leading-relaxed mt-0.5">
                          Event by {ev.actor_type || "system"} • chain hash{" "}
                          <span className="font-mono">{shortHash(ev.event_hash, 8)}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </SidebarDashboardLayout>
  );
}

function AttackButton({
  title,
  desc,
  kind,
  onClick,
  loading,
  color,
}: {
  title: string;
  desc: string;
  kind: string;
  onClick: (k: string) => void;
  loading: boolean;
  color: string;
}) {
  return (
    <Button
      variant="outline"
      disabled={loading}
      onClick={() => onClick(kind)}
      className={`h-auto min-h-[82px] p-3 rounded-2xl flex flex-col items-start justify-between text-left border border-[#EAEAE5] bg-white ${color} hover:shadow-soft hover:-translate-y-0.5 transition-all`}
    >
      <span className="font-bold text-xs text-[#202124]">{title}</span>
      <span className="text-[11px] text-[#4A5568] mt-1 leading-relaxed">{desc}</span>
    </Button>
  );
}
