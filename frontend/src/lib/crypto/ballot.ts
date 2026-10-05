import { b64d, b64e, cat, randHex } from "@/lib/utils";
import { sha256 } from "./sha";

export interface BallotPayload {
  v: number;
  eph: string;
  iv: string;
  ct: string;
}

export interface SealedBallot {
  ballot: BallotPayload;
  ephD: string;
}

const PAD = 96;
const DOMAIN = new TextEncoder().encode("glassballot-v1");

function parseX962Uncompressed(pubRaw: Uint8Array): Promise<CryptoKey> {
  if (pubRaw.length !== 65 || pubRaw[0] !== 4) {
    throw new Error("Invalid X9.62 uncompressed public key");
  }
  return crypto.subtle.importKey(
    "raw",
    pubRaw.buffer as ArrayBuffer,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
}

export async function sealBallot(
  electionPubKeyB64: string,
  electionId: string,
  choice: string
): Promise<SealedBallot> {
  const s = crypto.subtle;

  const pubRaw = b64d(electionPubKeyB64);
  const peerPub = await parseX962Uncompressed(pubRaw);

  const ephKeypair = await s.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const shared = new Uint8Array(
    await s.deriveBits({ name: "ECDH", public: peerPub }, ephKeypair.privateKey, 256)
  );

  const ephPubBytes = new Uint8Array(await s.exportKey("raw", ephKeypair.publicKey));

  const keyBytes = await sha256(cat(DOMAIN, shared, ephPubBytes));

  const aesKey = await s.importKey("raw", keyBytes.buffer as ArrayBuffer, "AES-GCM", false, ["encrypt"]);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const nonce = randHex(8);

  const ptStr = JSON.stringify({ c: choice, n: nonce }).padEnd(PAD, " ");
  const ptBytes = new TextEncoder().encode(ptStr);

  const aad = new TextEncoder().encode(electionId);

  const ctWithTag = new Uint8Array(
    await s.encrypt({ name: "AES-GCM", iv, additionalData: aad }, aesKey, ptBytes.buffer as ArrayBuffer)
  );

  const jwk = await s.exportKey("jwk", ephKeypair.privateKey);
  const ephD = (jwk as { d?: string }).d || "";

  return {
    ballot: {
      v: 1,
      eph: b64e(ephPubBytes),
      iv: b64e(iv),
      ct: b64e(ctWithTag),
    },
    ephD,
  };
}

export function ballotFingerprintCanonical(ballot: BallotPayload): string {
  const c: BallotPayload = { v: ballot.v, eph: ballot.eph, iv: ballot.iv, ct: ballot.ct };
  const keys = Object.keys(c).sort() as (keyof BallotPayload)[];
  const parts = keys.map((k) => JSON.stringify(k) + ":" + JSON.stringify(c[k]));
  return "{" + parts.join(",") + "}";
}

export async function fingerprintBallot(ballot: BallotPayload): Promise<string> {
  const canonical = ballotFingerprintCanonical(ballot);
  const d = await sha256(new TextEncoder().encode(canonical));
  const full = Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
  return full.slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}
