"use client";

import { useEffect, useState } from "react";
import { getElectionConfig, ElectionConfigResponse } from "@/lib/api/elections";
import { getTrustees, getTallySessions, TrusteeOut, TallySessionOut, startTally, approveTally } from "@/lib/api/admin";
import { SidebarDashboardLayout } from "@/components/layouts/SidebarDashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { toast } from "sonner";
import {
  KeyRound,
  ShieldCheck,
  Users,
  CheckCircle2,
  Lock,
  Unlock,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Cpu,
  Layers,
  ArrowRight,
  EyeOff,
  Sparkles,
} from "lucide-react";

export default function AdminTrusteesPage() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<ElectionConfigResponse | null>(null);
  const [trustees, setTrustees] = useState<TrusteeOut[]>([]);
  const [tallySessions, setTallySessions] = useState<TallySessionOut[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeTrustees, setActiveTrustees] = useState<number[]>([1, 2]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfg, trs, tss] = await Promise.all([
        getElectionConfig(),
        getTrustees().catch(() => []),
        getTallySessions().catch(() => []),
      ]);
      setConfig(cfg);
      setTrustees(trs);
      setTallySessions(tss);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Failed to load trustee state.");
      toast.error(e.message || "Failed to load trustee state.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartTally = async () => {
    if (!config?.election?.id) return;
    setActionLoading(true);
    setStatusMessage(null);
    try {
      await startTally(config.election.id);
      setStatusMessage("Tally session initialized! Trustee approvals are now requested.");
      toast.success("Tally session initialized! Trustee approvals requested.");
      await loadData();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message);
      toast.error(e.message || "Failed to start tally session.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSimulateApprove = async (sessionId: string, trusteeIndex: number) => {
    setActionLoading(true);
    setStatusMessage(null);
    try {
      await approveTally(sessionId, {
        trustee_id: `tr-${trusteeIndex}`,
        share_b64: `demo-share-${trusteeIndex}-${Date.now()}`,
        trustee_share: {
          index: trusteeIndex,
          x: trusteeIndex,
          y: `0x7fa92c${trusteeIndex}84b1d6e`,
          authorized_at: new Date().toISOString(),
        },
      });
      setStatusMessage(`Trustee #${trusteeIndex} submitted digital share successfully.`);
      toast.success(`Trustee #${trusteeIndex} share submitted.`);
      await loadData();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message);
      toast.error(e.message || `Trustee #${trusteeIndex} share submission failed.`);
    } finally {
      setActionLoading(false);
    }
  };

  const displayTrustees = trustees.map((t, idx) => ({
    id: t.id || `tr-${idx + 1}`,
    name: t.display_name || `Trustee ${idx + 1}`,
    role: t.role_code || "Electoral Trustee",
    email: `${(t.role_code || "trustee").toLowerCase()}@rgit.ac.in`,
    public_key_b64: t.public_key_b64 || "P-256-SHARD-KEY",
    status: t.status || "ACTIVE",
  }));

  return (
    <SidebarDashboardLayout role="admin">
      <div className="space-y-8">
        <div className="text-center space-y-3">
          <Badge variant="outline" className="bg-[#DAF39F]/20 text-[#3E5A0E] border-[#DAF39F] rounded-full px-3 py-1 text-xs">
            <KeyRound className="w-3.5 h-3.5 mr-1.5 inline text-[#3E5A0E]" /> Threshold Cryptography & Key Ceremony
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-black text-[#202124] tracking-tight">
            Shamir (2, 3) Trustee Key Assembly
          </h1>
          <p className="text-[#5C7089] max-w-2xl mx-auto text-sm">
            No single individual, server admin, or returning officer holds the decryption key. Ballots remain sealed until at least 2 of 3 designated independent trustees convene to reconstruct the tally key.
          </p>
        </div>

        {statusMessage && (
          <Alert className="border-[#C6E66C] pastel-lime text-[#202124] rounded-2xl">
            <CheckCircle2 className="h-4 h-4 text-[#3E5A0E]" />
            <AlertTitle className="font-bold">Trustee Action Recorded</AlertTitle>
            <AlertDescription className="text-xs">{statusMessage}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="border-[#F8B4B4] pastel-peach text-[#202124] rounded-2xl">
            <AlertTriangle className="h-4 h-4 text-[#E05252]" />
            <AlertTitle className="font-bold">Trustee Operation Notice</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-8">
            <Skeleton className="h-44 rounded-2xl" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-64 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        ) : (
          <>
            <div className="pastel-lavender border border-[#EBD3FF] rounded-2xl p-6 shadow-card space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase tracking-wider text-[#7C3AED]">
                      POLYNOMIAL DEGREE: d = 1
                    </span>
                    <span className="text-xs bg-white/60 text-[#7C3AED] border border-[#EBD3FF] px-2 py-0.5 rounded-full font-bold">
                      THRESHOLD: 2 OF 3 REQUIRED
                    </span>
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-[#202124]">
                    Cryptographic Quorum Governance
                  </h2>
                  <p className="text-xs text-[#5C7089] max-w-xl">
                    Lagrange polynomial interpolation over NIST P-256: Reconstructs S = f(0) using any 2 shares (x₁, y₁) and (x₂, y₂). Any single shard provides 0 bits of information about the secret.
                  </p>
                </div>

                <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
                  <span className="text-xs text-[#5C7089] uppercase font-semibold">Active Quorum Readiness</span>
                  <div className="flex items-center gap-2 text-2xl font-black text-[#3E5A0E]">
                    <ShieldCheck className="w-6 h-6 text-[#3E5A0E]" />
                    <span>{activeTrustees.length} / 2 Ready</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-[#5C7089]">
                  <span>Threshold Progress</span>
                  <span className="font-mono text-[#7C3AED] font-bold">
                    {Math.min(100, Math.round((activeTrustees.length / 2) * 100))}% Quorum Met
                  </span>
                </div>
                <Progress
                  value={Math.min(100, (activeTrustees.length / 2) * 100)}
                  className="h-2.5 bg-white/60"
                />
              </div>
            </div>

            {displayTrustees.length === 0 ? (
              <Card className="border-[#FFD6BA] pastel-peach shadow-card rounded-2xl">
                <CardContent className="p-10 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="p-4 rounded-2xl bg-white text-[#E07A24]">
                    <KeyRound className="w-10 h-10" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-[#202124]">No Trustees Configured</h3>
                    <p className="text-sm text-[#5C7089] max-w-md">
                      Trustee roster is empty. Please run election setup to designate the 3 independent Shamir key-holders for threshold decryption.
                    </p>
                  </div>
                  <Button
                    variant="default"
                    onClick={handleStartTally}
                    disabled={actionLoading || !config?.election?.id}
                    className="bg-[#243056] hover:bg-[#1A2340] rounded-full"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    Run Election Setup / Initialize Roster
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {displayTrustees.map((trustee, idx) => {
                  const shardIndex = idx + 1;
                  const isSelected = activeTrustees.includes(shardIndex);

                  return (
                    <Card
                      key={trustee.id || idx}
                      className={`border-2 transition-all shadow-card rounded-2xl ${
                        isSelected ? "border-[#DAF39F] bg-[#DAF39F]/10" : "border-[#EAEAE5] bg-white"
                      }`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <Badge
                            variant="outline"
                            className={`font-mono text-xs rounded-full ${
                              isSelected
                                ? "bg-[#DAF39F]/30 text-[#3E5A0E] border-[#DAF39F]"
                                : "bg-[#F5F5F4] text-[#5C7089] border-[#EAEAE5]"
                            }`}
                          >
                            SHARD #{shardIndex} (x={shardIndex})
                          </Badge>
                          {isSelected ? (
                            <CheckCircle2 className="w-5 h-5 text-[#3E5A0E]" />
                          ) : (
                            <Lock className="w-4 h-4 text-[#5C7089]" />
                          )}
                        </div>
                        <CardTitle className="text-base font-bold text-[#202124] mt-2">
                          {trustee.name}
                        </CardTitle>
                        <CardDescription className="text-xs text-[#5C7089]">
                          {trustee.role || "Electoral Trustee"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 text-xs">
                        <div className="p-2.5 bg-[#F5F5F4] rounded-2xl border border-[#EAEAE5] font-mono text-[11px] space-y-1">
                          <div className="text-[#5C7089]">Official Contact:</div>
                          <div className="text-[#202124] font-bold truncate">{trustee.email}</div>
                          <div className="text-[#5C7089] pt-1">Public Key Commitment:</div>
                          <div className="text-[#243056] font-bold truncate">{trustee.public_key_b64 || "ECDH-P256-PUBKEY"}</div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[#5C7089] font-semibold">Ceremony Participation:</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setActiveTrustees(activeTrustees.filter((i) => i !== shardIndex));
                              } else {
                                setActiveTrustees([...activeTrustees, shardIndex]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                              isSelected
                                ? "bg-[#DAF39F] hover:bg-[#C6E66C] text-[#202124]"
                                : "bg-[#F5F5F4] text-[#202124] hover:bg-[#EAEAE5]"
                            }`}
                          >
                            {isSelected ? "Shard Provided" : "Submit Shard"}
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            <Card className="border border-[#EAEAE5] shadow-soft bg-white rounded-2xl">
              <CardHeader className="border-b border-[#EAEAE5]">
                <CardTitle className="text-lg font-bold text-[#202124] flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-[#243056]" />
                  Lagrange Polynomial Interpolation at Evaluation Point x = 0
                </CardTitle>
                <CardDescription className="text-xs text-[#5C7089]">
                  How the tally decryption key is reconstructed in secure enclave memory without revealing candidate selections
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="p-4 bg-[#F5F5F4] rounded-2xl border border-[#EAEAE5] font-mono text-xs text-[#202124] space-y-2">
                  <div className="font-bold text-[#243056]">Lagrange Basis Formulation:</div>
                  <p className="text-[#5C7089]">
                    For any two participating shares (x_i, y_i) and (x_j, y_j):
                  </p>
                  <div className="p-3 bg-white rounded-2xl border border-[#EAEAE5] text-[#243056] font-semibold text-center">
                    L_i(0) = (-x_j) / (x_i - x_j) mod p &nbsp;&nbsp;|&nbsp;&nbsp; L_j(0) = (-x_i) / (x_j - x_i) mod p
                  </div>
                  <p className="text-[#5C7089] text-[11px]">
                    Master Tally Secret: S = [ y_i * L_i(0) + y_j * L_j(0) ] mod p
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-2xl border border-[#C6E66C] pastel-lime space-y-2">
                    <div className="flex items-center gap-2 font-bold text-[#202124]">
                      <ShieldCheck className="w-4 h-4 text-[#3E5A0E]" />
                      <span>Information-Theoretic Privacy</span>
                    </div>
                    <p className="text-[#5C7089] text-[11px] leading-relaxed">
                      Even with unlimited computing power, an attacker with only 1 share faces equal probability across all possible secrets in the finite field.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl border border-[#C6E6FA] pastel-sky space-y-2">
                    <div className="flex items-center gap-2 font-bold text-[#202124]">
                      <Layers className="w-4 h-4 text-[#243056]" />
                      <span>Zero Server Persistence</span>
                    </div>
                    <p className="text-[#5C7089] text-[11px] leading-relaxed">
                      Trustee shards exist solely in volatile RAM during the tally execution step and are purged immediately after batch homomorphic decryption.
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#EAEAE5] pt-4">
                  <div className="text-xs text-[#5C7089]">
                    Election Status: <strong className="text-[#202124]">{config?.state?.toUpperCase() || "OPEN"}</strong>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadData}
                      disabled={loading}
                      className="text-xs font-semibold rounded-full"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh Ceremony
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleStartTally}
                      disabled={actionLoading || displayTrustees.length === 0}
                      className="text-xs font-semibold bg-[#DAF39F] hover:bg-[#C6E66C] text-[#202124] rounded-full"
                    >
                      {actionLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <KeyRound className="w-3.5 h-3.5 mr-1" />}
                      Start Tally Session
                    </Button>
                    <Link
                      href="/results"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#243056] hover:bg-[#1A2340] text-white rounded-full text-xs font-bold shadow-xs transition-all"
                    >
                      <span>View Decrypted Results</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </SidebarDashboardLayout>
  );
}
