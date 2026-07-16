import { UploadCard } from "@/features/upload/upload-card";
import { triggerOpportunisticReconcile } from "@/lib/scans/reconcile-trigger";

export default function UploadPage() {
  triggerOpportunisticReconcile();

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto w-full max-w-2xl px-4 py-12 lg:py-16">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            New scan
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload an Nmap XML file to parse and analyse your attack surface.
          </p>
          <p className="mx-auto mt-3 inline-block rounded-md bg-primary px-3 py-2 font-mono text-xs text-primary-foreground">
            nmap -sC -sV -oX scan.xml &lt;target&gt;
          </p>
        </div>
        <UploadCard />
      </div>
    </main>
  );
}
