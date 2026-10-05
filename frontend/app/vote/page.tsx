"use client";

import { useState, useEffect } from "react";
import {
  Vote,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Lock,
  RefreshCw,
  Eye,
  Sparkles,
  UserCheck,
  KeyRound,
  FileText,
  XCircle,
} from "lucide-react";
import { sealBallot } from "@/lib/crypto/ballot";
import { ProofCard } from "@/components/ProofCard";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { requestOTP, verifyOTP, getDemoInbox } from "@/lib/api/auth";
import { getElectionConfig } from "@/lib/api/elections";
import { getVotingToken, testBallot, castBallot } from "@/lib/api/voting";
import { toast } from "sonner";
import type {
  OtpVerifyResponse,
  VotingTokenResponse,
  BallotSpoilResponse,
  BallotCastResponse,
  ElectionConfigResponse,
  CandidateOut,
} from "@/lib/api/auth";

const stepLabels = [
  "Student ID",
  "OTP Verify",
  "Candidate",
  "Seal Ballot",
  "Test Challenge",
  "Proof Card",
];

export default function VotePage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [voterId, setVoterId] = useState<string>("RGIT26001");
  const [otpCode, setOtpCode] = useState<string>("");
  const [demoOtp, setDemoOtp] = useState<string>("");
  const [electionId, setElectionId] = useState<string>("");
  const [publicId, setPublicId] = useState<string>("");
  const [electionPubB64, setElectionPubB64] = useState<string>("");
  const [candidates, setCandidates] = useState<CandidateOut[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<string>("");
  const [ballotToken, setBallotToken] = useState<string>("");
  const [sealedPayload, setSealedPayload] = useState<{ v: number; eph: string; iv: string; ct: string } | null>(null);
  const [ephemeralPrivB64, setEphemeralPrivB64] = useState<string>("");
  const [testResult, setTestResult] = useState<BallotSpoilResponse | null>(null);
  const [castResult, setCastResult] = useState<BallotCastResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [configLoading, setConfigLoading] = useState<boolean>(true);
  const [elections, setElections] = useState<Array<{id: string; title: string; state: string}>>([]);
  const [selectedElectionId, setSelectedElectionId] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setConfigLoading(true);
      try {
        // 1. Load all open elections so voter can pick if there are multiple
        const { listElections } = await import("@/lib/api/elections");
        const allElections = await listElections("me");
        const openElections = allElections.filter((e: any) =>
          ["OPEN", "SETUP", "ACTIVE"].includes(String(e.state).toUpperCase())
        );
        if (alive && openElections.length > 0) {
          setElections(openElections as any);
        }

        // 2. Load config for the active election (backend now returns latest OPEN)
        const cfg = await getElectionConfig();
        if (!alive) return;
        if (cfg && cfg.election) {
          setElectionId(cfg.election.id || "");
          setSelectedElectionId(cfg.election.id || "");
          setPublicId(cfg.election.public_id || "E1");
          setElectionPubB64(cfg.election.election_public_key_b64 || cfg.election_pub || "");
          const cands = cfg.election.candidates || [];
          setCandidates(cands);
          if (cands.length > 0 && !selectedCandidate) {
            setSelectedCandidate(cands[0].candidate_code);
          }
        } else {
          setPublicId(cfg?.state ? "ELECTION-LIVE" : "E1");
        }
      } catch (err) {
        if (alive) {
          toast.error("Could not load election configuration.");
        }
      } finally {
        if (alive) setConfigLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When voter picks a different election, reload its candidates
  const handleElectionChange = async (eid: string) => {
    setSelectedElectionId(eid);
    setElectionId(eid);
    setSelectedCandidate("");
    setCandidates([]);
    try {
      const cfg = await getElectionConfig(eid);
      if (cfg?.election) {
        setPublicId(cfg.election.public_id || "E1");
        setElectionPubB64(cfg.election.election_public_key_b64 || cfg.election_pub || "");
        const cands = cfg.election.candidates || [];
        setCandidates(cands);
        if (cands.length > 0) setSelectedCandidate(cands[0].candidate_code);
      }
    } catch {
      toast.error("Could not load candidates for this election.");
    }
  };

  const toastError = (msg: string) => toast.error(msg);
  const toastInfo = (msg: string) => toast.message(msg);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voterId.trim()) {
      toastError("Please enter your College ID");
      return;
    }
    setLoading(true);
    try {
      await requestOTP({ voter_id: voterId.trim() });
      try {
        const inbox = await getDemoInbox(voterId.trim());
        const code = inbox?.otp || (inbox?.inbox?.[voterId.trim()] ?? inbox?.inbox?.[voterId.trim().toUpperCase()] ?? "");
        setDemoOtp(code || "");
      } catch {
        setDemoOtp("");
      }
      toast.success("One-time passcode issued. Check demo inbox for testing.");
      setStep(2);
    } catch (err) {
      toastError((err as Error).message || "Failed to request OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 4) {
      toastError("Enter the 6-digit OTP");
      return;
    }
    setLoading(true);
    try {
      const res = await verifyOTP({
        voter_id: voterId.trim(),
        otp: otpCode.trim(),
      });
      if (!res || res.success === false) {
        toastError("Invalid OTP code");
        return;
      }
      toastInfo("Voter OTP verified — issuing single-use token…");
      const token = (res as any).voter_session_token || (res as any).token || "";
      if (token) {
        document.cookie = `voter_token=${token}; path=/; max-age=86400`;
        document.cookie = `gb_voter_session=${token}; path=/; max-age=86400`;
      }
      const tokRes = await getVotingToken({ election_id: electionId || undefined });
      const theToken = tokRes?.token || tokRes?.ballot_token || "";
      if (!theToken) {
        toastError("Token issuance failed — try again.");
        return;
      }
      setBallotToken(theToken);
      toast.success("Unlinked ballot token received. Choose your candidate.");
      setStep(3);
    } catch (err) {
      toastError((err as Error).message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSealBallot = async () => {
    if (!selectedCandidate) {
      toastError("Please select a candidate first.");
      return;
    }
    setLoading(true);
    try {
      const pubKey = electionPubB64 || "BGA6T1234567890abcdef";
      const sealed = await sealBallot(pubKey, publicId || "E1", selectedCandidate);
      setSealedPayload(sealed.ballot);
      setEphemeralPrivB64(sealed.ephD);
      toast.success("Ballot sealed client-side with AES-256-GCM.");
      setStep(4);
    } catch (err: any) {
      toastError("Client ballot encryption failed: " + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleTestBallot = async () => {
    if (!sealedPayload) {
      toastError("No sealed ballot to test.");
      return;
    }
    setLoading(true);
    try {
      const res = await testBallot({
        ballot: sealedPayload,
        eph_d: ephemeralPrivB64,
        claimed_choice: selectedCandidate,
      });
      setTestResult(res);
      if (res?.ok) {
        toast.success("Benaloh challenge PASSED — ballot matches claimed choice.");
      } else {
        toast.warning("TEST FAILED — DO NOT CAST. Ballot contents mismatch claimed choice.");
      }
      setStep(5);
    } catch (err: any) {
      toastError("Test ballot request failed: " + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleCastFreshBallot = async () => {
    if (!ballotToken) {
      toastError("No valid ballot token. Return to Step 1.");
      return;
    }
    if (!selectedCandidate) {
      toastError("Select a candidate first.");
      return;
    }
    setLoading(true);
    try {
      const pubKey = electionPubB64 || "BGA6T1234567890abcdef";
      const freshSealed = await sealBallot(pubKey, publicId || "E1", selectedCandidate);
      const res = await castBallot({
        token: ballotToken,
        ballot: freshSealed.ballot,
      });
      if (!res || !res.entry_hash) {
        toastError("Ballot cast failed — try again.");
        return;
      }
      setCastResult(res);
      toast.success("Ballot appended to ledger successfully! Save your proof card.");
      setStep(6);
    } catch (err: any) {
      toastError("Ballot cast failed: " + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const isTestPassed = !!(testResult && (testResult.ok || testResult.match));

  return (
    <PublicLayout>
      <section className="min-h-[calc(100vh-80px)] py-10 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header Stepper */}
          <div className="bg-white border border-[#EAEAE5] rounded-2xl shadow-soft p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-[#DAF39F]/20 text-[#3E5A0E] border-[#DAF39F] rounded-full font-bold text-xs">
                  STEP {step} OF 6
                </Badge>
                <span className="font-bold text-[#202124] text-sm">{stepLabels[step - 1]}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#5C7089] font-medium">
                <Lock className="w-3.5 h-3.5 text-[#243056]" /> WebCrypto Client-Side Sealed Voting Flow
              </div>
            </div>

            <div className="grid grid-cols-6 gap-1.5 pt-1">
              {[1, 2, 3, 4, 5, 6].map((s) => (
                <div key={s} className="space-y-1">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      s === step
                        ? "bg-[#243056] shadow-soft"
                        : s < step
                        ? "bg-[#DAF39F]"
                        : "bg-[#EAEAE5]"
                    }`}
                  />
                  <span
                    className={`text-[10px] hidden sm:block truncate ${
                      s === step ? "font-bold text-[#243056]" : "text-[#9E9E97]"
                    }`}
                  >
                    {stepLabels[s - 1]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <Card className="border-[#EAEAE5] shadow-soft rounded-2xl overflow-hidden">
              <CardHeader className="pastel-card pastel-lavender !rounded-none">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-white/70 text-[#5B3D86]">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-extrabold text-[#202124]">Step 1: Student ID Verification</CardTitle>
                    <CardDescription className="text-xs text-[#5B3D86]/80">
                      Enter your registered student ID to request a one-time passcode (OTP).
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 md:p-8 space-y-6">
                {configLoading ? (
                  <div className="space-y-3">
                    <div className="h-4 w-40 bg-[#EAEAE5] rounded animate-pulse" />
                    <div className="h-12 bg-[#F5F5F4] rounded-2xl animate-pulse" />
                    <div className="h-12 bg-[#F5F5F4] rounded-2xl animate-pulse" />
                  </div>
                ) : (
                  <form onSubmit={handleRequestOtp} className="space-y-5">
                    {/* Election selector — shown when multiple open elections exist */}
                    {elections.length > 1 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-bold text-[#202124]">Select Election</Label>
                        <select
                          value={selectedElectionId}
                          onChange={(e) => handleElectionChange(e.target.value)}
                          className="w-full h-12 rounded-2xl bg-[#F5F5F4] border border-[#EAEAE5] focus:ring-2 focus:ring-[#DAF39F] focus:outline-none text-sm font-medium px-4"
                        >
                          {elections.map((el: any) => (
                            <option key={el.id} value={el.id}>
                              {el.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="voterId" className="text-sm font-bold text-[#202124]">
                        Student Roll / College ID
                      </Label>
                      <Input
                        id="voterId"
                        type="text"
                        value={voterId}
                        onChange={(e) => setVoterId(e.target.value)}
                        placeholder="e.g. RGIT26001"
                        required
                        className="font-mono text-base h-12 rounded-2xl bg-[#F5F5F4] border-[#EAEAE5] focus-visible:ring-2 focus-visible:ring-[#DAF39F]"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 rounded-full bg-[#243056] hover:bg-[#1a2547] text-white font-bold shadow-soft text-sm"
                    >
                      {loading ? "Issuing OTP token…" : "Request One-Time Passcode"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>

                    <div className="pastel-card pastel-lime !p-4 space-y-1.5 rounded-2xl">
                      <span className="font-bold text-[#3E5A0E] flex items-center gap-1.5 text-sm">
                        <Sparkles className="w-4 h-4" /> Demo Credentials
                      </span>
                      <p className="text-xs text-[#202124]/80">
                        Eligible student ID: <code className="font-bold text-[#3E5A0E]">RGIT26001</code>
                      </p>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <Card className="border-[#EAEAE5] shadow-soft rounded-2xl overflow-hidden">
              <CardHeader className="pastel-card pastel-sky !rounded-none">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-white/70 text-[#1B4366]">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-extrabold text-[#202124]">Step 2: OTP Verification</CardTitle>
                    <CardDescription className="text-xs text-[#1B4366]/80">
                      Enter the 6-digit passcode sent for student ID <strong>{voterId}</strong>.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 md:p-8 space-y-5">
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="otpCode" className="text-sm font-bold text-[#202124]">
                        6-Digit One-Time Code
                      </Label>
                      {demoOtp && (
                        <button
                          type="button"
                          onClick={() => setOtpCode(demoOtp)}
                          className="text-xs font-bold text-[#243056] hover:underline flex items-center gap-1 rounded-full px-2.5 py-1 hover:bg-[#DAF39F]/30"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> Auto-fill ({demoOtp})
                        </button>
                      )}
                    </div>
                    <Input
                      id="otpCode"
                      type="text"
                      inputMode="numeric"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="000000"
                      maxLength={6}
                      required
                      className="font-mono text-center tracking-[0.5em] text-xl font-black h-14 rounded-2xl bg-[#F5F5F4] border-[#EAEAE5] focus-visible:ring-2 focus-visible:ring-[#DAF39F]"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || otpCode.length < 4}
                    className="w-full h-12 rounded-full bg-[#DAF39F] hover:bg-[#C6E66C] text-[#202124] font-bold shadow-soft text-sm"
                  >
                    {loading ? "Verifying & issuing token…" : "Verify & Issue Single-Use Token"}
                    <CheckCircle2 className="w-4 h-4 ml-2 text-[#3E5A0E]" />
                  </Button>

                  {demoOtp && (
                    <div className="pastel-card pastel-peach !p-3.5 rounded-2xl text-center">
                      <div className="text-[11px] text-[#845913]/80 mb-0.5">Demo Inbox</div>
                      <div className="font-mono text-2xl font-black text-[#202124] tracking-[0.2em]">
                        {demoOtp}
                      </div>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          )}

          {/* STEP 3 — Candidate Selection with images */}
          {step === 3 && (
            <Card className="border-[#EAEAE5] shadow-soft rounded-2xl overflow-hidden">
              <CardHeader className="pastel-card pastel-peach !rounded-none">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-white/70 text-[#845913]">
                      <Vote className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-extrabold text-[#202124]">Step 3: Select Candidate</CardTitle>
                      <CardDescription className="text-xs text-[#845913]/80">
                        Choice will be sealed AES-256-GCM client-side before transmission.
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-white/70 text-[#845913] border-white rounded-full font-mono text-xs">
                    Single-Use Token Ready
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 md:p-8 space-y-6">
                {candidates.length === 0 ? (
                  <div className="pastel-card pastel-lavender !p-8 rounded-2xl text-center space-y-3">
                    <AlertTriangle className="w-10 h-10 mx-auto text-[#5B3D86]" />
                    <h4 className="font-extrabold text-[#202124]">No candidates available</h4>
                    <p className="text-sm text-[#5B3D86]/80">
                      Please wait for election setup — candidates have not been configured yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {candidates.map((c) => {
                      const isSelected = selectedCandidate === c.candidate_code;
                      const label = c.display_name || c.name || "";
                      const initials = label.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
                      const avatarUrl = c.avatar_url ?? null;
                      const dept = c.department ?? null;
                      const party = c.statement ?? null;

                      return (
                        <button
                          key={c.candidate_code}
                          type="button"
                          onClick={() => setSelectedCandidate(c.candidate_code)}
                          className={`p-5 rounded-2xl border text-left transition-all cursor-pointer w-full ${
                            isSelected
                              ? "border-[#DAF39F] bg-[#DAF39F]/15 ring-2 ring-[#DAF39F]/30 shadow-soft"
                              : "border-[#EAEAE5] bg-white hover:border-[#D0D0C9] hover:bg-[#FAFAF8]"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            {/* Avatar */}
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt={label}
                                className="w-16 h-16 rounded-2xl object-cover border border-[#EAEAE5] shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#EBD3FF] to-[#CFE8FF] flex items-center justify-center text-lg font-extrabold text-[#243056] shrink-0 border border-[#EAEAE5]">
                                {initials}
                              </div>
                            )}

                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="font-bold text-[#202124] text-base leading-tight">{label}</h4>
                                {isSelected && (
                                  <CheckCircle2 className="w-5 h-5 text-[#3E5A0E] shrink-0" />
                                )}
                              </div>
                              {party && (
                                <p className="text-xs text-[#5C7089] font-medium">{party}</p>
                              )}
                              {dept && (
                                <span className="inline-block px-2 py-0.5 rounded-full bg-[#F5F5F4] border border-[#EAEAE5] text-[10px] font-bold text-[#5C7089]">
                                  {dept}
                                </span>
                              )}
                              {c.statement && !party && (
                                <p className="text-xs text-[#5C7089] line-clamp-2 leading-relaxed">{c.statement}</p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <Button
                  onClick={handleSealBallot}
                  disabled={loading || !selectedCandidate || candidates.length === 0}
                  className="w-full h-12 rounded-full bg-[#202124] hover:bg-[#2D2E33] text-white font-bold shadow-soft text-sm"
                >
                  <Lock className="w-4 h-4 mr-2" /> Seal Ballot Client-Side (AES-256-GCM)
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* STEP 4 */}
          {step === 4 && sealedPayload && (
            <Card className="border-[#EAEAE5] shadow-soft rounded-2xl overflow-hidden">
              <CardHeader className="pastel-card pastel-lavender !rounded-none">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-white/70 text-[#5B3D86]">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-extrabold text-[#202124]">Step 4: Sealed Ballot Review</CardTitle>
                      <CardDescription className="text-xs text-[#5B3D86]/80">
                        Test/challenge the ballot or cast it directly.
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-white/70 text-[#5B3D86] border-white rounded-full text-xs font-mono">
                    WebCrypto Sealed
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="p-5 bg-[#F5F5F4] rounded-2xl border border-[#EAEAE5] font-mono text-xs space-y-3">
                  <div className="flex flex-wrap justify-between text-[#5C7089] text-[11px] pb-2 border-b border-[#EAEAE5] gap-2">
                    <span>GlassBallot v1</span>
                    <span>P-256 ECDH · AES-256-GCM</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#9E9E97] shrink-0 w-20">eph_pub</span>
                    <span className="text-[#202124] break-all">{sealedPayload.eph}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#9E9E97] shrink-0 w-20">iv</span>
                    <span className="text-[#202124] break-all">{sealedPayload.iv}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#9E9E97] shrink-0 w-20">ciphertext</span>
                    <span className="text-[#243056] break-all">{sealedPayload.ct}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    onClick={handleTestBallot}
                    disabled={loading}
                    className="h-12 rounded-full border-[#F4D79E] bg-[#FDF3DE] hover:bg-[#FAE8B8] text-[#845913] font-bold"
                  >
                    <Eye className="w-4 h-4 mr-2" /> Challenge / Test My Ballot
                  </Button>

                  <Button
                    onClick={handleCastFreshBallot}
                    disabled={loading}
                    className="h-12 rounded-full bg-[#DAF39F] hover:bg-[#C6E66C] text-[#202124] font-bold shadow-soft"
                  >
                    <Vote className="w-4 h-4 mr-2" /> Cast Directly to Ledger
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 5 */}
          {step === 5 && testResult && (
            <Card
              className={`shadow-soft rounded-2xl overflow-hidden border ${
                isTestPassed ? "border-[#DAF39F]" : "border-red-200"
              }`}
            >
              <CardHeader className={`!rounded-none ${isTestPassed ? "pastel-card pastel-lime" : "pastel-card pastel-peach"}`}>
                <div className="flex items-center gap-3">
                  <div
                    className={`p-3 rounded-2xl bg-white/70 ${
                      isTestPassed ? "text-[#3E5A0E]" : "text-[#9A1C1C]"
                    }`}
                  >
                    {isTestPassed ? (
                      <ShieldCheck className="w-6 h-6" />
                    ) : (
                      <XCircle className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-xl font-extrabold text-[#202124]">
                      Step 5: Cast-As-Intended Test — {isTestPassed ? "PASSED" : "FAILED"}
                    </CardTitle>
                    <CardDescription
                      className={`text-xs ${
                        isTestPassed ? "text-[#3E5A0E]/80" : "text-[#9A1C1C]/80"
                      }`}
                    >
                      {isTestPassed
                        ? "Ephemeral key revealed — encrypted choice matches claimed choice."
                        : "Ballot MISMATCH — do NOT cast this or any related ballot. Contact election officers."}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 md:p-8 space-y-6">
                <div
                  className={`p-5 rounded-2xl border space-y-4 ${
                    isTestPassed
                      ? "border-[#DAF39F]/60 bg-[#F5FAE3]"
                      : "border-red-200 bg-red-50"
                  }`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-bold text-[#202124] text-sm">Verification Outcome</span>
                    {isTestPassed ? (
                      <Badge className="bg-[#3E5A0E] text-white rounded-full font-bold text-xs">
                        TEST PASSED
                      </Badge>
                    ) : (
                      <Badge className="bg-red-700 text-white rounded-full font-bold text-xs">
                        TEST FAILED — DO NOT CAST
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 font-mono text-[11px] bg-white/60 p-4 rounded-xl border border-white">
                    <div>
                      <span className="text-[#9E9E97] block mb-1">Claimed Choice</span>
                      <span className="font-bold text-[#202124]">{testResult.claimed || selectedCandidate}</span>
                    </div>
                    <div>
                      <span className="text-[#9E9E97] block mb-1">Revealed Plaintext</span>
                      <span className={`font-bold ${isTestPassed ? "text-[#243056]" : "text-red-700"}`}>
                        {testResult.revealed || "—"}
                      </span>
                    </div>
                  </div>
                  <p
                    className={`text-[11px] leading-relaxed ${
                      isTestPassed ? "text-[#3E5A0E]" : "text-[#9A1C1C]"
                    }`}
                  >
                    • Tested ballot has been <strong>permanently excluded</strong> from tally.
                    <br />
                    • System requires sealing a <strong>fresh ballot</strong> before casting the real vote.
                  </p>
                </div>

                <Button
                  onClick={handleCastFreshBallot}
                  disabled={loading || !isTestPassed}
                  className={`w-full h-12 rounded-full font-bold shadow-soft text-sm ${
                    isTestPassed
                      ? "bg-[#243056] hover:bg-[#1a2547] text-white"
                      : "bg-[#9A1C1C] hover:bg-[#7A1515] text-white"
                  }`}
                >
                  {isTestPassed ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" /> Seal Fresh Ballot & Cast Real Vote
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 mr-2" /> Cast Disabled — Test Failed
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* STEP 6 */}
          {step === 6 && castResult && (
            <div className="space-y-6">
              <Card className="border-[#DAF39F] pastel-card pastel-lime text-center py-8 shadow-soft rounded-2xl">
                <CardContent className="space-y-3 pt-2">
                  <div className="w-14 h-14 rounded-full bg-white text-[#3E5A0E] flex items-center justify-center mx-auto shadow-card">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-[#202124]">
                    Ballot Cast Successfully!
                  </h2>
                  <p className="text-sm text-[#3E5A0E] max-w-md mx-auto">
                    Your ballot is cryptographically recorded in the append-only ledger. Save the proof card below to independently verify your vote later.
                  </p>
                </CardContent>
              </Card>

              <ProofCard
                data={{
                  election_id: castResult.election_id || publicId || "E1",
                  election_title: "Student Council Election",
                  ledger_index: castResult.ledger_index ?? castResult.index ?? 0,
                  ballot_fingerprint: castResult.ballot_fingerprint || castResult.entry_hash || "",
                  entry_hash: castResult.entry_hash || "",
                  tree_size: (castResult.sth?.size as number) ?? 0,
                  merkle_root: (castResult.sth?.root as string) ?? "",
                  timestamp: (castResult.sth?.ts as number) ?? Math.floor(Date.now() / 1000),
                }}
                showActions={true}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link href="/results" className="w-full">
                  <Button variant="outline" className="w-full h-12 rounded-full border-[#EAEAE5] text-[#202124] font-bold">
                    <FileText className="w-4 h-4 mr-2" /> View Published Results
                  </Button>
                </Link>
                <Link href="/verify" className="w-full">
                  <Button className="w-full h-12 rounded-full bg-[#243056] hover:bg-[#1a2547] text-white font-bold shadow-soft">
                    <ShieldCheck className="w-4 h-4 mr-2 text-[#DAF39F]" /> Verify Any Ballot
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
