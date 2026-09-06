import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const nodeRequire = createRequire(__filename);

function workspaceRoot(): string {
  return path.resolve(__filename, '../../../../../../../');
}

/**
 * Loads a native Tree-sitter grammar. Prefers the package name (normal pnpm
 * install), then falls back to the workspace `.pnpm` store so local/dev
 * environments still work when `apps/api/node_modules` cannot be relinked.
 */
export function loadNativeGrammar(packageName: string): unknown {
  try {
    return nodeRequire(packageName);
  } catch {
    const pnpmDir = path.join(workspaceRoot(), 'node_modules/.pnpm');
    if (!existsSync(pnpmDir)) {
      throw new Error(`Unable to load ${packageName}`);
    }
    const entries = readdirSync(pnpmDir).filter((entry) =>
      entry.startsWith(`${packageName}@`),
    );
    for (const entry of entries) {
      const candidate = path.join(pnpmDir, entry, 'node_modules', packageName);
      if (existsSync(candidate)) {
        return nodeRequire(candidate);
      }
    }
    throw new Error(`Unable to load ${packageName}`);
  }
}
