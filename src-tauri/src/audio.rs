use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, Host, SampleFormat, Stream, StreamConfig};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Emitter};

pub struct AudioManager {
    host: Host,
    current_device: Option<Device>,
    is_recording: Arc<Mutex<bool>>,
    audio_buffer: Arc<Mutex<Vec<f32>>>,
    start_time: Arc<Mutex<Option<Instant>>>,
    stream: Arc<Mutex<Option<Stream>>>,
    input_sample_rate: Arc<Mutex<u32>>,
    input_channels: Arc<Mutex<u16>>,
    err_callback: Arc<Mutex<Option<cpal::StreamError>>>,
}

impl AudioManager {
    pub fn new() -> Result<Self, String> {
        let host = cpal::default_host();

        let default_device = host
            .default_input_device()
            .ok_or("No default audio device found")?;

        Ok(Self {
            host,
            current_device: Some(default_device),
            is_recording: Arc::new(Mutex::new(false)),
            audio_buffer: Arc::new(Mutex::new(Vec::new())),
            start_time: Arc::new(Mutex::new(None)),
            stream: Arc::new(Mutex::new(None)),
            input_sample_rate: Arc::new(Mutex::new(0)),
            input_channels: Arc::new(Mutex::new(0)),
            err_callback: Arc::new(Mutex::new(None)),
        })
    }

    pub fn get_input_devices(&self) -> Result<Vec<String>, String> {
        let devices = self
            .host
            .input_devices()
            .map_err(|e| format!("Failed to get input devices: {}", e))?;

        // Deprecated d.name() used because cpal hasn't provided a stable cross-platform 
        // alternative for getting device names yet as of 0.15+.
        #[allow(deprecated)]
        let device_names: Vec<String> = devices.filter_map(|d| d.name().ok()).collect();

        Ok(device_names)
    }

    pub fn set_device(&mut self, device_name: &str) -> Result<(), String> {
        let devices = self
            .host
            .input_devices()
            .map_err(|e| format!("Failed to get input devices: {}", e))?;

        for device in devices {
            // See rationale for deprecated d.name() above
            #[allow(deprecated)]
            if let Ok(name) = device.name() {
                if name == device_name {
                    self.current_device = Some(device);
                    return Ok(());
                }
            }
        }

        Err(format!("Device '{}' not found", device_name))
    }

