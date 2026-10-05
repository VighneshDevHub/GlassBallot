"use client";

import { useEffect, useMemo, useState } from "react";
import { SidebarDashboardLayout } from "@/components/layouts/SidebarDashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import Link from "next/link";
import {
  FileCheck,
  Download,
  ChevronLeft,
  ChevronRight,
  Activity,
  BarChart3,
  CheckCircle2,
  XCircle,
  Users,
  ExternalLink,
  Clock,
} from "lucide-react";
import { listElections, getBallotCounts, type ElectionSummary, type ByHourBucket } from "@/lib/api/elections";
import { getBallotLedger, type BallotLedgerItem } from "@/lib/api/admin";

const PAGE_SIZE = 20;

function shortHash(h?: string) {
  if (!h) return "—";
  return h.length > 10 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h;
}

function aggregateByDay(buckets: ByHourBucket[]): number[] {
  const days = [0, 0, 0, 0, 0, 0, 0];
  if (!buckets.length) return days;
  const today = new Date();
  for (const b of buckets) {
    const d = new Date(b.hour);
    const diffDays = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays < 7) {
      days[(7 - 1 - diffDays + 7) % 7] += b.count || 0;
    }
  }
  return days;
}

export default function AdminBallots() {
  const [loading, setLoading] = useState(true);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [elections, setElections] = useState<ElectionSummary[]>([]);
  const [electionId, setElectionId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<BallotLedgerItem[]>([]);
  const [totals, setTotals] = useState({ total: 0, real: 0, test: 0 });
  const [counts, setCounts] = useState<{ total: number; last24: number; byDay: number[] }>({ total: 0, last24: 0, byDay: [0, 0, 0, 0, 0, 0, 0] });

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
        const res = await getBallotLedger(electionId, page, PAGE_SIZE);
        if (!alive) return;
        setItems(res.items ?? []);
        setTotals({ total: res.total ?? 0, real: res.real_ballots ?? 0, test: res.test_ballots ?? 0 });
      } catch (e: any) {
        toast.error(e?.message || "Failed to load ballot ledger");
        setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [electionId, page]);

  useEffect(() => {
    if (!electionId) return;
    let alive = true;
    setLoadingCounts(true);
    (async () => {
      try {
        const c = await getBallotCounts(electionId);
        if (!alive) return;
        setCounts({
          total: c.total ?? 0,
          last24: c.last_24h ?? 0,
          byDay: aggregateByDay(c.by_hour_last_7d ?? []),
        });
      } catch (e: any) {
        toast.error(e?.message || "Failed to load ballot counts");
      } finally {
        if (alive) setLoadingCounts(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [electionId]);

  function exportCsv() {
    if (!items.length) {
      toast.warning("No ballots to export");
      return;
    }
    const header = "index,fingerprint,token_hash_short,entry_hash_short,is_test,created_at\n";
    const rows = items
      .map(
        (b) =>
          `${b.ledger_index},"${b.ballot_fingerprint}","${b.token_hash_short ?? shortHash(b.token_hash)}","${b.entry_hash_short ?? shortHash(b.entry_hash)}",${b.is_test_ballot},"${b.created_at}"`,
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ballot-ledger-${electionId?.slice(0, 8) ?? "all"}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${items.length} ledger rows`);
  }

  const maxBar = Math.max(1, ...counts.byDay);
  const dayLabels = useMemo(() => {
    const out: string[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      out.push(d.toLocaleDateString(undefined, { weekday: "short" }));
    }
    return out;
  }, []);
  const totalPages = Math.max(1, Math.ceil(totals.total / PAGE_SIZE));

  return (
    <SidebarDashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[2.25rem] font-extrabold tracking-tight leading-none">Ballot Ledger</h1>
            <p className="text-[#5C7089] text-sm mt-1">
              Cryptographic hash chain of every test- and cast-ballot. Click any fingerprint to verify inclusion.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/voters">
              <Button variant="outline" className="rounded-full border-[#EAEAE5] h-11 font-bold text-sm">
                <Users className="w-4 h-4 mr-2" /> Voter Roster
              </Button>
            </Link>
            <Button
              className="rounded-full h-11 bg-[#DAF39F] hover:bg-[#C6E66C] text-[#202124] font-bold text-sm shadow-soft"
              onClick={exportCsv}
            >
              <Download className="w-4 h-4 mr-2" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Entries", value: totals.total, cls: "pastel-lavender", icon: FileCheck },
            { label: "Last 24 Hours", value: counts.last24, cls: "pastel-peach", icon: Clock },
            { label: "Cast Ballots", value: totals.real, cls: "pastel-lime", icon: CheckCircle2 },
            { label: "Spoiled / Test", value: totals.test, cls: "pastel-sky", icon: XCircle },
          ].map((s) => {
            const I = s.icon;
            return (
              <div key={s.label} className={`${s.cls} pastel-card !p-5`}>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-[#202124]/70 uppercase tracking-wider">{s.label}</div>
                  <I className="w-4.5 h-4.5 text-[#202124]" />
                </div>
                {loading && s.label.includes("Total") ? (
                  <Skeleton className="mt-2 w-20 h-10 rounded-xl" />
                ) : (
                  <div className="mt-2 text-3xl font-black tracking-tight text-[#202124]">{s.value.toLocaleString()}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Election selector + weekly chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="pastel-card-white !p-5 md:!p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-2xl pastel-card pastel-peach !p-0 flex items-center justify-center">
                <BarChart3 className="w-4.5 h-4.5 text-[#202124]" />
              </div>
              <div>
                <h3 className="font-extrabold text-[15px] text-[#202124]">Election</h3>
                <p className="text-[11px] text-[#5C7089]">Choose context for ledger view</p>
              </div>
            </div>
            <select
              className="h-11 w-full rounded-2xl bg-[#F5F5F4] border-[#EAEAE5] px-4 text-sm font-semibold text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#DAF39F]"
              value={electionId ?? ""}
              disabled={loading && !elections.length}
              onChange={(e) => {
                setElectionId(e.target.value);
                setPage(1);
              }}
            >
              {!electionId && <option value="">Choose election...</option>}
              {elections.map((e) => (
                <option key={e.id ?? e.public_id} value={e.id ?? e.public_id}>
                  {e.title} ({e.state})
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2 pastel-card pastel-lavender !p-5 md:!p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-white/70 flex items-center justify-center">
                  <Activity className="w-4.5 h-4.5 text-[#202124]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[15px] text-[#202124]">Ballots Last 7 Days</h3>
                  <p className="text-[11px] text-[#5C4A8C]/80">Hourly buckets aggregated per day</p>
                </div>
              </div>
              {loadingCounts ? <Skeleton className="w-20 h-5 rounded-full" /> : <Badge className="rounded-full pastel-card-white text-[#202124] border-transparent">{counts.total.toLocaleString()} total</Badge>}
            </div>
            <div className="h-40 flex items-end gap-2 md:gap-3">
              {loadingCounts
                ? Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="flex-1 rounded-xl" />)
                : counts.byDay.map((v, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full bg-white/40 rounded-xl relative overflow-hidden">
                        <div
                          className="w-full bg-[#202124] rounded-xl transition-all"
                          style={{ height: `${(v / maxBar) * 100}%`, minHeight: v ? 4 : 0 }}
                          title={`${dayLabels[i]}: ${v} ballots`}
                        />
                      </div>
                      <div className="text-[11px] font-bold text-[#202124]/70">{dayLabels[i]}</div>
                    </div>
                  ))}
            </div>
          </div>
        </div>

        {/* Ledger table */}
        <div className="pastel-card-white !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F5F5F4]/60 text-[#5C7089] text-xs uppercase tracking-wider">
                  <th className="text-left font-bold px-5 md:px-6 py-3.5">#</th>
                  <th className="text-left font-bold px-5 md:px-6 py-3.5">Fingerprint</th>
                  <th className="text-left font-bold px-5 md:px-6 py-3.5 hidden md:table-cell">Token</th>
                  <th className="text-left font-bold px-5 md:px-6 py-3.5 hidden lg:table-cell">Entry Hash</th>
                  <th className="text-left font-bold px-5 md:px-6 py-3.5">Kind</th>
                  <th className="text-left font-bold px-5 md:px-6 py-3.5 hidden lg:table-cell">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0EC]">
                {loading
                  ? Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-5 md:px-6 py-4"><Skeleton className="w-10 h-4 rounded-md" /></td>
                        <td className="px-5 md:px-6 py-4"><Skeleton className="w-44 h-5 rounded-md" /></td>
                        <td className="px-5 md:px-6 py-4 hidden md:table-cell"><Skeleton className="w-28 h-4 rounded-md" /></td>
                        <td className="px-5 md:px-6 py-4 hidden lg:table-cell"><Skeleton className="w-28 h-4 rounded-md" /></td>
                        <td className="px-5 md:px-6 py-4"><Skeleton className="w-24 h-6 rounded-full" /></td>
                        <td className="px-5 md:px-6 py-4 hidden lg:table-cell"><Skeleton className="w-36 h-4 rounded-md" /></td>
                      </tr>
                    ))
                  : items.length === 0
                  ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-16">
                          <div className="max-w-md mx-auto text-center pastel-card pastel-sky !p-8 rounded-2xl">
                            <FileCheck className="w-10 h-10 text-[#202124] mx-auto mb-3" />
                            <h3 className="font-extrabold text-lg text-[#202124] mb-1">No ledger entries yet</h3>
                            <p className="text-sm text-[#1F5689]/85 leading-relaxed">
                              Ballots will appear here once tokens are issued and voters begin casting or testing ballots.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )
                  : items.map((b) => (
                      <tr key={`${b.ledger_index}-${b.entry_hash}`} className="hover:bg-[#FAFAF7] transition-colors">
                        <td className="px-5 md:px-6 py-4 font-mono text-xs font-bold text-[#5C7089]">#{b.ledger_index.toLocaleString()}</td>
                        <td className="px-5 md:px-6 py-4">
                          <Link
                            href={`/verify/${encodeURIComponent(b.ballot_fingerprint)}`}
                            className="group inline-flex items-center gap-2 font-mono text-[13px] font-bold text-[#243056] hover:text-[#202124]"
                          >
                            <span className="bg-[#F5F5F4] rounded-xl px-2.5 py-1 group-hover:bg-[#DAF39F]/40 transition-colors">
                              {b.fingerprint_short ?? shortHash(b.ballot_fingerprint)}
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                          </Link>
                        </td>
                        <td className="px-5 md:px-6 py-4 hidden md:table-cell">
                          <div className="font-mono text-[12px] text-[#5C7089]">{b.token_hash_short ?? shortHash(b.token_hash)}</div>
                        </td>
                        <td className="px-5 md:px-6 py-4 hidden lg:table-cell">
                          <div className="font-mono text-[12px] text-[#5C7089]">{b.entry_hash_short ?? shortHash(b.entry_hash)}</div>
                        </td>
                        <td className="px-5 md:px-6 py-4">
                          {b.is_test_ballot ? (
                            <Badge className="pastel-peach text-[#202124] border-transparent rounded-full text-[11px] font-bold inline-flex items-center">
                              <XCircle className="w-3 h-3 mr-1" /> TEST / SPOIL
                            </Badge>
                          ) : (
                            <Badge className="pastel-lime text-[#202124] border-transparent rounded-full text-[11px] font-bold inline-flex items-center">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> CAST
                            </Badge>
                          )}
                        </td>
                        <td className="px-5 md:px-6 py-4 hidden lg:table-cell text-sm text-[#5C7089]">
                          {new Date(b.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 md:px-6 py-4 border-t border-[#EAEAE5] flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-[#5C7089] font-semibold">
              Entry {Math.min(totals.total, (page - 1) * PAGE_SIZE + 1)}–{Math.min(page * PAGE_SIZE, totals.total)} of {totals.total}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-[#EAEAE5] h-9 w-9 p-0"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="px-3 text-sm font-bold text-[#202124]">
                {page} / {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-[#EAEAE5] h-9 w-9 p-0"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </SidebarDashboardLayout>
  );
}
