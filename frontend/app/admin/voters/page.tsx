"use client";

import { useEffect, useMemo, useState } from "react";
import { SidebarDashboardLayout } from "@/components/layouts/SidebarDashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import Link from "next/link";
import {
  Users,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CircleDot,
  Clock,
  FileCheck,
  Filter,
  AlertTriangle,
} from "lucide-react";
import { listElections, type ElectionSummary } from "@/lib/api/elections";
import { getVoterRoster, type VoterRosterItem } from "@/lib/api/admin";

const STATUS_OPTIONS = [
  { key: "ALL", label: "All" },
  { key: "ELIGIBLE", label: "Eligible" },
  { key: "TOKEN", label: "Has Token" },
  { key: "VOTED", label: "Voted" },
  { key: "PENDING", label: "Pending Token" },
] as const;
type StatusKey = (typeof STATUS_OPTIONS)[number]["key"];

function statusBadge(v: VoterRosterItem): { label: string; cls: string; icon: JSX.Element } {
  if (v.has_completed_vote || v.has_completed_voted) {
    return {
      label: "Voted",
      cls: "pastel-lime text-[#202124] border-transparent",
      icon: <CheckCircle2 className="w-3.5 h-3.5 mr-1" />,
    };
  }
  if (v.has_received_token) {
    return {
      label: "Token Issued",
      cls: "pastel-sky text-[#202124] border-transparent",
      icon: <CircleDot className="w-3.5 h-3.5 mr-1" />,
    };
  }
  if (v.is_eligible) {
    return {
      label: "Eligible",
      cls: "pastel-lavender text-[#202124] border-transparent",
      icon: <Clock className="w-3.5 h-3.5 mr-1" />,
    };
  }
  return {
    label: "Ineligible",
    cls: "pastel-peach text-[#202124] border-transparent",
    icon: <AlertTriangle className="w-3.5 h-3.5 mr-1" />,
  };
}

const PAGE_SIZE = 20;

