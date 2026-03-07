import { getConfig } from './config';
import { invoke } from '@tauri-apps/api/core';

/**
 * Sends the recorded WAV buffer to the Whisper API using standard fetch
 * @param audioData Uint8Array containing raw WAV file bytes
 * @returns Transcribed text string
 */
export async function transcribeAudio(audioData: Uint8Array): Promise<string> {
  const config = await getConfig();
  
  if (!config.whisper_url) {
    throw new Error('Whisper URL is not configured');
  }

  // Build the multipart form data
  const formData = new FormData();
  
  // Create a Blob from the Uint8Array. Whisper expects audio files.
  const audioBlob = new Blob([audioData], { type: 'audio/wav' });
  formData.append('file', audioBlob, 'speech.wav');
  
  // These parameters mirror the old Rust whisper.rs defaults
  formData.append('temperature', '0.2');
  formData.append('response_format', 'json');

  console.log(`Sending ${audioData.length} bytes to ${config.whisper_url}`);

  const response = await fetch(config.whisper_url, {
    method: 'POST',
    body: formData,
    // Add headers if API key is required later
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Whisper API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  
  if (!result.text) {
    throw new Error('Invalid response from Whisper API: No text returned');
  }

  return result.text;
}

/**
 * Complete flow: Take audio, transcribe it, and inject it
 */
export async function handleAudioTranscription(audioData: Uint8Array) {
  try {
    console.log("Starting transcription...");
    const text = await transcribeAudio(audioData);
    
    console.log("Transcription successful:", text);
    
    // Inject the text via Rust's winput implementation
    await invoke('inject_text', { 
      text, 
      withNewline: false 
    });
    
    console.log("Text injected successfully");
  } catch (error) {
    console.error("Transcription pipeline failed:", error);
    // Here we can easily add a Toast notification or UI error state later
  }
}