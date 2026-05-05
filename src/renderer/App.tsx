import { useEffect } from 'react';
import { startRecording, stopRecording, enumerateDevices, setSelectedDeviceId } from './audio-capture';
import { RecordingPopup } from './RecordingPopup';
import './App.css';

async function sendAudioDevices(): Promise<void> {
  const devices = await enumerateDevices();
  window.electronAPI?.send('audio-devices', devices);
}

function AudioWindow() {
  useEffect(() => {
    let startPromise: Promise<void> | null = null;

    window.electronAPI?.invoke('config:get').then((config) => {
      setSelectedDeviceId(config.selectedDeviceId);
    }).catch((err) => {
      console.error('Failed to load audio config:', err);
    });

    // Enumerate devices on mount and send to main process
    sendAudioDevices().then(() => {
      console.log('Audio devices sent to main process');
    }).catch((err) => {
      console.error('Failed to enumerate audio devices:', err);
    });

    // Listen for commands from main process
    const removeStart = window.electronAPI?.on('audio:start-recording', () => {
      startPromise = startRecording()
        .then(() => {
          void sendAudioDevices().catch((err) => {
            console.error('Failed to refresh audio devices after recording started:', err);
          });
        })
        .catch((err) => {
          console.error('Failed to start recording:', err);
          throw err;
        })
        .finally(() => {
          startPromise = null;
        });
    });

    const removeStop = window.electronAPI?.on('audio:stop-recording', async () => {
      try {
        await startPromise;
        const audioData = stopRecording();
        window.electronAPI?.send('audio-data-ready', audioData.buffer);
      } catch (err) {
        console.error('Failed to stop recording:', err);
      }
    });

    const removeSelect = window.electronAPI?.on('audio:select-device', (deviceId: string) => {
      setSelectedDeviceId(deviceId);
    });

    window.electronAPI?.send('audio-window-ready');

    return () => {
      removeStart?.();
      removeStop?.();
      removeSelect?.();
    };
  }, []);

  return null;
}

function MainWindow() {
  return (
    <main className="container">
      <h1>Shuddhalekhan</h1>
      <p>System tray application running...</p>
      <p>Hold Ctrl+Win to start recording</p>
      <p>Release to stop and transcribe</p>
    </main>
  );
}

function App() {
  const hash = window.location.hash.replace(/^#\/?/, '');

  if (hash === 'recording') {
    return <RecordingPopup />;
  }

  if (hash === 'audio') {
    return <AudioWindow />;
  }

  return <MainWindow />;
}

export default App;
