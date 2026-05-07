import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, stepCountIs, type JSONValue, type Tool } from 'ai';
import { createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import type { MCPClient } from '@ai-sdk/mcp';
import type { AgentToolApprovalPolicy, AppConfig, McpServerConfig } from '../types/ipc';
import { logSidecar } from './protocol';

export interface AgentRuntimeCallbacks {
  onStatus(status: string): void;
  onCompleted(response: string, toolSummary: string[]): void;
  onFailed(error: string): void;
  onCancelled(): void;
  requestToolApproval(request: ToolApprovalRequest): Promise<ToolApprovalDecision>;
}

export interface ToolApprovalRequest {
  serverId: string;
  toolName: string;
  modelToolName: string;
  arguments: unknown;
}

export type ToolApprovalDecision =
  | {
      approved: true;
    }
  | {
      approved: false;
      message: string;
    };

const SYSTEM_PROMPT = `You are Shuddhalekhan Agent, a stateless voice assistant. You execute one-off commands. You respect tool policies and approval decisions. If a tool call is rejected with "Rejected: tool approval window expired.", the likely cause is that the user is no longer deliberately focused on the request. Stop execution and respond that you have stopped and are waiting for the user's deliberate focus. Be concise.`;

function getApiKey(envVarName: string): string | undefined {
  return process.env[envVarName];
}

function looksLikeRawApiKey(value: string): boolean {
  return /^sk-[A-Za-z0-9_-]/.test(value.trim());
}

function getProviderHeaders(baseUrl: string): Record<string, string> | undefined {
  if (!baseUrl.includes('openrouter.ai')) return undefined;

  return {
    'HTTP-Referer': 'https://github.com/parthashirolkar/shuddhalekhan',
    'X-OpenRouter-Title': 'Shuddhalekhan',
  };
}

function isOpenRouterBaseUrl(baseUrl: string): boolean {
  return baseUrl.includes('openrouter.ai');
}

function applyDefaultReasoningOptions(args: Record<string, unknown>, baseUrl: string): Record<string, unknown> {
  if (!isOpenRouterBaseUrl(baseUrl)) return args;

  return {
    ...args,
    reasoning: {
      ...(typeof args.reasoning === 'object' && args.reasoning !== null ? args.reasoning : {}),
      effort: 'none',
    },
  };
}

type AgentProviderOptions = Record<string, Record<string, JSONValue>>;

function getDefaultProviderOptions(baseUrl: string): AgentProviderOptions {
  const options: AgentProviderOptions = {
    openaiCompatible: {
      reasoningEffort: 'none',
    },
    shuddhalekhan: {
      reasoningEffort: 'none',
    },
  };

  if (isOpenRouterBaseUrl(baseUrl)) {
    options.shuddhalekhan = {
      reasoningEffort: 'none',
      reasoning: {
        effort: 'none',
      },
    };
  }

  return options;
}

function formatProviderError(err: unknown): string {
  const messages = new Set<string>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;

    if (typeof record.message === 'string') {
      messages.add(record.message);
    }

    const statusCode = record.statusCode ?? record.status;
    if (typeof statusCode === 'number') {
      messages.add(`HTTP ${statusCode}`);
    }

    if (record.responseBody) {
      messages.add(`Response: ${stringifyForMessage(record.responseBody)}`);
    }

    if (record.data) {
      messages.add(`Details: ${stringifyForMessage(record.data)}`);
    }

    if (record.cause && record.cause !== value) {
      visit(record.cause);
    }
  };

  visit(err);

  if (messages.size === 0) {
    return err instanceof Error ? err.message : String(err);
  }

  return Array.from(messages).join(' | ');
}

