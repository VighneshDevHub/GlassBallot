"use client";

import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { shortFingerprint, shortHash } from "@/lib/utils";
import { Printer, Download, ArrowRight, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export interface ProofCardData {
  election_id: string;
  election_title?: string;
  ledger_index: number;
  ballot_fingerprint: string;
  entry_hash: string;
  tree_size: number;
  merkle_root: string;
  timestamp: number;
}

export function ProofCard({
  data,
  showActions = true,
}: {
  data: ProofCardData;
  showActions?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const fp = shortFingerprint(data.ballot_fingerprint || data.entry_hash);
  const verifyUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/verify/${data.ballot_fingerprint || data.ledger_index}`;

  const qrPayload = JSON.stringify({
    e: data.election_id,
    i: data.ledger_index,
    f: data.ballot_fingerprint,
    s: data.tree_size,
    r: data.merkle_root,
    u: verifyUrl,
  });

  const dateStr = new Date(data.timestamp * 1000).toLocaleString();

  // ── Print ONLY the card via a hidden iframe ────────────────────────────────
  const handlePrint = () => {
    const cardEl = cardRef.current;
    if (!cardEl) return;

    // Grab the card's inner HTML + inline all computed styles needed for the card
    const cardHtml = cardEl.outerHTML;

    // Collect all <style> and <link rel="stylesheet"> from the current page
    const styleLinks: string[] = [];
    document.querySelectorAll('link[rel="stylesheet"]').forEach((el) => {
      styleLinks.push(el.outerHTML);
    });
    document.querySelectorAll("style").forEach((el) => {
      styleLinks.push(`<style>${el.innerHTML}</style>`);
    });

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;border:0;visibility:hidden;";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>GlassBallot Proof Card — Ledger #${data.ledger_index}</title>
  ${styleLinks.join("\n")}
  <style>
    @page { size: A5; margin: 10mm; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
  </style>
</head>
<body>
  ${cardHtml}
</body>
</html>`);
    doc.close();

    // Wait for fonts + images to load then print
    const win = iframe.contentWindow;
    if (!win) { document.body.removeChild(iframe); return; }

    win.onload = () => {
      setTimeout(() => {
        win.focus();
        win.print();
        // Remove iframe after print dialog closes
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 300);
    };
  };

  // ── Download proof as JSON ─────────────────────────────────────────────────
  const handleDownload = () => {
    const payload = {
      version: "glassballot-proof-v1",
      generated_at: new Date().toISOString(),
      election_id: data.election_id,
      election_title: data.election_title,
      ledger_index: data.ledger_index,
      ballot_fingerprint: data.ballot_fingerprint,
      entry_hash: data.entry_hash,
      tree_size: data.tree_size,
      merkle_root: data.merkle_root,
      recorded_at: dateStr,
      verify_url: verifyUrl,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `glassballot-proof-ledger-${data.ledger_index}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6 items-center">
      {/* ── The card itself ── */}
      <div
        ref={cardRef}
        className="proof-card-print-target"
        style={{
          width: 320,
          maxWidth: "100%",
          boxSizing: "border-box",
          background: "linear-gradient(135deg, #ffffff 0%, #f8faff 100%)",
          border: "8px solid #243056",
          borderRadius: 24,
          padding: 20,
          boxShadow: "0 8px 32px rgba(36,48,86,0.15)",
          display: "flex",
          flexDirection: "column",
          gap: 0,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "#DAF39F", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Lock size={14} color="#202124" strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#3E5A0E", textTransform: "uppercase" }}>
              GlassBallot
            </span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#202124", letterSpacing: "-0.5px" }}>
            Proof Card
          </div>
          {data.election_title && (
            <div style={{ fontSize: 12, color: "#5C7089", marginTop: 2, lineHeight: 1.3 }}>
              {data.election_title}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 3, borderRadius: 4, background: "linear-gradient(90deg, #243056, #DAF39F, #1F5689)", marginBottom: 16 }} />

        {/* Data rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          {[
            { label: "Ledger Position", value: `#${data.ledger_index}`, big: true },
            { label: "Fingerprint", value: fp, mono: true },
            { label: "Tree Size", value: `${data.tree_size} ballots` },
            { label: "Merkle Root", value: shortHash(data.merkle_root, 16), mono: true },
            { label: "Recorded", value: dateStr },
          ].map(({ label, value, big, mono }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "#9AA7B8", whiteSpace: "nowrap" }}>{label}</span>
              <span style={{
                fontSize: big ? 18 : mono ? 10 : 12,
                fontWeight: big ? 900 : 600,
                color: big ? "#243056" : "#202124",
                fontFamily: mono ? "monospace" : "inherit",
                textAlign: "right",
                wordBreak: "break-all",
              }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* QR code */}
        <div style={{
          marginTop: 14,
          background: "white",
          borderRadius: 16,
          padding: 12,
          border: "1px solid #EAEAE5",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}>
          <QRCodeSVG value={qrPayload} size={150} level="L" includeMargin={false} />
          <span style={{ fontSize: 9, color: "#9AA7B8", textAlign: "center", lineHeight: 1.4 }}>
            Scan to verify inclusion on the public ledger
          </span>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #EAEAE5", textAlign: "center" }}>
          <span style={{ fontSize: 9, color: "#9AA7B8", lineHeight: 1.4 }}>
            This card proves ledger inclusion only.
            <br />It does NOT reveal your candidate choice or identity.
          </span>
        </div>
      </div>

      {/* ── Action buttons (outside the printable card) ── */}
      {showActions && (
        <div className="flex flex-wrap gap-2 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="rounded-full border-[#EAEAE5] font-bold text-sm hover:shadow-card"
          >
            <Printer className="w-4 h-4 mr-1.5" /> Print Card
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="rounded-full border-[#EAEAE5] font-bold text-sm hover:shadow-card"
          >
            <Download className="w-4 h-4 mr-1.5" /> Download JSON
          </Button>
          <Button
            size="sm"
            asChild
            className="rounded-full bg-[#243056] hover:bg-[#1A2340] text-white font-bold text-sm shadow-soft"
          >
            <Link href={`/verify/${data.ballot_fingerprint || data.ledger_index}`}>
              <ShieldCheck className="w-4 h-4 mr-1.5 text-[#DAF39F]" /> Verify Online
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
