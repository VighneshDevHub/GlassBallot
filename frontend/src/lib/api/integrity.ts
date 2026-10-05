import { httpGet, httpPost } from "./http";
import type { IntegrityResponse, CheckResult } from "./elections";

export function getIntegrityStatus() {
  return httpGet<IntegrityResponse>("/v1/integrity/status");
}

export function getIntegrityChecks() {
  return httpGet<CheckResult[]>("/v1/integrity/checks");
}

export function runIntegrity() {
  return httpPost<IntegrityResponse>("/v1/integrity/run");
}
