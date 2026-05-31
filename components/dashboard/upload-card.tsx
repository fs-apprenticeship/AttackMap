import { FileUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function UploadCard() {
  return (
    <Card className="rounded-md border-dashed border-zinc-300 bg-white py-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex size-10 items-center justify-center rounded-md bg-zinc-950 text-white">
          <FileUp className="size-5" />
        </div>
        <h2 className="mt-4 text-sm font-semibold">Upload Nmap XML</h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          Parse a scan and add it to this workspace.
        </p>
        <Button className="mt-4 w-full rounded-md" size="lg">
          Select file
        </Button>
      </CardContent>
    </Card>
  );
}
