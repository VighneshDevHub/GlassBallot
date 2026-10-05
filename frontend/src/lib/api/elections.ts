import { httpGet, httpPost } from "./http";
import type { SignedTreeHead } from "./voting";

export type ElectionState =
  | "DRAFT"
  | "SETUP"
  | "OPEN"
  | "FROZEN"
  | "DECRYPTING"
  | "CLOSED"
  | "TALLYING"
  | "PUBLISHED"
  | "COMPLETED"
  | "ARCHIVED";

export interface CandidateOut {
  id: string;
  candidate_code: string;
  display_name: string;
  /** alias — backend returns both "name" and "display_name" */
  name?: string;
  statement?: string | null;
  sort_order: number;
  department?: string | null;
  avatar_url?: string | null;
}

export interface ElectionOut {
  id?: string;
  public_id: string;
  title: string;
  college_name?: string;
  description?: string | null;
  state: ElectionState;
  opens_at?: string | null;
  closes_at?: string | null;
  tally_completed_at?: string | null;
  election_public_key_b64?: string;
  public_key_b64?: string;
  sth_public_key_b64?: string;
  candidates: CandidateOut[];
  created_at?: string;
  updated_at?: string;
}

export interface ElectionSummary {
  id: string;
  public_id: string;
  title: string;
  state: ElectionState;
  college_name?: string;
  description?: string | null;
  public_key_b64?: string;
  created_at: string;
  candidates?: CandidateOut[];
  opens_at?: string | null;
  closes_at?: string | null;
}

export interface ElectionListResponse {
  success: boolean;
  elections: ElectionSummary[];
}

export interface ElectionConfigResponse {
  success?: boolean;
  election?: ElectionOut | null;
  state: ElectionState;
  election_pub: string;
  sth_pub: string;
  demo: boolean;
  threshold: number;
  trustees: number;
}

export interface WitnessOut {
  witness_code: string;
  owner_name?: string;
  status: "ok" | "waiting" | "alarm";
  last_accepted_size: number;
  last_accepted_root?: string | null;
  last_signature_b64?: string | null;
  last_synced_at?: string | null;
  alarm_sticky: boolean;
  last_message?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TallyResultOut {
  candidate_code: string;
  candidate_name?: string | null;
  vote_total: number;
}

export interface PublishedResults {
  success?: boolean;
  published: boolean;
  election_id?: string | null;
  state?: ElectionState;
  counts: Record<string, number>;
  results?: Record<string, unknown> | null;
  total: number;
  total_ballots?: number;
  candidates?: CandidateOut[];
  ledger_entries: number;
  matches_ledger: boolean;
  shuffled_choices: string[];
  spoiled_count: number;
  failed_count: number;
  merkle_root?: string | null;
  witness_summary?: WitnessSummary | null;
  sth?: SignedTreeHead | null;
  message?: string;
}

export interface WitnessSummary {
  total: number;
  synced: number;
  alarmed: number;
  waiting: number;
}

export interface CheckResult {
  name: string;
  /** Backend sends "PASS" | "FAIL" */
  status: "PASS" | "FAIL";
  /** Convenience alias — derived from status */
  passed?: boolean;
  details: string | Record<string, unknown>;
}

export interface ReconciliationResponse {
  /** "PASS" | "FAIL" from the backend */
  status: string;
  /** Convenience alias — true when status === "PASS" */
  ok?: boolean;
  voters_marked: number;
  ballots_recorded: number;
  tokens_issued?: number;
  tokens_used?: number;
  tokens_void?: number;
  /** Legacy alias for tokens_void */
  pending?: number;
  /** "issues" is the field the backend actually sends */
  issues?: string[];
  /** Legacy alias */
  problems?: string[];
}

export type IntegrityStatusValue = "VERIFIED" | "COMPROMISED" | "PENDING";

export interface IntegrityResponse {
  status: IntegrityStatusValue;
  checks: CheckResult[];
  first_failed_check?: string | null;
  entries: number;
  merkle_root?: string | null;
  reconciliation?: ReconciliationResponse | null;
  witness_summary?: WitnessSummary | null;
  evidence_bundle_id?: string | null;
  frozen: boolean;
  executed_at?: string | null;
}

export interface ElectionStatsResponse {
  election_id: string;
  eligible_voters: number;
  registered_voters: number;
  received_tokens: number;
  cast_ballots: number;
  total_cast: number;
  spoiled_test_ballots: number;
  turnout_percent: number;
  integrity_pct: number;
  state: string;
  opens_at?: string | null;
  closes_at?: string | null;
  tally_completed_at?: string | null;
  by_hour_last_7d: Array<{ hour: string; count: number }>;
}

export interface ByHourBucket {
  hour: string;
  count: number;
}

export interface BallotCountsResponse {
  total: number;
  last_24h: number;
  by_hour_last_7d: ByHourBucket[];
}

export interface MilestoneItem {
  key: string;
  label: string;
  status: "PENDING" | "CURRENT" | "DONE";
  timestamp?: string | null;
  description?: string | null;
}

export interface MilestonesResponse {
  election_id: string;
  items: MilestoneItem[];
}

export async function listElections(scope?: "me" | string) {
  const res = await httpGet<ElectionListResponse>("/v1/elections", scope ? { scope } : undefined);
  return res?.elections ?? [];
}

export async function getElectionDetail(id: string) {
  const res = await httpGet<{ success: boolean; election: ElectionOut }>(`/v1/elections/${id}`);
  return res?.election as ElectionOut;
}

export async function getElectionIntegrity(id: string) {
  return httpGet<IntegrityResponse>(`/v1/elections/${id}/integrity`);
}

export async function getElectionWitnesses(id: string): Promise<WitnessOut[]> {
  const res = await httpGet<{ success: boolean; witnesses: WitnessOut[] }>(
    `/v1/elections/${id}/witnesses`
  );
  // Backend returns { success, witnesses: [...] } — not an Envelope
  if (res && Array.isArray((res as any).witnesses)) {
    return (res as any).witnesses as WitnessOut[];
  }
  // Fallback: maybe it came back as a plain array via the proxy
  if (Array.isArray(res)) return res as unknown as WitnessOut[];
  return [];
}

export async function getElectionResults(id?: string) {
  const path = id ? `/v1/elections/${id}/results` : "/v1/elections/results";
  return httpGet<PublishedResults>(path);
}

export async function getElectionConfig(id?: string) {
  return httpGet<ElectionConfigResponse>("/v1/elections/config", id ? { id } : undefined);
}

export function getElectionStats(electionId: string) {
  return httpGet<ElectionStatsResponse>(`/v1/elections/${electionId}/stats`);
}

export function getElectionMilestones(electionId: string) {
  return httpGet<MilestonesResponse>(`/v1/elections/${electionId}/milestones`);
}

export function getBallotCounts(electionId: string) {
  return httpGet<BallotCountsResponse>(`/v1/admin/elections/${electionId}/ballots/counts`);
}

// ── Create Election ──────────────────────────────────────────────────────────

export interface CandidateCreate {
  name: string;
  party_or_tag?: string;
  department?: string;
  avatar_url?: string;
}

export interface ElectionCreateRequest {
  public_id: string;
  title: string;
  description?: string;
  /** Base-64 encoded P-256 public key — generated by the browser via Web Crypto */
  public_key_b64: string;
  candidates: CandidateCreate[];
}

export interface ElectionCreateResponse {
  success: boolean;
  election_id: string;
}

export async function createElection(payload: ElectionCreateRequest): Promise<ElectionCreateResponse> {
  const res = await httpPost<ElectionCreateResponse>("/v1/elections", payload);
  return res;
}