export default function AdminVoters() {
  const [loading, setLoading] = useState(true);
  const [elections, setElections] = useState<ElectionSummary[]>([]);
  const [electionId, setElectionId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusKey>("ALL");
  const [items, setItems] = useState<VoterRosterItem[]>([]);
  const [totals, setTotals] = useState({ total: 0, eligible: 0, received_token: 0, voted: 0 });

  const debouncedSearch = useMemo(() => search, [search]);

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
      } finally {
        // no setLoading(false) here — inner effect below drives loading when electionId is set
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
        const res = await getVoterRoster(electionId, page, PAGE_SIZE, debouncedSearch || undefined, status === "ALL" ? undefined : status);
        if (!alive) return;
        setItems(res.items ?? []);
        setTotals({
          total: res.total ?? 0,
          eligible: res.eligible ?? 0,
          received_token: res.received_token ?? 0,
          voted: res.voted ?? 0,
        });
      } catch (e: any) {
        toast.error(e?.message || "Failed to load voter roster");
        setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [electionId, page, status, debouncedSearch]);

  function exportCsv() {
    if (!items.length) {
      toast.warning("No voters to export");
      return;
    }
    const header = "voter_external_id,display_name,department,year,eligible,has_token,has_voted,token_issued_at,voted_at\n";
    const rows = items
      .map(
        (v) =>
          `"${v.voter_external_id}","${v.display_name}","${v.department ?? ""}","${v.year ?? ""}",${v.is_eligible},${v.has_received_token},${v.has_completed_vote || v.has_completed_voted || false},"${v.token_issued_at ?? ""}","${v.voted_at ?? ""}"`,
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voter-roster-${electionId?.slice(0, 8) ?? "all"}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${items.length} voters`);
  }

  const totalPages = Math.max(1, Math.ceil(totals.total / PAGE_SIZE));

  return (
    <SidebarDashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[2.25rem] font-extrabold tracking-tight leading-none">Voter Roster</h1>
            <p className="text-[#5C7089] text-sm mt-1">
              Full ledger of registered student voters with eligibility, token-issuance, and cast status.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/ballots">
              <Button variant="outline" className="rounded-full border-[#EAEAE5] h-11 font-bold text-sm">
                <FileCheck className="w-4 h-4 mr-2" /> Ballot Ledger
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
            { label: "Total Registered", value: totals.total, cls: "pastel-peach" },
            { label: "Eligible", value: totals.eligible, cls: "pastel-sky" },
            { label: "Tokens Issued", value: totals.received_token, cls: "pastel-lavender" },
            { label: "Cast Ballots", value: totals.voted, cls: "pastel-lime" },
          ].map((s) => (
            <div key={s.label} className={`${s.cls} pastel-card !p-5`}>
              <div className="text-xs font-bold text-[#202124]/70 uppercase tracking-wider">{s.label}</div>
              {loading ? (
                <Skeleton className="mt-2 w-20 h-10 rounded-xl" />
              ) : (
                <div className="mt-2 text-3xl font-black tracking-tight text-[#202124]">{s.value.toLocaleString()}</div>
              )}
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="pastel-card-white !p-5 md:!p-6 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-[#5C7089]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, student ID, or email..."
              className="h-11 rounded-full bg-[#F5F5F4] border-[#EAEAE5] focus-visible:ring-2 focus-visible:ring-[#DAF39F] text-sm"
            />
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <Filter className="w-4 h-4 text-[#5C7089]" />
            <div className="p-1 rounded-full bg-[#F5F5F4] flex gap-1 border border-[#EAEAE5] overflow-x-auto">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => {
                    setStatus(s.key);
                    setPage(1);
                  }}
                  className={
                    status === s.key
                      ? "px-3.5 py-2 rounded-full bg-white text-[12px] font-bold text-[#202124] shadow-card whitespace-nowrap"
                      : "px-3.5 py-2 rounded-full text-[12px] font-semibold text-[#5C7089] hover:text-[#202124] whitespace-nowrap"
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <select
            className="h-11 rounded-full bg-[#F5F5F4] border-[#EAEAE5] px-4 text-sm font-semibold text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#DAF39F]"
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

        {/* Table */}
        <div className="pastel-card-white !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F5F5F4]/60 text-[#5C7089] text-xs uppercase tracking-wider">
                  <th className="text-left font-bold px-5 md:px-6 py-3.5">Student</th>
                  <th className="text-left font-bold px-5 md:px-6 py-3.5 hidden md:table-cell">Dept / Year</th>
                  <th className="text-left font-bold px-5 md:px-6 py-3.5">Status</th>
                  <th className="text-left font-bold px-5 md:px-6 py-3.5 hidden lg:table-cell">Token Issued</th>
                  <th className="text-left font-bold px-5 md:px-6 py-3.5 hidden lg:table-cell">Voted At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0EC]">
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-5 md:px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Skeleton className="w-9 h-9 rounded-full" />
                            <div className="space-y-1.5">
                              <Skeleton className="w-44 h-4 rounded-md" />
                              <Skeleton className="w-28 h-3 rounded-md" />
                            </div>
                          </div>
                        </td>
                        <td className="px-5 md:px-6 py-4 hidden md:table-cell"><Skeleton className="w-32 h-4 rounded-md" /></td>
                        <td className="px-5 md:px-6 py-4"><Skeleton className="w-24 h-6 rounded-full" /></td>
                        <td className="px-5 md:px-6 py-4 hidden lg:table-cell"><Skeleton className="w-36 h-4 rounded-md" /></td>
                        <td className="px-5 md:px-6 py-4 hidden lg:table-cell"><Skeleton className="w-36 h-4 rounded-md" /></td>
                      </tr>
                    ))
                  : items.length === 0
                  ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-16">
                          <div className="max-w-md mx-auto text-center pastel-card pastel-peach !p-8 rounded-2xl">
                            <Users className="w-10 h-10 text-[#202124] mx-auto mb-3" />
                            <h3 className="font-extrabold text-lg text-[#202124] mb-1">No voters match filters</h3>
                            <p className="text-sm text-[#5C3A18]/85 leading-relaxed">
                              Try a broader search term, switch election context, or change status filter.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )
                  : items.map((v) => {
                      const b = statusBadge(v);
                      return (
                        <tr key={v.voter_id} className="hover:bg-[#FAFAF7] transition-colors">
                          <td className="px-5 md:px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#EBD3FF] to-[#CFE8FF] flex items-center justify-center text-[#202124] font-bold">
                                {v.display_name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-bold text-[15px] text-[#202124]">{v.display_name}</div>
                                <div className="text-xs text-[#5C7089] font-mono">{v.voter_external_id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 md:px-6 py-4 hidden md:table-cell">
                            <div className="text-sm text-[#202124] font-semibold">
                              {(v.department ?? "—") + (v.year ? ` · ${v.year}` : "")}
                            </div>
                          </td>
                          <td className="px-5 md:px-6 py-4">
                            <Badge className={`${b.cls} rounded-full text-[11px] font-bold inline-flex items-center`}>
                              {b.icon} {b.label}
                            </Badge>
                          </td>
                          <td className="px-5 md:px-6 py-4 hidden lg:table-cell text-sm text-[#5C7089]">
                            {v.token_issued_at ? new Date(v.token_issued_at).toLocaleString() : "—"}
                          </td>
                          <td className="px-5 md:px-6 py-4 hidden lg:table-cell text-sm text-[#5C7089]">
                            {v.voted_at ? new Date(v.voted_at).toLocaleString() : "—"}
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
          <div className="px-5 md:px-6 py-4 border-t border-[#EAEAE5] flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-[#5C7089] font-semibold">
              Showing {Math.min(totals.total, (page - 1) * PAGE_SIZE + 1)}–{Math.min(page * PAGE_SIZE, totals.total)} of {totals.total}
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