function stringifyForMessage(value: unknown): string {
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function createStdioTransport(server: McpServerConfig) {
  if (server.transport.type !== 'stdio') return null;
  const env: Record<string, string> = {};
  for (const name of server.transport.envVarNames) {
    const value = process.env[name];
    if (value !== undefined) {
      env[name] = value;
    }
  }
  return new Experimental_StdioMCPTransport({
    command: server.transport.command,
    args: server.transport.args,
    env,
  });
}

function createHttpTransport(server: McpServerConfig) {
  if (server.transport.type !== 'http') return null;
  return {
    type: 'http' as const,
    url: server.transport.url,
  };
}

async function connectMcpClients(
  config: AppConfig,
  requestToolApproval: AgentRuntimeCallbacks['requestToolApproval']
): Promise<{ clients: MCPClient[]; tools: Record<string, Tool> }> {
  const clients: MCPClient[] = [];
  const allTools: Record<string, Tool> = {};

  for (const server of config.agent.mcpServers) {
    if (!server.enabled) continue;

    try {
      let client: MCPClient;
      if (server.transport.type === 'stdio') {
        const transport = createStdioTransport(server);
        if (!transport) continue;
        client = await createMCPClient({ transport });
      } else if (server.transport.type === 'http') {
        const transport = createHttpTransport(server);
        if (!transport) continue;
        client = await createMCPClient({ transport });
      } else {
        continue;
      }

      const rawTools = await client.tools();
      clients.push(client);

      for (const [originalName, toolDef] of Object.entries(rawTools)) {
        const policyKey = `${server.id}:${originalName}` as const;
        const policy = server.toolPolicies[policyKey] ?? 'alwaysAsk';
        if (policy === 'disabled') continue;
        const modelName = `${server.id}__${originalName}`;
        allTools[modelName] = wrapToolWithPolicy(server.id, originalName, modelName, toolDef, policy, requestToolApproval);
      }

      logSidecar(`MCP server connected: ${server.id} (${server.displayName})`);
    } catch (err) {
      logSidecar(`MCP server failed: ${server.id}`, err);
    }
  }

  return { clients, tools: allTools };
}

function wrapToolWithPolicy(
  serverId: string,
  toolName: string,
  modelToolName: string,
  toolDef: Tool,
  policy: Exclude<AgentToolApprovalPolicy, 'disabled'>,
  requestToolApproval: AgentRuntimeCallbacks['requestToolApproval']
): Tool {
  return {
    ...toolDef,
    execute: async (args, options) => {
      if (policy === 'alwaysAsk') {
        const approval = await requestToolApproval({
          serverId,
          toolName,
          modelToolName,
          arguments: args,
        });

        if (!approval.approved) {
          return approval.message;
        }
      }

      if (!toolDef.execute) {
        throw new Error(`MCP tool ${serverId}:${toolName} is missing an execute handler.`);
      }

      return toolDef.execute(args, options);
    },
  };
}

export async function runAgent(
  _agentRunId: string,
  transcript: string,
  config: AppConfig,
  signal: AbortSignal,
  callbacks: AgentRuntimeCallbacks
): Promise<void> {
  let clients: MCPClient[] = [];

  try {
    const provider = config.agent.provider;
    if (!provider.baseUrl || !provider.model || !provider.apiKeyEnvVar) {
      callbacks.onFailed('Agent provider configuration is incomplete. Check base URL, model, and API key environment variable in Settings.');
      return;
    }

    const apiKey = getApiKey(provider.apiKeyEnvVar);
    if (!apiKey) {
      if (looksLikeRawApiKey(provider.apiKeyEnvVar)) {
        callbacks.onFailed(
          'Settings contains an API key value, but Shuddhalekhan expects an environment variable name. Set OPENROUTER_API_KEY in your shell, restart bun run dev, and put OPENROUTER_API_KEY in Settings.'
        );
        return;
      }

      callbacks.onFailed(`API key environment variable "${provider.apiKeyEnvVar}" is not set.`);
      return;
    }

    callbacks.onStatus('Connecting to tools...');
    const mcp = await connectMcpClients(config, callbacks.requestToolApproval);
    clients = mcp.clients;

    const model = createOpenAICompatible({
      name: 'shuddhalekhan',
      baseURL: provider.baseUrl,
      apiKey,
      headers: getProviderHeaders(provider.baseUrl),
      transformRequestBody: (args) => applyDefaultReasoningOptions(args, provider.baseUrl),
    }).chatModel(provider.model);

    callbacks.onStatus('Thinking...');

    const result = await generateText({
      model,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: transcript }],
      tools: mcp.tools,
      providerOptions: getDefaultProviderOptions(provider.baseUrl),
      stopWhen: stepCountIs(5),
      abortSignal: signal,
      onStepFinish: ({ toolCalls }) => {
        if (toolCalls.length > 0) {
          const names = toolCalls.map((t) => String(t.toolName)).join(', ');
          callbacks.onStatus(`Using tools: ${names}`);
        } else {
          callbacks.onStatus('Thinking...');
        }
      },
    });

    let finalResponse = result.text;
    const toolSummary: string[] = [];

    for (const step of result.steps) {
      for (const tc of step.toolCalls) {
        toolSummary.push(`Used ${String(tc.toolName)}`);
      }
    }

    const reachedMaxSteps = result.steps.length >= 5;
    const hasPendingToolCalls = result.toolCalls.length > result.toolResults.length;

    if (reachedMaxSteps && hasPendingToolCalls) {
      callbacks.onStatus('Step limit reached. Summarizing...');
      const fallback = await generateText({
        model,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: transcript },
          {
            role: 'assistant',
            content: result.text || 'I was in the middle of using tools to complete your request.',
          },
          {
            role: 'user',
            content:
              'You have reached the maximum number of steps. Please provide a concise final response describing what completed and what remains.',
          },
        ],
        providerOptions: getDefaultProviderOptions(provider.baseUrl),
        abortSignal: signal,
      });
      finalResponse = fallback.text;
      toolSummary.push('Max step guardrail reached');
    }

    callbacks.onCompleted(finalResponse, toolSummary);
  } catch (err) {
    if (signal.aborted) {
      callbacks.onCancelled();
      return;
    }
    logSidecar('Agent runtime error', err);
    callbacks.onFailed(formatProviderError(err));
  } finally {
    await Promise.all(clients.map((c) => c.close().catch(() => undefined)));
  }
}
