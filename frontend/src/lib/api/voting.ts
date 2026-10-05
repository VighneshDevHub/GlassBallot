import { httpGet, httpPost } from "./http";

export interface BallotPayload {
  v: number;
  eph: string;
  iv: string;
  ct: string;
  [key: string]: unknown;
}

export interface VotingTokenRequest {
  election_id?: string | null;
}

export interface VotingTokenResponse {
  success?: boolean;
  token: string;
  ballot_token?: string;
  election_id?: string;
  issued: boolean;
}

export interface BallotSpoilRequest {
  ballot?: BallotPayload;
  ciphertext_payload?: BallotPayload;
  eph_d?: string;
  ephemeral_priv_b64?: string;
  claimed_choice?: string;
  ballot_token?: string;
  election_id?: string;
  [key: string]: unknown;
}

export interface BallotSpoilResponse {
  success?: boolean;
  ok: boolean;
  match?: boolean;
  claimed: string;
  claimed_choice?: string;
  revealed: string;
  revealed_choice?: string;
  fingerprint: string;
  ballot_fingerprint?: string;
  message?: string;
}

export interface BallotCastRequest {
  token?: string;
  ballot_token?: string;
  ballot?: BallotPayload;
  ciphertext_payload?: BallotPayload;
  voter_session_token?: string;
  election_id?: string;
  [key: string]: unknown;
}

export interface SignedTreeHead {
  election: string;
  size: number;
  root: string;
  ts: number;
  sig: string;
  [key: string]: unknown;
}

export interface BallotReceipt {
  index: number;
  entry_hash: string;
  merkle_root: string;
  tree_size: number;
  fingerprint: string;
}

export interface BallotCastResponse {
  success?: boolean;
  index: number;
  ledger_index?: number;
  entry_hash: string;
  sth: SignedTreeHead;
  election_id: string;
  ballot_fingerprint: string;
  proof_card_url?: string;
  proof_card_id?: string;
  receipt?: BallotReceipt;
}

export function getToken(body: VotingTokenRequest) {
  return httpPost<VotingTokenResponse>("/v1/voting/token", body);
}

export const getVotingToken = getToken;

export function testBallot(body: BallotSpoilRequest) {
  return httpPost<BallotSpoilResponse>("/v1/voting/ballots/test", body);
}

export const spoilBallot = testBallot;

export function castBallot(body: BallotCastRequest) {
  return httpPost<BallotCastResponse>("/v1/voting/ballots/cast", body);
}
