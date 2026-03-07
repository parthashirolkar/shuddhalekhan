import { load } from '@tauri-apps/plugin-store';

// Default config values
const DEFAULT_CONFIG = {
  whisper_url: 'http://127.0.0.1:8080/v1/audio/transcriptions',
  ollama_url: 'http://127.0.0.1:11434',
  selected_device: '',
};

export type AppConfig = typeof DEFAULT_CONFIG;

let storeInstance: Awaited<ReturnType<typeof load>> | null = null;

async function getStore() {
  if (!storeInstance) {
    // This will create or load config.json in the app's appData directory
    storeInstance = await load('config.json', { 
      autoSave: false,
      defaults: DEFAULT_CONFIG 
    });
  }
  return storeInstance;
}

export async function getConfig(): Promise<AppConfig> {
  const store = await getStore();
  const config = { ...DEFAULT_CONFIG };
  
  for (const key of Object.keys(DEFAULT_CONFIG) as Array<keyof AppConfig>) {
    const val = await store.get<string>(key);
    if (val !== null && val !== undefined) {
      config[key] = val;
    } else {
      // Initialize if missing
      await store.set(key, DEFAULT_CONFIG[key]);
    }
  }
  
  await store.save();
  return config;
}

export async function updateConfig<K extends keyof AppConfig>(key: K, value: AppConfig[K]): Promise<void> {
  const store = await getStore();
  await store.set(key, value);
  await store.save();
}

// React Hook for easy state management
import { useState, useEffect } from 'react';

export function useConfig() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConfig().then((c) => {
      setConfig(c);
      setLoading(false);
    });
  }, []);

  const update = async <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
    try {
      await updateConfig(key, value);
      setConfig((prev) => ({ ...prev, [key]: value }));
    } catch (e) {
      console.error("Failed to update config:", e);
      // Depending on UI framework, could show a toast here
    }
  };

  return { config, update, loading };
}