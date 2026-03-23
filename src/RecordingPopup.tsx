import './RecordingPopup.css';
import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';

interface RecordingPopupProps {
  isAgentMode?: boolean;
}

export function RecordingPopup({ isAgentMode = false }: RecordingPopupProps) {
  const bars = Array.from({ length: 12 });

  return (
    <div className="recording-root">
      <div className={`recording-pill ${isAgentMode ? 'agent-mode' : 'transcription-mode'}`} role="status" aria-label="Recording in progress">
        <div className="bars">
          {bars.map((_, index) => (
            <span
              key={index}
              className="bar"
              style={{ animationDelay: `${index * 0.06}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// RecordingPopupNoState - version that manages its own state for the recording window
export function RecordingPopupNoState() {
  const [isAgentMode, setIsAgentMode] = useState(false);
  const bars = Array.from({ length: 12 });

  useEffect(() => {
    const unlistenRecordingStarted = listen<string>('recording-started', (event) => {
      // event.payload is either "agent" or "transcription"
      setIsAgentMode(event.payload === 'agent');
    });

    return () => {
      unlistenRecordingStarted.then(fn => fn());
    };
  }, []);

  return (
    <div className="recording-root">
      <div className={`recording-pill ${isAgentMode ? 'agent-mode' : 'transcription-mode'}`} role="status" aria-label="Recording in progress">
        <div className="bars">
          {bars.map((_, index) => (
            <span
              key={index}
              className="bar"
              style={{ animationDelay: `${index * 0.06}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
