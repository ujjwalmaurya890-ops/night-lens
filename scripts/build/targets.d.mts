export type TargetId = 'chrome' | 'edge' | 'brave' | 'opera' | 'firefox' | 'safari';

export interface TargetDefinition {
  readonly id: TargetId;
  readonly family: 'chromium' | 'firefox' | 'safari';
  readonly label: string;
  readonly output: string;
  readonly documentation?: string;
  readonly manifest: string;
  readonly docs?: string;
}

export declare const TARGETS: Record<TargetId, TargetDefinition>;
export declare const DEFAULT_TARGETS: TargetId[];
export declare const CHROMIUM_TARGETS: TargetId[];
export declare function resolveTargets(requested?: readonly string[]): TargetId[];
