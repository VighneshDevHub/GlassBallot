import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "GlassBallot — Transparent to verify. Private to vote.",
  description:
    "Production-quality prototype for low-stakes college/student elections. Independent security audit required before real-world deployment.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${manrope.variable}`}>
      <body className="min-h-screen bg-[#F5F5F4] text-[#202124] font-sans antialiased">
        <main className="min-h-screen">{children}</main>
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
