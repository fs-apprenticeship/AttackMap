import Link from "next/link";
import { AlertTriangle, FileQuestion, FileUp, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type AppStateCardProps = {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actions?: React.ReactNode;
  className?: string;
};

export function AppStateCard({
  icon,
  title,
  description,
  actions,
  className,
}: AppStateCardProps) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        {icon ? (
          <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            {icon}
          </div>
        ) : null}
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="max-w-sm text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        {actions ? (
          <div className="mt-1 flex items-center gap-2">{actions}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function PageStateShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 lg:px-6">
        {children}
      </div>
    </main>
  );
}

export function RouteErrorState({
  title = "Something went wrong",
  description = "The page could not finish loading. Try again, or return to your scans.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <PageStateShell>
      <AppStateCard
        icon={<AlertTriangle className="size-5" />}
        title={title}
        description={description}
        actions={
          <>
            {onRetry ? (
              <Button type="button" className="rounded-md" onClick={onRetry}>
                <RotateCw className="size-4" />
                Try again
              </Button>
            ) : null}
            <Button asChild variant="outline" className="bg-background">
              <Link href="/dashboard/scans">View scans</Link>
            </Button>
          </>
        }
      />
    </PageStateShell>
  );
}

export function NotFoundState() {
  return (
    <PageStateShell>
      <AppStateCard
        icon={<FileQuestion className="size-5" />}
        title="Page not found"
        description="This page does not exist, or it may have moved."
        actions={
          <>
            <Button asChild className="rounded-md">
              <Link href="/dashboard/scans">View scans</Link>
            </Button>
            <Button asChild variant="outline" className="bg-background">
              <Link href="/dashboard/upload">Upload a scan</Link>
            </Button>
          </>
        }
      />
    </PageStateShell>
  );
}

export function FirstScanEmptyState() {
  return (
    <AppStateCard
      className="border-dashed"
      icon={<FileUp className="size-5" />}
      title="No scans yet"
      description="Upload an Nmap XML scan to start tracking hosts, services, findings, and remediation work."
      actions={
        <Button asChild className="rounded-md">
          <Link href="/dashboard/upload">Upload a scan</Link>
        </Button>
      }
    />
  );
}
