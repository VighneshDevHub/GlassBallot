"use client";

import { useEffect, useState } from "react";
import { getIntegrityStatus, runIntegrity } from "@/lib/api/integrity";
import type { IntegrityResponse, CheckResult, ReconciliationResponse } from "@/lib/api/elections";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  BookOpen,
  Loader2,
  FileCheck2,
  Lock,
  Download,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Helpers to normalise the backend response shape
// ---------------------------------------------------------------------------

/** The backend sends status:"PASS"/"FAIL", not passed:boolean */
function checkPassed(c: CheckResult): boolean {
  if (c.status === "PASS") return true;
  if (c.status === "FAIL") return false;
  // fallback for any legacy shape
  return Boolean((c as any).passed);
}

/** Reconciliation problems: backend sends `issues`, page used to read `problems` */
function reconcProblems(r: ReconciliationResponse): string[] {
  return r.issues ?? r.problems ?? [];
}

/** Whether reconciliation passed */
function reconcOk(r: ReconciliationResponse): boolean {
  if (typeof r.ok === "boolean") return r.ok;
  return (r.status ?? "").toUpperCase() === "PASS";
}

/** Void token count — backend sends tokens_void */
function reconcVoid(r: ReconciliationResponse): number {
  return r.tokens_void ?? r.pending ?? 0;
}

/** Render check detail safely */
function detailText(d: string | Record<string, unknown> | undefined): string {
  if (!d) return "—";
  if (typeof d === "string") return d;
  return JSON.stringify(d);
}

// ---------------------------------------------------------------------------

