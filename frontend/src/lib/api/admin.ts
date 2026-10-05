import { httpGet, httpPatch, httpPost } from "./http";
import type { SignedTreeHead } from "./voting";
import type { CheckResult, IntegrityResponse, MilestonesResponse, WitnessSummary } from "./elections";

export interface AuditEventOut {
  id: string;
  created_at: string;
  actor_type: string;
  actor_id?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  previous_hash: string;
  event_hash: string;
  metadata_json?: Record<string, unknown>;
}

export interface AuditEventListResponse {
  success: boolean;
  events: AuditEventOut[];
}

export interface AuditVerifyResponse {
  success: boolean;
  audit_integrity?: string;
  ok: boolean;
  first_bad_id?: string | null;
  first_bad_event_id?: string | null;
  total_events: number;
}

export interface SecurityAlertOut {
  id?: string;
  created_at?: string;
  updated_at?: string | null;
  severity: string;
  alert_type?: string;
  kind?: string;
  title?: string;
  summary: string;
  description?: string;
  details: Record<string, unknown>;
  details_json?: Record<string, unknown>;
  is_active: boolean;
  is_resolved?: boolean;
}

export interface SecurityAlertListResponse {
  success: boolean;
  alerts: SecurityAlertOut[];
}

export interface TrusteeOut {
  id?: string;
  created_at?: string;
  updated_at?: string | null;
  role_code: string;
  display_name: string;
  trustee_name?: string;
  user_id?: string | null;
  threshold_group?: string;
  share_index?: number;
}

export interface TrusteeListResponse {
  success: boolean;
  trustees: TrusteeOut[];
  tally_session?: TallySessionOut | null;
}

export type ApprovalStatus = "pending" | "approved" | "rejected" | "completed" | "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED" | "FAILED";

export interface TallySessionOut {
  id?: string;
  created_at?: string;
  updated_at?: string | null;
  election_id: string;
  status: ApprovalStatus;
  approvals_required?: number;
  approvals_received?: number;
  approvals_count?: number;
  completed_at?: string | null;
  approved_trustee_ids?: string[];
}

export interface TallyApprovalRequest {
  trustee_id?: string;
  share_b64?: string;
  trustee_share?: Record<string, unknown>;
}

export interface DemoSeedRequest {
  n?: number;
  count?: number;
  election_id?: string;
}

export interface DemoSeedResponse {
  added?: number;
  seeded_count?: number;
  success?: boolean;
}

export interface DemoAttackRequest {
  kind: string;
  scenario?: string;
  election_id?: string;
}

export interface DemoAttackResponse {
  kind?: string;
  scenario?: string;
  affected_index?: number | null;
  affected_event_id?: string | null;
  note: string;
  before_integrity?: string | null;
  after_integrity?: string | null;
  success?: boolean;
}

export interface DemoDeviceResponse {
  compromised_device: boolean;
  on?: boolean;
}

export interface DemoResetResponse {
  ok: boolean;
  message: string;
  success?: boolean;
  election_id?: string;
}

export interface AdminUserOut {
  user_id: string;
  username: string;
  email?: string | null;
  is_active: boolean;
  roles: string[];
  created_at?: string | null;
}

