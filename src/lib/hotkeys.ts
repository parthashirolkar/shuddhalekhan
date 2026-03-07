import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { invoke } from '@tauri-apps/api/core';
import { handleAudioTranscription } from './whisperClient';

export async function setupHotkeys() {
  await unregisterAll();
  
  // Try to register the push-to-talk hotkey
  // We use Super for the Windows/Meta key.
  const shortcut = 'Control+Super'; 
  
  try {
    await register(shortcut, async (event) => {
      if (event.state === 'Pressed') {
        console.log('Push-to-talk pressed');
        await invoke('start_recording');
      } else if (event.state === 'Released') {
        console.log('Push-to-talk released');
        try {
          const audioData = await invoke<Uint8Array>('stop_recording');
          await handleAudioTranscription(audioData);
        } catch (e) {
          console.error('Error during stop_recording or transcription:', e);
        }
      }
    });
    console.log(`Registered hotkey: ${shortcut}`);
  } catch (err) {
    console.error(`Failed to register hotkey ${shortcut}:`, err);
  }
}
