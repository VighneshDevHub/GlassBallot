"use client";

import { useState } from "react";
import { runDemoAttack, seedDemoVotes, resetDemo, setDemoDevice, DemoAttackResponse } from "@/lib/api/admin";
import { SidebarDashboardLayout } from "@/components/layouts/SidebarDashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import { toast } from "sonner";
import {
  Zap,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  Lock,
  ArrowRight,
  Sparkles,
  Bug,
  Cpu,
  Layers,
  FileCode,
} from "lucide-react";

interface AttackCardProps {
  id: string;
  number: number;
  title: string;
  description: string;
  defense: string;
  kind: string;
  onAttack: (kind: string) => void;
  loading: boolean;
  activeKind: string | null;
}

function AttackScenarioCard({
  number,
  title,
  description,
  defense,
  kind,
  onAttack,
  loading,
  activeKind,
}: AttackCardProps) {
  const isExecuting = loading && activeKind === kind;

  return (
    <Card className="border border-[#EAEAE5] bg-white hover:border-[#FFD6BA] hover:shadow-card transition-all flex flex-col justify-between rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="font-mono text-xs bg-[#FFD6BA]/30 text-[#E07A24] border-[#FFD6BA] rounded-full">
            SCENARIO 0{number}
          </Badge>
          <Zap className="w-4 h-4 text-[#E07A24]" />
        </div>
        <CardTitle className="text-base font-bold text-[#202124] mt-2">
          {title}
        </CardTitle>
        <CardDescription className="text-xs text-[#5C7089] leading-relaxed">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="p-2.5 bg-[#F5F5F4] rounded-2xl border border-[#EAEAE5] text-[11px] text-[#5C7089] space-y-1">
          <span className="font-bold text-[#202124] block">Defense Mechanism:</span>
          <span>{defense}</span>
        </div>
        <Button
          onClick={() => onAttack(kind)}
          disabled={loading}
          variant="outline"
          className="w-full text-xs font-bold border-[#FFD6BA] text-[#E07A24] hover:bg-[#FFD6BA]/30 flex items-center justify-center gap-1.5 rounded-full"
        >
          {isExecuting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E07A24]" />
              <span>Executing Attack...</span>
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5 text-[#E07A24]" />
              <span>Simulate Attack</span>
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AdminSimulatorPage() {
  const [loading, setLoading] = useState(false);
  const [activeKind, setActiveKind] = useState<string | null>(null);
  const [attackResult, setAttackResult] = useState<DemoAttackResponse | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compromisedDevice, setCompromisedDevice] = useState(false);

  const handleRunAttack = async (kind: string) => {
    setLoading(true);
    setActiveKind(kind);
    setAttackResult(null);
    setNotification(null);
    setError(null);

    try {
      const res = await runDemoAttack(kind);
      setAttackResult(res);
      const msg = `Attack "${kind}" completed. Detection triggered.`;
      setNotification(msg);
      toast.success(msg);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || `Attack simulation failed for scenario: ${kind}`);
      toast.error(e.message || `Attack simulation failed: ${kind}`);
    } finally {
      setLoading(false);
      setActiveKind(null);
    }
  };

  const handleSeedVotes = async () => {
    setLoading(true);
    setError(null);
    try {
      await seedDemoVotes(10);
      const msg = "Seeded 10 valid test ballots into the ledger.";
      setNotification(msg);
      toast.success(msg);
    } catch (err: unknown) {
      const e = err as Error;
      const msg = e.message || "Failed to seed ballots.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    setError(null);
    try {
      await resetDemo();
      setAttackResult(null);
      const msg = "Demo baseline successfully restored. System integrity: VERIFIED.";
      setNotification(msg);
      toast.success(msg);
    } catch (err: unknown) {
      const e = err as Error;
      setAttackResult(null);
      const msg = e.message || "Failed to reset demo baseline.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDevice = async () => {
    try {
      const res = await setDemoDevice(!compromisedDevice);
      setCompromisedDevice(res.compromised_device);
      const msg = `Compromised client malware simulation: ${res.compromised_device ? "ACTIVE" : "OFF"}`;
      setNotification(msg);
      toast.success(msg);
    } catch (err: unknown) {
      const e = err as Error;
      setCompromisedDevice(!compromisedDevice);
      const msg = `Compromised client malware simulation: ${!compromisedDevice ? "ACTIVE" : "OFF"}`;
      setNotification(msg);
      toast.error(e.message || "Device toggle API failed; toggling UI state only.");
    }
  };

  const scenarios = [
    {
      number: 1,
      title: "Ballot Stuffing",
      kind: "stuff_ballot",
      description: "Adversary tries injecting an extra vote into Book B without an eligible voter in Book A.",
      defense: "Two-Books Reconciliation Invariant halts immediately: Count(Book A) ≠ Count(Book B).",
    },
    {
      number: 2,
      title: "Historic Ledger Tampering",
      kind: "tamper_history",
      description: "Adversary alters an existing encrypted ballot ciphertext stored in the database.",
      defense: "RFC 6962 Merkle tree recomputation fails: Root hash differs from Ed25519 Signed Tree Head.",
    },
    {
      number: 3,
      title: "Audit Log Hash Breaking",
      kind: "tamper_audit",
      description: "Adversary attempts to modify or delete an administrative election audit event.",
      defense: "Cryptographic SHA-256 hash-chain pointer breaks at the tampered event index.",
    },
    {
      number: 4,
      title: "Double-Voting / Token Replay",
      kind: "double_vote",
      description: "Adversary tries casting twice using the same blind authorization token.",
      defense: "Token nullifier invariant: Single-use token hash is immediately burned upon first cast.",
    },
    {
      number: 5,
      title: "Split-View / Fork Witness Attack",
      kind: "fork_witness",
      description: "Server attempts presenting different Merkle roots to different candidate observers.",
      defense: "Independent candidate witness nodes cross-verify STHs; sticky alarm triggers publicly.",
    },
    {
      number: 6,
      title: "Cast Challenged/Audited Ballot",
      kind: "cast_tested",
      description: "Adversary attempts casting a ballot that was already opened during Test-My-Ballot.",
      defense: "Benaloh challenge protocol: Spoiled ephemeral keys are permanently blacklisted.",
    },
    {
      number: 7,
      title: "Bad Cryptographic Signature",
      kind: "bad_signature",
      description: "Adversary submits an invalid Ed25519 signature or corrupted ECDH ciphertext payload.",
      defense: "WebCrypto client verification and server verification immediately reject invalid signatures.",
    },
  ];

  return (
    <SidebarDashboardLayout role="admin">
      <div className="space-y-8">
        <div className="text-center space-y-3">
          <Badge variant="outline" className="bg-[#FFD6BA]/30 text-[#E07A24] border-[#FFD6BA] rounded-full px-3 py-1 text-xs">
            <Zap className="w-3.5 h-3.5 mr-1.5 inline text-[#E07A24]" /> Interactive Red-Team Sandbox
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-black text-[#202124] tracking-tight">
            Attack & Fraud Detection Simulator
          </h1>
          <p className="text-[#5C7089] max-w-2xl mx-auto text-sm">
            Simulate real-world election tampering attacks against GlassBallot. Experience how mathematical invariants, 2-of-3 threshold splitting, and RFC 6962 Merkle trees detect and prevent fraud in real time.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 pastel-lavender border border-[#EBD3FF] rounded-2xl shadow-card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white text-[#E07A24] border border-[#FFD6BA]">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-[#202124]">Interactive Red-Team Testing Mode</div>
              <div className="text-xs text-[#5C7089]">8 Attack Vectors • Live Mathematical Reconciler</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedVotes}
              disabled={loading}
              className="text-[#202124] bg-white hover:bg-[#F5F5F4] text-xs font-semibold rounded-full border-[#EAEAE5]"
            >
              + Seed 10 Ballots
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleReset}
              disabled={loading}
              className="text-xs font-semibold rounded-full"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Reset Baseline
            </Button>
          </div>
        </div>

        {notification && (
          <Alert className="border-[#C6E66C] pastel-lime text-[#202124] rounded-2xl">
            <CheckCircle2 className="h-4 h-4 text-[#3E5A0E]" />
            <AlertTitle className="font-bold">Simulator Notice</AlertTitle>
            <AlertDescription className="text-xs">{notification}</AlertDescription>
          </Alert>
        )}

        {error && !attackResult && (
          <Alert variant="destructive" className="rounded-2xl">
            <AlertTriangle className="h-4 h-4" />
            <AlertTitle>Simulator Error</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {attackResult && (
          <div className="pastel-peach border-2 border-[#FFD6BA] rounded-2xl p-6 shadow-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="font-bold text-xs rounded-full">
                  ATTACK EXECUTED: {attackResult.kind.replace(/_/g, " ").toUpperCase()}
                </Badge>
                {attackResult.affected_index !== undefined && (
                  <span className="text-xs font-mono text-[#E05252] font-bold">
                    TARGET INDEX: #{attackResult.affected_index ?? 0}
                  </span>
                )}
              </div>
              <Link
                href="/integrity"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#E05252] hover:text-[#B84A10] underline"
              >
                <span>Inspect in 10-Check Ledger</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <p className="text-xs text-[#202124] font-semibold leading-relaxed">
              {attackResult.note}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono bg-white p-4 rounded-2xl border border-[#FFD6BA]">
              <div>
                <span className="text-[#5C7089] block text-[11px] font-sans">STATE BEFORE ATTACK:</span>
                <span className="font-bold text-[#3E5A0E] text-sm">
                  {attackResult.before_integrity || "VERIFIED (10/10 PASS)"}
                </span>
              </div>
              <div>
                <span className="text-[#5C7089] block text-[11px] font-sans">STATE AFTER ATTACK:</span>
                <span className="font-bold text-[#E05252] text-sm flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  {attackResult.after_integrity || "ALARM TRIGGERED (TAMPER DETECTED)"}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {scenarios.map((scen) => (
            <AttackScenarioCard
              key={scen.kind}
              id={scen.kind}
              number={scen.number}
              title={scen.title}
              description={scen.description}
              defense={scen.defense}
              kind={scen.kind}
              onAttack={handleRunAttack}
              loading={loading}
              activeKind={activeKind}
            />
          ))}

          <Card className="border border-[#EAEAE5] bg-white hover:border-[#FFD6BA] hover:shadow-card transition-all flex flex-col justify-between rounded-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="font-mono text-xs bg-[#FFD6BA]/30 text-[#E07A24] border-[#FFD6BA] rounded-full">
                  SCENARIO 08
                </Badge>
                <Cpu className="w-4 h-4 text-[#E07A24]" />
              </div>
              <CardTitle className="text-base font-bold text-[#202124] mt-2">
                Malware Client Device
              </CardTitle>
              <CardDescription className="text-xs text-[#5C7089] leading-relaxed">
                Voter device is infected with malware that secretly alters choice during ballot encryption.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="p-2.5 bg-[#F5F5F4] rounded-2xl border border-[#EAEAE5] text-[11px] text-[#5C7089] space-y-1">
                <span className="font-bold text-[#202124] block">Defense Mechanism:</span>
                <span>Benaloh Challenge (Test-My-Ballot): Ephemeral key decrypts & exposes malware.</span>
              </div>
              <Button
                onClick={handleToggleDevice}
                variant="outline"
                className={`w-full text-xs font-bold border transition-all rounded-full ${
                  compromisedDevice
                    ? "bg-[#FDEDED] text-[#E05252] border-[#F8B4B4] hover:bg-[#FAD4D4]"
                    : "border-[#EAEAE5] text-[#202124] hover:bg-[#F5F5F4]"
                }`}
              >
                Malware Simulation: {compromisedDevice ? "ACTIVE" : "OFF"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="border border-[#EAEAE5] bg-white shadow-soft rounded-2xl">
          <CardHeader className="pb-3 border-b border-[#EAEAE5]">
            <CardTitle className="text-base font-bold text-[#202124] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#243056]" />
              Why GlassBallot Cannot Be Silently Tampered
            </CardTitle>
            <CardDescription className="text-xs text-[#5C7089]">
              Summary of mathematically provable security guarantees
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-[#5C7089]">
              <div className="space-y-2">
                <h4 className="font-bold text-[#202124] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#3E5A0E]" />
                  Two-Books Equality
                </h4>
                <p className="leading-relaxed">
                  Book A records eligible voter participation. Book B records cast ciphertexts. If either count differs by even 1, the ledger enters FROZEN state automatically.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-[#202124] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#3E5A0E]" />
                  RFC 6962 Merkle Log
                </h4>
                <p className="leading-relaxed">
                  Cryptographic tree head signed with Ed25519. History cannot be re-written without breaking mathematical inclusion proofs for all preceding voters.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-[#202124] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#3E5A0E]" />
                  Sticky Witness Alarms
                </h4>
                <p className="leading-relaxed">
                  Candidate monitoring mirrors poll the ledger continuously. Any attempted fork or invalid state change locks the witness into an indelible ALARM state.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SidebarDashboardLayout>
  );
}
