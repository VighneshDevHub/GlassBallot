"use client";

import { useEffect, useState } from "react";
import {
  getElectionConfig,
  getElectionResults,
  getElectionStats,
  type PublishedResults,
  type ElectionConfigResponse,
  type ElectionStatsResponse,
} from "@/lib/api/elections";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trophy,
  Users,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function ResultsPage() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<ElectionConfigResponse | null>(null);
  const [results, setResults] = useState<PublishedResults | null>(null);
  const [stats, setStats] = useState<ElectionStatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await getElectionConfig();
      setConfig(cfg);
      if (cfg.election?.id) {
        const [res, st] = await Promise.allSettled([
          getElectionResults(cfg.election.id),
          getElectionStats(cfg.election.id),
        ]);
        if (res.status === "fulfilled") setResults(res.value);
        if (st.status === "fulfilled") setStats(st.value);
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load election results.");
      toast.error((err as Error).message || "Could not load results.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const electionTitle = config?.election?.title || "Student Council Election";
  const electionState = (config?.state || config?.election?.state || "OPEN").toString().toUpperCase();
  const isOpen = electionState === "OPEN" || electionState === "SETUP";
  const isClosed = !isOpen;
  const isTallied = results?.published === true;
  const candidates = config?.election?.candidates ?? [];

  // Determine winner from tally counts
  const countEntries = results?.counts ? Object.entries(results.counts) : [];
  const maxVotes = countEntries.length > 0 ? Math.max(...countEntries.map(([, v]) => v as number)) : 0;
  const winner = countEntries.find(([, v]) => v === maxVotes)?.[0];

  return (
    <PublicLayout>
      <section className="min-h-[calc(100vh-80px)] py-12 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto space-y-8">

          {/* Header */}
          <div className="text-center space-y-3">
            <Badge
              variant="outline"
              className="bg-[#DAF39F]/20 text-[#3E5A0E] border-[#C6E66C] rounded-full px-4 py-1.5 text-xs font-bold"
            >
              <BarChart3 className="w-3.5 h-3.5 mr-1.5 inline" /> Election Results
            </Badge>
            <h1 className="text-3xl font-extrabold text-[#202124] tracking-tight">{electionTitle}</h1>
            <div className="flex items-center justify-center gap-2">
              <Badge
                variant="outline"
                className={`rounded-full text-xs font-bold px-3 py-1 ${
                  isOpen
                    ? "bg-[#E8F6EE] border-[#4CAF7A]/30 text-[#3E5A0E]"
                    : isTallied
                    ? "bg-[#DAF39F]/30 border-[#C6E66C] text-[#3E5A0E]"
                    : "bg-[#FFF8E1] border-[#FFDEB0] text-[#845913]"
                }`}
              >
                {isOpen ? "🗳️ Voting Open" : isTallied ? "✓ Results Published" : "🔒 Voting Closed — Tally Pending"}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadData}
                disabled={loading}
                className="rounded-full text-xs text-[#5C7089]"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="space-y-4">
              <Skeleton className="h-20 rounded-2xl" />
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
              </div>
              <Skeleton className="h-72 rounded-2xl" />
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="p-5 rounded-2xl bg-[#FFE5E5] border border-[#E05252]/30 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#E05252] shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm text-[#202124]">Could not load results</div>
                <div className="text-xs text-[#E05252] mt-0.5">{error}</div>
              </div>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  {
                    label: "Total Votes Cast",
                    value: stats?.cast_ballots ?? results?.total ?? "—",
                    icon: CheckCircle2,
                    color: "text-[#3E5A0E]",
                    bg: "bg-[#E8F6EE]",
                  },
                  {
                    label: "Eligible Voters",
                    value: stats?.eligible_voters ?? "—",
                    icon: Users,
                    color: "text-[#243056]",
                    bg: "bg-[#CFE8FF]/40",
                  },
                  {
                    label: "Turnout",
                    value: stats ? `${stats.turnout_percent}%` : "—",
                    icon: BarChart3,
                    color: "text-[#5B3D86]",
                    bg: "bg-[#EBD3FF]/40",
                  },
                  {
                    label: "Test Ballots",
                    value: results?.spoiled_count ?? stats?.spoiled_test_ballots ?? "—",
                    icon: ShieldCheck,
                    color: "text-[#845913]",
                    bg: "bg-[#FFDEB0]/40",
                  },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label} className={`rounded-2xl p-4 ${bg} border border-white text-center space-y-1`}>
                    <Icon className={`w-5 h-5 mx-auto ${color}`} />
                    <div className={`text-2xl font-extrabold ${color}`}>{String(value)}</div>
                    <div className="text-[11px] text-[#5C7089] font-medium">{label}</div>
                  </div>
                ))}
              </div>

              {/* Voting still open */}
              {isOpen && (
                <div className="rounded-2xl bg-[#FFF8E1] border border-[#FFDEB0] p-6 flex items-start gap-4">
                  <Clock className="w-6 h-6 text-[#845913] shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <h3 className="font-extrabold text-[#202124]">Voting is still open</h3>
                    <p className="text-sm text-[#5C7089] leading-relaxed">
                      Results will be revealed after voting closes and the election officer initiates
                      the decryption process with 2-of-3 trustee key shares.
                      All ballots are sealed — no one can see the current count.
                    </p>
                    <Link href="/vote">
                      <Button className="rounded-full bg-[#202124] text-white font-bold text-sm h-10 px-5 shadow-soft mt-1">
                        Cast your vote →
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {/* Closed, no tally yet — show live ballot count without revealing winner */}
              {isClosed && !isTallied && (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-[#F5F5F4] border border-[#EAEAE5] p-6 flex items-start gap-4">
                    <Lock className="w-6 h-6 text-[#5C7089] shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <h3 className="font-extrabold text-[#202124]">Voting has closed — decryption in progress</h3>
                      <p className="text-sm text-[#5C7089] leading-relaxed">
                        {stats?.cast_ballots ?? 0} sealed ballots are locked in the ledger.
                        The election officer is assembling the 2-of-3 trustee key shares
                        to decrypt the results. Candidate totals will appear here once published.
                      </p>
                    </div>
                  </div>

                  {/* Show candidate list without counts */}
                  {candidates.length > 0 && (
                    <div className="rounded-2xl bg-white border border-[#EAEAE5] overflow-hidden">
                      <div className="px-5 py-4 border-b border-[#EAEAE5]">
                        <h3 className="font-extrabold text-[#202124]">Candidates on this ballot</h3>
                        <p className="text-xs text-[#5C7089] mt-0.5">Vote counts are sealed pending trustee decryption</p>
                      </div>
                      <div className="divide-y divide-[#F5F5F4]">
                        {candidates.map((c: any) => (
                          <div key={c.candidate_code} className="px-5 py-4 flex items-center gap-3">
                            {c.avatar_url ? (
                              <img src={c.avatar_url} alt={c.display_name} className="w-10 h-10 rounded-full object-cover border border-[#EAEAE5]" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#EBD3FF] to-[#CFE8FF] flex items-center justify-center font-bold text-[#202124]">
                                {c.display_name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-[#202124]">{c.display_name}</div>
                              {c.statement && <div className="text-xs text-[#5C7089]">{c.statement}</div>}
                            </div>
                            <div className="ml-auto">
                              <Badge variant="outline" className="rounded-full text-[10px] bg-[#F5F5F4] border-[#EAEAE5] text-[#9AA7B8]">
                                Sealed 🔒
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tally published — show full results */}
              {isTallied && results && countEntries.length > 0 && (
                <div className="space-y-5">

                  {/* Winner banner */}
                  {winner && (
                    <div className="rounded-2xl bg-gradient-to-r from-[#DAF39F] to-[#C6E66C] p-6 flex items-center gap-4 shadow-soft">
                      <Trophy className="w-10 h-10 text-[#3E5A0E] shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-[#3E5A0E] uppercase tracking-widest">Winner</div>
                        <div className="text-2xl font-extrabold text-[#202124]">
                          {candidates.find((c: any) => c.candidate_code === winner)?.display_name || winner}
                        </div>
                        <div className="text-sm text-[#3E5A0E]">
                          {maxVotes} votes ({results.total > 0 ? Math.round((maxVotes / results.total) * 100) : 0}%)
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Full vote breakdown */}
                  <div className="rounded-2xl bg-white border border-[#EAEAE5] overflow-hidden">
                    <div className="px-5 py-4 border-b border-[#EAEAE5]">
                      <h3 className="font-extrabold text-[#202124]">Full Results</h3>
                      <p className="text-xs text-[#5C7089] mt-0.5">
                        Decrypted via 2-of-3 trustee threshold reconstruction ·{" "}
                        {results.total} total ballots
                      </p>
                    </div>
                    <div className="p-5 space-y-5">
                      {countEntries
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .map(([code, count]) => {
                          const cand = candidates.find((c: any) => c.candidate_code === code);
                          const name = cand?.display_name || code;
                          const pct = results.total > 0 ? Math.round(((count as number) / results.total) * 100) : 0;
                          const isWinner = code === winner;
                          return (
                            <div key={code} className="space-y-2">
                              <div className="flex items-center gap-3">
                                {cand?.avatar_url ? (
                                  <img src={cand.avatar_url} alt={name} className="w-8 h-8 rounded-full object-cover border border-[#EAEAE5] shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#EBD3FF] to-[#CFE8FF] flex items-center justify-center text-xs font-bold text-[#202124] shrink-0">
                                    {name.charAt(0)}
                                  </div>
                                )}
                                <div className="flex-1 flex items-center justify-between gap-2">
                                  <span className={`font-bold text-sm ${isWinner ? "text-[#3E5A0E]" : "text-[#202124]"}`}>
                                    {name}
                                    {isWinner && <Trophy className="w-3.5 h-3.5 inline ml-1.5 text-[#3E5A0E]" />}
                                  </span>
                                  <span className="text-sm font-extrabold text-[#202124] shrink-0">
                                    {count as number} <span className="text-[#5C7089] font-normal">({pct}%)</span>
                                  </span>
                                </div>
                              </div>
                              <div className="h-3 rounded-full bg-[#F5F5F4] overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${isWinner ? "bg-[#DAF39F]" : "bg-[#CFE8FF]"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Verification link */}
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#F5F5F4] border border-[#EAEAE5] text-sm">
                    <ShieldCheck className="w-5 h-5 text-[#4CAF7A] shrink-0" />
                    <span className="text-[#5C7089]">
                      Every ballot in this result can be independently verified on the public ledger.
                    </span>
                    <Link href="/integrity" className="ml-auto shrink-0 font-bold text-[#243056] text-xs hover:underline">
                      Check integrity →
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
