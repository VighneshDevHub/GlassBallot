import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function b64e(u: Uint8Array): string {
  return btoa(String.fromCharCode(...u));
}

export function b64d(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export function hex(u: Uint8Array): string {
  return Array.from(u, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function fromHex(s: string): Uint8Array {
  const m = s.match(/../g);
  return Uint8Array.from(m || [], (h) => parseInt(h, 16));
}

export function cat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const a of arrs) {
    out.set(a, p);
    p += a.length;
  }
  return out;
}

export function shortHash(h: string, n = 12): string {
  return h ? h.slice(0, n) + "\u2026" : "";
}

export function shortFingerprint(fp: string): string {
  return "GB-" + fp.slice(0, 12).toUpperCase().replace(/(.{4})/g, "$1-").replace(/-$/, "");
}

export function randHex(n: number): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return hex(bytes);
}
