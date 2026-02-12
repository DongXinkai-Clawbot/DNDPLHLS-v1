
import React from 'react';
import { useStore } from '../store';
import { shallow } from 'zustand/shallow';
import type { LandingMode } from '../types';
import { openConfirm } from '../utils/notifications';

export const LandingPage = () => {
  const { setLandingMode, hasConfiguredAdvanced, clearAdvancedSession } = useStore((s) => ({ setLandingMode: s.setLandingMode, hasConfiguredAdvanced: s.hasConfiguredAdvanced, clearAdvancedSession: s.clearAdvancedSession }), shallow);

  const ModeCard = ({
    mode,
    title,
    description,
    icon,
    colorClass,
    isAdvanced = false,
    onClick
  }: {
    mode: LandingMode,
    title: string,
    description: string,
    icon: string,
    colorClass: string,
    isAdvanced?: boolean,
    onClick?: () => void
  }) => (
    <button
      onClick={() => {
        if (onClick) {
          onClick();
          return;
        }
        setLandingMode(mode);
      }}
      className={`group relative p-3 sm:p-6 rounded-xl sm:rounded-2xl border border-gray-800 bg-gray-900/50 hover:bg-gray-800/80 transition-all duration-300 flex flex-col items-center text-center gap-2 sm:gap-4 hover:-translate-y-1 hover:shadow-2xl overflow-hidden`}
    >
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity ${colorClass}`}></div>

      {isAdvanced && hasConfiguredAdvanced && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            openConfirm({
              title: 'Reset Advanced Settings',
              message: 'Clear current advanced settings and return to setup defaults?',
              confirmLabel: 'Reset',
              cancelLabel: 'Cancel',
              onConfirm: () => {
                clearAdvancedSession();
                setLandingMode('advanced');
              }
            });
          }}
          className="absolute top-1 right-1 sm:top-2 sm:right-2 text-[8px] sm:text-[10px] text-gray-500 hover:text-red-400 bg-black/50 hover:bg-black/80 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded border border-gray-700 hover:border-red-900 transition-colors z-20"
          title="Reset to Defaults"
        >
          Reset ✕
        </div>
      )}

      <div className={`text-2xl sm:text-4xl mb-1 sm:mb-2 grayscale group-hover:grayscale-0 transition-all duration-300`}>{icon}</div>
      <div>
        <h3 className={`text-xs sm:text-xl font-black uppercase tracking-wider text-white mb-1 sm:mb-2 group-hover:text-blue-200 leading-tight`}>
          {isAdvanced && hasConfiguredAdvanced ? "Resume Advanced" : title}
        </h3>
        <p className="text-[10px] sm:text-sm text-gray-400 font-medium leading-snug sm:leading-relaxed line-clamp-3 sm:line-clamp-none">{description}</p>
      </div>
      <div className={`mt-auto px-2 sm:px-4 py-1 sm:py-2 rounded-full border border-gray-700 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-white group-hover:border-gray-500 transition-colors`}>
        {isAdvanced && hasConfiguredAdvanced ? "Quick Enter" : "Select"}
      </div>
    </button>
  );

  return (
    <div className="absolute inset-0 z-50 bg-[#050505] flex flex-col items-center p-4 sm:p-6 overflow-y-auto overflow-x-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-black/80 to-black pointer-events-none"></div>

      <div className="z-10 max-w-5xl w-full flex flex-col items-center space-y-6 sm:space-y-10 py-6 sm:py-12 opacity-100 transition-opacity duration-700">
        <div className="text-center space-y-2 sm:space-y-4 px-2">
          <h1 className="text-2xl sm:text-4xl md:text-6xl font-black text-blue-200 tracking-tighter drop-shadow-2xl leading-tight pb-1 sm:pb-2 max-w-5xl mx-auto">
            Dynamic N-Dimensional Prime-Limit Harmonic Lattice & Synthesizer
          </h1>
          <p className="text-xs sm:text-lg text-gray-400 font-mono tracking-widest uppercase opacity-80">
            Interactive Just Intonation Explorer
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 w-full px-1">
          <ModeCard
            mode="simple"
            title="Simple Mode"
            description="A streamlined 5-limit interface with curated presets. Perfect for exploration without configuration."
            icon="✨"
            colorClass="bg-blue-500"
          />
          <ModeCard
            mode="tutorial"
            title="Tutorial"
            description="Interactive guided tour explaining the physics of sound, from the Monad to the Comma Pump."
            icon="🎓"
            colorClass="bg-green-500"
          />
          <ModeCard
            mode="ear"
            title="Ear Training"
            description="Deep listening practice. Focus on identifying pure intervals and comma drifts."
            icon="👂"
            colorClass="bg-yellow-500"
          />
          <ModeCard
            mode="advanced"
            title="Advanced"
            description="Full control. Manually configure prime limits, dimensions, and generative parameters."
            icon="⚙️"
            colorClass="bg-purple-500"
            isAdvanced={true}
          />
        </div>

        <div className="text-[10px] sm:text-xs text-gray-600 font-mono mt-4 sm:mt-8 pb-4">
          v2.2.4 • Web Audio API • React Three Fiber
        </div>
      </div>
    </div>
  );
};
