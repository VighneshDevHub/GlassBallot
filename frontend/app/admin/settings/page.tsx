"use client";

import { useEffect, useState } from "react";
import { SidebarDashboardLayout } from "@/components/layouts/SidebarDashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ShieldCheck,
  KeyRound,
  Lock,
  Bell,
  Mail,
  Users,
  FileCode,
  AlertTriangle,
  Eye,
  UserPlus,
  Trash2,
  RotateCcw,
  Download,
  Clock,
} from "lucide-react";
import {
  listAdminUsers,
  patchAdminUserRoles,
  getReportsEvidence,
  getBallotLedger,
  resetDemo,
  type AdminUserOut,
} from "@/lib/api/admin";
import { adminMe, patchAdminMe, type AdminMeResponse } from "@/lib/api/auth";
import { listElections } from "@/lib/api/elections";

const ROLE_OPTIONS = ["RETURNING OFFICER", "KEY CUSTODIAN", "AUDITOR", "WITNESS", "OBSERVER"];
const ROLE_TAG: Record<string, string> = {
  "RETURNING OFFICER": "pastel-peach",
  "KEY CUSTODIAN": "pastel-lavender",
  AUDITOR: "pastel-lime",
  WITNESS: "pastel-sky",
  OBSERVER: "",
};

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUserOut[]>([]);
  const [adminData, setAdminData] = useState<AdminMeResponse | null>(null);
  const [electionId, setElectionId] = useState<string | null>(null);

  const [notifs, setNotifs] = useState({
    election_phase: true,
    audit_alarm: true,
    witness_fork: true,
    threshold_approval: true,
    daily_report: false,
  });
  const [sec, setSec] = useState({
    two_factor: true,
    session_timeout_20: true,
    ip_whitelist: false,
  });
  const [sessionTimeout, setSessionTimeout] = useState("20 Minutes (Strict)");
  const [retention, setRetention] = useState("7 Years (Default)");
  const [cidr, setCidr] = useState("");

  const inputClass =
    "h-11 rounded-2xl bg-[#F5F5F4] border-[#EAEAE5] focus-visible:ring-2 focus-visible:ring-[#DAF39F] text-sm font-medium px-4";

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [usersRes, meRes, electionsRes] = await Promise.all([
          listAdminUsers(1, 50).catch(() => ({ users: [], total: 0, page: 1, page_size: 50 })),
          adminMe().catch(() => ({ authenticated: false, roles: [] as string[] })),
          listElections("admin").catch(() => ([] as unknown[])),
        ]);
        if (!alive) return;
        setUsers((usersRes as unknown as { users: AdminUserOut[] })?.users ?? []);
        setAdminData(meRes as AdminMeResponse);
        const prefs =
          ((meRes as unknown as { preferences?: Record<string, unknown> })?.preferences as Record<
            string,
            unknown
          >) ?? {};
        setNotifs({
          election_phase: Boolean(prefs.election_phase ?? notifs.election_phase),
          audit_alarm: Boolean(prefs.audit_alarm ?? notifs.audit_alarm),
          witness_fork: Boolean(prefs.witness_fork ?? notifs.witness_fork),
          threshold_approval: Boolean(prefs.threshold_approval ?? notifs.threshold_approval),
          daily_report: Boolean(prefs.daily_report ?? notifs.daily_report),
        });
        setSec({
          two_factor: Boolean(prefs.two_factor ?? sec.two_factor),
          session_timeout_20: Boolean(prefs.session_timeout_20 ?? sec.session_timeout_20),
          ip_whitelist: Boolean(prefs.ip_whitelist ?? sec.ip_whitelist),
        });
        setSessionTimeout((prefs.session_timeout as string) ?? sessionTimeout);
        setRetention((prefs.audit_retention as string) ?? retention);
        setCidr((prefs.trusted_cidr as string) ?? cidr);
        const elList = electionsRes as Array<{ election_id?: string; id?: string }>;
        if (elList.length) setElectionId(elList[0].election_id ?? elList[0].id ?? null);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load governance settings");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function savePref(key: string, value: unknown, label: string) {
    const id = toast.loading(`Saving ${label}...`);
    setSaving(key);
    try {
      const nextPrefs = {
        ...notifs,
        ...sec,
        session_timeout: sessionTimeout,
        audit_retention: retention,
        trusted_cidr: cidr,
        [key]: value,
      };
      await patchAdminMe({ preferences: nextPrefs as unknown as Record<string, unknown> });
      setAdminData((prev) =>
        prev ? ({ ...prev, preferences: nextPrefs } as unknown as AdminMeResponse) : prev,
      );
      toast.success(`${label}: ${typeof value === "boolean" ? (value ? "Enabled" : "Disabled") : "Saved"}`, { id });
    } catch (e: any) {
      toast.error(e?.message || `Failed to save ${label}`, { id });
    } finally {
      setSaving(null);
    }
  }

  async function rotateRole(u: AdminUserOut) {
    return cycleRole(u);
  }

  async function rotateKey(u: AdminUserOut) {
    toast.info(`Rotating API key for ${u.username} — backend queueing...`);
  }

  async function removeUser(u: AdminUserOut) {
    toast.warning(`Revoke access: operation not available for ${u.username} in demo mode`);
  }

  async function cycleRole(u: AdminUserOut) {
    const id = toast.loading(`Updating role for ${u.username}...`);
    try {
      const current = u.roles[0] ?? "OBSERVER";
      const idx = ROLE_OPTIONS.indexOf(current);
      const next = ROLE_OPTIONS[(idx + 1) % ROLE_OPTIONS.length];
      const updated = await patchAdminUserRoles(u.user_id, [next]);
      setUsers((prev) => prev.map((x) => (x.user_id === u.user_id ? updated : x)));
      toast.success(`${u.username}: role changed to ${next}`, { id });
    } catch (e: any) {
      toast.error(e?.message || `Failed to update role for ${u.username}`, { id });
    }
  }

  async function exportAudit() {
    if (!electionId) {
      toast.error("No active election — cannot export audit");
      return;
    }
    const id = toast.loading("Exporting evidence bundle...");
    try {
      const evidence = await getReportsEvidence(electionId);
      const data = JSON.stringify(evidence, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `evidence-bundle-${electionId.slice(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${evidence.bundles?.length ?? 0} evidence bundles`, { id });
    } catch (e: any) {
      toast.error(e?.message || "Failed to export audit evidence", { id });
    }
  }

  async function exportLedger() {
    if (!electionId) {
      toast.error("No active election — cannot export ledger");
      return;
    }
    const id = toast.loading("Exporting ballot ledger...");
    try {
      const ledger = await getBallotLedger(electionId, 1, 10000);
      const header = "index,fingerprint,token_hash,entry_hash,created_at,is_test\n";
      const rows = (ledger.items ?? [])
        .map(
          (b) =>
            `${b.ledger_index},"${b.ballot_fingerprint}","${b.token_hash}","${b.entry_hash}","${b.created_at}",${b.is_test_ballot}`,
        )
        .join("\n");
      const blob = new Blob([header + rows], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ballot-ledger-${electionId.slice(0, 8)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${ledger.total ?? ledger.items?.length ?? 0} ledger rows`, { id });
    } catch (e: any) {
      toast.error(e?.message || "Failed to export ledger", { id });
    }
  }

  async function resetDemoBaseline() {
    if (!electionId) {
      toast.error("No active election — cannot reset");
      return;
    }
    const id = toast.loading("Resetting demo baseline...");
    try {
      const r = await resetDemo(electionId);
      toast.success(r?.message ?? "Demo baseline reset complete", { id });
    } catch (e: any) {
      toast.error(e?.message || "Failed to reset demo", { id });
    }
  }

  const renderUsers = loading && users.length === 0
    ? Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="px-6 md:px-8 py-4 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3.5">
            <Skeleton className="w-11 h-11 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="w-48 h-5 rounded-md" />
              <Skeleton className="w-64 h-3 rounded-md" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="w-28 h-9 rounded-full" />
            <Skeleton className="w-28 h-9 rounded-full" />
          </div>
        </div>
      ))
    : users.map((u, i) => {
        const topRole = u.roles[0] ?? "OBSERVER";
        const tag = ROLE_TAG[topRole] ?? "";
        const isRO = topRole === "RETURNING OFFICER";
        return (
          <div key={u.user_id} className="px-6 md:px-8 py-4 flex flex-wrap items-center gap-3 justify-between border-b border-[#F0F0EC] last:border-0">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#EBD3FF] to-[#CFE8FF] flex items-center justify-center font-extrabold text-[#202124]">
                {u.username?.charAt(0)?.toUpperCase() ?? "U"}
              </div>
              <div>
                <div className="font-bold text-[15px] text-[#202124] flex flex-wrap items-center gap-2">
                  {u.username}
                  <Badge className={`${tag} text-[#202124] border-transparent rounded-full text-[10px] font-bold`}>
                    {topRole}
                  </Badge>
                  {!u.is_active && (
                    <Badge className="pastel-peach text-[#202124] border-transparent rounded-full text-[10px] font-bold">
                      INACTIVE
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-[#5C7089] font-mono">
                  {u.email ?? "—"}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-[#EAEAE5] text-xs font-bold px-3.5 h-9"
                onClick={() => rotateRole(u)}
                disabled={isRO || saving === `role-${u.user_id}`}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Change Role
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-[#EAEAE5] text-xs font-bold px-3.5 h-9"
                onClick={() => rotateKey(u)}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Rotate Key
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-[#E05252]/40 text-[#E05252] hover:bg-[#FDEDED] text-xs font-bold px-3.5 h-9"
                disabled={isRO}
                onClick={() => removeUser(u)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> {isRO ? "Cannot remove RO" : "Remove"}
              </Button>
            </div>
          </div>
        );
      });

  return (
    <SidebarDashboardLayout role="admin">
      <div className="space-y-8">
        <div>
          <h1 className="text-[2.25rem] font-extrabold tracking-tight leading-none">
            Governance Settings
          </h1>
          <p className="text-[#5C7089] text-sm mt-1">
            Election administrator, officer management, security, and audit preferences.
          </p>
          {adminData?.username && (
            <Badge className="mt-3 pastel-lime text-[#202124] border-transparent rounded-full text-[11px] font-bold">
              Signed in as @{adminData.username}
            </Badge>
          )}
        </div>

        {/* User management */}
        <div className="pastel-card-white !p-0 overflow-hidden">
          <div className="px-6 md:px-8 pt-5 md:pt-6 pb-4 border-b border-[#EAEAE5] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl pastel-card pastel-lavender !p-0 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#202124]" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-[#202124]">Officer & Trustee Management</h3>
                <p className="text-xs text-[#5C7089]">Invite, remove, and adjust election officer roles.</p>
              </div>
            </div>
            <Button
              className="rounded-full h-11 bg-[#DAF39F] hover:bg-[#C6E66C] text-[#202124] font-bold text-sm shadow-soft"
              onClick={() => toast.info("Invite flow: use backend admin invite endpoint")}
            >
              <UserPlus className="w-4 h-4 mr-2" /> Invite Officer
            </Button>
          </div>
          <div className="divide-y divide-[#F0F0EC]">{renderUsers}</div>
        </div>

        {/* Security */}
        <div className="pastel-card-white !p-0 overflow-hidden">
          <div className="px-6 md:px-8 pt-5 md:pt-6 pb-4 border-b border-[#EAEAE5] flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl pastel-card pastel-peach !p-0 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[#202124]" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#202124]">Security & Sessions</h3>
              <p className="text-xs text-[#5C7089]">Authentication, access, and retention rules.</p>
            </div>
          </div>
          <div className="px-6 md:px-8 py-5 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-bold text-[#202124]">Session Inactivity Timeout</Label>
                {loading ? (
                  <Skeleton className={inputClass + " w-full"} />
                ) : (
                  <select
                    value={sessionTimeout}
                    disabled={saving === "session_timeout"}
                    onChange={(e) => {
                      setSessionTimeout(e.target.value);
                      void savePref("session_timeout", e.target.value, "Session Timeout");
                    }}
                    className={inputClass + " w-full disabled:opacity-60"}
                  >
                    <option>20 Minutes (Strict)</option>
                    <option>1 Hour</option>
                    <option>4 Hours</option>
                    <option>Never</option>
                  </select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-bold text-[#202124]">Audit Log Retention</Label>
                {loading ? (
                  <Skeleton className={inputClass + " w-full"} />
                ) : (
                  <select
                    value={retention}
                    disabled={saving === "audit_retention"}
                    onChange={(e) => {
                      setRetention(e.target.value);
                      void savePref("audit_retention", e.target.value, "Audit Retention");
                    }}
                    className={inputClass + " w-full disabled:opacity-60"}
                  >
                    <option>7 Years (Default)</option>
                    <option>1 Year</option>
                    <option>Forever</option>
                  </select>
                )}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-sm font-bold text-[#202124]">Trusted CIDR Whitelist (comma-separated)</Label>
                {loading ? (
                  <Skeleton className={inputClass + " w-full"} />
                ) : (
                  <Input
                    value={cidr}
                    disabled={saving === "trusted_cidr"}
                    onChange={(e) => setCidr(e.target.value)}
                    onBlur={() => void savePref("trusted_cidr", cidr, "Trusted CIDR")}
                    placeholder="10.0.0.0/8, 192.168.1.0/24"
                    className={inputClass + " w-full font-mono disabled:opacity-60"}
                  />
                )}
              </div>
            </div>
            <div className="pt-2 space-y-0.5 border-t border-[#F0F0EC]">
              {[
                {
                  key: "two_factor",
                  title: "Require Officer 2FA (WebAuthn / TOTP)",
                  desc: "Mandatory hardware or software 2-factor authentication for all governance operations.",
                  icon: KeyRound,
                },
                {
                  key: "session_timeout_20",
                  title: "Strict 20-Min Timeout Enforcement",
                  desc: "Auto-logout any idle officer session before election result publication.",
                  icon: Clock,
                },
                {
                  key: "ip_whitelist",
                  title: "Restrict Admin Login to Campus IPs",
                  desc: "Deny any authentication attempt from outside the institutional CIDR ranges.",
                  icon: Lock,
                },
              ].map((n) => {
                const I = n.icon;
                const on = (sec as any)[n.key];
                return (
                  <div key={n.key} className="py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-[#F0F0EC] last:border-0">
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
                        className="data-[state=checked]:bg-[#243056]"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="pastel-card-white !p-0 overflow-hidden">
          <div className="px-6 md:px-8 pt-5 md:pt-6 pb-4 border-b border-[#EAEAE5] flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl pastel-card pastel-sky !p-0 flex items-center justify-center">
              <Bell className="w-5 h-5 text-[#202124]" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#202124]">Governance Notifications</h3>
              <p className="text-xs text-[#5C7089]">Push & email alerts for critical election events.</p>
            </div>
          </div>
          <div className="px-6 md:px-8 py-5">
            {[
              { key: "election_phase", title: "Election Phase Transitions", desc: "Alert when voting opens, closes, or tally starts.", icon: Eye },
              { key: "audit_alarm", title: "Tamper-Alarms from Audit Chain", desc: "Immediate email if hash-chain fails verification.", icon: AlertTriangle },
              { key: "witness_fork", title: "Witness Fork Consensus Alerts", desc: "Alert if any witness returns a conflicting tree head.", icon: FileCode },
              { key: "threshold_approval", title: "Trustee Key-Share Approvals", desc: "Notify when a trustee submits a tally key share.", icon: KeyRound },
              { key: "daily_report", title: "Daily Automated Integrity Report", desc: "Morning summary of all 10 continuous ledger checks.", icon: Mail },
            ].map((n) => {
              const I = n.icon;
              const on = (notifs as any)[n.key];
              return (
                <div key={n.key} className="py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-[#F0F0EC] last:border-0">
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
                        setNotifs({ ...notifs, [n.key]: v });
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

        {/* Export & Reset */}
        <div className="pastel-card pastel-lime !p-6 md:!p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <h3 className="text-lg font-extrabold text-[#202124]">Reports, Logs, Reset</h3>
            <p className="text-[14px] text-[#3E5A0E] leading-relaxed max-w-xl">
              Export full audit chain, sealed ballot ledger, and election result certification. Reset demo state
              to a clean baseline for classroom demonstrations.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              variant="outline"
              className="rounded-full h-11 bg-white border-white/60 text-[#202124] hover:bg-white/80 font-bold text-sm shadow-card"
              onClick={exportAudit}
            >
              <Download className="w-4 h-4 mr-2" /> Export Audit
            </Button>
            <Button
              variant="outline"
              className="rounded-full h-11 bg-white border-white/60 text-[#202124] hover:bg-white/80 font-bold text-sm shadow-card"
              onClick={exportLedger}
            >
              <FileCode className="w-4 h-4 mr-2" /> Export Ledger
            </Button>
            <Button
              variant="outline"
              className="rounded-full h-11 bg-[#202124] border-[#202124] text-white hover:bg-[#2D2E33] font-bold text-sm shadow-card"
              onClick={resetDemoBaseline}
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Reset Demo Baseline
            </Button>
          </div>
        </div>
      </div>
    </SidebarDashboardLayout>
  );
}
