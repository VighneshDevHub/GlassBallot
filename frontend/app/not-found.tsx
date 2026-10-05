import Link from "next/link";
import { ShieldAlert, Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F5F5F4] flex items-center justify-center py-16 px-4">
      <div className="max-w-md w-full text-center space-y-6 bg-white p-8 rounded-3xl border border-[#EAEAE5] shadow-card">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#DAF39F] to-[#C6E66C] flex items-center justify-center mx-auto shadow-soft">
          <ShieldAlert className="w-8 h-8 text-[#202124]" />
        </div>

        <div className="space-y-2">
          <div className="text-xs font-mono font-bold text-[#5C7089] uppercase tracking-widest">
            Error 404
          </div>
          <h1 className="text-2xl font-extrabold text-[#202124]">Page Not Found</h1>
          <p className="text-sm text-[#5C7089] leading-relaxed">
            The requested election page or ballot record could not be found in the current route ledger.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
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
          <Button
            asChild
            className="rounded-full h-11 bg-[#DAF39F] hover:bg-[#C6E66C] text-[#202124] font-bold text-sm shadow-soft"
          >
            <Link href="/verify" className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              Public Verifier
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
