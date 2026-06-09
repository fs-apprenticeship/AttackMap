import { ShieldCheck, ScanLine, Brain, FileText } from "lucide-react";
import { HomeCTA } from "@/components/home-cta";

export default function LandingPage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-zinc-100">
      <div className="mx-auto w-full max-w-3xl px-4 py-20 lg:py-28">

        <div className="flex flex-col items-center text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-md">
            <ShieldCheck className="size-8" />
          </div>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
            AttackMap
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-7 text-zinc-500">
            Upload an Nmap scan and get an instant breakdown of your attack surface — hosts, services, findings, and AI-powered remediation in one place.
          </p>

          <div className="mt-8 flex items-center gap-3">
            <HomeCTA />
          </div>

          <p className="mt-4 font-mono text-xs text-zinc-400">
            nmap -sC -sV -oX scan.xml &lt;target&gt;
          </p>
        </div>

        <div className="mt-20 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex size-10 items-center justify-center rounded-md bg-zinc-100">
              <ScanLine className="size-5 text-zinc-700" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-zinc-950">Parse & visualize</h3>
            <p className="mt-1 text-sm leading-6 text-zinc-500">
              Upload any Nmap XML file and instantly see every host, open port, service, and OS in a structured dashboard.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex size-10 items-center justify-center rounded-md bg-zinc-100">
              <Brain className="size-5 text-zinc-700" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-zinc-950">AI analysis</h3>
            <p className="mt-1 text-sm leading-6 text-zinc-500">
              Get an AI-generated executive summary of your scan with a risk score and prioritised findings.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex size-10 items-center justify-center rounded-md bg-zinc-100">
              <FileText className="size-5 text-zinc-700" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-zinc-950">Remediation plans</h3>
            <p className="mt-1 text-sm leading-6 text-zinc-500">
              Generate a step-by-step remediation plan with commands and verification steps tailored to your environment.
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
