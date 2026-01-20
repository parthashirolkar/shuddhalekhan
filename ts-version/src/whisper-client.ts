const SERVER_URL = "http://localhost:8080/inference";

export interface TranscriptionResult {
  text: string;
}

export class WhisperClient {
  private serverUrl: string;

  constructor(serverUrl = SERVER_URL) {
    this.serverUrl = serverUrl;
  }

  async transcribe(wavBuffer: Buffer, temperature = 0.2): Promise<string | null> {
    try {
      const boundary = `----WebKitFormBoundary${Date.now()}`;
      const CRLF = "\r\n";
      
      let bodyParts: Buffer[] = [];
      
      let header = "";
      header += `--${boundary}${CRLF}`;
      header += `Content-Disposition: form-data; name="file"; filename="audio.wav"${CRLF}`;
      header += `Content-Type: audio/wav${CRLF}`;
      header += `${CRLF}`;
      bodyParts.push(Buffer.from(header, "utf8"));
      bodyParts.push(wavBuffer);
      
      header = "";
      header += `${CRLF}--${boundary}${CRLF}`;
      header += `Content-Disposition: form-data; name="temperature"${CRLF}${CRLF}`;
      header += `${temperature}${CRLF}`;
      bodyParts.push(Buffer.from(header, "utf8"));
      
      header = "";
      header += `--${boundary}${CRLF}`;
      header += `Content-Disposition: form-data; name="response_format"${CRLF}${CRLF}`;
      header += `json${CRLF}`;
      bodyParts.push(Buffer.from(header, "utf8"));
      
      bodyParts.push(Buffer.from(`--${boundary}--${CRLF}`, "utf8"));
      
      const bodyBuffer = Buffer.concat(bodyParts);
      
      const response = await fetch(this.serverUrl, {
        method: "POST",
        body: bodyBuffer,
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": bodyBuffer.length.toString(),
        },
      });

      if (!response.ok) {
        console.error(`[ERROR] Whisper server responded with status ${response.status}`);
        return null;
      }

      const result = (await response.json()) as TranscriptionResult;

      return result.text?.trim() || null;
    } catch (error) {
      console.error(`[ERROR] Transcription failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}
