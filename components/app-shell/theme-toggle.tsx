"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { IconButtonTooltip } from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <IconButtonTooltip label="Toggle color theme">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="rounded-md bg-background"
        aria-label="Toggle color theme"
        onClick={() => {
          setTheme(
            document.documentElement.classList.contains("dark")
              ? "light"
              : "dark",
          );
        }}
      >
        <Sun className="hidden size-4 dark:block" />
        <Moon className="size-4 dark:hidden" />
      </Button>
    </IconButtonTooltip>
  );
}