export default function IntegrityPage() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [data, setData] = useState<IntegrityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrity = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getIntegrityStatus();
      setData(res);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load integrity status.");
    } finally {
      setLoading(false);
    }
  };

  const handleRunChecks = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await runIntegrity();
      setData(res);
      toast.success("Integrity checks complete.");
    } catch (err: unknown) {
      const msg = (err as Error).message || "Failed to run integrity checks.";
      setError(msg);
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    fetchIntegrity();
  }, []);

  // -------------------------------------------------------------------------
  // Loading skeleton
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <PublicLayout>
        <section className="min-h-[calc(100vh-80px)] py-10 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-56 rounded-full" />
                <Skeleton className="h-9 w-72 rounded-2xl" />
                <Skeleton className="h-4 w-96 rounded-xl" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-36 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-52 rounded-2xl" />
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        </section>
      </PublicLayout>
    );
  }

  const isVerified =
    data?.status === "VERIFIED" || (data as any)?.overall === "VERIFIED";
  const recon: ReconciliationResponse | null =
    (data?.reconciliation as ReconciliationResponse) ?? null;
  const checks: CheckResult[] = Array.isArray(data?.checks) ? data!.checks : [];
  const problems = recon ? reconcProblems(recon) : [];
  const reconOk = recon ? reconcOk(recon) : true;

  return (
    <PublicLayout>
      <section className="min-h-[calc(100vh-80px)] py-10 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* ---- Header ---- */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <Badge
                variant="outline"
                className="bg-[#DAF39F]/20 text-[#3E5A0E] border-[#C6E66C] rounded-full px-3.5 py-1 text-[11px] font-bold"
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5 inline" />
                Continuous Integrity Engine
              </Badge>
              <h1 className="text-3xl font-extrabold text-[#202124] tracking-tight leading-none">
                System Integrity Dashboard
              </h1>
              <p className="text-sm text-[#5C7089]">
                Real-time automated reconciliation & 10-check cryptographic verification ledger.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="rounded-full h-10 border-[#EAEAE5] font-bold text-sm hover:shadow-card"
                onClick={() => fetchIntegrity()}
                disabled={loading}
              >
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Refresh
              </Button>
              <Button
                className="rounded-full h-10 bg-[#243056] hover:bg-[#1A2340] text-white font-bold text-sm shadow-soft"
                onClick={handleRunChecks}
                disabled={running}
              >
                {running ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                )}
                Re-run 10 Checks
              </Button>
              {data?.evidence_bundle_id && (
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full h-10 border-[#EAEAE5] font-bold text-sm hover:shadow-card"
                >
                  <a href={`/api/v1/evidence/${data.evidence_bundle_id}`} download>
                    <Download className="w-4 h-4 mr-1.5" />
                    Evidence Bundle
                  </a>
                </Button>
              )}
            </div>
          </div>

          {/* ---- Error banner ---- */}
          {error && (
            <div className="p-4 rounded-2xl bg-[#FFE5E5] border border-[#E05252]/30 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#E05252] shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm text-[#202124]">Integrity Check Error</div>
                <div className="text-xs text-[#E05252] mt-0.5">{error}</div>
              </div>
            </div>
          )}

          {/* ---- Overall status banner ---- */}
          {data && (
            <div
              className={`rounded-2xl p-6 border-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 ${
                isVerified
                  ? "pastel-lime border-[#C6E66C]"
                  : "bg-[#FFE5E5] border-[#E05252]/40"
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`p-4 rounded-2xl shadow-soft ${
                    isVerified ? "bg-white text-[#3E5A0E]" : "bg-white text-[#E05252]"
                  }`}
                >
                  {isVerified ? (
                    <ShieldCheck className="w-10 h-10" />
                  ) : (
                    <ShieldAlert className="w-10 h-10" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#5C7089] uppercase tracking-wider">
                      System State
                    </span>
                    {data.frozen && (
                      <Badge variant="destructive" className="text-[10px] rounded-full">
                        <Lock className="w-3 h-3 mr-1" /> FROZEN
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-xl font-extrabold text-[#202124]">
                    {isVerified
                      ? "SYSTEM VERIFIED — NO TAMPERING DETECTED"
                      : "INTEGRITY ALARM TRIGGERED"}
                  </h2>
                  <p className="text-xs text-[#5C7089]">
                    {isVerified
                      ? "All 10 mathematical and structural constraints satisfied."
                      : `First failed check: ${data.first_failed_check ?? "Unknown constraint failure"}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <span className="text-xs text-[#5C7089] block">Ledger Size</span>
                  <span className="text-2xl font-extrabold font-mono text-[#243056]">
                    {data.entries ?? 0}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[#5C7089] block">Merkle Root</span>
                  <span className="text-sm font-mono text-[#202124] block max-w-[160px] truncate">
                    {data.merkle_root || "—"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ---- Two Books Reconciliation ---- */}
          {recon && (
            <div className="bg-white rounded-2xl border border-[#EAEAE5] shadow-card overflow-hidden">
              <div className="px-6 py-5 border-b border-[#EAEAE5]">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#243056]" />
                  <h2 className="text-lg font-extrabold text-[#202124]">
                    Two Books Continuous Reconciliation
                  </h2>
                </div>
                <p className="text-xs text-[#5C7089] mt-1">
                  Book A (Eligibility Register) vs Book B (Sealed Ledger) — must equal 1:1 to
                  guarantee zero ballot stuffing or deletion.
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl pastel-sky border border-[#C6E6FA] text-center">
                    <span className="text-[11px] text-[#5C7089] font-bold block uppercase tracking-wide mb-1">
                      Voters Marked
                    </span>
                    <span className="text-2xl font-extrabold text-[#243056]">
                      {recon.voters_marked ?? 0}
                    </span>
                  </div>
                  <div className="p-4 rounded-2xl pastel-lavender border border-[#EBD3FF] text-center">
                    <span className="text-[11px] text-[#5C7089] font-bold block uppercase tracking-wide mb-1">
                      Ballots Recorded
                    </span>
                    <span className="text-2xl font-extrabold text-[#243056]">
                      {recon.ballots_recorded ?? 0}
                    </span>
                  </div>
                  <div className="p-4 rounded-2xl pastel-peach border border-[#FFD6BA] text-center">
                    <span className="text-[11px] text-[#5C7089] font-bold block uppercase tracking-wide mb-1">
                      Void Tokens
                    </span>
                    <span className="text-2xl font-extrabold text-[#E07A24]">
                      {reconcVoid(recon)}
                    </span>
                  </div>
                  <div className="p-4 rounded-2xl pastel-lime border border-[#C6E66C] text-center">
                    <span className="text-[11px] text-[#5C7089] font-bold block uppercase tracking-wide mb-1">
                      Status
                    </span>
                    <span
                      className={`text-lg font-extrabold ${
                        reconOk ? "text-[#3E5A0E]" : "text-[#E05252]"
                      }`}
                    >
                      {reconOk ? "1:1 MATCH" : "MISMATCH"}
                    </span>
                  </div>
                </div>

                {problems.length > 0 && (
                  <div className="p-4 rounded-2xl bg-[#FFE5E5] border border-[#E05252]/30 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#E05252] shrink-0" />
                      <span className="text-sm font-bold text-[#E05252]">
                        Reconciliation Discrepancies ({problems.length})
                      </span>
                    </div>
                    <ul className="list-disc list-inside space-y-1">
                      {problems.map((p, i) => (
                        <li key={i} className="text-xs text-[#202124] font-mono">
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---- 10-check results table ---- */}
          <div className="bg-white rounded-2xl border border-[#EAEAE5] shadow-card overflow-hidden">
            <div className="px-6 py-5 border-b border-[#EAEAE5]">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-[#243056]" />
                <h2 className="text-lg font-extrabold text-[#202124]">
                  Automated 10-Check Audit Results
                </h2>
              </div>
              <p className="text-xs text-[#5C7089] mt-1">
                Every constraint is evaluated continuously against live database state and
                cryptographic rules.
              </p>
            </div>

            {checks.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-[#5C7089]">
                No check results yet. Click &ldquo;Re-run 10 Checks&rdquo; to run the integrity engine.
              </div>
            ) : (
              <div className="divide-y divide-[#F5F5F4]">
                {checks.map((check, idx) => {
                  const passed = checkPassed(check);
                  return (
                    <div
                      key={idx}
                      className={`px-6 py-4 flex items-start gap-4 ${
                        !passed ? "bg-[#FFF8F8]" : ""
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        {passed ? (
                          <CheckCircle2 className="w-5 h-5 text-[#4CAF7A]" />
                        ) : (
                          <XCircle className="w-5 h-5 text-[#E05252]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-[#202124]">
                            {idx + 1}. {check.name}
                          </span>
                          <Badge
                            variant="outline"
                            className={`rounded-full text-[10px] font-bold px-2.5 py-0.5 ${
                              passed
                                ? "bg-[#E8F6EE] border-[#4CAF7A]/40 text-[#3E5A0E]"
                                : "bg-[#FFE5E5] border-[#E05252]/40 text-[#E05252]"
                            }`}
                          >
                            {passed ? "PASS" : "FAIL"}
                          </Badge>
                        </div>
                        <p className="text-xs text-[#5C7089] font-mono mt-1 break-all">
                          {detailText(check.details)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </section>
    </PublicLayout>
  );
}
