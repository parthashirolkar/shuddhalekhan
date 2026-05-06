import { createInterface } from 'readline';
import { logSidecar, parseElectronMessage, writeJsonLine } from './protocol';
import type { AppConfig } from '../types/ipc';

let config: AppConfig | null = null;
let activeAgentRunId: string | null = null;

function main(): void {
  writeJsonLine({
    type: 'sidecar:ready',
    protocolVersion: 1,
  });

  logSidecar('ready');

  const input = createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  input.on('line', (line) => {
    try {
      handleLine(line);
    } catch (err) {
      logSidecar('failed to handle protocol line', err);
    }
  });
}

function handleLine(line: string): void {
  const message = parseElectronMessage(line);
  if (!message) {
    logSidecar('ignored unknown protocol message');
    return;
  }

  switch (message.type) {
    case 'config:update':
      config = message.config;
      logSidecar('received config update');
      break;
    case 'agent:start':
      activeAgentRunId = message.agentRunId;
      writeJsonLine({
        type: 'agent:status',
        agentRunId: message.agentRunId,
        status: 'Agent runtime placeholder received transcript',
      });
      writeJsonLine({
        type: 'agent:completed',
        agentRunId: message.agentRunId,
        response: `Agent runtime is ready for SDK implementation. Transcript: ${message.transcript}`,
        toolSummary: config?.agent.mcpServers.length ? ['MCP registry snapshot received'] : [],
      });
      activeAgentRunId = null;
      break;
    case 'agent:cancel':
      if (activeAgentRunId === message.agentRunId) {
        activeAgentRunId = null;
      }
      writeJsonLine({
        type: 'agent:cancelled',
        agentRunId: message.agentRunId,
      });
      break;
    case 'approval:decision':
      logSidecar(`received approval decision ${message.decision}`);
      break;
  }
}

main();
