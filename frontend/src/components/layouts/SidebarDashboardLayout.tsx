"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Vote,
  FileText,
  Users,
  Award,
  ShieldCheck,
  UserCircle,
  Settings,
  Search,
  Bell,
  Menu,
  X,
  Lock,
  LogOut,
  KeyRound,
  Database,
  Zap,
  BarChart3,
  Eye,
  ChevronRight,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { adminLogout } from "@/lib/api/auth";
import { voterLogout } from "@/lib/api/voter";
import { getSecurityAlerts, type SecurityAlertOut } from "@/lib/api/admin";
import { useAdminSession } from "@/hooks/useAdminSession";
import { useVoterSession } from "@/hooks/useVoterSession";
import { toast } from "sonner";

export type DashboardRole = "student" | "admin";

const studentNav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/vote", label: "Cast Ballot", icon: Vote },
  { href: "/dashboard#receipts", label: "My Receipts", icon: FileText },
  { href: "/dashboard#candidates", label: "Candidates", icon: Users },
  { href: "/results", label: "Results", icon: Award },
  { href: "/integrity", label: "Integrity", icon: ShieldCheck },
  { href: "/dashboard/profile", label: "Profile", icon: UserCircle },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const adminNav = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/elections/new", label: "Create Election", icon: Vote },
  { href: "/admin/voters", label: "Voter Roster", icon: Users },
  { href: "/admin/ballots", label: "Ballot Ledger", icon: Database },
  { href: "/admin/trustees", label: "Trustees", icon: KeyRound },
  { href: "/witnesses", label: "Witnesses", icon: Eye },
  { href: "/integrity", label: "Integrity Audit", icon: ShieldCheck },
  { href: "/admin/simulator", label: "Attack Simulator", icon: Zap },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function buildBreadcrumbs(pathname: string, role: DashboardRole) {
  const root = role === "student" ? "/dashboard" : "/admin";
  const rootLabel = role === "student" ? "Student Hub" : "Admin Console";
  const parts = pathname.split("/").filter(Boolean).slice(1);
  const crumbs: { label: string; href: string }[] = [{ label: rootLabel, href: root }];
  let built = root;
  for (const p of parts) {
    built += `/${p}`;
    crumbs.push({ label: p.charAt(0).toUpperCase() + p.slice(1), href: built });
  }
  return crumbs;
}

function AlertIcon({ severity }: { severity: string }) {
  const s = severity?.toUpperCase();
  if (s === "HIGH" || s === "CRITICAL")
    return <ShieldAlert className="w-3.5 h-3.5 text-[#E05252] shrink-0 mt-0.5" />;
  if (s === "MEDIUM")
    return <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] shrink-0 mt-0.5" />;
  return <CheckCircle2 className="w-3.5 h-3.5 text-[#4CAF7A] shrink-0 mt-0.5" />;
}

function timeAgo(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return "";
  }
}

