export function resolveApiPort(env: NodeJS.ProcessEnv): number {
  const configuredPort = env.PORT ?? env.API_PORT ?? '4000';
  const port = Number(configuredPort);

  if (
    !/^\d+$/.test(configuredPort) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(
      `Invalid API port "${configuredPort}". Set PORT or API_PORT to an integer from 1 to 65535.`,
    );
  }

  return port;
}
