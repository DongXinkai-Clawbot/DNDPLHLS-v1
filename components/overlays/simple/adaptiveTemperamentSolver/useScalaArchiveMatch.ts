import { useEffect, useState } from 'react';
import type { SolverOutput } from '../../../../utils/temperamentSolver';
import { findClosestScalaScale, type ScalaMatchResult } from '../../../../utils/scalaArchive';
import { readScalaArchivePrefs } from '../../../../utils/scalaArchivePrefs';

export const useScalaArchiveMatch = (result: SolverOutput | null) => {
  const [match, setMatch] = useState<ScalaMatchResult | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!result) {
        setMatch(null);
        setStatus('');
        return;
      }

      setStatus('Searching Scala archive...');
      const periodCents = result.optimizedPeriodCents ?? result.input.cycleCents;
      const cents = result.notes.map(note => note.centsFromRoot);
      const prefs = readScalaArchivePrefs();
      if (!prefs.showArchive) {
        setMatch(null);
        setStatus('Scala archive hidden in Library.');
        return;
      }
      const excludeIds = new Set(prefs.hiddenIds);

      try {
        const matchResult = await findClosestScalaScale({ cents, periodCents }, { excludeIds });
        if (cancelled) return;
        setMatch(matchResult);
        setStatus(matchResult ? '' : 'No archive match found.');
      } catch {
        if (cancelled) return;
        setMatch(null);
        setStatus('Archive search failed.');
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [result]);

  return { match, status };
};
