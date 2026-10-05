"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getBallotProof } from "@/lib/api/verification";
import { ProofCard, type ProofCardData } from "@/components/ProofCard";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { shortHash } from "@/lib/utils";
import {
  ShieldCheck,
  EyeOff,
  Lock,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Link from "next/link";

export default function ProofPage() {
  const params = useParams();
  const rawId = (params?.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proofData, setProofData] = useState<ProofCardData | null>(null);

  useEffect(() => {
    if (!rawId) return;
    setLoading(true);
    setError(null);

    const lookup = /^\d+$/.test(rawId) ? parseInt(rawId, 10) : rawId;

    getBallotProof(lookup)
      .then((proof) => {
        setProofData({
          election_id: proof.election_id,
          election_title: "Student Council Election",
          ledger_index: proof.ledger_index,
          ballot_fingerprint: proof.ballot_fingerprint,
          entry_hash: proof.entry_hash,
          tree_size: proof.tree_size,
          merkle_root: proof.merkle_root,
          timestamp: proof.sth_timestamp || Math.floor(Date.now() / 1000),
        });
      })
      .catch((err: Error) => {
        setError(err.message || "Failed to load proof card.");
      })
      .finally(() => setLoading(false));
  }, [rawId]);

  return (
    <PublicLayout>
      <section className="min-h-[calc(100vh-80px)] py-12 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-8">

          {/* Header */}
          <div className="text-center space-y-2">
            <Badge
              variant="outline"
              className="bg-[#DAF39F]/20 text-[#3E5A0E] border-[#C6E66C] rounded-full px-4 py-1.5 text-xs font-bold"
            >
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5 inline" /> Official Ballot Proof Card
            </Badge>
            <h1 className="text-3xl font-extrabold text-[#202124] tracking-tight">
              Cryptographic Proof Card
            </h1>
            <p className="text-[#5C7089] max-w-lg mx-auto text-sm leading-relaxed">
              Keep this card to independently confirm your ballot remains sealed in the immutable election ledger — forever.
            </p>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col md:flex-row gap-8 items-start justify-center">
              <Skeleton className="w-[320px] h-[500px] rounded-3xl mx-auto" />
              <div className="flex-1 space-y-4 max-w-sm">
                <Skeleton className="h-44 rounded-2xl" />
                <Skeleton className="h-44 rounded-2xl" />
              </div>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="max-w-md mx-auto p-6 rounded-2xl bg-[#FFE5E5] border border-[#E05252]/30 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-[#E05252] mx-auto" />
              <h2 className="font-extrabold text-[#202124]">Proof Not Found</h2>
              <p className="text-sm text-[#E05252]">{error}</p>
              <p className="text-xs text-[#5C7089]">
                No ballot exists at this index yet. Cast a ballot first, then return here with your receipt number.
              </p>
              <Link
                href="/vote"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#202124] text-white font-bold text-sm px-5 py-2.5 hover:bg-[#2D2E33] mt-2"
              >
                Go cast a ballot <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* Proof card + info */}
          {proofData && !loading && (
            <div className="flex flex-col lg:flex-row gap-10 items-start justify-center">

              {/* The printable card */}
              <div className="mx-auto lg:mx-0">
                <ProofCard data={proofData} showActions={true} />
              </div>

              {/* Side explanation */}
              <div className="flex-1 space-y-5 max-w-sm">

                <div className="rounded-2xl bg-white border border-[#EAEAE5] overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#EAEAE5]">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#4CAF7A]" />
                      <h3 className="font-extrabold text-[#202124] text-sm">What this card proves</h3>
                    </div>
                  </div>
                  <div className="p-5 space-y-4">
                    {[
                      {
                        icon: CheckCircle2,
                        color: "text-[#4CAF7A]",
                        title: "Your vote is in the ledger",
                        desc: `Your ballot is at position #${proofData.ledger_index} in a tree of ${proofData.tree_size} sealed ballots.`,
                      },
                      {
                        icon: Lock,
                        color: "text-[#243056]",
                        title: "Nobody can alter it",
                        desc: "Every ballot is hash-chained and Merkle-rooted. Changing any entry breaks the chain and triggers witness alarms.",
                      },
                      {
                        icon: ShieldCheck,
                        color: "text-[#5B3D86]",
                        title: "Anyone can verify",
                        desc: "Share this receipt number — anyone can confirm the ballot is still in the ledger without seeing who cast it.",
                      },
                    ].map(({ icon: Icon, color, title, desc }) => (
                      <div key={title} className="flex items-start gap-3">
                        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${color}`} />
                        <div>
                          <div className="text-sm font-bold text-[#202124]">{title}</div>
                          <div className="text-xs text-[#5C7089] leading-relaxed mt-0.5">{desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-[#FFF8F0] border border-[#FFD6BA] overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#FFD6BA]">
                    <div className="flex items-center gap-2">
                      <EyeOff className="w-4 h-4 text-[#845913]" />
                      <h3 className="font-extrabold text-[#202124] text-sm">What this card never reveals</h3>
                    </div>
                  </div>
                  <div className="p-5 space-y-3">
                    {[
                      { icon: XCircle, text: "Your candidate choice — sealed client-side, unreadable to the server" },
                      { icon: XCircle, text: "Your name or student ID — identity register is permanently unlinked after token issuance" },
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} className="flex items-start gap-2">
                        <Icon className="w-3.5 h-3.5 text-[#E05252] shrink-0 mt-0.5" />
                        <span className="text-xs text-[#5C7089] leading-relaxed">{text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Technical data */}
                <div className="rounded-2xl bg-white border border-[#EAEAE5] overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#EAEAE5]">
                    <span className="text-xs font-bold text-[#5C7089] uppercase tracking-wide">Proof data</span>
                  </div>
                  <div className="p-5 space-y-2 text-xs font-mono">
                    {[
                      ["Election ID", shortHash(proofData.election_id, 12)],
                      ["Entry hash", shortHash(proofData.entry_hash, 16)],
                      ["Merkle root", shortHash(proofData.merkle_root, 16)],
                      ["Tree size", String(proofData.tree_size)],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-3">
                        <span className="text-[#9AA7B8]">{label}</span>
                        <span className="text-[#202124] font-bold">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </section>
    </PublicLayout>
  );
}
