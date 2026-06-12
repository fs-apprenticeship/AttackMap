import { describe, expect, it } from "vitest";
import type { Paragraph, Root } from "mdast";

import { remarkCodeifyCommands } from "@/components/dashboard/remark-codeify-commands";

// Run the plugin against a one-paragraph tree and return that paragraph's
// children, so tests can assert which spans became inline code.
function transform(text: string) {
  const tree: Root = {
    type: "root",
    children: [{ type: "paragraph", children: [{ type: "text", value: text }] }],
  };
  // The plugin's transformer only reads the tree; extra unified args are unused.
  // Cast away the unified `Plugin` `this: Processor` context for direct calling.
  const build = remarkCodeifyCommands as unknown as () => (t: Root) => void;
  build()(tree);
  return (tree.children[0] as Paragraph).children;
}

function transformRoot(children: Root["children"]) {
  const tree: Root = { type: "root", children };
  const build = remarkCodeifyCommands as unknown as () => (t: Root) => void;
  build()(tree);
  return tree.children;
}

describe("remarkCodeifyCommands", () => {
  it("converts single-quoted commands in prose to inline code", () => {
    const children = transform(
      "Run 'grep PermitRootLogin /etc/ssh/sshd_config' and 'grep PasswordAuthentication /etc/ssh/sshd_config' to confirm the settings are applied.",
    );

    const codes = children.filter((n) => n.type === "inlineCode");
    expect(codes).toHaveLength(2);
    expect(codes[0]).toMatchObject({
      value: "grep PermitRootLogin /etc/ssh/sshd_config",
    });
    expect(codes[1]).toMatchObject({
      value: "grep PasswordAuthentication /etc/ssh/sshd_config",
    });
  });

  it("converts a quoted bare path to inline code", () => {
    const children = transform("Open '/etc/ssh/sshd_config' in an editor.");
    expect(children.filter((n) => n.type === "inlineCode")).toHaveLength(1);
  });

  it("leaves non-command quoted prose untouched", () => {
    const children = transform("Mark the host as 'internet-facing' in the report.");
    expect(children.filter((n) => n.type === "inlineCode")).toHaveLength(0);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ type: "text" });
  });

  it("preserves surrounding prose around a converted command", () => {
    const children = transform("Then run 'systemctl restart sshd' now.");
    expect(children.map((n) => n.type)).toEqual(["text", "inlineCode", "text"]);
    expect(children[0]).toMatchObject({ value: "Then run " });
    expect(children[2]).toMatchObject({ value: " now." });
  });

  it("converts standalone command paragraphs to code blocks", () => {
    const children = transformRoot([
      {
        type: "paragraph",
        children: [{ type: "text", value: "systemctl restart sshd" }],
      },
    ]);

    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({
      type: "code",
      value: "systemctl restart sshd",
    });
  });

  it("strips shell prompts from standalone command code blocks", () => {
    const children = transformRoot([
      {
        type: "paragraph",
        children: [{ type: "text", value: "$ curl -I http://devarea.htb" }],
      },
    ]);

    expect(children[0]).toMatchObject({
      type: "code",
      value: "curl -I http://devarea.htb",
    });
  });

  it("converts standalone config assignments to code blocks", () => {
    const children = transformRoot([
      {
        type: "paragraph",
        children: [{ type: "text", value: "anonymous_enable=NO" }],
      },
    ]);

    expect(children[0]).toMatchObject({
      type: "code",
      value: "anonymous_enable=NO",
    });
  });

  it("converts multi-line command paragraphs to one code block", () => {
    const children = transformRoot([
      {
        type: "paragraph",
        children: [
          {
            type: "text",
            value:
              "grep PermitRootLogin /etc/ssh/sshd_config\nsystemctl restart sshd",
          },
        ],
      },
    ]);

    expect(children[0]).toMatchObject({
      type: "code",
      lang: "bash",
      value:
        "grep PermitRootLogin /etc/ssh/sshd_config\nsystemctl restart sshd",
    });
  });

  it("does not convert prose that merely mentions a command", () => {
    const children = transformRoot([
      {
        type: "paragraph",
        children: [
          {
            type: "text",
            value: "Run systemctl restart sshd after changing the config.",
          },
        ],
      },
    ]);

    expect(children[0]).toMatchObject({ type: "paragraph" });
  });
});
