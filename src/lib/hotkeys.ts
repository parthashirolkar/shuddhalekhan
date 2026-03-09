import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { invoke } from '@tauri-apps/api/core';
import { message } from '@tauri-apps/plugin-dialog';
import { handleAudioTranscription } from './whisperClient';

export async function setupHotkeys() {
  await unregisterAll();
  
  // Try to register the push-to-talk hotkey
  const shortcut = 'Control+Shift+Space'; 
  
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
    await message(
      `Failed to register push-to-talk hotkey (${shortcut}).\n\nAnother application might be using it, or your OS is blocking it.`, 
      { title: 'Hotkey Error', kind: 'warning' }
    );
  }
}
