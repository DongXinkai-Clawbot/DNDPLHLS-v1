import React, { useEffect, useMemo, useRef, useState } from 'react';
import { museumExhibits, type Exhibit } from '../../data/museumExhibits';

interface ExhibitInspectPanelProps {
  exhibitId: string;
  onRequestClose: () => void;
}

const findExhibit = (id: string): Exhibit | undefined => museumExhibits.find((e) => e.id === id);

export const ExhibitInspectPanel = ({ exhibitId, onRequestClose }: ExhibitInspectPanelProps) => {
  const exhibit = useMemo(() => findExhibit(exhibitId), [exhibitId]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    
    setIsPlaying(false);
    setAudioError(null);
    const firstClip = exhibit?.assets.audioClips?.[0]?.id ?? null;
    setSelectedClipId(firstClip);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [exhibitId]);

  const selectedClip = useMemo(() => {
    if (!exhibit?.assets.audioClips?.length) return null;
    return exhibit.assets.audioClips.find((clip) => clip.id === selectedClipId) ?? exhibit.assets.audioClips[0];
  }, [exhibit, selectedClipId]);

  const onPlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setAudioError(null);
    try {
      if (audio.paused) {
        await audio.play();
        setIsPlaying(true);
      } else {
        audio.pause();
        setIsPlaying(false);
      }
    } catch (err: any) {
      setIsPlaying(false);
      setAudioError(err?.message ? String(err.message) : 'Audio failed to play.');
    }
  };

  const onRestart = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setAudioError(null);
    try {
      audio.currentTime = 0;
      await audio.play();
      setIsPlaying(true);
    } catch (err: any) {
      setIsPlaying(false);
      setAudioError(err?.message ? String(err.message) : 'Audio failed to play.');
    }
  };

  const onClipChange = (id: string) => {
    setSelectedClipId(id);
    setIsPlaying(false);
    setAudioError(null);
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  };

  if (!exhibit) {
    return (
      <div className="pointer-events-auto w-[min(520px,92vw)] rounded-2xl border border-white/10 bg-black/70 p-5 text-white shadow-xl backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Exhibit not found</div>
            <div className="text-sm text-white/70">This exhibit configuration could not be loaded.</div>
          </div>
          <button
            className="rounded-xl bg-white/10 px-3 py-1 text-xs hover:bg-white/15"
            onClick={onRequestClose}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const content = exhibit.content;

  return (
    <div className="pointer-events-auto w-[min(640px,92vw)] rounded-2xl border border-white/10 bg-black/70 p-5 text-white shadow-xl backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xl font-semibold leading-tight">{content.title}</div>
          <div className="mt-1 text-sm text-white/70">ESC to exit</div>
        </div>
        <button
          className="shrink-0 rounded-xl bg-white/10 px-3 py-1 text-xs hover:bg-white/15"
          onClick={onRequestClose}
        >
          Close
        </button>
      </div>

      <div className="mt-4 max-h-[62vh] overflow-auto pr-1">
        {content.shortDescription && <div className="text-sm text-white/80">{content.shortDescription}</div>}
        {content.description && !content.shortDescription && (
          <div className="text-sm text-white/80">{content.description}</div>
        )}

        {content.longDescription && (
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/85">{content.longDescription}</div>
        )}

        {content.sections?.length ? (
          <div className="mt-4 space-y-4">
            {content.sections.map((sec) => (
              <div key={sec.heading}>
                <div className="text-sm font-semibold">{sec.heading}</div>
                <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-white/80">{sec.body}</div>
              </div>
            ))}
          </div>
        ) : null}

        {exhibit.assets.audioClips?.length ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold">Listen & compare</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                className="rounded-xl bg-black/40 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10"
                value={selectedClip?.id ?? ''}
                onChange={(e) => onClipChange(e.target.value)}
              >
                {exhibit.assets.audioClips.map((clip) => (
                  <option key={clip.id} value={clip.id}>
                    {clip.label}
                  </option>
                ))}
              </select>
              <button
                className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                onClick={onPlayPause}
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button
                className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                onClick={onRestart}
              >
                Restart
              </button>
            </div>
            {selectedClip?.description && (
              <div className="mt-2 text-sm text-white/70">{selectedClip.description}</div>
            )}
            {audioError && <div className="mt-2 text-xs text-red-300">{audioError}</div>}
            {!selectedClip?.url ? (
              <div className="mt-2 text-xs text-yellow-200">Audio resource not configured for this clip.</div>
            ) : (
              <audio
                ref={audioRef}
                src={selectedClip.url}
                onEnded={() => setIsPlaying(false)}
                onError={() => {
                  setIsPlaying(false);
                  setAudioError('Audio failed to load. Check the clip URL/path.');
                }}
              />
            )}
          </div>
        ) : null}

        {content.keyTakeaways?.length ? (
          <div className="mt-5">
            <div className="text-sm font-semibold">Key takeaways</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/80">
              {content.keyTakeaways.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {content.references?.length ? (
          <div className="mt-5">
            <div className="text-sm font-semibold">References</div>
            <ul className="mt-2 space-y-1 text-sm text-white/70">
              {content.references.map((ref) => (
                <li key={ref.label}>
                  {ref.url ? (
                    <a
                      className="underline decoration-white/30 underline-offset-4 hover:decoration-white/70"
                      href={ref.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {ref.label}
                    </a>
                  ) : (
                    <span>{ref.label}</span>
                  )}
                  {ref.author || ref.year ? (
                    <span className="text-white/50"> — {ref.author ?? 'Unknown'}{ref.year ? ` (${ref.year})` : ''}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
};
