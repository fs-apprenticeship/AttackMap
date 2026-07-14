"use client";

export function downloadTextFile({
  content,
  filename,
  type,
  includeUtf8Bom = false,
}: {
  content: string;
  filename: string;
  type: string;
  includeUtf8Bom?: boolean;
}) {
  const parts = includeUtf8Bom ? ["\uFEFF", content] : [content];
  const url = URL.createObjectURL(new Blob(parts, { type }));
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
