"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F5F5F4] flex items-center justify-center py-16 px-4">
      <div className="max-w-md w-full text-center space-y-6 bg-white p-8 rounded-3xl border border-[#EAEAE5] shadow-card">
        <div className="w-16 h-16 rounded-2xl bg-[#FFE5E5] border border-[#E05252]/30 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-[#E05252]" />
        </div>

        <div className="space-y-2">
          <div className="text-xs font-mono font-bold text-[#E05252] uppercase tracking-widest">
            Application Error
          </div>
          <h1 className="text-2xl font-extrabold text-[#202124]">Something Went Wrong</h1>
          <p className="text-sm text-[#5C7089] leading-relaxed">
            {error.message || "An unexpected error occurred while loading this view."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button
            onClick={() => reset()}
            className="rounded-full h-11 bg-[#DAF39F] hover:bg-[#C6E66C] text-[#202124] font-bold text-sm shadow-soft flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-full h-11 border-[#EAEAE5] font-bold text-sm hover:shadow-card"
          >
            <Link href="/" className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
