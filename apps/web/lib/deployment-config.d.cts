export declare function resolveProductionApiOrigin(
  nodeEnvironment: string | undefined,
  configuredOrigin: string | undefined,
  options?: { allowHttpLoopbackForTests?: boolean },
): string | null;
