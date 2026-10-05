"use client";

import { useEffect, useState } from "react";
import { SidebarDashboardLayout } from "@/components/layouts/SidebarDashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Bell,
  Mail,
  Smartphone,
  ShieldCheck,
  Lock,
  KeyRound,
  Palette,
  HelpCircle,
  Eye,
  Download,
  Trash2,
} from "lucide-react";
import {
  getVoterSettings,
  patchVoterSettings,
  getVoterReceipts,
  type VoterSettingsResponse,
} from "@/lib/api/voter";

const DENSITIES = ["Compact", "Comfortable", "Spacious"] as const;
type Density = (typeof DENSITIES)[number];
const PROOF_MODES = ["Full JSON + Visual", "Visual Proof Card Only", "Minimal Fingerprint"] as const;
type ProofMode = (typeof PROOF_MODES)[number];

export default function StudentSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [prefs, setPrefs] = useState({
    email_alerts: true,
    push_browser: true,
    result_notify: true,
    weekly_digest: false,
    activity_email: true,
  });
  const [sec, setSec] = useState({
    otp_required: true,
    session_timeout: true,
    show_proofs: true,
  });
  const [density, setDensity] = useState<Density>("Comfortable");
  const [proofMode, setProofMode] = useState<ProofMode>("Full JSON + Visual");
  const [cidr, setCidr] = useState("");
  const [sessionTimeout, setSessionTimeout] = useState("20 Minutes (Strict)");
  const [retention, setRetention] = useState("7 Years (Default)");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const settings = await getVoterSettings();
        if (!alive || !settings) return;
        const anySet = settings as unknown as Record<string, unknown>;
        setPrefs({
          email_alerts: Boolean(anySet.email_alerts ?? settings.email_notifications ?? true),
          push_browser: Boolean(anySet.push_browser ?? settings.sms_notifications ?? true),
          result_notify: Boolean(anySet.result_notify ?? settings.email_notifications ?? true),
          weekly_digest: Boolean(anySet.weekly_digest ?? false),
          activity_email: Boolean(anySet.activity_email ?? settings.email_notifications ?? true),
        });
        setSec({
          otp_required: Boolean(anySet.otp_required ?? true),
          session_timeout: Boolean(anySet.session_timeout ?? true),
          show_proofs: Boolean(anySet.show_proofs ?? settings.accessibility_high_contrast ?? true),
        });
        setDensity((anySet.interface_density as Density) ?? (settings.compact_view ? "Compact" : "Comfortable"));
        setProofMode((anySet.proof_display_mode as ProofMode) ?? "Full JSON + Visual");
        setSessionTimeout((anySet.session_timeout_minutes as string) ?? "20 Minutes (Strict)");
        setRetention((anySet.audit_retention as string) ?? "7 Years (Default)");
        setCidr((anySet.trusted_cidr as string) ?? "");
      } catch (e: any) {
        toast.error(e?.message || "Failed to load settings");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function savePref(key: string, value: unknown, label: string) {
    const id = toast.loading(`Saving ${label}...`);
    setSaving(key);
    try {
      const merged: Record<string, unknown> = {
        ...prefs,
        ...sec,
        interface_density: density,
        proof_display_mode: proofMode,
        session_timeout_minutes: sessionTimeout,
        audit_retention: retention,
        trusted_cidr: cidr,
        [key]: value,
      };
      const body: Partial<VoterSettingsResponse> & Record<string, unknown> = {
        email_notifications:
          key === "email_alerts" || key === "result_notify" || key === "activity_email"
            ? Boolean(value)
            : prefs.email_alerts || prefs.result_notify || prefs.activity_email,
        sms_notifications: key === "push_browser" ? Boolean(value) : prefs.push_browser,
        compact_view:
          key === "interface_density" ? (value as Density) === "Compact" : density === "Compact",
        accessibility_high_contrast:
          key === "show_proofs" ? Boolean(value) : sec.show_proofs,
        accessibility_reduced_motion: Boolean(merged.accessibility_reduced_motion ?? false),
        dark_mode: Boolean(merged.dark_mode ?? false),
        language: String(merged.language ?? "en"),
      };
      if (
        key === "weekly_digest" ||
        key === "otp_required" ||
        key === "session_timeout" ||
        key === "proof_display_mode" ||
        key === "interface_density" ||
        key === "session_timeout_minutes" ||
        key === "audit_retention" ||
        key === "trusted_cidr"
      ) {
        (body as Record<string, unknown>)[key] = value;
      }
      await patchVoterSettings(body);
      toast.success(`${label}: ${typeof value === "boolean" ? (value ? "Enabled" : "Disabled") : "Saved"}`, { id });
    } catch (e: any) {
      toast.error(e?.message || `Failed to save ${label}`, { id });
    } finally {
      setSaving(null);
    }
  }

  async function exportReceipts() {
    const id = toast.loading("Preparing receipt export...");
    try {
      const receipts = await getVoterReceipts(500);
      const data = JSON.stringify(receipts, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `glassballot-receipts-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${receipts.total ?? receipts.items?.length ?? 0} receipts`, { id });
    } catch (e: any) {
      toast.error(e?.message || "Failed to export receipts", { id });
    }
  }

  function clearCache() {
    try {
      localStorage.clear();
      sessionStorage.clear();
      toast.success("Local receipt cache cleared.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to clear cache");
    }
  }

  return (
    <SidebarDashboardLayout role="student">
      <div className="space-y-8">
        <div>
          <h1 className="text-[2.25rem] font-extrabold tracking-tight leading-none">
            Settings
          </h1>
          <p className="text-[#5C7089] text-sm mt-1">
            Personalize your GlassBallot voting experience and security preferences.
          </p>
        </div>

        {/* Notifications */}
        <div className="pastel-card-white space-y-4 !p-0 overflow-hidden">
          <div className="px-6 md:px-8 pt-5 md:pt-6 pb-4 border-b border-[#EAEAE5] flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl pastel-card pastel-peach !p-0 flex items-center justify-center">
              <Bell className="w-5 h-5 text-[#202124]" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#202124]">Notifications</h3>
              <p className="text-xs text-[#5C7089]">Choose which election alerts reach you.</p>
            </div>
          </div>
          <div className="px-6 md:px-8 py-5 divide-y divide-[#F0F0EC]">
            {[
              {
                key: "email_alerts",
                title: "Email Alerts",
                desc: "Email you when your ballot is anchored to the ledger.",
                icon: Mail,
              },
              {
                key: "push_browser",
                title: "Browser Push Notifications",
                desc: "In-browser notifications for election phase transitions.",
                icon: Bell,
              },
              {
                key: "result_notify",
                title: "Election Results Published",
                desc: "Alert when threshold tally is complete and results are certified.",
                icon: Smartphone,
              },
              {
                key: "weekly_digest",
                title: "Weekly Integrity Digest",
                desc: "Summary email of 10 automated ledger check status.",
                icon: Mail,
              },
              {
                key: "activity_email",
                title: "Suspicious Activity Alerts",
                desc: "Email on failed OTP attempts or new device logins.",
                icon: ShieldCheck,
              },
            ].map((n) => {
              const I = n.icon;
              const on = (prefs as any)[n.key];
              return (
                <div key={n.key} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#F5F5F4] flex items-center justify-center text-[#5C7089] mt-0.5">
                      <I className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <div className="font-bold text-[15px] text-[#202124] flex items-center gap-2">
                        {n.title}
                        {loading && <Skeleton className="w-16 h-4 rounded-full" />}
                      </div>
                      <p className="text-[13px] text-[#5C7089] leading-relaxed">{n.desc}</p>
                    </div>
                  </div>
                  {loading ? (
                    <Skeleton className="w-11 h-6 rounded-full" />
                  ) : (
                    <Switch
                      checked={on}
                      disabled={saving === n.key}
                      onCheckedChange={(v) => {
                        setPrefs({ ...prefs, [n.key]: v });
                        void savePref(n.key, v, n.title);
                      }}
                      className="data-[state=checked]:bg-[#202124]"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Display */}
        <div className="pastel-card-white space-y-4 !p-0 overflow-hidden">
          <div className="px-6 md:px-8 pt-5 md:pt-6 pb-4 border-b border-[#EAEAE5] flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl pastel-card pastel-lavender !p-0 flex items-center justify-center">
              <Palette className="w-5 h-5 text-[#202124]" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#202124]">Display & Data</h3>
              <p className="text-xs text-[#5C7089]">Interface density, receipts, export options.</p>
            </div>
          </div>
          <div className="px-6 md:px-8 py-5 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold text-[#202124]">Interface Density</label>
                <div className="mt-2 p-1 rounded-full bg-[#F5F5F4] w-fit flex gap-1 border border-[#EAEAE5]">
                  {loading
                    ? DENSITIES.map((t) => (
                        <Skeleton key={t} className="w-24 h-9 rounded-full" />
                      ))
                    : DENSITIES.map((t, i) => (
                        <button
                          key={t}
                          disabled={saving === "interface_density"}
                          onClick={() => {
                            setDensity(t);
                            void savePref("interface_density", t, "Interface Density");
                          }}
                          className={
                            t === density
                              ? "px-4 py-2 rounded-full bg-white text-[12px] font-bold text-[#202124] shadow-card"
                              : "px-4 py-2 rounded-full text-[12px] font-semibold text-[#5C7089] hover:text-[#202124]"
                          }
                        >
                          {t}
                        </button>
                      ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-[#202124]">Proof Display Mode</label>
                {loading ? (
                  <Skeleton className="mt-2 w-full h-11 rounded-2xl" />
                ) : (
                  <select
                    value={proofMode}
                    disabled={saving === "proof_display_mode"}
                    onChange={(e) => {
                      const v = e.target.value as ProofMode;
                      setProofMode(v);
                      void savePref("proof_display_mode", v, "Proof Display Mode");
                    }}
                    className="mt-2 w-full h-11 rounded-2xl bg-[#F5F5F4] border border-[#EAEAE5] px-4 text-sm font-semibold text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#DAF39F] disabled:opacity-60"
                  >
                    {PROOF_MODES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="outline"
                className="rounded-full border-[#EAEAE5] h-11 font-bold text-sm"
                onClick={exportReceipts}
              >
                <Download className="w-4 h-4 mr-2" /> Export All Receipts
              </Button>
              <Button
                variant="outline"
                className="rounded-full border-[#E05252]/40 text-[#E05252] hover:bg-[#FDEDED] h-11 font-bold text-sm"
                onClick={clearCache}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Clear Local Receipt Cache
              </Button>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="pastel-card-white space-y-4 !p-0 overflow-hidden">
          <div className="px-6 md:px-8 pt-5 md:pt-6 pb-4 border-b border-[#EAEAE5] flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl pastel-card pastel-lime !p-0 flex items-center justify-center">
              <Lock className="w-5 h-5 text-[#202124]" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#202124]">Security</h3>
              <p className="text-xs text-[#5C7089]">Session, OTP, and verification hardening.</p>
            </div>
          </div>
          <div className="px-6 md:px-8 py-5 divide-y divide-[#F0F0EC]">
            {[
              {
                key: "otp_required",
                title: "Mandatory OTP Requirement",
                desc: "Require OTP even if a session cookie exists. Recommended for election day.",
                icon: KeyRound,
              },
              {
                key: "session_timeout",
                title: "Auto-Idle Session Timeout",
                desc: "Automatically lock session after 10 minutes of inactivity.",
                icon: ShieldCheck,
              },
              {
                key: "show_proofs",
                title: "Always Show Full Merkle Proof",
                desc: "Display the complete Merkle audit path instead of a summary on every verification.",
                icon: Eye,
              },
            ].map((n) => {
              const I = n.icon;
              const on = (sec as any)[n.key];
              return (
                <div key={n.key} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#F5F5F4] flex items-center justify-center text-[#5C7089] mt-0.5">
                      <I className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <div className="font-bold text-[15px] text-[#202124] flex items-center gap-2">
                        {n.title}
                        {loading && <Skeleton className="w-16 h-4 rounded-full" />}
                      </div>
                      <p className="text-[13px] text-[#5C7089] leading-relaxed">{n.desc}</p>
                    </div>
                  </div>
                  {loading ? (
                    <Skeleton className="w-11 h-6 rounded-full" />
                  ) : (
                    <Switch
                      checked={on}
                      disabled={saving === n.key}
                      onCheckedChange={(v) => {
                        setSec({ ...sec, [n.key]: v });
                        void savePref(n.key, v, n.title);
                      }}
                      className="data-[state=checked]:bg-[#202124]"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Help */}
        <div className="pastel-card pastel-sky !p-6 md:!p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/70 flex items-center justify-center shrink-0">
              <HelpCircle className="w-6 h-6 text-[#202124]" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#202124]">Need help verifying a ballot?</h3>
              <p className="text-[14px] text-[#1F5689]/85 leading-relaxed max-w-xl">
                Our step-by-step verification walkthrough and FAQ will show you exactly how to confirm
                inclusion in the RFC 6962 Merkle tree using only a fingerprint.
              </p>
            </div>
          </div>
          <Button
            className="rounded-full h-11 bg-[#202124] hover:bg-[#2D2E33] text-white font-bold text-sm shadow-soft px-6 shrink-0"
            onClick={() => toast.info("Opening help center...")}
          >
            Open Help Center
          </Button>
        </div>
      </div>
    </SidebarDashboardLayout>
  );
}
