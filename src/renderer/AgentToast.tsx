import { useEffect, useMemo, useState } from 'react';
import type { AgentToastState } from '../types/ipc';

export function AgentToast() {
  const [state, setState] = useState<AgentToastState | null>(null);
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const remove = window.electronAPI?.on('agent-toast:update', (nextState) => {
      setState(nextState);
      setMessage('');
    });

    const interval = window.setInterval(() => setNow(Date.now()), 500);

    return () => {
      remove?.();
      window.clearInterval(interval);
    };
  }, []);

  const secondsLeft = useMemo(() => {
    if (state?.kind !== 'approval') return null;
    return Math.max(0, Math.ceil((new Date(state.expiresAt).getTime() - now) / 1000));
  }, [now, state]);

  if (!state) return null;

  if (state.kind === 'approval') {
    return (
      <main className="agent-toast approval-toast">
        <div className="toast-head">
          <span className="toast-kicker">Approval</span>
          <span className="toast-timer">{secondsLeft}s</span>
        </div>
        <h1>{state.serverId}:{state.toolName}</h1>
        <p className="toast-body">{formatArguments(state.arguments)}</p>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Optional denial message"
          aria-label="Optional denial message"
        />
        <div className="toast-actions">
          <button type="button" className="secondary" onClick={() => decide(state, 'denied', message)}>
            Deny
          </button>
          <button type="button" onClick={() => decide(state, 'approved')}>
            Approve
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={`agent-toast ${state.kind}`}>
      <div className="toast-head">
        <span className="toast-kicker">{getTitle(state)}</span>
      </div>
      <p className="toast-body">{getBody(state)}</p>
      {state.kind === 'completed' && state.toolSummary.length > 0 ? (
        <ul>
          {state.toolSummary.slice(0, 3).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}

function decide(state: Extract<AgentToastState, { kind: 'approval' }>, decision: 'approved' | 'denied', message?: string): void {
  void window.electronAPI?.invoke('agent:approval-decision', state.agentRunId, state.approvalId, decision, message);
}

function getTitle(state: AgentToastState): string {
  switch (state.kind) {
    case 'status':
      return 'Agent';
    case 'completed':
      return 'Complete';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    case 'config':
      return 'Agent Setup';
    case 'approval':
      return 'Approval';
  }
}

function getBody(state: Exclude<AgentToastState, { kind: 'approval' }>): string {
  switch (state.kind) {
    case 'status':
      return state.message;
    case 'completed':
      return state.response;
    case 'failed':
      return state.error;
    case 'cancelled':
      return 'Agent run cancelled.';
    case 'config':
      return state.message;
  }
}

function formatArguments(value: unknown): string {
  if (value === null || value === undefined) return 'No arguments.';
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
