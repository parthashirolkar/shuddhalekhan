import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AgentToastState } from '../types/ipc';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

export function AgentToast() {
  const [state, setState] = useState<AgentToastState | null>(null);
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const toastRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

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

  useLayoutEffect(() => {
    if (!state || (state.kind !== 'streaming' && state.kind !== 'completed')) return undefined;
    const element = toastRef.current;
    if (!element) return undefined;

    let frame = 0;
    const publishSize = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const body = bodyRef.current;
        const measuredHeight = body
          ? element.scrollHeight - body.clientHeight + body.scrollHeight
          : element.scrollHeight;
        window.electronAPI?.send('agent-toast:content-size', measuredHeight);
      });
    };

    publishSize();
    const observer = new ResizeObserver(publishSize);
    observer.observe(element);
    if (bodyRef.current) observer.observe(bodyRef.current);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [state]);

  if (!state) return null;

  if (state.kind === 'approval') {
    return (
      <main ref={toastRef} className="relative flex h-screen w-screen flex-col overflow-hidden rounded-[10px] border border-white/10 bg-[#111416] p-4 text-[#f8fafb] shadow-[0_22px_70px_rgba(0,0,0,0.48)]"
        style={{ background: 'linear-gradient(135deg, rgba(255,106,106,0.18), rgba(241,199,91,0.08)), #111416' }}>
        <div className="pointer-events-none fixed inset-0"
          style={{
            background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
            maskImage: 'linear-gradient(135deg, black, transparent 68%)',
          }} />

        <div className="relative mb-2.5 flex items-center justify-between gap-3">
          <Badge variant="outline" className="border-transparent bg-transparent px-0 text-[11px] font-extrabold uppercase tracking-normal text-[#ffb2a6]">
            Approval
          </Badge>
          <span className="min-w-[36px] text-right text-[11px] font-extrabold uppercase tracking-normal text-[#f1d38a]">
            {secondsLeft}s
          </span>
        </div>

        <h1 className="relative mb-2 break-words text-base font-bold leading-[21px] text-white line-clamp-3">
          {state.serverId}:{state.toolName}
        </h1>

        <p className="relative mb-2 block min-h-[42px] flex-1 overflow-auto whitespace-pre-wrap rounded-md border border-white/10 bg-black/35 p-2 text-[13px] leading-[18px] text-[#d9dee2]">
          {formatArguments(state.arguments)}
        </p>

        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Optional denial message"
          aria-label="Optional denial message"
          className="relative h-9 min-h-0 flex-shrink-0 resize-none rounded-md border-white/15 bg-black/60 py-[7px] text-xs leading-4 text-[#f4f7f8] placeholder:text-muted-foreground focus-visible:border-[rgba(241,199,91,0.74)] focus-visible:ring-[rgba(241,199,91,0.13)]"
        />

        <div className="relative mt-2 flex flex-shrink-0 justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-[34px] w-24 bg-[#242a30] text-[#e8edf2] hover:bg-[#2a3138]"
            onClick={() => decide(state, 'denied', message)}
          >
            Deny
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-[34px] w-24"
            onClick={() => decide(state, 'approved')}
          >
            Approve
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main ref={toastRef} className={`relative flex h-screen w-screen flex-col overflow-hidden rounded-[10px] border border-white/10 bg-[#111416] p-4 text-[#f8fafb] shadow-[0_22px_70px_rgba(0,0,0,0.48)] ${state.kind}`}
      style={state.kind === 'failed' || state.kind === 'cancelled'
        ? { background: 'linear-gradient(135deg, rgba(255,106,106,0.18), rgba(241,199,91,0.08)), #111416' }
        : undefined}>
      <div className="pointer-events-none fixed inset-0"
        style={{
          background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
          maskImage: 'linear-gradient(135deg, black, transparent 68%)',
        }} />

      <div className="relative mb-2.5 flex items-center justify-between gap-3">
        <Badge variant="outline" className="border-transparent bg-transparent px-0 text-[11px] font-extrabold uppercase tracking-normal text-[#ffb2a6]">
          {getTitle(state)}
        </Badge>
      </div>

      <div ref={bodyRef} className="relative m-0 min-h-0 flex-1 overflow-auto break-words text-[13px] leading-[18px] text-[#d9dee2]">
        {state.kind === 'streaming' || state.kind === 'completed'
          ? renderMarkdown(getBody(state))
          : <p className="m-0 whitespace-pre-wrap">{getBody(state)}</p>}
      </div>

      {state.kind === 'completed' && state.toolSummary.length > 0 ? (
        <ul className="relative mt-3 flex flex-wrap gap-1.5 p-0">
          {state.toolSummary.slice(0, 3).map((item) => (
            <li key={item} className="max-w-full rounded-full border border-white/10 bg-white/[0.06] px-[7px] py-[3px] text-[11px] leading-[15px] text-[#cad2da] break-words">
              {item}
            </li>
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
    case 'streaming':
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
    case 'streaming':
      return state.response;
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

function renderMarkdown(markdown: string): ReactNode {
  const lines = markdown.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';

    if (!line.trim()) {
      index++;
      continue;
    }

    if (line.trimStart().startsWith('```')) {
      const codeLines: string[] = [];
      index++;
      while (index < lines.length && !(lines[index] ?? '').trimStart().startsWith('```')) {
        codeLines.push(lines[index] ?? '');
        index++;
      }
      if (index < lines.length) index++;
      nodes.push(
        <pre key={nodes.length} className="my-2 max-w-full overflow-auto rounded-md border border-white/10 bg-black/35 p-2 text-[12px] leading-[17px] text-[#edf1f4]">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      nodes.push(
        <p key={nodes.length} className="mb-1 mt-2 text-[13px] font-bold leading-[18px] text-white first:mt-0">
          {renderInlineMarkdown(heading[2] ?? '')}
        </p>
      );
      index++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index] ?? '')) {
        items.push((lines[index] ?? '').replace(/^\s*[-*]\s+/, ''));
        index++;
      }
      nodes.push(
        <ul key={nodes.length} className="my-1.5 list-disc space-y-1 pl-4">
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index] ?? '')) {
        items.push((lines[index] ?? '').replace(/^\s*\d+\.\s+/, ''));
        index++;
      }
      nodes.push(
        <ol key={nodes.length} className="my-1.5 list-decimal space-y-1 pl-4">
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      (lines[index] ?? '').trim() &&
      !(lines[index] ?? '').trimStart().startsWith('```') &&
      !/^(#{1,3})\s+/.test(lines[index] ?? '') &&
      !/^\s*[-*]\s+/.test(lines[index] ?? '') &&
      !/^\s*\d+\.\s+/.test(lines[index] ?? '')
    ) {
      paragraphLines.push(lines[index] ?? '');
      index++;
    }

    nodes.push(
      <p key={nodes.length} className="my-1.5 whitespace-pre-wrap first:mt-0 last:mb-0">
        {renderInlineMarkdown(paragraphLines.join('\n'))}
      </p>
    );
  }

  return nodes.length > 0 ? nodes : <p className="m-0" />;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('`')) {
      nodes.push(
        <code key={nodes.length} className="rounded bg-white/10 px-1 py-[1px] text-[12px] text-[#f1d38a]">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={nodes.length} className="font-bold text-white">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*')) {
      nodes.push(<em key={nodes.length} className="italic">{token.slice(1, -1)}</em>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      const href = link?.[2] ?? '#';
      nodes.push(
        <a key={nodes.length} href={href} className="text-[#f1d38a] underline underline-offset-2">
          {link?.[1] ?? token}
        </a>
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}
