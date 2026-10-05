import { httpGet, httpPatch, httpPost } from "./http";

export interface OtpRequest {
  voter_id: string;
  voter_external_id?: string;
  election_id?: string;
}

export interface OtpResponse {
  success: boolean;
  message: string;
}

export interface OtpVerifyRequest {
  voter_id: string;
  voter_external_id?: string;
  otp: string;
  otp_code?: string;
  election_id?: string;
}

export interface OtpVerifyResponse {
  success: boolean;
  voter_session_token?: string;
  voter_external_id?: string;
  election_id?: string;
}

export interface DemoInboxResponse {
  otp?: string | null;
  inbox?: Record<string, string>;
}

export interface AdminLoginRequest {
  username_or_email?: string;
  username?: string;
  password: string;
}

export interface AdminLoginResponse {
  success?: boolean;
  user_id?: string;
  username?: string;
  email?: string;
  roles?: string[];
}

export interface AdminLogoutResponse {
  success: boolean;
}

export interface AdminMeResponse {
  user_id?: string | null;
  username?: string | null;
  email?: string | null;
  roles: string[];
  authenticated: boolean;
}

export interface AdminProfileUpdate {
  email?: string;
  username?: string;
  preferences?: Record<string, unknown>;
}

export interface RegisterVoterRequest {
  student_id: string;
  display_name: string;
  email: string;
  department: string;
  year_of_study: string;
  election_id?: string;
}

export interface RegisterVoterResponse {
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

export function requestOtp(body: OtpRequest) {
  return httpPost<OtpResponse>("/v1/auth/otp/request", body);
}

export function verifyOtp(body: OtpVerifyRequest) {
  return httpPost<OtpVerifyResponse>("/v1/auth/otp/verify", body);
}

export function getDemoInbox(voterId: string) {
  return httpGet<DemoInboxResponse>("/v1/auth/demo/inbox", { voter_id: voterId });
}

export const requestOTP = requestOtp;
export const verifyOTP = verifyOtp;

export async function requestDemoOTP(voterId: string) {
  const res = await getDemoInbox(voterId);
  return { otp: res?.otp ?? null, inbox: res?.inbox ?? {} };
}

export function registerVoter(body: RegisterVoterRequest) {
  const payload = {
    election_id: body.election_id ?? undefined,
    voter_external_id: body.student_id,
    display_name: body.display_name,
    course: body.department || null,
    year: body.year_of_study || null,
    email: body.email || null,
  };
  return httpPost<RegisterVoterResponse>("/v1/auth/register", payload);
}

export function adminLogin(body: AdminLoginRequest) {
  return httpPost<AdminLoginResponse>("/v1/admin/login", body);
}

export function adminLogout() {
  return httpPost<AdminLogoutResponse>("/v1/admin/logout");
}

export function adminMe() {
  return httpGet<AdminMeResponse>("/v1/admin/me");
}

export function patchAdminMe(body: AdminProfileUpdate) {
  return httpPatch<AdminMeResponse>("/v1/admin/me", body);
}
