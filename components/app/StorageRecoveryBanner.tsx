import React from 'react';
import { useStore } from '../../store';
import { downloadJson } from '../../utils/download';
import { buildDiagnosticsPackage } from '../../utils/diagnostics';

export const StorageRecoveryBanner = () => {
  const { storageRecovery, isStorageReadOnly, ackStorageRecovery, nuclearReset } = useStore((s) => ({
    storageRecovery: s.storageRecovery,
    isStorageReadOnly: s.isStorageReadOnly,
    ackStorageRecovery: s.ackStorageRecovery,
    nuclearReset: s.nuclearReset
  }));

  if (!storageRecovery) return null;

  const exportPayload = () => {
    downloadJson(`storage-recovery-${Date.now()}.json`, {
      exportedAt: new Date().toISOString(),
      readOnly: isStorageReadOnly,
      recovery: storageRecovery
    });
  };

  const exportDiagnostics = () => {
    const state = useStore.getState();
    downloadJson(`diagnostics-${Date.now()}.json`, buildDiagnosticsPackage(state));
  };

  return (
    <div className="pointer-events-none absolute top-3 left-1/2 z-[80] w-[92%] max-w-[860px] -translate-x-1/2">
      <div className="pointer-events-auto rounded-2xl border border-amber-500/40 bg-black/80 p-4 text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">Storage Recovery</div>
            <div className="mt-1 text-[11px] text-gray-300">
              Saved state looks corrupted. Running in read-only mode to avoid overwriting your data.
            </div>
            <div className="mt-1 text-[10px] text-amber-200/80">Reason: {storageRecovery.reason}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportPayload}
              className="rounded-full border border-amber-400/40 bg-amber-600/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-100 hover:bg-amber-500/30"
            >
              Export Data
            </button>
            <button
              onClick={exportDiagnostics}
              className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-200 hover:bg-white/20"
            >
              Diagnostics
            </button>
            <button
              onClick={ackStorageRecovery}
              className="rounded-full border border-gray-700 bg-black/40 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-300 hover:bg-gray-800"
            >
              Continue
            </button>
            <button
              onClick={nuclearReset}
              className="rounded-full border border-red-500/50 bg-red-600/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-red-100 hover:bg-red-500/30"
            >
              Reset Storage
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
