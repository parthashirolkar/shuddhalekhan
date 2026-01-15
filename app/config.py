"""Configuration Module

Handles application configuration with YAML file support.
"""

import sys
from pathlib import Path
from typing import Any, Dict


DEFAULT_CONFIG: Dict[str, Any] = {
    "model": {
        "id": "openai/whisper-large-v3-turbo",
        "language": "auto",
        "device": "auto",
    },
    "hotkeys": {"start": "ctrl+win", "stop": "ctrl", "stop_and_send": "alt"},
    "audio": {"sample_rate": 16000, "channels": 1, "chunk_size": 1024},
    "injection": {
        "method": "clipboard",  # 'clipboard' or 'keyboard'
        "auto_newline": False,
    },
}


class Config:
    """Manages application configuration"""

    def __init__(self, config_path: Path | None = None):
        """
        Args:
            config_path: Optional path to configuration file. If None, uses default location.
        """
        if config_path is None:
            # Default to ~/.shuddhalekhan/config.yaml
            self.config_path = Path.home() / ".shuddhalekhan" / "config.yaml"
        else:
            self.config_path = config_path

        self.config = self._load()

    def _load(self) -> Dict[str, Any]:
        """Load configuration from file or use defaults"""
        if self.config_path.exists():
            try:
                # Try to import yaml
                import yaml

                with open(self.config_path, "r", encoding="utf-8") as f:
                    loaded_config = yaml.safe_load(f)

                # Merge with defaults (in case of missing keys)
                config = self._merge_config(DEFAULT_CONFIG, loaded_config)
                print(
                    f"[INFO] शुद्धलेखन configuration loaded from {self.config_path}",
                    flush=True,
                )
                return config

            except ImportError:
                print(
                    "[WARNING] PyYAML not installed, using default config",
                    file=sys.stderr,
                    flush=True,
                )
                return DEFAULT_CONFIG.copy()
            except Exception as e:
                print(
                    f"[WARNING] Failed to load config: {e}", file=sys.stderr, flush=True
                )
                print("[INFO] Using default configuration", flush=True)
                return DEFAULT_CONFIG.copy()
        else:
            # Create config directory and file
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            self._save(DEFAULT_CONFIG)
            return DEFAULT_CONFIG.copy()

    def _merge_config(self, base: Dict, updates: Dict) -> Dict:
        """
        Merge updates into base config recursively

        Args:
            base: Base configuration (defaults)
            updates: User configuration (loaded from file)

        Returns:
            Merged configuration
        """
        result = base.copy()
        for key, value in updates.items():
            if (
                key in result
                and isinstance(result[key], dict)
                and isinstance(value, dict)
            ):
                result[key] = self._merge_config(result[key], value)
            else:
                result[key] = value
        return result

    def _save(self, config: Dict[str, Any]) -> None:
        """
        Save configuration to YAML file

        Args:
            config: Configuration dictionary to save
        """
        try:
            import yaml

            with open(self.config_path, "w", encoding="utf-8") as f:
                yaml.dump(config, f, default_flow_style=False)

            print(
                f"[INFO] शुद्धलेखन configuration saved to {self.config_path}", flush=True
            )

        except ImportError:
            print(
                "[WARNING] PyYAML not installed, config not saved",
                file=sys.stderr,
                flush=True,
            )
        except Exception as e:
            print(f"[ERROR] Failed to save config: {e}", file=sys.stderr, flush=True)

    def save(self) -> None:
        """Save current configuration"""
        self._save(self.config)

    def get(self, key_path: str, default: Any = None) -> Any:
        """
        Get configuration value by key path (e.g., 'model.id')

        Args:
            key_path: Dot-separated path to config value
            default: Default value if key not found

        Returns:
            Configuration value or default
        """
        keys = key_path.split(".")
        value = self.config

        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return default

        return value

    def set(self, key_path: str, value: Any) -> None:
        """
        Set configuration value by key path

        Args:
            key_path: Dot-separated path to config value (e.g., 'model.language')
            value: Value to set
        """
        keys = key_path.split(".")
        config = self.config

        # Navigate to parent dict
        for key in keys[:-1]:
            if key not in config:
                config[key] = {}
            config = config[key]

        # Set final value
        config[keys[-1]] = value

    def reload(self) -> None:
        """Reload configuration from file"""
        self.config = self._load()
