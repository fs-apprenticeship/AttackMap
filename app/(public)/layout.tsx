import { PublicFooter } from "@/components/app-shell/public-footer";
import { PublicHeader } from "@/components/app-shell/public-header";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicHeader />
      {children}
      <PublicFooter />
    </>
  );
}
