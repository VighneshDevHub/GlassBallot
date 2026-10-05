import { httpGet, httpPatch, httpPost } from "./http";

export interface VoterProfileResponse {
  voter_id: string;
  election_id: string;
  voter_external_id: string;
  display_name: string;
  is_eligible: boolean;
  has_received_token: boolean;
  has_completed_vote: boolean;
  course?: string | null;
  year?: string | null;
  email?: string | null;
  created_at: string;
}

export interface VoterProfileUpdate {
  display_name?: string;
  course?: string | null;
  year?: string | null;
  email?: string | null;
}

export interface VoterSettingsResponse {
  email_notifications: boolean;
  sms_notifications: boolean;
  dark_mode: boolean;
  compact_view: boolean;
  accessibility_high_contrast: boolean;
  accessibility_reduced_motion: boolean;
  language: string;
}

export type VoterSettingsUpdate = Partial<VoterSettingsResponse>;

export interface ActivityItem {
  id: string;
  timestamp: string;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  summary: string;
  metadata: Record<string, unknown>;
}

export interface ActivityListResponse {
  items: ActivityItem[];
  total: number;
}

export interface ReceiptItem {
  receipt_id: string;
  kind: "ballot_token" | "cast_ballot" | "test_ballot" | "spoiled_test";
  election_id: string;
  election_title: string;
  issued_at: string;
  fingerprint?: string | null;
  token_tail?: string | null;
  summary: string;
  verified: boolean;
  details: Record<string, unknown>;
}

export interface ReceiptListResponse {
  items: ReceiptItem[];
  total: number;
}

export function getVoterMe() {
  return httpGet<VoterProfileResponse>("/v1/voter/me");
}

export function patchVoterMe(body: VoterProfileUpdate) {
  return httpPatch<VoterProfileResponse>("/v1/voter/me", body);
}

export function getVoterSettings() {
  return httpGet<VoterSettingsResponse>("/v1/voter/me/settings");
}

export function patchVoterSettings(body: VoterSettingsUpdate) {
  return httpPatch<VoterSettingsResponse>("/v1/voter/me/settings", body);
}

export function getVoterActivity(limit = 25, page = 1) {
  return httpGet<ActivityListResponse>("/v1/voter/me/activity", { limit, page });
}

export function getVoterReceipts(limit = 20) {
  return httpGet<ReceiptListResponse>("/v1/voter/me/receipts", { limit });
}

export function voterLogout() {
  return httpPost<{ ok: boolean; message?: string }>("/v1/voter/logout");
}
