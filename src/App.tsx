import { RecordingPopup } from './RecordingPopup';
import { useEffect, useState } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useConfig } from './lib/config';
import { invoke } from '@tauri-apps/api/core';
import './App.css';

function App() {
  const [isRecordingWindow, setIsRecordingWindow] = useState(false);
  const { config, update, loading } = useConfig();
  const [devices, setDevices] = useState<string[]>([]);

  useEffect(() => {
    const currentWindow = getCurrentWebviewWindow();
    setIsRecordingWindow(currentWindow.label === 'recording');

    // Disable right click menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  async function loadDevices() {
    try {
      const audioDevices = await invoke<string[]>("get_audio_devices");
      setDevices(audioDevices);
    } catch (e) {
      console.error("Failed to get audio devices:", e);
    }
  }

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    if (config.selected_device && devices.includes(config.selected_device)) {
      invoke("select_audio_device", { deviceName: config.selected_device }).catch(console.error);
    }
  }, [config.selected_device, devices]);

  if (isRecordingWindow) {
    return <RecordingPopup />;
  }

  if (loading) return <div>Loading config...</div>;

  return (
    <main className="container">
      <h2>Speech-to-Text Settings</h2>

      <div className="settings-form">
        <div className="form-group">
          <label htmlFor="device-select">Microphone:</label>
          <select
            id="device-select"
            value={config.selected_device}
            onChange={(e) => update("selected_device", e.target.value)}
          >
            <option value="">Select a device</option>
            {devices.map((device) => (
              <option key={device} value={device}>
                {device}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="whisper-url">Whisper API URL:</label>
          <input
            id="whisper-url"
            type="text"
            value={config.whisper_url}
            onChange={(e) => update("whisper_url", e.target.value)}
            placeholder="http://127.0.0.1:8080/v1/audio/transcriptions"
          />
        </div>

        <div className="form-group">
          <label htmlFor="ollama-url">Ollama API URL:</label>
          <input
            id="ollama-url"
            type="text"
            value={config.ollama_url}
            onChange={(e) => update("ollama_url", e.target.value)}
            placeholder="http://127.0.0.1:11434"
          />
        </div>
      </div>
      <p className="hint" style={{marginTop: '20px'}}>
        Push-to-talk hotkey is: <code>Ctrl + Win</code>
      </p>
    </main>
  );
}

export default App;
