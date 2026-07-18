import { Suspense } from "react";

import { AppHeader } from "@/components/app-shell/app-header";
import { requireAuthSync } from "@/lib/auth/sync";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <ProtectedShell>{children}</ProtectedShell>
    </Suspense>
  );
}

async function ProtectedShell({ children }: { children: React.ReactNode }) {
  await requireAuthSync();

  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
