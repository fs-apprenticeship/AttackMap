"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

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
import { deleteScan } from "@/lib/scans/store";
import type { Scan } from "@/lib/types";

type DeleteScanDialogProps = {
  scan: Scan;
};

export function DeleteScanDialog({ scan }: DeleteScanDialogProps) {
  const [open, setOpen] = useState(false);

  function handleDelete() {
    deleteScan(scan.id);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${scan.filename}`}
          className="size-8 shrink-0 rounded-md text-zinc-400 hover:text-red-600"
        >
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete scan?</DialogTitle>
          <DialogDescription>
            “{scan.filename}” will be removed from this browser. This can’t be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleDelete}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
