import { UploadCard } from "@/components/dashboard/upload-card";

export default function UploadPage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-zinc-100">
      <div className="mx-auto w-full max-w-2xl px-4 py-12 lg:py-16">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
            New scan
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Upload an Nmap XML file to parse and analyse your attack surface.
          </p>
          <p className="mx-auto mt-3 inline-block rounded-md bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100">
            nmap -sC -sV -oX scan.xml &lt;target&gt;
          </p>
        </div>
        <UploadCard />
      </div>
    </main>
  );
}
