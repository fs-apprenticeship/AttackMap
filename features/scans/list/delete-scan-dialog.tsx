"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { IconButtonTooltip } from "@/components/ui/tooltip";
import { deleteScanAction } from "@/lib/scans/actions";
import type { Scan } from "@/lib/types";

type DeleteScanDialogProps = {
  scan: Scan;
};

export function DeleteScanDialog({ scan }: DeleteScanDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteScanAction(scan.id);
        setOpen(false);
        router.refresh();
        toast.success("Scan deleted");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to delete scan";
        toast.error(message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <IconButtonTooltip label={`Delete ${scan.filename}`}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${scan.filename}`}
            className="shrink-0 rounded-md text-muted-foreground hover:text-red-600"
          >
            <Trash2 className="size-4" />
          </Button>
        </DialogTrigger>
      </IconButtonTooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete scan?</DialogTitle>
          <DialogDescription>
            “{scan.filename}” will be permanently deleted. This can’t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
