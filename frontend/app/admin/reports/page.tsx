"use client";

import { useEffect, useState } from "react";
import { SidebarDashboardLayout } from "@/components/layouts/SidebarDashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import Link from "next/link";
import {
  FileCheck,
  Download,
  FileKey,
  FileBarChart2,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Users,
  Activity,
  ChevronRight,
  ExternalLink,
  FolderArchive,
  Scale,
} from "lucide-react";
import {
  listElections,
  getElectionStats,
  getElectionMilestones,
  type ElectionSummary,
  type MilestoneItem,
} from "@/lib/api/elections";
import {
  getReportsEvidence,
  getElectionReport,
  getTallySessions,
  getIntegrityHistory,
  type EvidenceBundleOut,
  type TallySessionOut,
  type IntegrityResponse,
} from "@/lib/api/admin";

export default function AdminReports() {
  const [loading, setLoading] = useState(true);
  const [elections, setElections] = useState<ElectionSummary[]>([]);
  const [electionId, setElectionId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<{ bundles: EvidenceBundleOut[]; audit_count: number; alert_count: number; status?: string | null } | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [stats, setStats] = useState<{ eligible?: number; registered?: number; turnout?: number; cast?: number; state?: string } | null>(null);
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [sessions, setSessions] = useState<TallySessionOut[]>([]);
  const [integrity, setIntegrity] = useState<IntegrityResponse[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const el = await listElections("admin");
        if (!alive) return;
        setElections(el);
        if (el.length) setElectionId(el[0].id ?? el[0].public_id);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load elections");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!electionId) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const [ev, rep, st, ms, ss, ig] = await Promise.all([
          getReportsEvidence(electionId).catch(() => ({ bundles: [], audit_event_count: 0, active_alert_count: 0 })),
          getElectionReport(electionId).catch(() => ({ bundles: [] })),
          getElectionStats(electionId).catch(() => ({ turnout_percent: 0 })),
          getElectionMilestones(electionId).catch(() => ({ items: [] })),
          getTallySessions().catch(() => []),
          getIntegrityHistory().catch(() => []),
        ]);
        if (!alive) return;
        setEvidence({
          bundles: (ev as unknown as { bundles?: EvidenceBundleOut[] })?.bundles ?? (rep as unknown as { bundles?: EvidenceBundleOut[] })?.bundles ?? [],
          audit_count: (ev as unknown as { audit_event_count?: number })?.audit_event_count ?? 0,
          alert_count: (ev as unknown as { active_alert_count?: number })?.active_alert_count ?? 0,
          status: (ev as unknown as { latest_integrity_status?: string })?.latest_integrity_status ?? null,
        });
        setSummary((rep as unknown as Record<string, unknown>) ?? null);
        setStats({
          eligible: (st as unknown as { eligible_voters?: number })?.eligible_voters,
          registered: (st as unknown as { registered_voters?: number })?.registered_voters,
          cast: (st as unknown as { cast_ballots?: number })?.cast_ballots,
          turnout: (st as unknown as { turnout_percent?: number })?.turnout_percent,
          state: (st as unknown as { state?: string })?.state,
        });
        setMilestones((ms as unknown as { items?: MilestoneItem[] })?.items ?? []);
        setSessions(Array.isArray(ss) ? ss : []);
        setIntegrity(Array.isArray(ig) ? ig.slice(0, 10) : []);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load reports");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [electionId]);

  function downloadBundle(b: EvidenceBundleOut) {
    const data = JSON.stringify(b, null, 2);
    const blob = new Blob([data], { type: b.content_type?.includes("json") ? "application/json" : "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${b.bundle_id}.${b.content_type?.includes("json") ? "json" : "bin"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${b.bundle_id.slice(0, 8)}`);
  }

  function downloadSummary() {
    if (!summary) {
      toast.warning("No report summary available");
      return;
    }
    const data = JSON.stringify(summary, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `election-report-${electionId?.slice(0, 8) ?? "all"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Election report exported");
  }

  return (
    <SidebarDashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[2.25rem] font-extrabold tracking-tight leading-none">Reports & Evidence</h1>
            <p className="text-[#5C7089] text-sm mt-1">
              Certification evidence, tally session logs, integrity check history, and exportable election summary.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/ballots">
              <Button variant="outline" className="rounded-full border-[#EAEAE5] h-11 font-bold text-sm">
                <FileCheck className="w-4 h-4 mr-2" /> Ballot Ledger
              </Button>
            </Link>
            <Link href="/admin/voters">
              <Button variant="outline" className="rounded-full border-[#EAEAE5] h-11 font-bold text-sm">
                <Users className="w-4 h-4 mr-2" /> Voter Roster
              </Button>
            </Link>
            <Button
              className="rounded-full h-11 bg-[#DAF39F] hover:bg-[#C6E66C] text-[#202124] font-bold text-sm shadow-soft"
              onClick={downloadSummary}
            >
              <Download className="w-4 h-4 mr-2" /> Export Full Report
            </Button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Evidence Bundles", value: evidence?.bundles.length ?? 0, cls: "pastel-lavender", icon: FolderArchive },
            { label: "Audit Events", value: evidence?.audit_count ?? 0, cls: "pastel-peach", icon: Activity },
            { label: "Active Alerts", value: evidence?.alert_count ?? 0, cls: evidence?.alert_count ? "pastel-peach" : "pastel-lime", icon: AlertTriangle },
            { label: "Turnout", value: stats?.turnout != null ? `${Number(stats.turnout).toFixed(1)}%` : "—", cls: "pastel-sky", icon: Scale },
          ].map((s) => {
            const I = s.icon;
            return (
              <div key={s.label} className={`${s.cls} pastel-card !p-5`}>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-[#202124]/70 uppercase tracking-wider">{s.label}</div>
                  <I className="w-4.5 h-4.5 text-[#202124]" />
                </div>
                {loading ? (
                  <Skeleton className="mt-2 w-20 h-10 rounded-xl" />
                ) : (
                  <div className="mt-2 text-3xl font-black tracking-tight text-[#202124]">{s.value}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Election selector */}
        <div className="pastel-card-white !p-5 md:!p-6 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-3 min-w-[220px] flex-1">
            <div className="w-9 h-9 rounded-2xl pastel-card pastel-sky !p-0 flex items-center justify-center">
              <FileBarChart2 className="w-4.5 h-4.5 text-[#202124]" />
            </div>
            <div>
              <h3 className="font-extrabold text-[15px] text-[#202124]">Election Context</h3>
              <p className="text-[11px] text-[#5C7089]">Select election to generate reports</p>
            </div>
          </div>
          <select
            className="h-11 rounded-full bg-[#F5F5F4] border-[#EAEAE5] px-4 text-sm font-semibold text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#DAF39F] min-w-[260px]"
            value={electionId ?? ""}
            disabled={loading && !elections.length}
            onChange={(e) => setElectionId(e.target.value)}
          >
            {!electionId && <option value="">Choose election...</option>}
            {elections.map((e) => (
              <option key={e.id ?? e.public_id} value={e.id ?? e.public_id}>
                {e.title} ({e.state})
              </option>
            ))}
          </select>
        </div>

        {/* 3 main cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Evidence Bundle */}
          <div className="pastel-card-white !p-0 overflow-hidden">
            <div className="px-5 md:px-6 pt-5 pb-4 border-b border-[#EAEAE5] flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl pastel-card pastel-lavender !p-0 flex items-center justify-center">
                <FileKey className="w-5 h-5 text-[#202124]" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-[#202124]">Evidence Bundle</h3>
                <p className="text-xs text-[#5C7089]">Certifiable archives for external auditors</p>
              </div>
            </div>
            <div className="px-5 md:px-6 py-5 space-y-3 max-h-96 overflow-auto">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-3 rounded-2xl border border-[#EAEAE5] space-y-2">
                    <Skeleton className="w-full h-5 rounded-md" />
                    <Skeleton className="w-2/3 h-3 rounded-md" />
                  </div>
                ))
              ) : evidence?.bundles?.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="pastel-card pastel-lavender !p-6 rounded-2xl max-w-xs mx-auto">
                    <FolderArchive className="w-9 h-9 text-[#202124] mx-auto mb-2" />
                    <h4 className="font-bold text-[15px] text-[#202124] mb-1">No bundles yet</h4>
                    <p className="text-[12px] text-[#5C4A8C]/85 leading-relaxed">
                      Evidence will appear after integrity checks and tally are run.
                    </p>
                  </div>
                </div>
              ) : (
                evidence?.bundles?.map((b) => (
                  <div key={b.bundle_id} className="p-3.5 rounded-2xl border border-[#EAEAE5] hover:bg-[#FAFAF7] transition-colors flex items-center gap-3 justify-between">
                    <div className="min-w-0">
                      <div className="font-bold text-[13px] text-[#202124] truncate">{b.summary}</div>
                      <div className="text-[11px] text-[#5C7089] font-mono truncate">
                        {b.bundle_id.slice(0, 12)} · {new Date(b.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full border-[#EAEAE5] h-8 px-3 text-xs font-bold shrink-0"
                      onClick={() => downloadBundle(b)}
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" /> Get
                    </Button>
                  </div>
                )) ?? null
              )}
            </div>
          </div>

          {/* Election Summary */}
          <div className="pastel-card pastel-lime !p-0 overflow-hidden">
            <div className="px-5 md:px-6 pt-5 pb-4 border-b border-white/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/70 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-[#202124]" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-[#202124]">Election Summary</h3>
                <p className="text-xs text-[#3E5A0E]/80">Snapshot stats & milestone tracker</p>
              </div>
            </div>
            <div className="px-5 md:px-6 py-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { k: "Eligible", v: stats?.eligible },
                  { k: "Registered", v: stats?.registered },
                  { k: "Cast", v: stats?.cast },
                  { k: "State", v: stats?.state },
                ].map((s) => (
                  <div key={s.k} className="bg-white/70 rounded-2xl p-3.5">
                    <div className="text-[11px] font-bold text-[#3E5A0E]/70 uppercase tracking-wider">{s.k}</div>
                    {loading ? (
                      <Skeleton className="mt-1 w-full h-5 rounded-md" />
                    ) : (
                      <div className="mt-1 text-lg font-black tracking-tight text-[#202124] truncate">
                        {typeof s.v === "number" ? s.v.toLocaleString() : (s.v ?? "—")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div>
                <div className="text-[12px] font-bold text-[#3E5A0E]/80 uppercase tracking-wider mb-2.5">Milestones</div>
                <div className="space-y-1.5">
                  {loading
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Skeleton className="w-6 h-6 rounded-full" />
                          <Skeleton className="flex-1 h-5 rounded-md" />
                        </div>
                      ))
                    : milestones.length === 0
                    ? (
                        <div className="text-[12px] text-[#3E5A0E]/80">No milestones defined yet.</div>
                      )
                    : milestones.map((m) => {
                        const cls =
                          m.status === "DONE"
                            ? "pastel-lime text-[#202124]"
                            : m.status === "CURRENT"
                            ? "pastel-peach text-[#202124]"
                            : "bg-white/70 text-[#5C7089]";
                        const Icon = m.status === "DONE" ? CheckCircle2 : m.status === "CURRENT" ? Activity : FileCheck;
                        return (
                          <div key={m.key} className="flex items-center gap-2.5 py-1">
                            <Badge className={`${cls} rounded-full border-transparent inline-flex items-center text-[11px] font-bold`}>
                              <Icon className="w-3 h-3 mr-1" /> {m.status}
                            </Badge>
                            <div className="flex-1">
                              <div className="text-[13px] font-bold text-[#202124]">{m.label}</div>
                              {m.description && <div className="text-[11px] text-[#3E5A0E]/80">{m.description}</div>}
                            </div>
                          </div>
                        );
                      })}
                </div>
              </div>
            </div>
          </div>

          {/* Tally Sessions */}
          <div className="pastel-card-white !p-0 overflow-hidden">
            <div className="px-5 md:px-6 pt-5 pb-4 border-b border-[#EAEAE5] flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl pastel-card pastel-sky !p-0 flex items-center justify-center">
                <FileBarChart2 className="w-5 h-5 text-[#202124]" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-[#202124]">Tally Sessions</h3>
                <p className="text-xs text-[#5C7089]">Threshold decryption session log</p>
              </div>
            </div>
            <div className="px-5 md:px-6 py-5 space-y-3 max-h-96 overflow-auto">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-3.5 rounded-2xl border border-[#EAEAE5] space-y-2">
                    <Skeleton className="w-full h-5 rounded-md" />
                    <Skeleton className="w-2/3 h-3 rounded-md" />
                  </div>
                ))
              ) : sessions.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="pastel-card pastel-sky !p-6 rounded-2xl max-w-xs mx-auto">
                    <Scale className="w-9 h-9 text-[#202124] mx-auto mb-2" />
                    <h4 className="font-bold text-[15px] text-[#202124] mb-1">No tally sessions</h4>
                    <p className="text-[12px] text-[#1F5689]/85 leading-relaxed">
                      Sessions start once election is closed and trustees approve tally.
                    </p>
                  </div>
                </div>
              ) : (
                sessions.map((s) => {
                  const status = (s.status ?? "pending").toUpperCase();
                  const statusCls =
                    status.includes("COMPLETE") || status.includes("APPROVED")
                      ? "pastel-lime text-[#202124]"
                      : status.includes("REJECT") || status.includes("FAIL")
                      ? "pastel-peach text-[#202124]"
                      : "pastel-lavender text-[#202124]";
                  const progress =
                    typeof s.approvals_received === "number" && typeof s.approvals_required === "number" && s.approvals_required
                      ? (s.approvals_received / s.approvals_required) * 100
                      : typeof s.approvals_count === "number" && typeof s.approvals_required === "number" && s.approvals_required
                      ? (s.approvals_count / s.approvals_required) * 100
                      : 0;
                  return (
                    <div key={s.id} className="p-3.5 rounded-2xl border border-[#EAEAE5] hover:bg-[#FAFAF7] transition-colors">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="font-mono text-[12px] font-bold text-[#243056] truncate">{s.id?.slice(0, 16) ?? "session"}</div>
                        <Badge className={`${statusCls} rounded-full border-transparent text-[11px] font-bold`}>{status}</Badge>
                      </div>
                      <div className="text-[12px] text-[#5C7089] mb-2">
                        {s.approvals_received ?? s.approvals_count ?? 0} of {s.approvals_required ?? "?"} trustee shares approved
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#F5F5F4] overflow-hidden">
                        <div className="h-full bg-[#202124] rounded-full transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-[#5C7089]">
                        <span>{s.election_id.slice(0, 10)}…</span>
                        <Link href="/admin/trustees" className="inline-flex items-center gap-1 font-bold text-[#243056] hover:text-[#202124]">
                          Trustees <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Integrity history */}
        <div className="pastel-card-white !p-0 overflow-hidden">
          <div className="px-5 md:px-6 pt-5 pb-4 border-b border-[#EAEAE5] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl pastel-card pastel-lime !p-0 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-[#202124]" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-[#202124]">Integrity Check History</h3>
                <p className="text-xs text-[#5C7089]">Last 10 automated RFC 6962 + reconciliation checks</p>
              </div>
            </div>
            <Link href="/integrity">
              <Button variant="outline" className="rounded-full border-[#EAEAE5] h-9 text-xs font-bold px-4">
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Public Integrity Page
              </Button>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F5F5F4]/60 text-[#5C7089] text-xs uppercase tracking-wider">
                  <th className="text-left font-bold px-5 md:px-6 py-3.5">Status</th>
                  <th className="text-left font-bold px-5 md:px-6 py-3.5 hidden md:table-cell">Checks</th>
                  <th className="text-left font-bold px-5 md:px-6 py-3.5 hidden lg:table-cell">Entries</th>
                  <th className="text-left font-bold px-5 md:px-6 py-3.5 hidden lg:table-cell">First Failure</th>
                  <th className="text-left font-bold px-5 md:px-6 py-3.5">Executed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0EC]">
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-5 md:px-6 py-3"><Skeleton className="w-28 h-6 rounded-full" /></td>
                        <td className="px-5 md:px-6 py-3 hidden md:table-cell"><Skeleton className="w-32 h-4 rounded-md" /></td>
                        <td className="px-5 md:px-6 py-3 hidden lg:table-cell"><Skeleton className="w-20 h-4 rounded-md" /></td>
                        <td className="px-5 md:px-6 py-3 hidden lg:table-cell"><Skeleton className="w-40 h-4 rounded-md" /></td>
                        <td className="px-5 md:px-6 py-3"><Skeleton className="w-44 h-4 rounded-md" /></td>
                      </tr>
                    ))
                  : integrity.length === 0
                  ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12">
                          <div className="max-w-md mx-auto text-center pastel-card pastel-lime !p-8 rounded-2xl">
                            <ShieldCheck className="w-10 h-10 text-[#202124] mx-auto mb-3" />
                            <h3 className="font-extrabold text-lg text-[#202124] mb-1">No integrity runs</h3>
                            <p className="text-sm text-[#3E5A0E]/85 leading-relaxed">
                              Execute an integrity check from the trustees or simulator panel to populate audit history.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )
                  : integrity.map((r, i) => {
                      const passed = r.status === "VERIFIED";
                      const passedCount = r.checks?.filter((c) => c.passed).length ?? 0;
                      const totalCount = r.checks?.length ?? 0;
                      return (
                        <tr key={i} className="hover:bg-[#FAFAF7] transition-colors">
                          <td className="px-5 md:px-6 py-3.5">
                            {passed ? (
                              <Badge className="pastel-lime text-[#202124] border-transparent rounded-full text-[11px] font-bold inline-flex items-center">
                                <CheckCircle2 className="w-3 h-3 mr-1" /> VERIFIED
                              </Badge>
                            ) : (
                              <Badge className="pastel-peach text-[#202124] border-transparent rounded-full text-[11px] font-bold inline-flex items-center">
                                <AlertTriangle className="w-3 h-3 mr-1" /> {r.status ?? "UNKNOWN"}
                              </Badge>
                            )}
                          </td>
                          <td className="px-5 md:px-6 py-3.5 hidden md:table-cell text-sm font-bold text-[#202124]">
                            {passedCount} / {totalCount} passed
                          </td>
                          <td className="px-5 md:px-6 py-3.5 hidden lg:table-cell text-sm text-[#5C7089] font-mono">
                            {r.entries?.toLocaleString() ?? "—"}
                          </td>
                          <td className="px-5 md:px-6 py-3.5 hidden lg:table-cell text-sm text-[#E05252] font-semibold">
                            {passed ? "—" : r.first_failed_check ?? "Undetermined"}
                          </td>
                          <td className="px-5 md:px-6 py-3.5 text-sm text-[#5C7089]">
                            {r.executed_at ? new Date(r.executed_at).toLocaleString() : "—"}
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SidebarDashboardLayout>
  );
}
