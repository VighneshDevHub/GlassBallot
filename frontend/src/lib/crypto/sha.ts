export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const buf = await crypto.subtle.digest("SHA-256", data.buffer as ArrayBuffer);
  return new Uint8Array(buf);
}

export async function sha256hex(data: Uint8Array): Promise<string> {
  const d = await sha256(data);
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
}
