import React from 'react';
import AdvancedPartialsTable from './AdvancedPartialsTable';
import SpectrumEditor from './SpectrumEditor';
import RoughnessCurve from './RoughnessCurve';
import TriadHeatmap from './TriadHeatmap';
import ControlDeck from './ControlDeck';
import { clamp } from './utils';

type SetharesExperimentViewProps = Record<string, any>;

export const SetharesExperimentView = (props: SetharesExperimentViewProps) => {
  const {
    timestamp,
    showAdvanced,
    partials,
    setPartialsWithHistory,
    stretch,
    setStretch,
    waveform,
    setWaveform,
    startGhostCapture,
    setShowAdvanced,
    importSample,
    fftPeakCount,
    setFftPeakCount,
    fftThreshold,
    setFftThreshold,
    fftSetBaseFreq,
    setFftSetBaseFreq,
    drawMode,
    setDrawMode,
    combPeriod,
    setCombPeriod,
    combDepth,
    setCombDepth,
    applyComb,
    hoverCents,
    decayAmount,
    timeSlice,
    setIsDragging,
    curveData,
    minima,
    setHoverCents,
    scaleOverlays,
    showTetOverlay,
    showHarmonicOverlay,
    tetDivisions,
    ghostCurveData,
    showGhostCurve,
    baseFreq,
    setBaseFreq,
    triadHighlight,
    axisMode,
    locateSignal,
    maxRatioDenominator,
    harmonicCount,
    harmonicsConfig,
    showHarmonicAdvanced,
    gridFollowsEdo,
    maxRange,
    setShowTetOverlay,
    setTetDivisions,
    setGridFollowsEdo,
    setMaxRange,
    setMaxRatioDenominator,
    setShowHarmonicOverlay,
    setHarmonicCount,
    setShowHarmonicAdvanced,
    setHarmonicsConfig,
    minimaFilter,
    setMinimaFilter,
    exportSCL,
    exportTUN,
    exportKSP,
    exportWavetable,
    exportPreset,
    importPreset,
    morphFrames,
    setMorphFrames,
    triadFixedF2,
    setTriadFixedF2,
    heatmapGain,
    setHeatmapGain,
    playTriad,
    playRandomArp,
    playTone,
    handleLocateMinima,
    setAxisMode,
    snapToMinima,
    setSnapToMinima,
    midiEnabled,
    setMidiEnabled,
    midiInputs,
    midiInputId,
    setMidiInputId,
    midiMappingMode,
    setMidiMappingMode,
    midiBaseNote,
    setMidiBaseNote,
    midiNoteBendRange,
    setMidiNoteBendRange,
    midiChannel,
    setMidiChannel,
    presetInputRef,
    algoParams,
    setAlgoParams,
    setDecayAmount,
    setTimeSlice,
    cbScale,
    setCbScale,
    masterVolume,
    setMasterVolume,
    handleUndo,
    handleRedo,
    resetEngine,
    undoStack,
    redoStack,
    roughnessModel,
    showVerification,
    setShowVerification,
    customTargets,
    customTargetContinuous,
    targetCentsInput,
    targetRoughnessInput,
    setTargetCentsInput,
    setTargetRoughnessInput,
    addCustomTarget,
    updateCustomTarget,
    removeCustomTarget,
    clearCustomTargets,
    applyCustomTargets,
    includeFundamental,
    setIncludeFundamental,
    setCustomTargetContinuous,
    saveAsTimbre
  } = props as any;
  const [customTargetsCollapsed, setCustomTargetsCollapsed] = React.useState(false);

  return (
    <div className="h-full w-full bg-black/40 text-gray-200 font-mono flex flex-col overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-indigo-500/40 p-3 bg-black/60">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300">SETHARES ENGINE</div>
          <div className="text-white text-lg font-black tracking-tight">Timbre-Scale Isomorphism Engine</div>
          <div className="text-[11px] text-gray-400 font-mono">Advanced: Dissonance Curves & Spectral Analysis</div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[10px] sm:justify-end">
          <span className="text-gray-500">TIME: {timestamp}</span>
          <span className="text-indigo-300 font-bold">STATUS: ONLINE</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {showAdvanced && (
          <div className="order-2 lg:order-1 w-full lg:w-[280px] lg:flex-shrink-0 h-[40vh] lg:h-full overflow-hidden">
            <AdvancedPartialsTable partials={partials} onChange={setPartialsWithHistory} stretch={stretch} />
          </div>
        )}

        <div className="order-1 lg:order-2 flex-1 flex flex-col overflow-y-auto p-3 space-y-3 custom-scrollbar">
          <SpectrumEditor
            partials={partials}
            onChange={setPartialsWithHistory}
            stretch={stretch}
            onStretchChange={setStretch}
            waveform={waveform}
            onWaveformChange={setWaveform}
            onStartGhost={startGhostCapture}
            showAdvanced={showAdvanced}
            onToggleAdvanced={setShowAdvanced}
            onImportSample={importSample}
            fftPeakCount={fftPeakCount}
            onFftPeakCountChange={setFftPeakCount}
            fftThreshold={fftThreshold}
            onFftThresholdChange={setFftThreshold}
            fftSetBaseFreq={fftSetBaseFreq}
            onFftSetBaseFreqChange={setFftSetBaseFreq}
            drawMode={drawMode}
            onDrawModeChange={setDrawMode}
            combPeriod={combPeriod}
            onCombPeriodChange={setCombPeriod}
            combDepth={combDepth}
            onCombDepthChange={setCombDepth}
            onApplyComb={applyComb}
            hoverCents={hoverCents}
            decayAmount={decayAmount}
            timeSlice={timeSlice}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => setIsDragging(false)}
          />

          <div className="flex flex-col lg:flex-row gap-3 items-stretch">
            <div className="flex-1 min-w-0">
              <RoughnessCurve
                data={curveData}
                minima={minima}
                onHover={setHoverCents}
                scaleOverlay={scaleOverlays}
                scaleType={showTetOverlay ? 'custom' : 'none'}
                showTetOverlay={showTetOverlay}
                showHarmonicOverlay={showHarmonicOverlay}
                tetDivisions={tetDivisions}
                ghostData={ghostCurveData}
                showGhost={showGhostCurve}
                baseFreq={baseFreq}
                triadHighlight={triadHighlight}
                axisMode={axisMode}
                partials={partials}
                decayAmount={decayAmount}
                timeSlice={timeSlice}
                externalHoverSignal={locateSignal}
                maxRatioDenominator={maxRatioDenominator}
                harmonicCount={harmonicCount}
                harmonicsConfig={showHarmonicAdvanced ? harmonicsConfig : undefined}
                gridFollowsEdo={gridFollowsEdo}
                maxCents={maxRange}
                customTargets={customTargets}
                customTargetContinuous={customTargetContinuous}
              />
            </div>

            <div className="lg:hidden">
              <button
                type="button"
                onClick={() => setShowVerification(!showVerification)}
                className="w-full min-h-[44px] rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-200"
              >
                {showVerification ? 'Hide Verification Panel' : 'Show Verification Panel'}
              </button>
            </div>

            {!showVerification && (
              <div className="hidden lg:flex w-8 flex-col items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVerification(true)}
                  className="p-1 bg-black/50 border border-white/10 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                  title="Show Verification Panel"
                >
                  ◀
                </button>
                <div
                  className="text-[9px] text-gray-600 font-bold uppercase tracking-widest whitespace-nowrap mt-8"
                  style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                >
                  Verify
                </div>
              </div>
            )}

            {showVerification && (
              <div className="w-full lg:w-[260px] max-h-[45vh] lg:max-h-none overflow-y-auto custom-scrollbar bg-black/50 border border-white/10 rounded-xl p-3 text-[11px] text-gray-300 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-200">Verification</div>
                  <button
                    type="button"
                    onClick={() => setShowVerification(false)}
                    className="min-h-[36px] min-w-[36px] grid place-items-center rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    title="Hide"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showTetOverlay}
                      onChange={(e) => setShowTetOverlay(e.target.checked)}
                      className="accent-indigo-500 w-4 h-4"
                    />
                    <span>EDO Lines</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-gray-500">Divisions</span>
                    <input
                      type="number"
                      min="1"
                      max="72"
                      step="1"
                      value={tetDivisions}
                      onChange={(e) =>
                        setTetDivisions(clamp(parseInt(e.target.value, 10) || 12, 1, 72))
                      }
                      className="w-20 min-h-[36px] bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-white font-mono text-[11px]"
                      disabled={!showTetOverlay}
                    />
                    <span className="text-gray-600">-EDO</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={gridFollowsEdo}
                      onChange={(e) => setGridFollowsEdo(e.target.checked)}
                      className="accent-indigo-500 w-4 h-4"
                    />
                    <span className="text-gray-500">Grid follows EDO</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={maxRange === 2400}
                      onChange={(e) => setMaxRange(e.target.checked ? 2400 : 1200)}
                      className="accent-indigo-500 w-4 h-4"
                    />
                    <span className="text-gray-500">2 Octaves (2400¢)</span>
                  </label>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-800">
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Ratio Precision</div>
                  <label className="flex items-center gap-2">
                    <span className="text-gray-500">Max Denom</span>
                    <input
                      type="number"
                      min="4"
                      max="1028"
                      step="1"
                      value={maxRatioDenominator}
                      onChange={(e) =>
                        setMaxRatioDenominator(clamp(parseInt(e.target.value, 10) || 32, 4, 1028))
                      }
                      className="w-24 min-h-[36px] bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-white font-mono text-[11px]"
                    />
                  </label>
                  <div className="text-[10px] text-gray-600">Higher = more ratios, larger integers</div>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-800">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showHarmonicOverlay}
                      onChange={(e) => setShowHarmonicOverlay(e.target.checked)}
                      className="accent-indigo-500 w-4 h-4"
                    />
                    <span>Harmonic Series</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Count</span>
                    <input
                      type="number"
                      min="1"
                      max="55"
                      step="1"
                      value={harmonicCount}
                      onChange={(e) => setHarmonicCount(clamp(parseInt(e.target.value, 10) || 8, 1, 55))}
                      className="w-20 min-h-[36px] bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-white font-mono text-[11px]"
                      disabled={!showHarmonicOverlay}
                    />
                  </div>

                  <button
                    type="button"
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-black uppercase tracking-widest"
                    onClick={() => setShowHarmonicAdvanced(!showHarmonicAdvanced)}
                  >
                    {showHarmonicAdvanced ? '▼' : '▶'} Advanced Config
                  </button>

                  {showHarmonicAdvanced && (
                    <div className="mt-1 space-y-1 max-h-40 overflow-y-auto custom-scrollbar bg-gray-900/50 rounded p-1">
                      <div className="text-[9px] text-gray-500 px-1">
                        Intensity sets each harmonic's relative weight (0 to 1) in the overlay.
                      </div>
                      <div className="text-[9px] text-gray-500 px-1">
                        Drag the bar to scale contribution: 0% mutes, 100% full.
                      </div>
                      {harmonicsConfig.slice(0, harmonicCount).map((h, idx) => (
                        <div key={idx} className="flex items-center gap-1 text-[9px]">
                          <input
                            type="checkbox"
                            checked={h.enabled}
                            onChange={(e) => {
                              const next = [...harmonicsConfig];
                              next[idx] = { ...next[idx], enabled: e.target.checked };
                              setHarmonicsConfig(next);
                            }}
                            className="accent-indigo-500 w-4 h-4"
                          />
                          <span className="w-10 text-gray-300 font-mono">
                            {h.n}/{h.d}
                          </span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={h.intensity}
                            onChange={(e) => {
                              const next = [...harmonicsConfig];
                              next[idx] = { ...next[idx], intensity: parseFloat(e.target.value) };
                              setHarmonicsConfig(next);
                            }}
                            className="flex-1 accent-indigo-500 h-1"
                            disabled={!h.enabled}
                          />
                          <span className="w-6 text-gray-500">{Math.round(h.intensity * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-black/50 border border-white/10 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                Custom Roughness Targets
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCustomTargetsCollapsed(prev => !prev)}
                  className="text-[9px] px-2 py-1 bg-gray-900 border border-gray-700 rounded text-gray-400 hover:text-white"
                >
                  {customTargetsCollapsed ? 'Expand' : 'Collapse'}
                </button>
                <button
                  type="button"
                  onClick={clearCustomTargets}
                  className="text-[9px] px-2 py-1 bg-gray-900 border border-gray-700 rounded text-gray-400 hover:text-white"
                >
                  Clear
                </button>
              </div>
            </div>

            {!customTargetsCollapsed && (
              <>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Cents"
                    value={targetCentsInput}
                    onChange={(e) => setTargetCentsInput(e.target.value)}
                    className="min-h-[36px] bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-white font-mono text-[11px]"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Roughness (0-1)"
                    value={targetRoughnessInput}
                    onChange={(e) => setTargetRoughnessInput(e.target.value)}
                    className="min-h-[36px] bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-white font-mono text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={addCustomTarget}
                    className="min-h-[36px] px-3 bg-indigo-900/50 border border-indigo-500/50 rounded-lg text-white text-[10px] font-bold hover:bg-indigo-800"
                  >
                    ADD
                  </button>
                </div>
                <div className="text-[9px] text-gray-500">
                  Auto-applies to the spectrum. Roughness accepts 0-1 (or 0-100%).
                </div>

                <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-2">
                  {customTargets.length === 0 && (
                    <div className="text-gray-500 text-[10px] p-2">No targets yet.</div>
                  )}
                  {customTargets.map((t: any) => (
                    <div key={t.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center text-[10px]">
                      <input
                        type="number"
                        step="0.1"
                        value={Number(t.cents.toFixed(2))}
                        onChange={(e) => {
                          const val = e.currentTarget.valueAsNumber;
                          if (Number.isFinite(val)) updateCustomTarget(t.id, { cents: val });
                        }}
                        className="min-h-[34px] bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white font-mono text-[11px]"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={Number(t.roughness.toFixed(3))}
                        onChange={(e) => {
                          const raw = e.currentTarget.valueAsNumber;
                          if (!Number.isFinite(raw)) return;
                          const normalized = raw > 1.5 ? raw / 100 : raw;
                          updateCustomTarget(t.id, { roughness: normalized });
                        }}
                        className="min-h-[34px] bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white font-mono text-[11px]"
                      />
                      <button
                        type="button"
                        onClick={() => removeCustomTarget(t.id)}
                        className="min-h-[34px] px-2 bg-red-900/30 border border-red-500/50 rounded text-red-200 hover:bg-red-800/50"
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <label className="flex items-center gap-2 text-gray-400 text-[10px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeFundamental}
                      onChange={(e) => setIncludeFundamental(e.target.checked)}
                      className="accent-indigo-500 w-4 h-4"
                    />
                    <span>Include fundamental (0c)</span>
                  </label>
                  <label className="flex items-center gap-2 text-gray-400 text-[10px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customTargetContinuous}
                      onChange={(e) => setCustomTargetContinuous(e.target.checked)}
                      className="accent-indigo-500 w-4 h-4"
                    />
                    <span>Continuous target curve</span>
                  </label>
                  <button
                    type="button"
                    onClick={saveAsTimbre}
                    className="text-[10px] px-3 py-1.5 bg-cyan-900/50 border border-cyan-500/50 rounded-lg text-white font-bold hover:bg-cyan-800"
                  >
                    SAVE AS TIMBRE
                  </button>
                </div>
              </>
            )}
          </div>

          <ControlDeck
            baseFreq={baseFreq}
            setBaseFreq={setBaseFreq}
            minimaFilter={minimaFilter}
            setMinimaFilter={setMinimaFilter}
            minima={minima}
            exportSCL={exportSCL}
            exportTUN={exportTUN}
            exportKSP={exportKSP}
            exportWavetable={exportWavetable}
            exportPreset={exportPreset}
            importPreset={importPreset}
            morphFrames={morphFrames}
            setMorphFrames={setMorphFrames}
            triadFixedF2={triadFixedF2}
            setTriadFixedF2={setTriadFixedF2}
            heatmapGain={heatmapGain}
            setHeatmapGain={setHeatmapGain}
            playTriad={playTriad}
            playRandomArp={playRandomArp}
            playTone={playTone}
            onLocateMinima={handleLocateMinima}
            axisMode={axisMode}
            setAxisMode={setAxisMode}
            snapToMinima={snapToMinima}
            setSnapToMinima={setSnapToMinima}
            midiEnabled={midiEnabled}
            setMidiEnabled={setMidiEnabled}
            midiInputs={midiInputs}
            midiInputId={midiInputId}
            setMidiInputId={setMidiInputId}
            midiMappingMode={midiMappingMode}
            setMidiMappingMode={setMidiMappingMode}
            midiBaseNote={midiBaseNote}
            setMidiBaseNote={setMidiBaseNote}
            midiNoteBendRange={midiNoteBendRange}
            setMidiNoteBendRange={setMidiNoteBendRange}
            midiChannel={midiChannel}
            setMidiChannel={setMidiChannel}
            presetInputRef={presetInputRef}
            algoParams={algoParams}
            setAlgoParams={setAlgoParams}
            decayAmount={decayAmount}
            setDecayAmount={setDecayAmount}
            timeSlice={timeSlice}
            setTimeSlice={setTimeSlice}
            cbScale={cbScale}
            setCbScale={setCbScale}
            masterVolume={masterVolume}
            setMasterVolume={setMasterVolume}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onReset={resetEngine}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
          />

          <div className="bg-black/50 border border-white/10 rounded-xl p-3 space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-300">
              Triad Roughness Surface
            </div>
            <div className="flex gap-5 flex-wrap">
              <TriadHeatmap
                partials={partials}
                roughnessModel={roughnessModel}
                algoParams={algoParams}
                cbScale={cbScale}
                decayAmount={decayAmount}
                timeSlice={timeSlice}
                fixedF2Cents={triadFixedF2}
                gain={heatmapGain}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetharesExperimentView;
