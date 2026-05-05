import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useState, useEffect } from 'react';

export function useRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const unlistenPromises = [
      listen('recording-started', () => {
        setIsRecording(true);
      }),
      listen('recording-stopped', async () => {
        setIsRecording(false);
      }),
      listen('audio-level-changed', (event: { payload: number }) => {
        setAudioLevel(event.payload);
      }),
      listen('recording-duration-changed', (event: { payload: number }) => {
        setDuration(event.payload);
      }),
    ];

    return () => {
      unlistenPromises.forEach(p => p.then(f => f()));
    };
  }, []);

  const startRecording = async () => {
    try {
      await invoke('start_recording');
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = async () => {
    try {
      const text = await invoke<string>('stop_recording');
      return text;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      return null;
    }
  };

  const injectText = async (text: string, withNewline: boolean = false) => {
    try {
      await invoke('inject_text', { text, withNewline });
    } catch (error) {
      console.error('Failed to inject text:', error);
    }
  };

  return {
    isRecording,
    audioLevel,
    duration,
    startRecording,
    stopRecording,
    injectText,
  };
}
