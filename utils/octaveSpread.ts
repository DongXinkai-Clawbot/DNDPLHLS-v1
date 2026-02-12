
export const spreadChordFrequencies = (
    freqs: number[], 
    spreadOctaves: number, 
    minSpacingCents: number, 
    range: [number, number] = [20, 20000],
    strategy: 'stack' | 'wrap' = 'stack'
): { freqsOut: number[], mutedMask: boolean[], debug: string[] } => {
    
    const sorted = freqs.filter(f => Number.isFinite(f) && f > 0).sort((a, b) => a - b);
    
    if (sorted.length === 0) return { freqsOut: [], mutedMask: [], debug: [] };

    const result: number[] = [];
    const muted: boolean[] = [];
    const debug: string[] = [];

    const baseFreq = sorted[0]; 
    const upperBound = baseFreq * Math.pow(2, spreadOctaves);

    for (let i = 0; i < sorted.length; i++) {
        let f = sorted[i];
        const originalF = f;
        let isMuted = false;
        let note = "";

        if (f < range[0]) {
            
            while (f < range[0]) f *= 2;
        }

        if (i > 0) {
            const prev = result[i - 1];
            
            const minRatio = Math.pow(2, minSpacingCents / 1200);
            
            let shifts = 0;
            while (f < prev * minRatio && f < range[1] && shifts < 10) {
                f *= 2;
                shifts++;
            }
        }

        if (strategy === 'wrap') {
            
            while (f > upperBound && f > range[0] * 2) {
                const testF = f / 2;
                
                if (i === 0 || (result.length > 0 && testF >= result[result.length - 1] * Math.pow(2, minSpacingCents/1200))) {
                    f = testF;
                } else {
                    break; 
                }
            }
        }

        if (f < range[0] || f > range[1]) {
            isMuted = true;
            note = "Out of Range";
        }

        result.push(f);
        muted.push(isMuted);
        debug.push(`In:${originalF.toFixed(1)} -> Out:${f.toFixed(1)} ${note}`);
    }

    return { freqsOut: result, mutedMask: muted, debug };
};
