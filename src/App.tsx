import { RecordingPopup } from './RecordingPopup';
import { useEffect, useState } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import './App.css';

function App() {
  const [isRecordingWindow, setIsRecordingWindow] = useState(false);

  useEffect(() => {
    const currentWindow = getCurrentWebviewWindow();
    setIsRecordingWindow(currentWindow.label === 'recording');
  }, []);

  if (isRecordingWindow) {
    return <RecordingPopup />;
  }

  return (
    <main className="container">
      <h1>Speech-2-Text</h1>
      <p>System tray application running...</p>
      <p>Use Ctrl+Win to start/stop recording</p>
      <p>Use Ctrl+Win+Alt for agent mode</p>
    </main>
  );
}

export default App;
