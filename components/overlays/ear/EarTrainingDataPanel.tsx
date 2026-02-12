import React, { useMemo, useState } from 'react';
import { useStore } from '../../../store';
import { shallow } from 'zustand/shallow';
import type { EarTrainingPersistedV1 } from '../../../types';
import { notifyError, notifySuccess, notifyWarning, openConfirm } from '../../../utils/notifications';

export const EarTrainingDataPanel = ({ className }: { className?: string }) => {
  const {
    earTraining,
    exportEarTrainingData,
    importEarTrainingData,
    resetEarTrainingData
  } = useStore((s) => ({
    earTraining: s.earTraining,
    exportEarTrainingData: s.exportEarTrainingData,
    importEarTrainingData: s.importEarTrainingData,
    resetEarTrainingData: s.resetEarTrainingData
  }), shallow);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [raw, setRaw] = useState('');

  const exported = useMemo(() => {
    try {
      const data = exportEarTrainingData();
      return JSON.stringify(data, null, 2);
    } catch (e: any) {
      return `{"error":"${String(e?.message ?? e)}"}`;
    }
  }, [earTraining.persisted.updatedAt]);

  const doImport = () => {
    try {
      const parsed = JSON.parse(raw) as EarTrainingPersistedV1;
      importEarTrainingData(parsed, mode);
      setRaw('');
      notifySuccess('Import complete.', 'Ear Training');
    } catch (e: any) {
      notifyError(`Import failed: ${String(e?.message ?? e)}`, 'Ear Training');
    }
  };

  const doExportToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(exported);
      notifySuccess('Export copied to clipboard.', 'Ear Training');
    } catch {
      
      notifyWarning('Clipboard copy failed. You can manually select and copy the JSON.', 'Ear Training');
    }
  };

  return (
    <div className={`mt-2 p-2 border border-gray-700 rounded bg-gray-900 ${className ?? ''}`}>
      <div className="text-xs text-gray-300 mb-2">Data (Export / Import)</div>

      <div className="flex items-center gap-2 mb-2">
        <button className="px-2 py-1 text-xs rounded bg-gray-800 border border-gray-700 text-gray-200" onClick={doExportToClipboard}>
          Copy Export JSON
        </button>
        <button className="px-2 py-1 text-xs rounded bg-gray-800 border border-gray-700 text-gray-200" onClick={() => setRaw(exported)}>
          Load Export Below
        </button>
        <button className="px-2 py-1 text-xs rounded bg-red-900 border border-red-700 text-gray-100" onClick={() => {
          openConfirm({
            title: 'Reset Ear Training',
            message: 'Reset all Ear Training saved data?',
            confirmLabel: 'Reset',
            cancelLabel: 'Cancel',
            onConfirm: () => resetEarTrainingData()
          });
        }}>
          Reset Data
        </button>

        <div className="ml-auto flex items-center gap-2">
          <label className="text-[10px] text-gray-400">Import mode</label>
          <select className="text-xs bg-gray-800 border border-gray-700 text-gray-200 rounded px-1 py-0.5"
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
          >
            <option value="merge">merge</option>
            <option value="replace">replace</option>
          </select>
        </div>
      </div>

      <textarea
        className="w-full h-40 text-[10px] font-mono bg-black border border-gray-700 text-gray-100 rounded p-2"
        placeholder="Paste Ear Training JSON here to import..."
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
      />

      <div className="mt-2 flex items-center gap-2">
        <button className="px-2 py-1 text-xs rounded bg-blue-700 text-white" onClick={doImport}>
          Import JSON
        </button>
        <div className="text-[10px] text-gray-500">
          Import is reproducible: full settings, attempts, sessions, and review queue are preserved.
        </div>
      </div>

      <div className="mt-4 border-t border-gray-800 pt-2">
        <h4 className="text-[10px] text-gray-400 font-bold uppercase mb-2">Part 2 Snapshots</h4>
        <RecentSnapshotsList />
      </div>
    </div>
  );
};

const RecentSnapshotsList = () => {
  const part2 = useStore(s => s.earTraining.persisted.part2);
  const history = part2?.evaluation || [];

  if (history.length === 0) return <p className="text-[10px] text-gray-600 italic">No snapshots saved.</p>;

  return (
    <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar">
      {history.slice(0, 8).map((snap: any, i: number) => (
        <div key={i} className="bg-black/30 p-2 rounded border border-gray-800/60 flex items-center justify-between group hover:border-gray-700 transition-colors">
          <span className="text-[9px] text-gray-500 font-mono">{new Date(snap.t).toLocaleTimeString()}</span>
          <div className="flex gap-3 text-[9px]">
            {snap.jnd && (
              <span title="JND Estimate" className={snap.jnd.estimateCents && snap.jnd.estimateCents < 10 ? 'text-green-400' : 'text-gray-400'}>
                J:{(snap.jnd.estimateCents ?? 0).toFixed(1)}c
              </span>
            )}
            {snap.intervalZone && (
              <span title="Mean Interval Error" className="text-amber-300">
                I:{snap.intervalZone.meanAbsDeviationCents.toFixed(2)}c
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
