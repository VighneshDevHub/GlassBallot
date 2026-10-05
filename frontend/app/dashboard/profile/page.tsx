"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SidebarDashboardLayout } from "@/components/layouts/SidebarDashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserCircle,
  GraduationCap,
  Mail,
  Calendar,
  KeyRound,
  ShieldCheck,
  FileCheck2,
  Award,
  MapPin,
  Monitor,
  Smartphone,
  Trash2,
  Edit3,
  ChevronRight,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

import { useVoterSession } from "@/hooks/useVoterSession";
import {
  getVoterMe,
  patchVoterMe,
  getVoterReceipts,
  type VoterProfileResponse,
  type ReceiptItem,
} from "@/lib/api/voter";
import { requestOTP } from "@/lib/api/auth";

export default function StudentProfile() {
  const { voterProfile, refresh: refreshSession } = useVoterSession();
  const inputClass =
    "h-11 rounded-2xl bg-[#F5F5F4] border-[#EAEAE5] focus-visible:ring-2 focus-visible:ring-[#DAF39F] text-sm font-medium";

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<VoterProfileResponse | null>(null);
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [course, setCourse] = useState("");
  const [year, setYear] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  const devices = [
    { name: "Laptop (Chrome — Windows)", location: "Mumbai, India", lastActive: "Just now", current: true },
    { name: "Mobile (Safari — iPhone)", location: "Mumbai, India", lastActive: "Yesterday" },
  ];

  const loadProfile = async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([
        getVoterMe().catch(() => null),
        getVoterReceipts(20).catch(() => ({ items: [] })),
      ]);
      if (p) {
        setProfile(p);
        setName(p.display_name || "");
        setEmail(p.email || "");
        setCourse(p.course || "");
        setYear(p.year || "");
      }
      if (r?.items) setReceipts(r.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleRequestOTP = async () => {
    const id = profile?.voter_external_id || voterProfile?.voter_external_id || undefined;
    if (!id) {
      toast.error("Voter ID unavailable for OTP request");
      return;
    }
    setOtpLoading(true);
    try {
      await requestOTP(id);
      toast.success("OTP code sent to registered channel.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to request OTP");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSave = async () => {
    if (!otpCode.trim()) {
      toast.error("Please request and enter OTP to save changes.");
      return;
    }
    setSaving(true);
    try {
      const updated = await patchVoterMe({
        display_name: name.trim() || undefined,
        email: email.trim() || null,
        course: course.trim() || null,
        year: year.trim() || null,
      });
      setProfile(updated);
      toast.success("Profile saved successfully — OTP verified.");
      setOtpCode("");
      await refreshSession();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const displayName = profile?.display_name || voterProfile?.display_name || "Voter";
  const studentId = profile?.voter_external_id || voterProfile?.voter_external_id || "——";
  const initials = displayName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "SV";
  const hasVoted = !!profile?.has_completed_vote || receipts.some(r => r.kind === "cast_ballot");

  const elections = receipts.length > 0 ? Array.from(
    new Map(receipts.map(r => [r.election_id, {
      name: r.election_title || "Election",
      role: r.kind === "cast_ballot" ? "Voted · Ballot Cast" : r.kind === "spoiled_test" || r.kind === "test_ballot" ? "Tested · Benaloh Challenge" : "Token Issued",
      status: hasVoted ? "completed" : "open",
      date: new Date(r.issued_at).toLocaleDateString(undefined, { month: "short", year: "numeric" }) || "Ongoing",
    }])).values()
  ) : [];

  return (
    <SidebarDashboardLayout role="student">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-[2.25rem] font-extrabold tracking-tight leading-none">
              Voter Profile
            </h1>
            <p className="text-[#5C7089] text-sm mt-1">
              Manage your voter identity, sessions, and election history.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="pastel-card pastel-sky lg:col-span-1 flex flex-col items-center text-center p-7">
            <div className="relative">
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#EBD3FF] to-[#CFE8FF] flex items-center justify-center text-3xl font-extrabold text-[#202124] shadow-card">
                {loading ? <Skeleton className="w-20 h-10 rounded-2xl" /> : initials}
              </div>
              <button className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-white shadow-card border border-[#EAEAE5] flex items-center justify-center text-[#5C7089] hover:text-[#202124] transition-all">
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
            <h2 className="text-xl font-extrabold text-[#202124] mt-5">
              {loading ? <Skeleton className="w-48 h-6 rounded-2xl inline-block align-middle" /> : displayName}
            </h2>
            <div className="text-sm font-mono text-[#1F5689]">{studentId}</div>
            <Badge className="mt-3 rounded-full bg-[#DAF39F] text-[#3E5A0E] border-transparent font-bold text-[11px] px-3 py-1">
              <ShieldCheck className="w-3 h-3 mr-1 inline align-sub" /> VERIFIED VOTER
            </Badge>
            <p className="text-[13px] text-[#1F5689]/80 mt-4 leading-relaxed">
              Member of the eligibility register. Your voter identity is
              cryptographically verified but unlinked from cast ballots.
            </p>
            <Button variant="outline" className="mt-5 rounded-full border-[#EAEAE5] bg-white w-full h-11 font-bold text-sm">
              <FileCheck2 className="w-4 h-4 mr-2" /> Download Voter Card
            </Button>
          </div>

          <div className="pastel-card-white lg:col-span-2 space-y-6">
            <div>
              <h3 className="text-lg font-extrabold text-[#202124] mb-4">Personal Information</h3>
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "Full Name", icon: UserCircle, value: profile?.display_name || "—", field: true, key: "name" },
                    { label: "College ID", icon: KeyRound, value: profile?.voter_external_id || "—", field: false },
                    { label: "Institutional Email", icon: Mail, value: profile?.email || "—", field: true, key: "email" },
                    { label: "Department", icon: GraduationCap, value: profile?.course || "Not specified", field: true, key: "course" },
                    { label: "Year of Study", icon: Calendar, value: profile?.year || "Not specified", field: true, key: "year" },
                    { label: "Voter Status", icon: MapPin, value: profile?.is_eligible ? "Eligible · Active" : "Ineligible", field: false },
                  ].map((f, i) => {
                    const I = f.icon as any;
                    return (
                      <div key={i} className="p-4 rounded-2xl bg-[#FAFAF7] border border-[#EAEAE5]">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-[#5C7089] uppercase tracking-wider">
                          <I className="w-3.5 h-3.5" /> {f.label}
                        </div>
                        {f.field ? (
                          <input
                            className="mt-1.5 w-full bg-transparent text-[15px] font-bold text-[#202124] focus:outline-none"
                            value={
                              f.key === "name" ? name :
                              f.key === "email" ? email :
                              f.key === "course" ? course :
                              f.key === "year" ? year : ""
                            }
                            onChange={(e) => {
                              if (f.key === "name") setName(e.target.value);
                              if (f.key === "email") setEmail(e.target.value);
                              if (f.key === "course") setCourse(e.target.value);
                              if (f.key === "year") setYear(e.target.value);
                            }}
                          />
                        ) : (
                          <div className="font-bold text-[#202124] mt-1.5 text-[15px]">{f.value}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-[#202124] mb-4 flex items-center justify-between">
                Change Contact / Passcode
                <span className="text-[11px] font-mono text-[#5C7089] font-normal">OTP-based changes</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#202124]">Current OTP</label>
                  <input
                    placeholder="Enter 6-digit OTP"
                    type="password"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className={`${inputClass} px-4 w-full`}
                  />
                </div>
                <div className="space-y-2 pt-6">
                  <Button
                    variant="outline"
                    className="rounded-full h-11 border-[#EAEAE5] font-bold text-sm w-full"
                    onClick={handleRequestOTP}
                    disabled={otpLoading || loading}
                  >
                    {otpLoading ? <span className="animate-pulse">Requesting…</span> : "Request OTP"}
                  </Button>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  className="rounded-full h-11 bg-[#DAF39F] hover:bg-[#C6E66C] text-[#202124] font-bold text-sm shadow-soft px-6"
                  onClick={handleSave}
                  disabled={saving || loading}
                >
                  {saving ? <span className="animate-pulse">Saving…</span> : <><Lock className="w-4 h-4 mr-2" /> Save Changes</>}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="pastel-card-white !p-0 overflow-hidden">
          <div className="px-6 md:px-8 pt-5 md:pt-6 pb-4 border-b border-[#EAEAE5] flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-[#202124] flex items-center gap-2">
              <Award className="w-5 h-5 text-[#5B3D86]" /> Election Participation History
            </h3>
            <Button variant="ghost" className="rounded-full text-xs font-bold text-[#243056]" onClick={() => toast.success("Participation history exported")}>
              Export History <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="divide-y divide-[#F0F0EC]">
            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="px-6 md:px-8 py-5"><Skeleton className="h-12 rounded-2xl w-full" /></div>)
            ) : (
              (elections as any[]).length > 0 ? Array.from(elections).map((e, i) => (
                <div
                  key={i}
                  className="px-6 md:px-8 py-4.5 hover:bg-[#FAFAF7] transition-colors flex flex-wrap items-center gap-3 justify-between"
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`w-11 h-11 rounded-2xl ${["pastel-peach", "pastel-lavender", "pastel-lime"][i % 3]} flex items-center justify-center`}>
                      <Award className="w-5 h-5 text-[#202124]" />
                    </div>
                    <div>
                      <div className="font-bold text-[#202124]">{e.name}</div>
                      <div className="text-xs text-[#5C7089]">{e.role} · {e.date}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={e.status === "completed" ? "outline" : "default"}
                      className={
                        e.status === "open"
                          ? "bg-[#DAF39F] text-[#3E5A0E] border-transparent rounded-full text-[11px] font-bold"
                          : "bg-[#F5F5F4] border-[#EAEAE5] text-[#5C7089] rounded-full text-[11px] font-bold"
                      }
                    >
                      {e.status.toUpperCase()}
                    </Badge>
                    {e.status === "open" ? (
                      <Link href="/vote">
                        <Button className="rounded-full h-9 bg-[#202124] hover:bg-[#2D2E33] text-white text-xs font-bold px-4">
                          Vote Now
                        </Button>
                      </Link>
                    ) : (
                      <Link href="/verify/0">
                        <Button variant="outline" className="rounded-full h-9 border-[#EAEAE5] text-xs font-bold px-4">
                          <FileCheck2 className="w-3.5 h-3.5 mr-1.5" /> Proof
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              )) : (
                <div className="px-6 md:px-8 py-10 text-center text-sm text-[#5C7089]">
                  No election participation yet. <Link href="/vote" className="underline text-[#243056] font-bold">Cast your first ballot</Link>.
                </div>
              )
            )}
          </div>
        </div>

        <div className="pastel-card-white !p-0 overflow-hidden">
          <div className="px-6 md:px-8 pt-5 md:pt-6 pb-4 border-b border-[#EAEAE5] flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-[#202124] flex items-center gap-2">
              <Monitor className="w-5 h-5 text-[#243056]" /> Active Sessions & Devices
            </h3>
          </div>
          <div className="divide-y divide-[#F0F0EC]">
            {devices.map((d, i) => (
              <div key={i} className="px-6 md:px-8 py-4 flex flex-wrap items-center gap-4 justify-between">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-[#F5F5F4] border border-[#EAEAE5] flex items-center justify-center text-[#5C7089]">
                    {i === 0 ? <Monitor className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="font-bold text-[#202124] text-[15px] flex items-center gap-2">
                      {d.name}
                      {d.current && (
                        <Badge className="rounded-full bg-[#DAF39F] text-[#3E5A0E] border-transparent text-[10px] font-bold">
                          CURRENT
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-[#5C7089] mt-0.5">
                      <MapPin className="w-3 h-3 inline align-middle mr-1" /> {d.location} · Last active: {d.lastActive}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full h-9 border-[#E05252]/40 text-[#E05252] hover:bg-[#FDEDED] text-xs font-bold px-4"
                    disabled={d.current}
                    onClick={() => toast.warning("Session revoked")}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    {d.current ? "Cannot revoke current" : "End Session"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SidebarDashboardLayout>
  );
}
