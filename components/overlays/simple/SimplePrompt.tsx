
import React from 'react';

export const SimplePrompt = ({ onChoice, onCancel }: { onChoice: (tutorial: boolean, dontShowAgain: boolean) => void, onCancel?: () => void }) => {
    const [dontShow, setDontShow] = React.useState(false);
    return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto">
            <div className="bg-gray-900 border border-gray-700 p-8 rounded-2xl max-w-md text-center shadow-2xl animate-in fade-in zoom-in duration-300 relative">
                {onCancel && (
                    <button
                        onClick={onCancel}
                        className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors p-1"
                        title="Cancel and return to Advanced Mode"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
                <div className="w-16 h-16 bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-3xl">🎓</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">Welcome to Simple Mode</h2>
                <p className="text-gray-400 mb-8 leading-relaxed">
                    This mode simplifies the interface to focus on fundamental harmonic structures.
                    Would you like a guided interactive tutorial on deriving notes from scratch?
                </p>
                <div className="flex gap-4 justify-center mb-6">
                    <button
                        onClick={() => onChoice(true, dontShow)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/25"
                    >
                        Yes, Start Tutorial
                    </button>
                    <button
                        onClick={() => onChoice(false, dontShow)}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-6 py-3 rounded-xl font-bold transition-all"
                    >
                        No, Manual Config
                    </button>
                </div>
                <div className="flex justify-center">
                    <label className="flex items-center gap-2 cursor-pointer text-gray-400 hover:text-white transition-colors">
                        <input
                            type="checkbox"
                            checked={dontShow}
                            onChange={e => setDontShow(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500/20"
                        />
                        <span className="text-xs select-none">Don't show this again</span>
                    </label>
                </div>
            </div>
        </div>
    );
};