export function SidebarDashboardLayout({
  children,
  role = "student",
}: {
  children: React.ReactNode;
  role?: DashboardRole;
}) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const nav = role === "student" ? studentNav : adminNav;
  const brandLabel = role === "student" ? "GlassBallot" : "GlassBallot Admin";
  const breadcrumbs = buildBreadcrumbs(pathname, role);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [alerts, setAlerts] = useState<SecurityAlertOut[]>([]);

  // Pull real user from the appropriate session hook
  const adminSession = useAdminSession();
  const voterSession = useVoterSession();

  const userLabel = (() => {
    if (role === "admin") {
      const name = adminSession.adminInfo?.username || adminSession.user?.username || "Election Officer";
      const id = adminSession.adminInfo?.role || adminSession.user?.roles?.[0] || "OFFICER";
      return { name, id };
    }
    const name = voterSession.voterInfo?.display_name || voterSession.voterProfile?.display_name || "Student Voter";
    const id = voterSession.voterInfo?.student_id || voterSession.voterProfile?.voter_external_id || "";
    return { name, id };
  })();

  // Load real alerts for admin notifications panel
  const loadAlerts = useCallback(async () => {
    if (role !== "admin") return;
    try {
      const data = await getSecurityAlerts();
      setAlerts(data.slice(0, 5));
    } catch {
      // silently fail — not critical
    }
  }, [role]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleLogout = async () => {
    try {
      if (role === "admin") {
        await adminLogout().catch(() => {});
        adminSession.clear();
      } else {
        await voterLogout().catch(() => {});
        voterSession.clear();
      }
      toast.success("Signed out successfully");
    } catch {}
    router.push("/");
  };

  const newAlertCount = alerts.filter((a) => a.is_active).length;

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-[#202124] font-sans flex w-full">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:static z-40 md:z-auto top-0 left-0 h-screen w-[250px] bg-white border-r border-[#EAEAE5] flex flex-col transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Brand */}
        <div className="h-20 flex items-center gap-3 px-6 border-b border-[#EAEAE5]">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#DAF39F] to-[#C6E66C] flex items-center justify-center shadow-soft">
            <Lock className="w-5 h-5 text-[#202124]" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-extrabold text-lg tracking-tight leading-none">{brandLabel}</div>
            <div className="text-[11px] text-[#5C7089] mt-0.5">
              {role === "student" ? "Voter Console" : "Governance"}
            </div>
          </div>
          <button
            className="md:hidden ml-auto text-[#5C7089]"
            onClick={() => setMobileOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav list */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const basePath = item.href.split("#")[0];
            const hasHash = item.href.includes("#");

            // Hash-anchor items (e.g. /dashboard#receipts) are NEVER highlighted —
            // they are jump links within a page, not real routes.
            // Root section items (/dashboard, /admin) match only when exact.
            // Sub-pages match by prefix.
            const rootPath = role === "student" ? "/dashboard" : "/admin";
            const isActive = !hasHash && (
              basePath === rootPath
                ? pathname === rootPath
                : pathname.startsWith(basePath)
            );

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn("nav-sidebar-link", isActive && "active")}
              >
                <Icon
                  className={cn(
                    "w-5 h-5",
                    isActive ? "text-[#202124]" : "text-[#5C7089]"
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom account strip */}
        <div className="p-3 border-t border-[#EAEAE5]">
          <div className="rounded-2xl p-3 bg-[#F5F5F4] flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#EBD3FF] to-[#D6BDF8] flex items-center justify-center text-[#202124] font-bold shrink-0">
              {(userLabel.name.charAt(0) || "U").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{userLabel.name}</div>
              <div className="text-[11px] text-[#5C7089] truncate font-mono">{userLabel.id}</div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl hover:bg-white text-[#5C7089] hover:text-[#202124] transition-all"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top header */}
        <header className="sticky top-0 z-20 h-20 bg-white/80 backdrop-blur-lg border-b border-[#EAEAE5] flex items-center px-4 md:px-8 gap-4">
          <button
            className="md:hidden p-2 rounded-xl text-[#5C7089] hover:bg-[#F5F5F4]"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search pill */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C7089]" />
            <input
              type="text"
              placeholder={
                role === "student"
                  ? "Search ballot, fingerprint..."
                  : "Search voters, events..."
              }
              className="search-pill w-full pl-11 pr-4"
            />
          </div>

          <div className="flex items-center gap-2 md:gap-4 ml-auto">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen((v) => !v);
                  if (!notifOpen) loadAlerts();
                }}
                className="w-10 h-10 rounded-full border border-[#EAEAE5] bg-white flex items-center justify-center text-[#5C7089] hover:text-[#202124] hover:shadow-card transition-all relative"
              >
                <Bell className="w-[18px] h-[18px]" />
                {newAlertCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#E05252]" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white shadow-soft border border-[#EAEAE5] overflow-hidden z-50">
                  <div className="px-5 py-4 border-b border-[#EAEAE5] flex items-center justify-between">
                    <div className="font-bold text-[#202124]">
                      {role === "admin" ? "Security Alerts" : "Notifications"}
                    </div>
                    {newAlertCount > 0 && (
                      <Badge variant="outline" className="text-[11px] bg-[#FFE5E5] border-[#E05252]/30 text-[#E05252]">
                        {newAlertCount} active
                      </Badge>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {role === "admin" ? (
                      alerts.length === 0 ? (
                        <div className="px-5 py-6 text-sm text-[#5C7089] text-center">
                          <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-[#4CAF7A]" />
                          No active security alerts
                        </div>
                      ) : (
                        alerts.map((a) => (
                          <div
                            key={a.id}
                            className="px-5 py-3 border-b border-[#F5F5F4] flex items-start gap-3 hover:bg-[#FAFAF7] transition-all"
                          >
                            <AlertIcon severity={a.severity} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-[#202124] leading-snug font-medium">
                                {a.title || a.summary || a.kind}
                              </div>
                              <div className="text-[11px] text-[#5C7089] mt-0.5">
                                {a.severity} · {timeAgo(a.created_at ?? "")}
                              </div>
                            </div>
                          </div>
                        ))
                      )
                    ) : (
                      /* Student: static election lifecycle notifications */
                      [
                        { text: "Election is currently open for voting.", time: "Live", ok: true },
                        { text: "Your ballot receipt is anchored to the ledger.", time: "After voting", ok: true },
                        { text: "Results published after closing.", time: "Upcoming", ok: false },
                      ].map((n, i) => (
                        <div
                          key={i}
                          className="px-5 py-3 border-b border-[#F5F5F4] flex items-start gap-3 hover:bg-[#FAFAF7] transition-all"
                        >
                          <div className={cn("w-2 h-2 mt-2 rounded-full shrink-0", n.ok ? "bg-[#4CAF7A]" : "bg-[#9AA7B8]")} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-[#202124] leading-snug">{n.text}</div>
                            <div className="text-[11px] text-[#5C7089] mt-1">{n.time}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {role === "admin" && (
                    <div className="px-5 py-3 border-t border-[#EAEAE5]">
                      <Button
                        asChild
                        variant="ghost"
                        className="w-full text-sm font-semibold text-[#202124] hover:bg-[#F5F5F4]"
                        onClick={() => setNotifOpen(false)}
                      >
                        <Link href="/integrity">View integrity audit →</Link>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Avatar dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="hidden sm:flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-[#EAEAE5] bg-white hover:shadow-card transition-all">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#EBD3FF] to-[#D6BDF8] flex items-center justify-center font-bold text-sm">
                    {(userLabel.name.charAt(0) || "U").toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold text-[#202124] pr-1 max-w-[120px] truncate">
                    {userLabel.name}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1 border border-[#EAEAE5]">
                <DropdownMenuLabel className="font-bold text-[#202124]">
                  {userLabel.name}
                  {userLabel.id && (
                    <span className="block text-[11px] font-mono text-[#5C7089] font-normal mt-0.5">
                      {userLabel.id}
                    </span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href={role === "student" ? "/dashboard/profile" : "/admin/settings"}
                    className="cursor-pointer"
                  >
                    <UserCircle className="w-4 h-4 mr-2" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href={role === "student" ? "/dashboard/settings" : "/admin/settings"}
                    className="cursor-pointer"
                  >
                    <Settings className="w-4 h-4 mr-2" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-[#E05252] focus:text-[#E05252] focus:bg-[#FDEDED]"
                >
                  <LogOut className="w-4 h-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Breadcrumbs */}
        <div className="px-4 md:px-8 py-4">
          <nav className="flex items-center gap-1.5 text-xs text-[#5C7089] flex-wrap">
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={b.href}>
                {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-[#9AA7B8]" />}
                {i === breadcrumbs.length - 1 ? (
                  <span className="font-semibold text-[#202124]">{b.label}</span>
                ) : (
                  <Link href={b.href} className="hover:text-[#202124] transition-colors">
                    {b.label}
                  </Link>
                )}
              </React.Fragment>
            ))}
          </nav>
        </div>

        {/* Page content */}
        <div className="flex-1 px-4 md:px-8 pb-12">{children}</div>
      </div>
    </div>
  );
}
