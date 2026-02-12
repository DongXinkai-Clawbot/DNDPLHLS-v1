
import React from 'react';
import { MidiDeviceInfo } from '../../engine/midi/deviceManager';
import { useMidiDeviceManager } from '../../hooks/useMidiDeviceManager';
import { createSysExQueue } from '../../engine/midi/sysexQueue';
import { createLogger } from '../../utils/logger';

interface MidiDevicePanelInternalProps {
  devices: MidiDeviceInfo[];
  selectedDevice: MidiDeviceInfo | null;
  localControlState: 'on' | 'off' | 'unknown';
  isInitialized: boolean;
  error: Error | null;
  onSelectDevice: (deviceId: string) => Promise<void>;
  onSetLocalControl: (state: 'on' | 'off') => Promise<void>;
  onExecutePanic: () => Promise<void>;
  compact?: boolean;
}

const log = createLogger('midi/device-panel');

const MidiDevicePanelInternal: React.FC<MidiDevicePanelInternalProps> = ({
  devices,
  selectedDevice,
  localControlState,
  isInitialized,
  error,
  onSelectDevice,
  onSetLocalControl,
  onExecutePanic,
  compact = false,
}) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const handleDeviceSelect = async (deviceId: string) => {
    if (!deviceId) return;
    setIsLoading(true);
    setLocalError(null);
    try {
      await onSelectDevice(deviceId);
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocalControlToggle = async () => {
    if (localControlState === 'unknown') return;
    const newState = localControlState === 'on' ? 'off' : 'on';
    setIsLoading(true);
    setLocalError(null);
    try {
      await onSetLocalControl(newState);
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePanic = async () => {
    setIsLoading(true);
    setLocalError(null);
    try {
      await onExecutePanic();
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const compatibleDevices = devices.filter(d => d.isCompatible && d.type === 'output');
  const displayError = error?.message || localError;

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-2 bg-gray-900/50 rounded-lg">
        <select
          value={selectedDevice?.id || ''}
          onChange={(e) => handleDeviceSelect(e.target.value)}
          disabled={!isInitialized || isLoading || compatibleDevices.length === 0}
          className="bg-black border border-gray-700 text-white text-xs rounded px-2 py-1 outline-none focus:border-blue-500 disabled:opacity-50"
        >
          <option value="">No Device</option>
          {compatibleDevices.map(device => (
            <option key={device.id} value={device.id}>
              {device.name}
            </option>
          ))}
        </select>

        <button
          onClick={handleLocalControlToggle}
          disabled={!selectedDevice || localControlState === 'unknown' || isLoading}
          className={`text-xs px-2 py-1 rounded font-bold transition-all disabled:opacity-50 ${localControlState === 'off'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300'
            }`}
          title={`Local Control: ${localControlState}`}
        >
          LC
        </button>

        <button
          onClick={handlePanic}
          disabled={!selectedDevice || isLoading}
          className="bg-red-600 hover:bg-red-500 text-white text-xs px-2 py-1 rounded font-bold transition-all disabled:opacity-50"
          title="Panic: Stop all notes"
        >
          ⚠
        </button>

        {displayError && (
          <span className="text-red-400 text-xs truncate max-w-[200px]" title={displayError}>
            {displayError}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 bg-gray-900/50 rounded-xl border border-gray-800">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-white uppercase tracking-wider">
          MIDI Device
        </h3>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${isInitialized && selectedDevice
                ? 'bg-green-500'
                : isInitialized
                  ? 'bg-yellow-500'
                  : 'bg-gray-500'
              }`}
            title={
              isInitialized && selectedDevice
                ? 'Connected'
                : isInitialized
                  ? 'No device selected'
                  : 'Initializing...'
            }
          />
          <span className="text-xs text-gray-400">
            {isInitialized && selectedDevice
              ? 'Connected'
              : isInitialized
                ? 'Ready'
                : 'Initializing...'}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-gray-400 font-bold uppercase">
          Device
        </label>
        <select
          value={selectedDevice?.id || ''}
          onChange={(e) => handleDeviceSelect(e.target.value)}
          disabled={!isInitialized || isLoading || compatibleDevices.length === 0}
          className="bg-black border border-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">
            {compatibleDevices.length === 0
              ? 'No compatible devices found'
              : 'Select a device...'}
          </option>
          {compatibleDevices.map(device => (
            <option key={device.id} value={device.id}>
              {device.name} ({device.manufacturer})
            </option>
          ))}
        </select>
        {compatibleDevices.length === 0 && isInitialized && (
          <p className="text-xs text-gray-500 italic">
            Connect a compatible MIDI device
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <label className="text-xs text-gray-400 font-bold uppercase">
            Local Control
          </label>
          <span className="text-xs text-gray-500">
            {localControlState === 'off'
              ? 'Computer-controlled mode'
              : localControlState === 'on'
                ? 'Traditional piano mode'
                : 'Unknown state'}
          </span>
        </div>
        <button
          onClick={handleLocalControlToggle}
          disabled={!selectedDevice || localControlState === 'unknown' || isLoading}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${localControlState === 'off'
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
        >
          {localControlState === 'off' ? 'ON' : 'OFF'}
        </button>
      </div>

      <button
        onClick={handlePanic}
        disabled={!selectedDevice || isLoading}
        className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <span>⚠</span>
        <span>PANIC (Stop All Notes)</span>
      </button>

      {displayError && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
          <p className="text-xs text-red-400 font-bold uppercase mb-1">Error</p>
          <p className="text-xs text-red-300">{displayError}</p>
        </div>
      )}

      {selectedDevice && (
        <div className="bg-gray-800/50 rounded-lg p-3 text-xs">
          <div className="flex justify-between mb-1">
            <span className="text-gray-400">Name:</span>
            <span className="text-white font-mono">{selectedDevice.name}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span className="text-gray-400">Manufacturer:</span>
            <span className="text-white font-mono">{selectedDevice.manufacturer}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Status:</span>
            <span className={`font-mono ${selectedDevice.state === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
              {selectedDevice.state}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export const MidiDevicePanel: React.FC<{ compact?: boolean }> = ({ compact = false }) => {

  const transport = React.useMemo(() => {

    const transportObj = {
      sendMidi(bytes: number[]): void {

        log.info('Send MIDI', bytes);
      },

      sendAllNotesOff(): void {

        for (let c = 0; c < 16; c++) {
          transportObj.sendMidi([0xB0 | c, 123, 0]);
        }
      },
    };
    return transportObj;
  }, []);

  const sysexQueue = React.useMemo(() => {
    return createSysExQueue(transport);
  }, []);

  const {
    devices,
    selectedDevice,
    localControlState,
    isInitialized,
    error,
    selectDevice,
    setLocalControl,
    executePanic,
  } = useMidiDeviceManager({
    sysexQueue,
    transport,
    autoInitialize: true,
  });

  return (
    <MidiDevicePanelInternal
      devices={devices}
      selectedDevice={selectedDevice}
      localControlState={localControlState}
      isInitialized={isInitialized}
      error={error}
      onSelectDevice={selectDevice}
      onSetLocalControl={setLocalControl}
      onExecutePanic={executePanic}
      compact={compact}
    />
  );
};