    pub fn start_recording(&self, app: AppHandle) -> Result<(), String> {
        if *self.is_recording.lock().expect("Failed to lock is_recording mutex") {
            return Ok(());
        }

        let device = self
            .current_device
            .as_ref()
            .ok_or("No device selected")?
            .clone();

        let default_config = device
            .default_input_config()
            .map_err(|e| format!("Failed to get default config: {}", e))?;

        let sample_rate = default_config.sample_rate();
        let channels = default_config.channels();

        let config: StreamConfig = default_config.clone().into();
        let sample_format = default_config.sample_format();

        let is_recording = Arc::clone(&self.is_recording);
        let audio_buffer = Arc::clone(&self.audio_buffer);
        let start_time = Arc::clone(&self.start_time);

        *is_recording.lock().expect("Failed to lock is_recording mutex") = true;
        audio_buffer.lock().expect("Failed to lock audio buffer").clear();
        *start_time.lock().expect("Failed to lock start time") = Some(Instant::now());
        *self.input_sample_rate.lock().expect("Failed to lock input sample rate") = sample_rate;
        *self.input_channels.lock().expect("Failed to lock input channels") = channels;

        let err_callback = Arc::clone(&self.err_callback);
        *err_callback.lock().expect("Failed to lock err callback") = None;

        let stream = match sample_format {
            SampleFormat::I16 => device.build_input_stream(
                &config,
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    Self::process_audio_i16(data, &audio_buffer, &app, &start_time);
                },
                move |err| {
                    eprintln!("Audio stream error: {:?}", err);
                    *err_callback.lock().expect("Failed to lock err callback") = Some(err);
                },
                None,
            ),
            SampleFormat::F32 => device.build_input_stream(
                &config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    Self::process_audio_f32(data, &audio_buffer, &app, &start_time);
                },
                move |err| {
                    eprintln!("Audio stream error: {:?}", err);
                    *err_callback.lock().expect("Failed to lock err callback") = Some(err);
                },
                None,
            ),
            _ => return Err("Unsupported sample format".to_string()),
        }
        .map_err(|e| format!("Failed to build stream: {}", e))?;

        // Play and store the stream so it doesn't get dropped
        stream
            .play()
            .map_err(|e| format!("Failed to play stream: {}", e))?;
        *self.stream.lock().expect("Failed to lock stream") = Some(stream);

        Ok(())
    }

    pub fn stop_recording(&mut self) -> Result<Vec<u8>, String> {
        *self.is_recording.lock().expect("Failed to lock is_recording mutex") = false;

        // Check for stream errors that occurred during recording
        if let Some(err) = self.err_callback.lock().expect("Failed to lock err_callback").take() {
            eprintln!("Recorded stream encountered an error previously: {:?}", err);
            // We can continue processing what we have been able to record
        }

        // Drop the stream to stop recording
        *self.stream.lock().expect("Failed to lock stream") = None;

        let buffer = self.audio_buffer.lock().expect("Failed to lock audio buffer").clone();
        let sample_rate = *self.input_sample_rate.lock().expect("Failed to lock input sample rate");
        let channels = *self.input_channels.lock().expect("Failed to lock input channels");

        // 1. Downmix to mono if necessary
        let mono_buffer = if channels > 1 {
            let mut mono = Vec::with_capacity(buffer.len() / channels as usize);
            for chunk in buffer.chunks_exact(channels as usize) {
                let sum: f32 = chunk.iter().sum();
                mono.push(sum / (channels as f32));
            }
            mono
        } else {
            buffer
        };

        // 2. Linear Resample to 16000 Hz if necessary
        let target_sample_rate = 16000;
        let resampled_buffer = if sample_rate != target_sample_rate && sample_rate > 0 {
            let ratio = sample_rate as f64 / target_sample_rate as f64;
            let output_len = (mono_buffer.len() as f64 / ratio).ceil() as usize;
            let mut resampled = Vec::with_capacity(output_len);

            for i in 0..output_len {
                let src_idx_f = i as f64 * ratio;
                let src_idx = src_idx_f as usize;

                if src_idx >= mono_buffer.len() - 1 {
                    resampled.push(mono_buffer[mono_buffer.len() - 1]);
                } else {
                    let fraction = (src_idx_f - src_idx as f64) as f32;
                    let sample1 = mono_buffer[src_idx];
                    let sample2 = mono_buffer[src_idx + 1];
                    // Linear interpolation
                    resampled.push(sample1 + fraction * (sample2 - sample1));
                }
            }
            resampled
        } else {
            mono_buffer
        };

        // 3. Convert f32 back to i16 bytes
        let final_pcm: Vec<u8> = resampled_buffer
            .into_iter()
            .flat_map(|sample| {
                // clamp and convert to i16
                let s = sample.clamp(-1.0, 1.0);
                let val = (s * 32767.0) as i16;
                val.to_le_bytes()
            })
            .collect();

        // Convert raw PCM to WAV format
        let wav_data = self.pcm_to_wav(final_pcm)?;
        Ok(wav_data)
    }

    fn pcm_to_wav(&self, pcm_data: Vec<u8>) -> Result<Vec<u8>, String> {
        if pcm_data.is_empty() {
            return Ok(Vec::new());
        }

        // Assume 16-bit PCM, 16kHz, mono (whisper.cpp default)
        let sample_rate = 16000u32;
        let num_channels = 1u16;
        let bits_per_sample = 16u16;
        let byte_rate: u32 = sample_rate * num_channels as u32 * bits_per_sample as u32 / 8;
        let block_align: u16 = num_channels * bits_per_sample / 8;
        let data_size = pcm_data.len();
        let file_size = 36 + data_size as u32;

        let mut wav = Vec::with_capacity(44 + data_size);

        // RIFF header
        wav.extend_from_slice(b"RIFF");
        wav.extend_from_slice(&file_size.to_le_bytes());
        wav.extend_from_slice(b"WAVE");

        // fmt chunk
        wav.extend_from_slice(b"fmt ");
        wav.extend_from_slice(&16u32.to_le_bytes()); // chunk size
        wav.extend_from_slice(&1u16.to_le_bytes()); // audio format (PCM)
        wav.extend_from_slice(&num_channels.to_le_bytes());
        wav.extend_from_slice(&sample_rate.to_le_bytes());
        wav.extend_from_slice(&byte_rate.to_le_bytes());
        wav.extend_from_slice(&block_align.to_le_bytes());
        wav.extend_from_slice(&bits_per_sample.to_le_bytes());

        // data chunk
        wav.extend_from_slice(b"data");
        wav.extend_from_slice(&(data_size as u32).to_le_bytes());
        wav.extend_from_slice(&pcm_data);

        Ok(wav)
    }

    fn process_audio_i16(
        data: &[i16],
        audio_buffer: &Arc<Mutex<Vec<f32>>>,
        app: &AppHandle,
        start_time: &Arc<Mutex<Option<Instant>>>,
    ) {
        let floats: Vec<f32> = data
            .iter()
            .map(|&sample| (sample as f32) / 32768.0)
            .collect();

        let mut buffer = audio_buffer.lock().expect("Failed to lock audio buffer");
        buffer.extend_from_slice(&floats);
        drop(buffer);

        let level = calculate_audio_level_i16(data);
        let duration = start_time.lock().expect("Failed to lock start time").map(|t| t.elapsed().as_secs());

        let _ = app.emit("audio-level-changed", level);
        if let Some(d) = duration {
            let _ = app.emit("recording-duration-changed", d);
        }
    }

    fn process_audio_f32(
        data: &[f32],
        audio_buffer: &Arc<Mutex<Vec<f32>>>,
        app: &AppHandle,
        start_time: &Arc<Mutex<Option<Instant>>>,
    ) {
        let mut buffer = audio_buffer.lock().expect("Failed to lock audio buffer");
        buffer.extend_from_slice(data);
        drop(buffer);

        let level = calculate_audio_level_f32(data);
        let duration = start_time.lock().expect("Failed to lock start time").map(|t| t.elapsed().as_secs());

        let _ = app.emit("audio-level-changed", level);
        if let Some(d) = duration {
            let _ = app.emit("recording-duration-changed", d);
        }
    }
}

fn calculate_audio_level_i16(data: &[i16]) -> f64 {
    if data.is_empty() {
        return 0.0;
    }

    let sum: i64 = data.iter().map(|&s| (s as i64).abs()).sum();
    let avg = (sum as f64) / (data.len() as f64);
    (avg / 32767.0).min(1.0)
}

fn calculate_audio_level_f32(data: &[f32]) -> f64 {
    if data.is_empty() {
        return 0.0;
    }

    let sum: f32 = data.iter().map(|&s| s.abs()).sum();
    let avg = sum / (data.len() as f32);
    (avg as f64).min(1.0)
}
