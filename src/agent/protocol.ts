export type SidecarReadyEvent = {
  type: 'sidecar:ready';
  protocolVersion: 1;
};

export type SidecarEvent = SidecarReadyEvent;

export function writeJsonLine(event: SidecarEvent): void {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

export function logSidecar(message: string, error?: unknown): void {
  const suffix = error ? ` ${error instanceof Error ? error.message : String(error)}` : '';
  process.stderr.write(`[agent-sidecar] ${message}${suffix}\n`);
}
