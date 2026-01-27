import * as cpal from "node-cpal";
import { logger } from "./logger.ts";

export interface AudioDevice {
  id: string;
  name: string;
  isDefault: boolean;
}

export class AudioDeviceManager {
  // Enumerate audio input devices using node-cpal
  getInputDevices(): AudioDevice[] {
    try {
      const allDevices = (cpal as any).getDevices();

      // Filter for input devices (devices that are not output-only)
      const inputDevices = allDevices.filter(
        (d: any) => d.isDefaultInput || !d.isDefaultOutput
      );

      return inputDevices.map((d: any) => ({
        id: d.deviceId,
        name: d.name,
        isDefault: d.isDefaultInput || false,
      }));
    } catch (error) {
      logger.error(`Failed to enumerate audio devices: ${error}`);
      return [];
    }
  }

  // Get the default input device
  getDefaultInputDevice(): AudioDevice | null {
    try {
      const device = cpal.getDefaultInputDevice();
      if (!device) {
        return null;
      }

      return {
        id: device.deviceId,
        name: device.name,
        isDefault: true,
      };
    } catch (error) {
      logger.error(`Failed to get default input device: ${error}`);
      return null;
    }
  }

  // Check if a device ID is valid
  isValidDevice(deviceId: string): boolean {
    const devices = this.getInputDevices();
    return devices.some((d) => d.id === deviceId);
  }
}
