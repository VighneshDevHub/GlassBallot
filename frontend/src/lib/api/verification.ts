import { httpGet } from "./http";

// ── What the backend /v1/verification/verify actually returns ──────────────
// (backend/app/schemas/verification.py → VerificationResponse)
export interface VerificationResponse {
  success: boolean;
  /** "VERIFIED" | "UNVERIFIED" */
  status: string;
  election_id: string;
  ledger_index: number;
  ballot_fingerprint: string;
  entry_hash: string;
  merkle_root: string;
  tree_size: number;
  inclusion_proof_valid: boolean;
  witnesses_synced: boolean;
  overall_integrity: string;
  disclaimer: string;
}

// ── What the backend /v1/verification/proof/{id} returns ───────────────────
// (backend/app/schemas/verification.py → ProofResponse)
export interface ProofResponse {
  election_id: string;
  ledger_index: number;
  ballot_fingerprint: string;
  entry_hash: string;
  previous_hash: string;
  tree_size: number;
  merkle_root: string;
  sth_signature: string;
  sth_timestamp: number;
  inclusion_path: string[];
  witnesses: Array<{ witness_code: string; status: string; alarm_sticky: boolean }>;
}

export function verifyBallot(fingerprintOrIndex: string | number) {
  const params: Record<string, string | number> = {};
  if (typeof fingerprintOrIndex === "number") {
    params.index = fingerprintOrIndex;
  } else if (/^\d+$/.test(String(fingerprintOrIndex))) {
    params.index = Number(fingerprintOrIndex);
  } else {
    params.fingerprint = fingerprintOrIndex;
  }
  return httpGet<VerificationResponse>("/v1/verification/verify", params);
}

export function getBallotProof(fingerprintOrIndex: string | number) {
  return httpGet<ProofResponse>(`/v1/verification/proof/${fingerprintOrIndex}`);
}
