import { RecordingPopupNoState } from './RecordingPopup';
import { ApprovalPopup } from './ApprovalPopup';
import { AgentResponsePopup } from './AgentResponsePopup';
import { useEffect, useState, useCallback, useRef } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen, emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import './App.css';

type ToolArgs = Record<string, string | number | boolean | null | undefined>;

interface ApprovalRequest {
  id: string;
  tool: string;
  args: ToolArgs;
}

function App() {
  const [windowLabel, setWindowLabel] = useState<string>('');
  const [agentResponse, setAgentResponse] = useState<string | null>(null);
  const [approvalQueue, setApprovalQueue] = useState<ApprovalRequest[]>([]);

  useEffect(() => {
    const currentWindow = getCurrentWebviewWindow();
    setWindowLabel(currentWindow.label);
    
    // Emit ready event when approval window mounts
    if (currentWindow.label === 'approval') {
      emit('approval-window-ready');
    }
    
    // Listen for agent response data (for agent-response window)
    if (currentWindow.label === 'agent-response') {
      const unlisten = listen<string>('agent-response-data', (event) => {
        setAgentResponse(event.payload);
      });
      
      return () => {
        unlisten.then(fn => fn());
      };
    }
  }, []);

  // Handle adding new approval requests to the queue
  const addApprovalRequest = useCallback((request: ApprovalRequest) => {
    setApprovalQueue(prev => [...prev, request]);
  }, []);

  // Handle resolving an approval (approve or deny)
  const handleApproval = useCallback(async (approved: boolean) => {
    const currentRequest = approvalQueue[0];
    if (!currentRequest) return;

    // Resolve this request
    await invoke('resolve_tool_approval', { id: currentRequest.id, approved });
    
    // Remove it from the queue
    setApprovalQueue(prev => prev.slice(1));
  }, [approvalQueue]);

  // Use a ref to avoid re-registering listeners when addApprovalRequest changes
  // addApprovalRequest is stable (created with useCallback), but using a ref
  // ensures we always have the latest reference without causing re-registrations
  const addApprovalRequestRef = useRef(addApprovalRequest);
  addApprovalRequestRef.current = addApprovalRequest;

  useEffect(() => {
    const unlistenAgentResponse = listen<string>('agent-response', (event) => {
      setAgentResponse(event.payload);
      setTimeout(() => setAgentResponse(null), 10000);
    });

    const unlistenApproval = listen<ApprovalRequest>('tool-approval-requested', (event) => {
      addApprovalRequestRef.current(event.payload);
    });

    return () => {
      unlistenAgentResponse.then(fn => fn());
      unlistenApproval.then(fn => fn());
    };
    // Empty dependency array - listeners are registered once and never re-registered
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get the current request (first in queue)
  const currentRequest = approvalQueue[0];
  const queueCount = approvalQueue.length;

  // Recording popup - use NoState version for separate window
  if (windowLabel === 'recording') {
    return <RecordingPopupNoState />;
  }

  // Approval popup window
  if (windowLabel === 'approval') {
    if (currentRequest) {
      return (
        <ApprovalPopup
          tool={currentRequest.tool}
          args={currentRequest.args}
          onApprove={() => handleApproval(true)}
          onDeny={() => handleApproval(false)}
          queueCount={queueCount}
        />
      );
    }
    // Waiting for approval request...
    return (
      <div className="approval-waiting">
        <div className="waiting-spinner"></div>
        <p>Waiting for Jarvis request...</p>
      </div>
    );
  }

  // Agent response popup window
  if (windowLabel === 'agent-response') {
    if (agentResponse) {
      return <AgentResponsePopup message={agentResponse} />;
    }
    return null;
  }

  // Main window
  return (
    <main className="container">
      <h1>Speech-2-Text</h1>
      <p>System tray application running...</p>
      <p>Use Ctrl+Win to start/stop recording</p>
      <p>Use Alt+Win for agent mode (Jarvis)</p>
    </main>
  );
}

export default App;