export interface AdminUserListResponse {
  users: AdminUserOut[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminUserPatchRolesRequest {
  roles: string[];
}

export interface VoterRosterItem {
  voter_id: string;
  voter_external_id: string;
  display_name: string;
  is_eligible: boolean;
  has_received_token: boolean;
  has_completed_voted?: boolean;
  has_completed_vote: boolean;
  token_issued_at?: string;
  voted_at?: string;
  otp_attempt_count?: number;
  department?: string;
  year?: string;
  created_at: string;
}

export interface VoterRosterResponse {
  election_id: string;
  items: VoterRosterItem[];
  total: number;
  eligible: number;
  received_token: number;
  voted: number;
  page: number;
  page_size: number;
}

export interface BallotLedgerItem {
  ledger_index: number;
  entry_hash: string;
  entry_hash_short?: string;
  token_hash: string;
  token_hash_short?: string;
  prev_hash?: string;
  ballot_fingerprint: string;
  fingerprint_short?: string;
  is_test_ballot: boolean;
  device_type?: string;
  created_at: string;
}

export interface BallotLedgerResponse {
  election_id: string;
  items: BallotLedgerItem[];
  total: number;
  real_ballots: number;
  test_ballots: number;
  page: number;
  page_size: number;
}

export interface EvidenceBundleOut {
  bundle_id: string;
  election_id: string;
  storage_key: string;
  content_type: string;
  summary: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface ReportsEvidenceResponse {
  election_id: string;
  bundles: EvidenceBundleOut[];
  latest_integrity_status?: string | null;
  latest_integrity_executed_at?: string | null;
  audit_event_count: number;
  active_alert_count: number;
}

export async function getAuditEvents(electionId?: string, limit = 50) {
  const params: Record<string, string | number | undefined> = { limit };
  if (electionId) params.election_id = electionId;
  const res = await httpGet<AuditEventListResponse>("/v1/admin/audit", params);
  return res?.events ?? [];
}

export async function verifyAuditChain(electionId?: string) {
  const params: Record<string, string | undefined> = {};
  if (electionId) params.election_id = electionId;
  const res = await httpPost<AuditVerifyResponse>("/v1/admin/audit/verify", params);
  return {
    ok: res?.audit_integrity === "VERIFIED" || res?.ok === true,
    first_bad_id: res?.first_bad_event_id ?? res?.first_bad_id ?? null,
    total_events: res?.total_events ?? 0,
  };
}

export async function getSecurityAlerts(electionId?: string) {
  const params: Record<string, string | undefined> = {};
  if (electionId) params.election_id = electionId;
  const res = await httpGet<SecurityAlertListResponse>("/v1/admin/alerts", params);
  return res?.alerts ?? [];
}

export function runIntegrityCheck(electionId?: string) {
  return httpPost<IntegrityResponse>("/v1/admin/integrity/run", electionId ? { election_id: electionId } : undefined);
}

export function getIntegrityHistory() {
  return httpGet<IntegrityResponse[]>("/v1/admin/integrity/history");
}

export function syncWitness(witnessCode: string, force = false) {
  return httpPost<WitnessSummary>(`/v1/admin/witnesses/${witnessCode}/sync`, { force });
}

export function syncAllWitnesses() {
  return httpPost<WitnessSummary>("/v1/admin/witnesses/sync");
}

export async function closeElection(electionId: string) {
  return httpPost<{ ok: boolean; sth?: SignedTreeHead; success?: boolean; state?: string; voided_tokens?: number; tree_size?: number }>(
    `/v1/admin/elections/${electionId}/close`
  );
}

export async function startTally(electionId: string, shares?: unknown[]) {
  const payload = shares ? { shares } : undefined;
  const res = await httpPost<{ success?: boolean; ok?: boolean; status: ApprovalStatus; session_id?: string }>(
    `/v1/admin/elections/${electionId}/tally/sessions`,
    payload && payload.shares && payload.shares.length ? shares[0] : {}
  );
  return { ok: res?.success ?? res?.ok ?? true, status: res?.status ?? ("pending" as ApprovalStatus) };
}

export async function getTrustees(electionId?: string) {
  if (electionId) {
    const res = await httpGet<TrusteeListResponse>(`/v1/admin/elections/${electionId}/trustees`);
    return res?.trustees ?? [] as TrusteeOut[];
  }
  return httpGet<TrusteeOut[]>("/v1/admin/trustees");
}

export function getTallySessions() {
  return httpGet<TallySessionOut[]>("/v1/admin/tally/sessions");
}

export function approveTally(sessionId: string, body: TallyApprovalRequest) {
  return httpPost<{ ok: boolean; success?: boolean }>(`/v1/admin/tally/sessions/${sessionId}/approve`, body);
}

export function seedDemoVotes(n = 10, electionId?: string) {
  return httpPost<DemoSeedResponse>("/v1/admin/demo/seed", { count: n, n, election_id: electionId });
}

export function runDemoAttack(kind: string, electionId?: string) {
  return httpPost<DemoAttackResponse>("/v1/admin/demo/attack", { scenario: kind.toUpperCase(), kind, election_id: electionId });
}

export function setDemoDevice(on: boolean) {
  return httpPost<DemoDeviceResponse>("/v1/admin/demo/device", { on });
}

export function resetDemo(electionId?: string) {
  return httpPost<DemoResetResponse>("/v1/admin/demo/reset", electionId ? { election_id: electionId } : {});
}

export function listAdminUsers(page = 1, pageSize = 50) {
  return httpGet<AdminUserListResponse>("/v1/admin/users", { page, page_size: pageSize });
}

export function patchAdminUserRoles(userId: string, roles: string[]) {
  return httpPatch<AdminUserOut>(`/v1/admin/users/${userId}/roles`, { roles });
}

export function getVoterRoster(electionId: string, page = 1, pageSize = 50, search?: string, status?: string) {
  const params: Record<string, string | number | undefined> = { page, page_size: pageSize };
  if (search) params.search = search;
  if (status) params.status = status;
  return httpGet<VoterRosterResponse>(`/v1/admin/elections/${electionId}/voters`, params);
}

export function getBallotLedger(electionId: string, page = 1, pageSize = 50) {
  return httpGet<BallotLedgerResponse>(`/v1/admin/elections/${electionId}/ballots`, { page, page_size: pageSize });
}

export function getReportsEvidence(electionId: string) {
  return httpGet<ReportsEvidenceResponse>(`/v1/admin/reports/evidence/${electionId}`);
}

export function getElectionReport(electionId: string) {
  return httpGet<ReportsEvidenceResponse>(`/v1/admin/reports/election/${electionId}`);
}

export function getDemoTrusteeShare(trusteeId: string) {
  return httpGet<{ share_b64: string; share_index: number; success?: boolean }>(`/v1/admin/trustees/share/${trusteeId}`);
}
