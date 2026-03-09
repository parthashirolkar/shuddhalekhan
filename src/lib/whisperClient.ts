import { invoke } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';
import { message } from '@tauri-apps/plugin-dialog';

function isValidUrl(urlString: string) {
  try {
    new URL(urlString);
    return true;
  } catch (e) {
    return false;
  }
}

export async function handleAudioTranscription(audioData: Uint8Array) {
  try {
    const store = await load('config.json');
    const whisperUrl = await store.get<string>('whisper_url') || 'http://127.0.0.1:8080/v1/audio/transcriptions';

    if (!isValidUrl(whisperUrl)) {
      throw new Error(`Invalid Whisper URL configured: ${whisperUrl}`);
    }

    // Convert the incoming numeric array back to a binary ArrayBuffer before creating the Blob
    const binaryData = new Uint8Array(audioData);
    const blob = new Blob([binaryData], { type: 'audio/wav' });
    
    const formData = new FormData();
    formData.append('file', blob, 'audio.wav');
    formData.append('temperature', '0.2');
    formData.append('response_format', 'json');

    console.log(`Sending ${audioData.length} bytes to Whisper API...`);
    
    const response = await fetch(whisperUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Whisper API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const text = data.text;
    
    console.log(`Transcription: "${text}"`);
    
    if (text) {
      await invoke('inject_text', { text, withNewline: false });
    }
  } catch (error) {
    console.error('Transcription failed:', error);
    await message(
      `Failed to transcribe audio. Ensure Whisper is running at your configured URL.\n\nError: ${error}`, 
      { title: 'Transcription Error', kind: 'error' }
    );
  }
}