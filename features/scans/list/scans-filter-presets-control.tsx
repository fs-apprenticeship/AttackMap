"use client";

import { useState } from "react";
import { Bookmark, Save, Trash2 } from "lucide-react";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

import {
  deleteScansFilterPreset,
  readScansFilterPresets,
  saveScansFilterPreset,
  writeScansFilterPresets,
  type SavedScansFilterPreset,
} from "./scans-filter-presets";
import type { ScansUrlState } from "./scans-url-state";

type ScansFilterPresetsControlProps = {
  currentState: ScansUrlState;
  onApply: (state: ScansUrlState) => void;
};

function createPresetId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function getBrowserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function ScansFilterPresetsControl({
  currentState,
  onApply,
}: ScansFilterPresetsControlProps) {
  const [presets, setPresets] = useState<SavedScansFilterPreset[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [overwritePreset, setOverwritePreset] =
    useState<SavedScansFilterPreset | null>(null);
  const [deletePreset, setDeletePreset] =
    useState<SavedScansFilterPreset | null>(null);

  function persist(nextPresets: SavedScansFilterPreset[]) {
    const storage = getBrowserStorage();
    if (!storage || !writeScansFilterPresets(storage, nextPresets)) {
      toast.error("Saved presets could not be stored in this browser");
      return false;
    }

    setPresets(nextPresets);
    return true;
  }

  function savePreset(replace = false) {
    const trimmedName = name.trim();
    if (trimmedName.length === 0 || trimmedName.length > 50) return;

    const existing = presets.find(
      (preset) =>
        preset.name.toLocaleLowerCase() === trimmedName.toLocaleLowerCase(),
    );
    if (existing && !replace) {
      setOverwritePreset(existing);
      return;
    }

    const next = saveScansFilterPreset(presets, {
      id: existing?.id ?? createPresetId(),
      name: trimmedName,
      state: currentState,
      createdAt: new Date().toISOString(),
    });
    if (persist(next)) {
      setSaveDialogOpen(false);
      setOverwritePreset(null);
      setName("");
      toast.success(existing ? "Preset replaced" : "Preset saved");
    }
  }

  function removePreset() {
    if (!deletePreset) return;
    if (persist(deleteScansFilterPreset(presets, deletePreset.id))) {
      toast.success("Preset deleted");
      setDeletePreset(null);
    }
  }

  return (
    <>
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) {
            const storage = getBrowserStorage();
            setPresets(storage ? readScansFilterPresets(storage) : []);
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="h-10 rounded-md">
            <Bookmark className="size-4" />
            Saved presets
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-md">
          <DropdownMenuItem
            onSelect={() => {
              setName("");
              setSaveDialogOpen(true);
            }}
          >
            <Save className="size-4" />
            Save current filters
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {presets.length === 0 ? (
            <DropdownMenuLabel className="text-muted-foreground">
              No saved presets
            </DropdownMenuLabel>
          ) : (
            presets.map((preset) => (
              <DropdownMenuSub key={preset.id}>
                <DropdownMenuSubTrigger>{preset.name}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44 rounded-md">
                  <DropdownMenuItem onSelect={() => onApply(preset.state)}>
                    Apply preset
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeletePreset(preset)}
                  >
                    <Trash2 className="size-4" />
                    Delete preset
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {overwritePreset ? "Replace saved preset?" : "Save filter preset"}
            </DialogTitle>
            <DialogDescription>
              {overwritePreset
                ? `A preset named “${overwritePreset.name}” already exists. Replacing it updates the saved filters.`
                : "Save the current search, filters, and sort order under a name."}
            </DialogDescription>
          </DialogHeader>
          {!overwritePreset ? (
            <label className="grid gap-2 text-sm font-medium">
              Preset name
              <Input
                autoFocus
                maxLength={50}
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") savePreset();
                }}
              />
            </label>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="outline"
                onClick={() => setOverwritePreset(null)}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              disabled={name.trim().length === 0 || name.trim().length > 50}
              onClick={() => savePreset(Boolean(overwritePreset))}
            >
              {overwritePreset ? "Replace preset" : "Save preset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletePreset !== null}
        onOpenChange={(open) => !open && setDeletePreset(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete saved preset?</DialogTitle>
            <DialogDescription>
              “{deletePreset?.name}” will be removed from this browser.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={removePreset}>
              Delete preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
