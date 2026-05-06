import { logSidecar, writeJsonLine } from './protocol';

function main(): void {
  writeJsonLine({
    type: 'sidecar:ready',
    protocolVersion: 1,
  });

  logSidecar('ready');
}

main();
