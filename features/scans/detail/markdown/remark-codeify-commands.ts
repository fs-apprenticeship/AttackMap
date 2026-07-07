import { SKIP, visit } from "unist-util-visit";
import type { Plugin } from "unified";
import type {
  Code,
  InlineCode,
  Paragraph,
  Root,
  RootContent,
  Text,
} from "mdast";

// The model frequently writes shell commands inside prose using single quotes
// (e.g. Run 'grep PermitRootLogin /etc/ssh/sshd_config' to confirm) instead of
// markdown code, especially in the remediation `verification` field. This
// remark plugin rewrites command-like single-quoted spans into inline code so
// commands always render as code, regardless of whether the model used markdown
// formatting. It visits only `text` nodes, so genuine code spans/blocks (which
// are `inlineCode` / `code` nodes in mdast) are never touched or corrupted.

// A span or paragraph is treated as a command when it contains a path, a
// CLI-style flag, or starts with a well-known command name.
const COMMAND_LIKE =
  /(?:^|\s)(?:sudo|grep|sed|awk|cat|echo|ls|ssh|scp|systemctl|service|journalctl|nmap|curl|wget|chmod|chown|chgrp|iptables|nft|ufw|firewall-cmd|nano|vim|vi|apt|apt-get|yum|dnf|pacman|docker|kubectl|openssl|netstat|ss|ps|find|tail|head|tee|export)\b|\s--?[a-zA-Z]|\//;

const QUOTED = /'([^'\n]+)'/g;
const COMMAND_START =
  /^(?:sudo\s+)?(?:grep|sed|awk|cat|echo|ls|ssh|scp|systemctl|service|journalctl|nmap|curl|wget|chmod|chown|chgrp|iptables|nft|ufw|firewall-cmd|nano|vim|vi|apt|apt-get|yum|dnf|pacman|docker|kubectl|openssl|netstat|ss|ps|find|tail|head|tee|export)\b/;
const CONFIG_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_.-]*=(?:"[^"]*"|'[^']*'|[^\s]+)$/;
const PROSE_START =
  /^(?:run|execute|use|verify|confirm|check|open|edit|restart|reload|ensure|set|change|review|disable|enable|limit|restrict|remove|update|install)\s/i;

export const remarkCodeifyCommands: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "paragraph", (node: Paragraph, index, parent) => {
      if (!parent || typeof index !== "number") return;

      const command = paragraphToStandaloneCommand(node);
      if (!command) return;

      parent.children.splice(index, 1, {
        type: "code",
        lang: command.includes("\n") ? "bash" : undefined,
        value: command,
      } satisfies Code);

      return [SKIP, index + 1];
    });

    visit(tree, "text", (node: Text, index, parent) => {
      if (!parent || typeof index !== "number") return;
      if (!node.value.includes("'")) return;

      const value = node.value;
      const parts: RootContent[] = [];
      let last = 0;
      let changed = false;
      let match: RegExpExecArray | null;

      QUOTED.lastIndex = 0;
      while ((match = QUOTED.exec(value)) !== null) {
        const inner = match[1];
        if (!COMMAND_LIKE.test(inner)) continue;

        if (match.index > last) {
          parts.push({ type: "text", value: value.slice(last, match.index) });
        }
        parts.push({ type: "inlineCode", value: inner } satisfies InlineCode);
        last = match.index + match[0].length;
        changed = true;
      }

      if (!changed) return;
      if (last < value.length) {
        parts.push({ type: "text", value: value.slice(last) });
      }

      parent.children.splice(index, 1, ...parts);
      // Skip the nodes we just inserted (their text was already processed).
      return [SKIP, index + parts.length];
    });
  };
};

function paragraphToStandaloneCommand(node: Paragraph) {
  if (
    !node.children.every(
      (child) => child.type === "text" || child.type === "inlineCode",
    )
  ) {
    return null;
  }

  const value = node.children
    .map((child) => child.value)
    .join("")
    .trim();

  if (!value) return null;

  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;
  if (!lines.every(isStandaloneCommandLine)) return null;

  return lines.map(stripShellPrompt).join("\n");
}

function isStandaloneCommandLine(line: string) {
  const normalized = stripShellPrompt(line);

  if (!normalized) return false;
  if (PROSE_START.test(normalized)) return false;
  if (CONFIG_ASSIGNMENT.test(normalized)) return true;
  if (COMMAND_START.test(normalized)) return true;

  return false;
}

function stripShellPrompt(line: string) {
  return line.replace(/^(?:[$#>]\s*)+/, "").trim();
}
