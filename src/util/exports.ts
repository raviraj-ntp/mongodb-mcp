/**
 * @raviraj87/mongodb-mcp · util/exports.ts
 * Temporary named export store for MCP resources.
 *
 * Copyright (c) 2026 Ravi Raj · MIT License · see LICENSE
 */

const exports = new Map<string, { data: unknown; createdAt: number }>();
const TTL_MS = 5 * 60 * 1000;

export const exportStore = {
  set(name: string, data: unknown): void {
    exports.set(name, { data, createdAt: Date.now() });
    prune();
  },
  get(name: string): unknown | undefined {
    prune();
    return exports.get(name)?.data;
  },
  list(): string[] {
    prune();
    return [...exports.keys()];
  },
};

function prune(): void {
  const now = Date.now();
  for (const [k, v] of exports) {
    if (now - v.createdAt > TTL_MS) exports.delete(k);
  }
}
