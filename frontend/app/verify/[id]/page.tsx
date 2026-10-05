"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { verifyBallot, getBallotProof, type VerificationResponse, type ProofResponse } from "@/lib/api/verification";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { shortHash } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Search,
  Loader2,
  FileText,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  Link2,
  Eye,
  Users,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function PublicVerifyPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = (params?.id as string) || "";

  const [query, setQuery] = useState(rawId === "0" ? "" : rawId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResponse | null>(null);
  const [proof, setProof] = useState<ProofResponse | null>(null);

  const run = async (target: string) => {
    const t = target.trim();
    if (t === "") return;   // empty — do nothing
    setLoading(true);
    setError(null);
    setResult(null);
    setProof(null);
    try {
      // numeric string (including "0") → use as index
      const lookup = /^\d+$/.test(t) ? parseInt(t, 10) : t;
      const [verRes, proofRes] = await Promise.allSettled([
        verifyBallot(lookup),
        getBallotProof(lookup),
      ]);
      if (verRes.status === "fulfilled") {
        setResult(verRes.value);
      } else {
        throw new Error((verRes.reason as Error)?.message || "Verification failed");
      }
      if (proofRes.status === "fulfilled") {
        setProof(proofRes.value);
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to verify ballot.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-run if there's a real ID in the URL (not empty, any number including 0)
    if (rawId !== "") run(rawId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = query.trim();
    if (!t) { toast.error("Enter a ballot fingerprint or ledger number"); return; }
    router.push(`/verify/${encodeURIComponent(t)}`);
  };

  const isVerified = result?.status === "VERIFIED";

  return (
    <PublicLayout>
      <section className="min-h-[calc(100vh-80px)] py-12 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto space-y-8">

          {/* Header */}
          <div className="text-center space-y-3">
            <Badge variant="outline" className="bg-[#DAF39F]/20 text-[#3E5A0E] border-[#C6E66C] rounded-full px-4 py-1.5 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5 inline" /> Public Ballot Verifier
            </Badge>
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#202124] tracking-tight">
              Check if your vote was counted
            </h1>
            <p className="text-[#5C7089] max-w-lg mx-auto text-sm leading-relaxed">
              Enter the receipt number from your ballot confirmation. Anyone can verify — no login needed, and no voter identity is ever revealed.
            </p>
          </div>

          {/* Search */}
          <div className="bg-white rounded-2xl border border-[#EAEAE5] p-4 shadow-card">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9AA7B8]" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Receipt number (e.g. 3) or ballot fingerprint…"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#EAEAE5] text-sm font-mono bg-[#F5F5F4] focus:outline-none focus:ring-2 focus:ring-[#DAF39F]"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-[#DAF39F] hover:bg-[#C6E66C] text-[#202124] font-bold px-5"
              >
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Search className="w-4 h-4" />}
              </Button>
            </form>
          </div>

          {/* Privacy notice */}
          <div className="p-4 rounded-2xl bg-[#EBD3FF]/30 border border-[#D6BDF8] flex items-start gap-3">
            <EyeOff className="w-4 h-4 text-[#5B3D86] shrink-0 mt-0.5" />
            <p className="text-xs text-[#5B3D86] leading-relaxed">
              <span className="font-bold">Zero-knowledge check.</span>{" "}
              Verifying a ballot proves it exists in the sealed ledger — without revealing who cast it or who they voted for. This is safe to share publicly.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 rounded-2xl bg-[#FFE5E5] border border-[#E05252]/30 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#E05252] shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm text-[#202124]">Ballot not found</div>
                <div className="text-xs text-[#E05252] mt-0.5">{error}</div>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="space-y-4">
              <Skeleton className="h-20 rounded-2xl" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
              </div>
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <div className="space-y-5">

              {/* Overall verdict */}
              <div
                className={`rounded-2xl p-6 border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isVerified
                    ? "bg-[#E8F6EE] border-[#4CAF7A]/50"
                    : "bg-[#FFE5E5] border-[#E05252]/40"
                }`}
              >
                <div className="flex items-center gap-4">
                  {isVerified
                    ? <CheckCircle2 className="w-10 h-10 text-[#3E5A0E] shrink-0" />
                    : <XCircle className="w-10 h-10 text-[#E05252] shrink-0" />}
                  <div>
                    <div className="font-extrabold text-xl text-[#202124]">
                      {isVerified ? "Vote confirmed in ledger ✓" : "Could not verify"}
                    </div>
                    <div className="text-sm text-[#5C7089] mt-0.5">
                      {isVerified
                        ? "This ballot is sealed, chained, and independently witnessed."
                        : "The ballot was not found or verification checks failed."}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-[#5C7089]">Ledger position</div>
                  <div className="text-2xl font-extrabold font-mono text-[#243056]">
                    #{result.ledger_index}
                  </div>
                </div>
              </div>

              {/* 4 check cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    icon: CheckCircle2,
                    title: "Ballot found in ledger",
                    passed: !!result.ballot_fingerprint,
                    status: result.ballot_fingerprint ? "Found" : "Not found",
                    detail: result.ballot_fingerprint
                      ? `Fingerprint: ${shortHash(result.ballot_fingerprint, 16)}`
                      : "No ballot at this index",
                  },
                  {
                    icon: Link2,
                    title: "Hash chain is unbroken",
                    passed: result.inclusion_proof_valid,
                    status: result.inclusion_proof_valid ? "Valid" : "Broken",
                    detail: result.inclusion_proof_valid
                      ? `Entry hash: ${shortHash(result.entry_hash, 16)}`
                      : "Inclusion proof check failed",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Merkle tree root verified",
                    passed: !!result.merkle_root,
                    status: result.merkle_root ? `${result.tree_size} votes in tree` : "No tree head",
                    detail: result.merkle_root
                      ? `Root: ${shortHash(result.merkle_root, 16)}`
                      : "No signed tree head found",
                  },
                  {
                    icon: Users,
                    title: "Observer nodes agree",
                    passed: result.witnesses_synced,
                    status: result.witnesses_synced ? "No alarms" : "Alarm raised",
                    detail: result.witnesses_synced
                      ? "All candidate witness nodes are in sync"
                      : "One or more witnesses detected a discrepancy",
                  },
                ].map((c, i) => {
                  const Icon = c.icon;
                  return (
                    <div
                      key={i}
                      className={`rounded-2xl border p-5 space-y-3 ${
                        c.passed
                          ? "bg-white border-[#EAEAE5]"
                          : "bg-[#FFF8F8] border-[#E05252]/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon
                            className={`w-4.5 h-4.5 ${c.passed ? "text-[#4CAF7A]" : "text-[#E05252]"}`}
                          />
                          <span className="text-sm font-bold text-[#202124]">{c.title}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`rounded-full text-[10px] font-bold px-2.5 py-0.5 ${
                            c.passed
                              ? "bg-[#E8F6EE] border-[#4CAF7A]/30 text-[#3E5A0E]"
                              : "bg-[#FFE5E5] border-[#E05252]/30 text-[#E05252]"
                          }`}
                        >
                          {c.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-[#5C7089] font-mono bg-[#F5F5F4] px-3 py-2 rounded-xl break-all">
                        {c.detail}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Proof detail if available */}
              {proof && (
                <div className="rounded-2xl bg-white border border-[#EAEAE5] overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#EAEAE5]">
                    <h3 className="font-extrabold text-[#202124]">Full proof details</h3>
                    <p className="text-xs text-[#5C7089] mt-0.5">Raw cryptographic data from the ledger entry</p>
                  </div>
                  <div className="px-5 py-4 space-y-3 text-xs font-mono">
                    {[
                      ["Election ID", proof.election_id],
                      ["Ledger index", String(proof.ledger_index)],
                      ["Entry hash", proof.entry_hash],
                      ["Previous hash", proof.previous_hash],
                      ["Merkle root", proof.merkle_root],
                      ["Tree size", String(proof.tree_size) + " votes"],
                      ["Inclusion path depth", proof.inclusion_path.length + " hashes"],
                      ["Witnesses", proof.witnesses.map(w => `${w.witness_code}:${w.status}`).join(", ") || "None"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex gap-3">
                        <span className="text-[#9AA7B8] w-36 shrink-0">{label}</span>
                        <span className="text-[#202124] break-all">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              <p className="text-xs text-[#9AA7B8] text-center leading-relaxed">
                {result.disclaimer}
              </p>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 justify-between items-center pt-1">
                <Button variant="outline" asChild className="rounded-full border-[#EAEAE5] font-bold text-sm">
                  <Link href="/integrity">
                    <ShieldCheck className="w-4 h-4 mr-1.5" /> System Integrity
                  </Link>
                </Button>
                {result.ledger_index > -1 && (
                  <Button asChild className="rounded-full bg-[#243056] hover:bg-[#1A2340] text-white font-bold text-sm shadow-soft">
                    <Link href={`/proof/${result.ledger_index}`}>
                      <FileText className="w-4 h-4 mr-1.5" /> Open Proof Card
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!result && !loading && !error && (
            <div className="text-center py-16 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-[#F5F5F4] flex items-center justify-center mx-auto">
                <Eye className="w-8 h-8 text-[#9AA7B8]" />
              </div>
              <div className="font-bold text-[#202124]">Enter your receipt number above</div>
              <p className="text-sm text-[#5C7089] max-w-xs mx-auto">
                After voting you receive a number — enter it here to confirm your vote is in the final count.
              </p>
              <Button
                variant="outline"
                className="rounded-full border-[#EAEAE5] font-bold text-sm mt-2"
                onClick={() => { setQuery("0"); router.push("/verify/0"); }}
              >
                <RefreshCw className="w-4 h-4 mr-1.5" /> Try ledger index #0 (first ballot)
              </Button>
            </div>
          )}

        </div>
      </section>
    </PublicLayout>
  );
}
