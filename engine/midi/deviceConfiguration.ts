
import { DeviceConfiguration } from './deviceManager';
import { createLogger } from '../../utils/logger';

export interface StoredConfiguration {
  version: string;
  lastUpdated: Date;
  devices: {
    selectedDeviceId: string | null;
    deviceHistory: Array<{
      id: string;
      name: string;
      lastUsed: Date;
    }>;
  };
  preferences: {
    localControlDefault: 'on' | 'off';
    channelMode: 'omni' | 'single';
    activeChannel: number;
    autoReconnect: boolean;
    scanInterval: number;
  };
  tuningMaps: {
    activeMapId: string | null;
    recentMaps: string[];
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class DeviceConfigurationManager {
  private static log = createLogger('midi/device-config');
  private static readonly STORAGE_KEY = 'midi-device-manager-config';
  private static readonly CURRENT_VERSION = '1.0.0';
  private static readonly MAX_DEVICE_HISTORY = 10;
  private static readonly MAX_RECENT_MAPS = 10;

  static saveConfiguration(config: DeviceConfiguration, deviceHistory?: Array<{ id: string; name: string; lastUsed: Date }>): void {
    try {
      const stored: StoredConfiguration = {
        version: this.CURRENT_VERSION,
        lastUpdated: new Date(),
        devices: {
          selectedDeviceId: config.selectedDeviceId,
          deviceHistory: deviceHistory ?? [],
        },
        preferences: {
          localControlDefault: config.localControlState === 'unknown' ? 'on' : config.localControlState,
          channelMode: config.channelMode,
          activeChannel: config.activeChannel,
          autoReconnect: true,
          scanInterval: 2000,
        },
        tuningMaps: {
          activeMapId: config.tuningMapId,
          recentMaps: [],
        },
      };

      if (stored.devices.deviceHistory.length > this.MAX_DEVICE_HISTORY) {
        stored.devices.deviceHistory = stored.devices.deviceHistory.slice(-this.MAX_DEVICE_HISTORY);
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stored));
    } catch (error) {
      this.log.error('Failed to save configuration', error);
      throw error;
    }
  }

  static loadConfiguration(): DeviceConfiguration | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return null;
      }

      const config: StoredConfiguration = JSON.parse(stored);

      const validation = this.validateConfiguration(config);
      if (!validation.valid) {
        this.log.warn('Invalid configuration', validation.errors);
        return this.getDefaultConfiguration();
      }

      const migrated = this.migrateConfiguration(config);

      return {
        selectedDeviceId: migrated.devices.selectedDeviceId,
        localControlState: migrated.preferences.localControlDefault,
        channelMode: migrated.preferences.channelMode,
        activeChannel: migrated.preferences.activeChannel,
        tuningMapId: migrated.tuningMaps.activeMapId,
      };
    } catch (error) {
      this.log.error('Failed to load configuration', error);
      return this.getDefaultConfiguration();
    }
  }

  static getDefaultConfiguration(): DeviceConfiguration {
    return {
      selectedDeviceId: null,
      localControlState: 'unknown',
      channelMode: 'omni',
      activeChannel: 1,
      tuningMapId: null,
    };
  }

  static validateConfiguration(config: StoredConfiguration): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.version) {
      errors.push('Missing version field');
    }

    if (!config.devices) {
      errors.push('Missing devices field');
    }
    if (!config.preferences) {
      errors.push('Missing preferences field');
    }
    if (!config.tuningMaps) {
      errors.push('Missing tuningMaps field');
    }

    if (config.preferences) {
      if (config.preferences.channelMode !== 'omni' && config.preferences.channelMode !== 'single') {
        errors.push(`Invalid channelMode: ${config.preferences.channelMode}`);
      }

      if (config.preferences.activeChannel < 1 || config.preferences.activeChannel > 16) {
        errors.push(`Invalid activeChannel: ${config.preferences.activeChannel}`);
      }

      if (config.preferences.scanInterval < 100) {
        warnings.push(`Scan interval too low: ${config.preferences.scanInterval}ms (minimum 100ms recommended)`);
      }
    }

    if (config.devices?.deviceHistory) {
      if (config.devices.deviceHistory.length > this.MAX_DEVICE_HISTORY) {
        warnings.push(`Device history exceeds maximum size (${this.MAX_DEVICE_HISTORY})`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static migrateConfiguration(config: StoredConfiguration): StoredConfiguration {
    
    if (config.version === this.CURRENT_VERSION) {
      return config;
    }

    return {
      ...config,
      version: this.CURRENT_VERSION,
      lastUpdated: new Date(),
    };
  }

  static clearConfiguration(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      this.log.error('Failed to clear configuration', error);
    }
  }

  static hasConfiguration(): boolean {
    try {
      return localStorage.getItem(this.STORAGE_KEY) !== null;
    } catch (error) {
      return false;
    }
  }

  static getStoredConfiguration(): StoredConfiguration | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return null;
      }
      return JSON.parse(stored);
    } catch (error) {
      this.log.error('Failed to get stored configuration', error);
      return null;
    }
  }
}
