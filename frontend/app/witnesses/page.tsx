"use client";

import { useEffect, useState } from "react";
import { getElectionConfig, getElectionWitnesses, WitnessOut, ElectionConfigResponse } from "@/lib/api/elections";
import { syncAllWitnesses, syncWitness } from "@/lib/api/admin";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { shortHash } from "@/lib/utils";
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  KeyRound,
} from "lucide-react";

export default function WitnessesPage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [config, setConfig] = useState<ElectionConfigResponse | null>(null);
  const [witnesses, setWitnesses] = useState<WitnessOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadWitnesses = async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await getElectionConfig();
      setConfig(cfg);
      if (cfg.election?.id) {
        const list = await getElectionWitnesses(cfg.election.id);
        // Ensure we always store an array regardless of API shape
        setWitnesses(Array.isArray(list) ? list : []);
      } else {
        setWitnesses([]);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Failed to load candidate witnesses.");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      await syncAllWitnesses();
      await loadWitnesses();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Failed to sync witness nodes.");
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncOne = async (code: string) => {
    try {
      await syncWitness(code, true);
      await loadWitnesses();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || `Failed to sync witness ${code}`);
    }
  };

  useEffect(() => {
    loadWitnesses();
  }, []);

  if (loading) {
    return (
      <PublicLayout>
        <section className="min-h-[calc(100vh-80px)] py-10 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-9 w-72" />
                <Skeleton className="h-4 w-[480px]" />
              </div>
              <Skeleton className="h-9 w-44" />
            </div>
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        </section>
      </PublicLayout>
    );
  }

  const hasAlarm = witnesses.some((w) => w.alarm_sticky || w.status === "alarm");

  return (
    <PublicLayout>
      <section className="min-h-[calc(100vh-80px)] py-10 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <Badge variant="outline" className="bg-[#DAF39F]/20 text-[#3E5A0E] border-[#DAF39F] rounded-full px-3 py-1">
                <Users className="w-4 h-4 mr-1.5 inline text-[#3E5A0E]" /> Independent Witness Audit Protocol
              </Badge>
              <h1 className="text-3xl font-bold text-[#243056]">Candidate Witness Monitor</h1>
              <p className="text-[#5C7089] text-sm max-w-xl">
                Candidate polling agents independently verify that the Merkle tree only grows append-only and history is never rewritten.
              </p>
            </div>

            <Button variant="outline" size="sm" onClick={handleSyncAll} disabled={syncing} className="rounded-full">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
              Force Sync All Witnesses
            </Button>
          </div>

          {error && (
            <Alert variant="destructive" className="rounded-2xl">
              <AlertTriangle className="h-4 h-4" />
              <AlertTitle>Witness Sync Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {hasAlarm && (
            <Alert variant="destructive" className="border-2 border-[#E05252] pastel-peach text-[#202124] rounded-2xl">
              <ShieldAlert className="h-5 w-5 text-[#E05252]" />
              <AlertTitle className="text-lg font-bold">STICKY WITNESS ALARM ACTIVATED!</AlertTitle>
              <AlertDescription className="text-sm mt-1">
                One or more witness nodes detected an invalid STH signature or illegal ledger rewrite. Sticky alarms cannot be silently reset without producing a cryptographic evidence bundle.
              </AlertDescription>
            </Alert>
          )}

          <Card className="border-[#C6E6FA] pastel-sky shadow-card rounded-2xl">
            <CardContent className="pt-6 space-y-3 text-xs text-[#202124]">
              <div className="flex items-center gap-2 text-sm font-bold text-[#243056]">
                <ShieldCheck className="w-4 h-4 text-[#243056]" /> How Candidate Witnessing Works
              </div>
              <p className="text-[#5C7089]">
                1. Every candidate appoints an independent witness node holding an Ed25519 public key.
                <br />
                2. When a new Signed Tree Head (STH) is published, the witness verifies:
                <br />
                &nbsp;&nbsp;&bull; The signature is valid.
                <br />
                &nbsp;&nbsp;&bull; The new tree size is greater than or equal to the previous size.
                <br />
                &nbsp;&nbsp;&bull; RFC 6962 consistency proof proves the new root extends the old root.
                <br />
                3. If any check fails, the witness node immediately enters <strong>STICKY ALARM</strong> status.
              </p>
            </CardContent>
          </Card>

          <Card className="border-[#EAEAE5] shadow-card rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-[#243056]">Registered Witness Nodes</CardTitle>
              <CardDescription className="text-xs text-[#5C7089]">
                Live observation logs for candidate and institutional observers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Witness</TableHead>
                    <TableHead>Owner / Party</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Accepted Size</TableHead>
                    <TableHead>Latest Accepted Root</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {witnesses.map((w) => (
                    <TableRow key={w.witness_code}>
                      <TableCell className="font-mono text-xs font-bold text-[#243056]">
                        {w.witness_code}
                      </TableCell>
                      <TableCell className="text-sm text-[#5C7089]">{w.owner_name}</TableCell>
                      <TableCell>
                        {w.status === "alarm" || w.alarm_sticky ? (
                          <Badge variant="destructive" className="bg-[#E05252] font-bold rounded-full">
                            <XCircle className="w-3 h-3 mr-1 inline" /> ALARM
                          </Badge>
                        ) : w.status === "ok" ? (
                          <Badge variant="default" className="bg-[#3E5A0E] rounded-full">
                            <CheckCircle2 className="w-3 h-3 mr-1 inline" /> OK
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[#E07A24] border-[#FFD6BA] rounded-full">
                            WAITING
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{w.last_accepted_size} entries</TableCell>
                      <TableCell className="font-mono text-xs text-[#5C7089]">
                        {w.last_accepted_root ? shortHash(w.last_accepted_root, 16) : "None"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleSyncOne(w.witness_code)} className="rounded-full">
                          Sync Node
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </section>
    </PublicLayout>
  );
}
