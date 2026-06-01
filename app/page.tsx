"use client";

import Link from "next/link";

import { UploadCard } from "@/components/dashboard/upload-card";
import { ScanCard } from "@/components/scans/scan-card";
import { useScans } from "@/lib/scans/use-scans";

export default function Home() {
  const { scans, loading } = useScans();
  const recent = scans.slice(0, 3);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-zinc-100 text-zinc-950">
      <div className="mx-auto w-full max-w-2xl px-4 py-12 lg:py-16">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Map your attack surface
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-600">
            Upload an Nmap XML scan to parse hosts, ports, and services into an
            interactive security dashboard.
          </p>
          <p className="mx-auto mt-4 inline-block rounded-md bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100">
            nmap -sC -sV -oX scan.xml &lt;target&gt;
          </p>
        </div>

        <div className="mt-8">
          <UploadCard />
        </div>

        <p className="mt-4 text-center text-xs text-zinc-500">
          Scans are analyzed on the server and cached in your browser. Nothing is
          stored remotely.
        </p>

        {!loading && recent.length > 0 ? (
          <section className="mt-12">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Recent scans
              </h2>
              <Link
                href="/scans"
                className="text-sm font-medium text-zinc-700 underline-offset-4 hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="mt-3 space-y-3">
              {recent.map((scan) => (
                <ScanCard key={scan.id} scan={scan} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
