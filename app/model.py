"""Speech-to-Text Model Module

Handles Whisper model loading and transcription.
"""

import sys
import threading
import torch
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline


# ─── CONFIGURATION ───────────────────────────────────────────────────
SAMPLE_RATE = 16000  # Required by Whisper model
MODEL_ID = "openai/whisper-large-v3-turbo"


class SpeechToTextModel:
    """Handles Whisper model loading and transcription"""

    def __init__(self, language="auto"):
        self.language = language
        self.pipeline = None
        self.model_loaded = False
        self._load_model_thread = None

    def load_model_async(self):
        """Load Whisper model in background thread"""
        if self.model_loaded:
            return

        def _load():
            device = "cuda:0" if torch.cuda.is_available() else "cpu"

            # Use bfloat16 if available (better numerical stability for transformers)
            if torch.cuda.is_available() and torch.cuda.is_bf16_supported():
                dtype = torch.bfloat16
                print(f"Using bfloat16 (bf16) for better stability and performance")
            elif torch.cuda.is_available():
                dtype = torch.float16
            else:
                dtype = torch.float32

            print(
                f"Loading OpenAI Whisper Large V3 Turbo (language: {self.language})..."
            )
            print(f"Device: {device}, Precision: {dtype}")
            sys.stdout.flush()

            # Load model and processor
            model = AutoModelForSpeechSeq2Seq.from_pretrained(
                MODEL_ID,
                torch_dtype=dtype,
                low_cpu_mem_usage=True,
                use_safetensors=True,
            )
            model.to(device)

            processor = AutoProcessor.from_pretrained(MODEL_ID)

            # Create pipeline
            self.pipeline = pipeline(
                "automatic-speech-recognition",
                model=model,
                tokenizer=processor.tokenizer,
                feature_extractor=processor.feature_extractor,
                torch_dtype=dtype,
                device=device,
            )

            self.model_loaded = True
            print("[INFO] Model loaded successfully!\n")
            sys.stdout.flush()

        # Load in background thread
        self._load_model_thread = threading.Thread(target=_load, daemon=True)
        self._load_model_thread.start()

    def wait_for_model(self, timeout: float = 60.0):
        """Wait for model to load (with timeout in seconds)"""
        if self._load_model_thread is None:
            return False

        self._load_model_thread.join(timeout=timeout)
        return self.model_loaded

    def transcribe(self, audio_array):
        """Transcribe audio array to text"""
        if audio_array is None or len(audio_array) == 0:
            return None

        if not self.model_loaded:
            print("[ERROR] Model not loaded yet", file=sys.stderr)
            return None

        # Prepare audio dictionary for pipeline
        audio_input = {"array": audio_array, "sampling_rate": SAMPLE_RATE}

        try:
            # Transcribe using Whisper pipeline
            if self.language == "auto":
                # Auto-detect language
                result = self.pipeline(audio_input)
            else:
                # Specify language
                result = self.pipeline(
                    audio_input, generate_kwargs={"language": self.language}
                )

            return result["text"]
        except Exception as e:
            print(f"Transcription error: {e}", file=sys.stderr)
            return None
