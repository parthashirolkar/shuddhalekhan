//! Clean Windows COM API for precise volume control
//!
//! Uses Windows Core Audio API via IAudioEndpointVolume for exact
//! volume percentage control instead of simulating media keypresses.

#[cfg(target_os = "windows")]
use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
#[cfg(target_os = "windows")]
use windows::Win32::Media::Audio::{eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
#[cfg(target_os = "windows")]
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CLSCTX_ALL, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED,
};

/// Error type for volume operations
#[derive(Debug)]
#[allow(dead_code)]
pub enum VolumeError {
    WindowsError(windows::core::Error),
    InvalidLevel(String),
    UnsupportedPlatform,
}

impl std::fmt::Display for VolumeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            VolumeError::WindowsError(e) => write!(f, "Windows API error: {}", e),
            VolumeError::InvalidLevel(s) => write!(f, "Invalid volume level: {}", s),
            VolumeError::UnsupportedPlatform => {
                write!(f, "Volume control not supported on this platform")
            }
        }
    }
}

impl std::error::Error for VolumeError {}

impl From<windows::core::Error> for VolumeError {
    fn from(err: windows::core::Error) -> Self {
        VolumeError::WindowsError(err)
    }
}

/// Get a handle to the default audio endpoint volume control
#[cfg(target_os = "windows")]
unsafe fn get_volume_control() -> windows::core::Result<IAudioEndpointVolume> {
    // Initialize COM (safe to call multiple times, returns S_FALSE if already initialized)
    let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

    // Create the device enumerator
    let enumerator: IMMDeviceEnumerator =
        CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_INPROC_SERVER)?;

    // Get the default audio rendering device (speakers/headphones)
    let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;

    // Activate the IAudioEndpointVolume interface for direct control
    let volume_control: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None)?;

    Ok(volume_control)
}

/// Get the current system volume as a percentage (0-100)
///
/// Returns the current master volume level on Windows, or 50 on other platforms.
pub fn get_volume() -> Result<u32, VolumeError> {
    #[cfg(target_os = "windows")]
    {
        unsafe {
            let volume_control = get_volume_control()?;
            let current_volume = volume_control.GetMasterVolumeLevelScalar()?;
            Ok((current_volume * 100.0).round() as u32)
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err(VolumeError::UnsupportedPlatform)
    }
}

/// Set the system volume to an exact percentage (0-100)
///
/// Instantly sets the master volume without simulating keypresses.
pub fn set_volume(level: u32) -> Result<(), VolumeError> {
    let level = level.clamp(0, 100);

    #[cfg(target_os = "windows")]
    {
        unsafe {
            let volume_control = get_volume_control()?;
            let scalar = level as f32 / 100.0;
            volume_control.SetMasterVolumeLevelScalar(scalar, std::ptr::null())?;
            Ok(())
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err(VolumeError::UnsupportedPlatform)
    }
}

/// Increase volume by a specific percentage amount
///
/// Calculates the new target from current level and sets it exactly.
pub fn increase_volume_by(amount: u32) -> Result<u32, VolumeError> {
    let current = get_volume()?;
    let new_level = (current + amount).min(100);
    set_volume(new_level)?;
    Ok(new_level)
}

/// Decrease volume by a specific percentage amount
///
/// Calculates the new target from current level and sets it exactly.
pub fn decrease_volume_by(amount: u32) -> Result<u32, VolumeError> {
    let current = get_volume()?;
    let new_level = current.saturating_sub(amount);
    set_volume(new_level)?;
    Ok(new_level)
}

/// Toggle the system mute state
///
/// Returns the new mute state (true = muted).
pub fn toggle_mute() -> Result<bool, VolumeError> {
    #[cfg(target_os = "windows")]
    {
        unsafe {
            let volume_control = get_volume_control()?;
            let current_mute = volume_control.GetMute()?;
            let new_mute = !current_mute.as_bool();
            volume_control.SetMute(new_mute, std::ptr::null())?;
            Ok(new_mute)
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err(VolumeError::UnsupportedPlatform)
    }
}

/// Set mute state explicitly
///
/// true = muted, false = unmuted
#[allow(dead_code)]
pub fn set_mute(mute: bool) -> Result<(), VolumeError> {
    #[cfg(target_os = "windows")]
    {
        unsafe {
            let volume_control = get_volume_control()?;
            volume_control.SetMute(mute, std::ptr::null())?;
            Ok(())
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err(VolumeError::UnsupportedPlatform)
    }
}

/// Check if the system is currently muted
#[allow(dead_code)]
pub fn is_muted() -> Result<bool, VolumeError> {
    #[cfg(target_os = "windows")]
    {
        unsafe {
            let volume_control = get_volume_control()?;
            Ok(volume_control.GetMute()?.as_bool())
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err(VolumeError::UnsupportedPlatform)
    }
}
