import { sha256 } from "./sha";

const LEAF_PREFIX = new Uint8Array([0x00]);
const NODE_PREFIX = new Uint8Array([0x01]);

export async function leafHash(data: Uint8Array): Promise<Uint8Array> {
  const combined = new Uint8Array(LEAF_PREFIX.length + data.length);
  combined.set(LEAF_PREFIX);
  combined.set(data, LEAF_PREFIX.length);
  return sha256(combined);
}

export async function nodeHash(left: Uint8Array, right: Uint8Array): Promise<Uint8Array> {
  const combined = new Uint8Array(NODE_PREFIX.length + left.length + right.length);
  combined.set(NODE_PREFIX);
  combined.set(left, NODE_PREFIX.length);
  combined.set(right, NODE_PREFIX.length + left.length);
  return sha256(combined);
}

export function fromHex(s: string): Uint8Array {
  const m = s.match(/../g);
  return Uint8Array.from(m || [], (h) => parseInt(h, 16));
}

export function hex(u: Uint8Array): string {
  return Array.from(u, (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface InclusionVerifyResult {
  valid: boolean;
  computedRoot: string;
}

export async function verifyInclusionProof(
  leafHex: string,
  index: number,
  size: number,
  pathHex: string[],
  rootHex: string
): Promise<InclusionVerifyResult> {
  if (index < 0 || index >= size) {
    return { valid: false, computedRoot: "" };
  }

  let fn = index;
  let sn = size - 1;
  let r: Uint8Array = fromHex(leafHex);

  for (const p of pathHex) {
    if (sn === 0) return { valid: false, computedRoot: hex(r) };
    const pBytes = fromHex(p);
    if ((fn & 1) || fn === sn) {
      r = await nodeHash(pBytes, r);
      if (!(fn & 1)) {
        while (!(fn & 1) && fn !== 0) {
          fn >>= 1;
          sn >>= 1;
        }
      }
    } else {
      r = await nodeHash(r, pBytes);
    }
    fn >>= 1;
    sn >>= 1;
  }

  const computedRoot = hex(r);
  return { valid: sn === 0 && computedRoot === rootHex.toLowerCase(), computedRoot };
}
