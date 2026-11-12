import type { TargetDefinition } from './targets.mjs';

export type Manifest = Record<string, unknown>;

export declare function deepMerge(base: unknown, override: unknown): unknown;
export declare function readJson(path: string): Manifest;
export declare function buildManifest(options: {
  root: string;
  target: TargetDefinition;
  version?: string;
}): Manifest;
export declare function validateManifest(
  manifest: Manifest,
  targetId: string,
  target: TargetDefinition,
): string[];
export declare function validateManifestFiles(manifest: Manifest, directory: string): string[];
