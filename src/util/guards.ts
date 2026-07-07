/**
 * @raviraj87/mongodb-mcp · util/guards.ts
 * Read-only mode and query safety guards.
 *
 * Copyright (c) 2026 Ravi Raj · MIT License · see LICENSE
 */

const SERVER_SIDE_JS_KEYS = new Set(["$where", "$function", "$accumulator"]);

export function assertNoServerSideJs(value: unknown, path = "query"): void {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) assertNoServerSideJs(value[i], `${path}[${i}]`);
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SERVER_SIDE_JS_KEYS.has(key)) {
      throw new Error(`Server-side JavaScript operator '${key}' is disabled (${path})`);
    }
    assertNoServerSideJs(child, `${path}.${key}`);
  }
}

export function assertReadOnly(operation: string): void {
  throw new Error(`Operation '${operation}' blocked: connection is read-only`);
}

export function assertDatabaseAllowed(db: string, allowed?: string[]): void {
  if (!allowed?.length) return;
  if (!allowed.includes(db)) {
    throw new Error(`Database '${db}' is not in allowed_databases for this connection`);
  }
}

export async function assertUsesIndex(
  explainFn: () => Promise<Record<string, unknown>>,
): Promise<void> {
  const plan = await explainFn();
  if (collectionScanDetected(plan)) {
    throw new Error("Query rejected by index_check: execution plan uses COLLSCAN");
  }
}

function collectionScanDetected(plan: Record<string, unknown>): boolean {
  const json = JSON.stringify(plan);
  return /COLLSCAN|COLL_SCAN|collectionScan/i.test(json);
}

export function assertConfirmation(toolName: string, confirmed: boolean | undefined, required: string[]): void {
  if (!required.includes(toolName)) return;
  if (!confirmed) {
    throw new Error(`Tool '${toolName}' requires confirmed=true`);
  }
}
