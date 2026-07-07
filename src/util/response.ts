/**
 * @raviraj87/mongodb-mcp · util/response.ts
 * MCP JSON response formatting.
 *
 * Copyright (c) 2026 Ravi Raj · MIT License · see LICENSE
 */

export function stringify(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function toContent(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function truncateText(text: string, maxChars = 120_000): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n... [truncated ${text.length - maxChars} chars]`;
}

export async function jsonResult(data: unknown) {
  return toContent(stringify(data));
}
