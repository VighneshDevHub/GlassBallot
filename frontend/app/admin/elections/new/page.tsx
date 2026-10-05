"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SidebarDashboardLayout } from "@/components/layouts/SidebarDashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Vote,
  Plus,
  Trash2,
  KeyRound,
  Users,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { createElection, type CandidateCreate } from "@/lib/api/elections";
import Link from "next/link";

// ── Generate a P-256 ECDH keypair in the browser ──────────────────────────
async function generateElectionKeyPair(): Promise<{ publicKeyB64: string; privateKeyB64: string }> {
  const pair = await window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );
  const pubRaw = await window.crypto.subtle.exportKey("raw", pair.publicKey);
  const privJwk = await window.crypto.subtle.exportKey("jwk", pair.privateKey);
  const publicKeyB64 = btoa(String.fromCharCode(...new Uint8Array(pubRaw)));
  const privateKeyB64 = btoa(JSON.stringify(privJwk));
  return { publicKeyB64, privateKeyB64 };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export default function CreateElectionPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    title: "",
    description: "",
    public_id: "",
  });
  const [candidates, setCandidates] = useState<CandidateCreate[]>([
    { name: "", party_or_tag: "", department: "", avatar_url: "" },
    { name: "", party_or_tag: "", department: "", avatar_url: "" },
  ]);
  const [keyPair, setKeyPair] = useState<{ publicKeyB64: string; privateKeyB64: string } | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ election_id: string; title: string } | null>(null);

  const handleTitleChange = (title: string) => {
    setForm((f) => ({ ...f, title, public_id: slugify(title) }));
  };

  const handleGenerateKey = async () => {
    setGeneratingKey(true);
    try {
      const kp = await generateElectionKeyPair();
      setKeyPair(kp);
      toast.success("Election keypair generated. Save the private key below — it cannot be recovered.");
    } catch (err) {
      toast.error("Key generation failed: " + (err as Error).message);
    } finally {
      setGeneratingKey(false);
    }
  };

  const addCandidate = () =>
    setCandidates((c) => [...c, { name: "", party_or_tag: "", department: "", avatar_url: "" }]);

  const removeCandidate = (i: number) =>
    setCandidates((c) => c.filter((_, idx) => idx !== i));

  const updateCandidate = (i: number, field: keyof CandidateCreate | "department" | "avatar_url", value: string) =>
    setCandidates((c) => c.map((cand, idx) => (idx === i ? { ...cand, [field]: value } : cand)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title.trim()) { toast.error("Election title is required"); return; }
    if (!form.public_id.trim()) { toast.error("Election ID (slug) is required"); return; }
    if (!keyPair) { toast.error("Generate the election keypair first"); return; }
    const validCandidates = candidates.filter((c) => c.name.trim());
    if (validCandidates.length < 2) { toast.error("At least 2 candidates are required"); return; }

    setSubmitting(true);
    try {
      const res = await createElection({
        public_id: form.public_id.trim(),
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        public_key_b64: keyPair.publicKeyB64,
        candidates: validCandidates,
      });
      setCreated({ election_id: res.election_id, title: form.title.trim() });
      toast.success(`Election "${form.title}" created successfully!`);
    } catch (err) {
      toast.error((err as Error).message || "Failed to create election");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "h-11 rounded-2xl bg-[#F5F5F4] border-[#EAEAE5] focus-visible:ring-2 focus-visible:ring-[#DAF39F] text-sm font-medium px-4";

  // ── Success screen ──
  if (created) {
    return (
      <SidebarDashboardLayout role="admin">
        <div className="max-w-xl mx-auto py-16 text-center space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-[#DAF39F] flex items-center justify-center mx-auto shadow-soft">
            <CheckCircle2 className="w-10 h-10 text-[#3E5A0E]" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold text-[#202124]">Election Created!</h1>
            <p className="text-[#5C7089]">
              <span className="font-bold text-[#202124]">{created.title}</span> is ready.
              You can now open voting from the admin overview.
            </p>
            <p className="text-xs font-mono text-[#9AA7B8] mt-1">ID: {created.election_id}</p>
          </div>

          {keyPair && (
            <div className="rounded-2xl bg-[#FFF8E1] border border-[#FFDEB0] p-4 text-left space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#845913] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sm text-[#845913]">Save your private key now!</div>
                  <p className="text-xs text-[#845913] mt-0.5 leading-relaxed">
                    This is the only time it will be shown. Share it with your trustees using a secure channel.
                    Without it, ballots cannot be decrypted.
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-xl p-3 text-[10px] font-mono text-[#202124] break-all border border-[#EAEAE5] select-all">
                {keyPair.privateKeyB64}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-xs font-bold border-[#FFDEB0]"
                onClick={() => {
                  navigator.clipboard.writeText(keyPair.privateKeyB64);
                  toast.success("Private key copied to clipboard");
                }}
              >
                Copy private key
              </Button>
            </div>
          )}

          <div className="flex gap-3 justify-center pt-2">
            <Button asChild className="rounded-full bg-[#202124] text-white font-bold shadow-soft">
              <Link href="/admin">
                <Vote className="w-4 h-4 mr-2" /> Go to Admin Overview
              </Link>
            </Button>
            <Button
              variant="outline"
              className="rounded-full border-[#EAEAE5] font-bold"
              onClick={() => {
                setCreated(null);
                setForm({ title: "", description: "", public_id: "" });
                setCandidates([{ name: "", party_or_tag: "", department: "", avatar_url: "" }, { name: "", party_or_tag: "", department: "", avatar_url: "" }]);
                setKeyPair(null);
              }}
            >
              Create another
            </Button>
          </div>
        </div>
      </SidebarDashboardLayout>
    );
  }

  // ── Form ──
  return (
    <SidebarDashboardLayout role="admin">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="space-y-2">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5C7089] hover:text-[#202124] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Overview
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#202124]">Create New Election</h1>
          <p className="text-sm text-[#5C7089]">
            Set up the election details, add all candidates, then generate the cryptographic keypair.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Election Details ── */}
          <div className="bg-white rounded-2xl border border-[#EAEAE5] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#EAEAE5] flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl pastel-card pastel-lime !p-0 flex items-center justify-center">
                <Vote className="w-4 h-4 text-[#202124]" />
              </div>
              <h2 className="font-extrabold text-[#202124]">Election Details</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-bold text-[#202124]">Election Title *</Label>
                <Input
                  required
                  value={form.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. RGIT Student Council Election 2026"
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-bold text-[#202124]">
                  Election ID (slug){" "}
                  <span className="font-normal text-[#9AA7B8]">— auto-generated, editable</span>
                </Label>
                <Input
                  required
                  value={form.public_id}
                  onChange={(e) => setForm((f) => ({ ...f, public_id: slugify(e.target.value) }))}
                  placeholder="rgit-council-2026"
                  className={`${inputClass} font-mono`}
                />
                <p className="text-xs text-[#9AA7B8]">Used in URLs. Lowercase letters, numbers, and hyphens only.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-bold text-[#202124]">Description (optional)</Label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of the election for voters…"
                  rows={3}
                  className="w-full rounded-2xl bg-[#F5F5F4] border border-[#EAEAE5] focus:ring-2 focus:ring-[#DAF39F] focus:outline-none text-sm font-medium px-4 py-3 resize-none"
                />
              </div>
            </div>
          </div>

          {/* ── Candidates ── */}
          <div className="bg-white rounded-2xl border border-[#EAEAE5] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#EAEAE5] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl pastel-card pastel-lavender !p-0 flex items-center justify-center">
                  <Users className="w-4 h-4 text-[#202124]" />
                </div>
                <div>
                  <h2 className="font-extrabold text-[#202124]">Candidates</h2>
                  <p className="text-xs text-[#5C7089]">At least 2 required</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCandidate}
                className="rounded-full border-[#EAEAE5] font-bold text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Candidate
              </Button>
            </div>
            <div className="p-6 space-y-3">
              {candidates.map((cand, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-7 h-7 rounded-full bg-[#F5F5F4] flex items-center justify-center text-xs font-extrabold text-[#5C7089] shrink-0 mt-2">
                    {i + 1}
                  </div>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      required
                      value={cand.name}
                      onChange={(e) => updateCandidate(i, "name", e.target.value)}
                      placeholder="Full name *"
                      className={inputClass}
                    />
                    <Input
                      value={cand.party_or_tag ?? ""}
                      onChange={(e) => updateCandidate(i, "party_or_tag", e.target.value)}
                      placeholder="Party / position (optional)"
                      className={inputClass}
                    />
                    <Input
                      value={(cand as any).department ?? ""}
                      onChange={(e) => updateCandidate(i, "department" as any, e.target.value)}
                      placeholder="Department (e.g. CSE, IT)"
                      className={inputClass}
                    />
                    <Input
                      value={(cand as any).avatar_url ?? ""}
                      onChange={(e) => updateCandidate(i, "avatar_url" as any, e.target.value)}
                      placeholder="Photo URL (optional)"
                      className={inputClass}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={candidates.length <= 2}
                    onClick={() => removeCandidate(i)}
                    className="mt-1 text-[#E05252] hover:bg-[#FFE5E5] rounded-xl shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Cryptographic Keypair ── */}
          <div className="bg-white rounded-2xl border border-[#EAEAE5] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#EAEAE5] flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl pastel-card pastel-peach !p-0 flex items-center justify-center">
                <KeyRound className="w-4 h-4 text-[#202124]" />
              </div>
              <div>
                <h2 className="font-extrabold text-[#202124]">Election Keypair</h2>
                <p className="text-xs text-[#5C7089]">Ballots are sealed with the public key; decryption requires the private key</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-2xl bg-[#CFE8FF]/30 border border-[#9ED5FA] flex items-start gap-3">
                <Info className="w-4 h-4 text-[#1F5689] shrink-0 mt-0.5" />
                <div className="text-xs text-[#1F5689] leading-relaxed">
                  The browser generates a P-256 elliptic curve keypair entirely on your device.
                  The <strong>public key</strong> is stored with the election and used to seal each voter's choice.
                  The <strong>private key</strong> is shown once — split it across trustees using Shamir sharing before closing.
                </div>
              </div>

              {!keyPair ? (
                <Button
                  type="button"
                  onClick={handleGenerateKey}
                  disabled={generatingKey}
                  className="w-full h-12 rounded-2xl bg-[#243056] hover:bg-[#1a2547] text-white font-bold shadow-soft"
                >
                  {generatingKey ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating keypair…</>
                  ) : (
                    <><KeyRound className="w-4 h-4 mr-2" /> Generate Election Keypair in Browser</>
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#3E5A0E]">
                    <CheckCircle2 className="w-4 h-4" /> Keypair generated
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-[#5C7089] uppercase tracking-wide">Public Key (stored with election)</Label>
                    <div className="bg-[#F5F5F4] rounded-xl p-3 text-[10px] font-mono text-[#5C7089] break-all border border-[#EAEAE5]">
                      {keyPair.publicKeyB64.slice(0, 80)}…
                    </div>
                  </div>
                  <div className="rounded-2xl bg-[#FFF8E1] border border-[#FFDEB0] p-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#845913]">
                      <AlertTriangle className="w-3.5 h-3.5" /> Private key — copy and save securely now
                    </div>
                    <div className="bg-white rounded-xl p-3 text-[10px] font-mono text-[#202124] break-all border border-[#EAEAE5] select-all max-h-24 overflow-y-auto">
                      {keyPair.privateKeyB64}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full text-xs font-bold border-[#FFDEB0] w-full"
                      onClick={() => {
                        navigator.clipboard.writeText(keyPair.privateKeyB64);
                        toast.success("Private key copied");
                      }}
                    >
                      Copy private key to clipboard
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Submit ── */}
          <Button
            type="submit"
            disabled={submitting || !keyPair}
            className="w-full h-14 rounded-2xl bg-[#202124] hover:bg-[#2D2E33] text-white font-bold shadow-soft text-base"
          >
            {submitting ? (
              <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Creating election…</>
            ) : (
              <><Vote className="w-5 h-5 mr-2" /> Create Election</>
            )}
          </Button>

          {!keyPair && (
            <p className="text-xs text-[#9AA7B8] text-center">
              Generate the keypair above before submitting.
            </p>
          )}
        </form>
      </div>
    </SidebarDashboardLayout>
  );
}
