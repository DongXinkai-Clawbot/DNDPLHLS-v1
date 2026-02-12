
import type { Fraction } from '../types';
export * from './huntIntervalNaming';

export interface IntervalEntry {
    ratio: Fraction;
    cents: number;
    name: string;
    shortName: string;
    category: 'comma' | 'pure' | 'melodic' | 'harmonic';
    primeLimit: number;
}

function cents(n: number | bigint, d: number | bigint = 1): number {
    return 1200 * Math.log2(Number(n) / Number(d));
}

export const DEFAULT_INTERVALS: IntervalEntry[] = [
    
    { ratio: { n: 1n, d: 1n }, cents: cents(1), name: 'Perfect Unison', shortName: 'P1', category: 'pure', primeLimit: 2 },
    { ratio: { n: 2n, d: 1n }, cents: cents(2), name: 'Perfect Octave', shortName: 'P8', category: 'pure', primeLimit: 2 },

    { ratio: { n: 3n, d: 2n }, cents: cents(3, 2), name: 'Perfect Fifth', shortName: 'P5', category: 'pure', primeLimit: 3 },
    { ratio: { n: 4n, d: 3n }, cents: cents(4, 3), name: 'Perfect Fourth', shortName: 'P4', category: 'pure', primeLimit: 3 },
    { ratio: { n: 9n, d: 8n }, cents: cents(9, 8), name: 'Major Second', shortName: 'M2', category: 'melodic', primeLimit: 3 },
    { ratio: { n: 16n, d: 9n }, cents: cents(16, 9), name: 'Minor Seventh', shortName: 'm7', category: 'melodic', primeLimit: 3 },
    { ratio: { n: 27n, d: 16n }, cents: cents(27, 16), name: 'Major Sixth', shortName: 'M6', category: 'melodic', primeLimit: 3 },
    { ratio: { n: 32n, d: 27n }, cents: cents(32, 27), name: 'Minor Third', shortName: 'm3', category: 'melodic', primeLimit: 3 },
    { ratio: { n: 81n, d: 64n }, cents: cents(81, 64), name: 'Pythagorean Major Third', shortName: 'M3ᴾ', category: 'melodic', primeLimit: 3 },
    { ratio: { n: 128n, d: 81n }, cents: cents(128, 81), name: 'Pythagorean Minor Sixth', shortName: 'm6ᴾ', category: 'melodic', primeLimit: 3 },
    { ratio: { n: 243n, d: 128n }, cents: cents(243, 128), name: 'Pythagorean Major Seventh', shortName: 'M7ᴾ', category: 'melodic', primeLimit: 3 },
    { ratio: { n: 256n, d: 243n }, cents: cents(256, 243), name: 'Pythagorean Minor Second', shortName: 'm2ᴾ', category: 'melodic', primeLimit: 3 },
    { ratio: { n: 729n, d: 512n }, cents: cents(729, 512), name: 'Pythagorean Tritone', shortName: 'A4ᴾ', category: 'melodic', primeLimit: 3 },
    { ratio: { n: 1024n, d: 729n }, cents: cents(1024, 729), name: 'Pythagorean Diminished Fifth', shortName: 'd5ᴾ', category: 'melodic', primeLimit: 3 },

    { ratio: { n: 531441n, d: 524288n }, cents: cents(531441, 524288), name: 'Pythagorean Comma', shortName: 'PC', category: 'comma', primeLimit: 3 },

    { ratio: { n: 5n, d: 4n }, cents: cents(5, 4), name: 'Classic Major Third', shortName: '5-M3', category: 'harmonic', primeLimit: 5 },
    { ratio: { n: 8n, d: 5n }, cents: cents(8, 5), name: 'Classic Minor Sixth', shortName: '5-m6', category: 'harmonic', primeLimit: 5 },
    { ratio: { n: 6n, d: 5n }, cents: cents(6, 5), name: 'Classic Minor Third', shortName: '5-m3', category: 'harmonic', primeLimit: 5 },
    { ratio: { n: 5n, d: 3n }, cents: cents(5, 3), name: 'Classic Major Sixth', shortName: '5-M6', category: 'harmonic', primeLimit: 5 },
    { ratio: { n: 10n, d: 9n }, cents: cents(10, 9), name: 'Minor Whole Tone', shortName: '5-m2', category: 'melodic', primeLimit: 5 },
    { ratio: { n: 9n, d: 5n }, cents: cents(9, 5), name: 'Minor Seventh (5-limit)', shortName: '5-m7', category: 'harmonic', primeLimit: 5 },
    { ratio: { n: 15n, d: 8n }, cents: cents(15, 8), name: 'Classic Major Seventh', shortName: '5-M7', category: 'harmonic', primeLimit: 5 },
    { ratio: { n: 16n, d: 15n }, cents: cents(16, 15), name: 'Classic Semitone', shortName: '5-m2', category: 'melodic', primeLimit: 5 },
    { ratio: { n: 25n, d: 24n }, cents: cents(25, 24), name: 'Classic Chromatic Semitone', shortName: '5-A1', category: 'melodic', primeLimit: 5 },
    { ratio: { n: 25n, d: 16n }, cents: cents(25, 16), name: 'Classic Augmented Fifth', shortName: '5-A5', category: 'harmonic', primeLimit: 5 },
    { ratio: { n: 32n, d: 25n }, cents: cents(32, 25), name: 'Classic Diminished Fourth', shortName: '5-d4', category: 'harmonic', primeLimit: 5 },

    { ratio: { n: 81n, d: 80n }, cents: cents(81, 80), name: 'Syntonic Comma', shortName: 'SC', category: 'comma', primeLimit: 5 },
    { ratio: { n: 128n, d: 125n }, cents: cents(128, 125), name: 'Diesis', shortName: 'Diesis', category: 'comma', primeLimit: 5 },
    { ratio: { n: 648n, d: 625n }, cents: cents(648, 625), name: 'Major Diesis', shortName: 'MD', category: 'comma', primeLimit: 5 },
    { ratio: { n: 3125n, d: 3072n }, cents: cents(3125, 3072), name: 'Magic Comma', shortName: 'Magic', category: 'comma', primeLimit: 5 },
    { ratio: { n: 2048n, d: 2025n }, cents: cents(2048, 2025), name: 'Diaschisma', shortName: 'Diasch', category: 'comma', primeLimit: 5 },

    { ratio: { n: 7n, d: 4n }, cents: cents(7, 4), name: 'Septimal Minor Seventh', shortName: '7-m7', category: 'harmonic', primeLimit: 7 },
    { ratio: { n: 8n, d: 7n }, cents: cents(8, 7), name: 'Septimal Major Second', shortName: '7-M2', category: 'harmonic', primeLimit: 7 },
    { ratio: { n: 7n, d: 6n }, cents: cents(7, 6), name: 'Septimal Minor Third', shortName: '7-m3', category: 'harmonic', primeLimit: 7 },
    { ratio: { n: 12n, d: 7n }, cents: cents(12, 7), name: 'Septimal Major Sixth', shortName: '7-M6', category: 'harmonic', primeLimit: 7 },
    { ratio: { n: 7n, d: 5n }, cents: cents(7, 5), name: 'Septimal Tritone', shortName: '7-A4', category: 'harmonic', primeLimit: 7 },
    { ratio: { n: 10n, d: 7n }, cents: cents(10, 7), name: 'Septimal Diminished Fifth', shortName: '7-d5', category: 'harmonic', primeLimit: 7 },
    { ratio: { n: 9n, d: 7n }, cents: cents(9, 7), name: 'Septimal Supermajor Third', shortName: '7-SM3', category: 'harmonic', primeLimit: 7 },
    { ratio: { n: 14n, d: 9n }, cents: cents(14, 9), name: 'Septimal Subminor Sixth', shortName: '7-sm6', category: 'harmonic', primeLimit: 7 },
    { ratio: { n: 15n, d: 14n }, cents: cents(15, 14), name: 'Septimal Diatonic Semitone', shortName: '7-m2', category: 'melodic', primeLimit: 7 },
    { ratio: { n: 21n, d: 16n }, cents: cents(21, 16), name: 'Septimal Narrow Fourth', shortName: '7-P4', category: 'harmonic', primeLimit: 7 },
    { ratio: { n: 32n, d: 21n }, cents: cents(32, 21), name: 'Septimal Wide Fifth', shortName: '7-P5', category: 'harmonic', primeLimit: 7 },
    { ratio: { n: 21n, d: 20n }, cents: cents(21, 20), name: 'Septimal Chromatic Semitone', shortName: '7-A1', category: 'melodic', primeLimit: 7 },
    { ratio: { n: 28n, d: 27n }, cents: cents(28, 27), name: 'Septimal Third-Tone', shortName: '7-⅓T', category: 'melodic', primeLimit: 7 },
    { ratio: { n: 35n, d: 32n }, cents: cents(35, 32), name: 'Septimal Neutral Second', shortName: '7-N2', category: 'melodic', primeLimit: 7 },
    { ratio: { n: 64n, d: 63n }, cents: cents(64, 63), name: 'Septimal Comma', shortName: '7-C', category: 'comma', primeLimit: 7 },
    { ratio: { n: 49n, d: 48n }, cents: cents(49, 48), name: 'Slendro Diesis', shortName: 'Slendro', category: 'comma', primeLimit: 7 },
    { ratio: { n: 50n, d: 49n }, cents: cents(50, 49), name: 'Jubilisma', shortName: 'Jubil', category: 'comma', primeLimit: 7 },
    { ratio: { n: 225n, d: 224n }, cents: cents(225, 224), name: 'Septimal Kleisma', shortName: '7-Kleis', category: 'comma', primeLimit: 7 },

    { ratio: { n: 11n, d: 8n }, cents: cents(11, 8), name: 'Undecimal Tritone', shortName: '11-A4', category: 'harmonic', primeLimit: 11 },
    { ratio: { n: 16n, d: 11n }, cents: cents(16, 11), name: 'Undecimal Diminished Fifth', shortName: '11-d5', category: 'harmonic', primeLimit: 11 },
    { ratio: { n: 11n, d: 9n }, cents: cents(11, 9), name: 'Undecimal Neutral Third', shortName: '11-N3', category: 'harmonic', primeLimit: 11 },
    { ratio: { n: 18n, d: 11n }, cents: cents(18, 11), name: 'Undecimal Neutral Sixth', shortName: '11-N6', category: 'harmonic', primeLimit: 11 },
    { ratio: { n: 11n, d: 10n }, cents: cents(11, 10), name: 'Undecimal Neutral Second', shortName: '11-N2', category: 'melodic', primeLimit: 11 },
    { ratio: { n: 20n, d: 11n }, cents: cents(20, 11), name: 'Undecimal Neutral Seventh', shortName: '11-N7', category: 'harmonic', primeLimit: 11 },
    { ratio: { n: 11n, d: 6n }, cents: cents(11, 6), name: 'Undecimal Neutral Seventh (alt)', shortName: '11-N7b', category: 'harmonic', primeLimit: 11 },
    { ratio: { n: 12n, d: 11n }, cents: cents(12, 11), name: 'Undecimal Neutral Second (alt)', shortName: '11-N2b', category: 'melodic', primeLimit: 11 },
    { ratio: { n: 33n, d: 32n }, cents: cents(33, 32), name: 'Undecimal Comma', shortName: '11-C', category: 'comma', primeLimit: 11 },
    { ratio: { n: 121n, d: 120n }, cents: cents(121, 120), name: 'Biyatisma', shortName: 'Biyat', category: 'comma', primeLimit: 11 },
    { ratio: { n: 99n, d: 98n }, cents: cents(99, 98), name: 'Mothwellsma', shortName: 'Mothw', category: 'comma', primeLimit: 11 },

    { ratio: { n: 13n, d: 8n }, cents: cents(13, 8), name: 'Tridecimal Neutral Sixth', shortName: '13-N6', category: 'harmonic', primeLimit: 13 },
    { ratio: { n: 16n, d: 13n }, cents: cents(16, 13), name: 'Tridecimal Neutral Third', shortName: '13-N3', category: 'harmonic', primeLimit: 13 },
    { ratio: { n: 13n, d: 12n }, cents: cents(13, 12), name: 'Tridecimal Neutral Second', shortName: '13-N2', category: 'melodic', primeLimit: 13 },
    { ratio: { n: 24n, d: 13n }, cents: cents(24, 13), name: 'Tridecimal Neutral Seventh', shortName: '13-N7', category: 'harmonic', primeLimit: 13 },
    { ratio: { n: 13n, d: 10n }, cents: cents(13, 10), name: 'Tridecimal Neutral Third (alt)', shortName: '13-N3b', category: 'harmonic', primeLimit: 13 },
    { ratio: { n: 20n, d: 13n }, cents: cents(20, 13), name: 'Tridecimal Neutral Sixth (alt)', shortName: '13-N6b', category: 'harmonic', primeLimit: 13 },
    { ratio: { n: 13n, d: 11n }, cents: cents(13, 11), name: 'Tridecimal Minor Third', shortName: '13-m3', category: 'harmonic', primeLimit: 13 },
    { ratio: { n: 22n, d: 13n }, cents: cents(22, 13), name: 'Tridecimal Major Sixth', shortName: '13-M6', category: 'harmonic', primeLimit: 13 },
    { ratio: { n: 27n, d: 26n }, cents: cents(27, 26), name: 'Tridecimal Third-Tone', shortName: '13-⅓T', category: 'melodic', primeLimit: 13 },
    { ratio: { n: 65n, d: 64n }, cents: cents(65, 64), name: 'Tridecimal Comma', shortName: '13-C', category: 'comma', primeLimit: 13 },
    { ratio: { n: 169n, d: 168n }, cents: cents(169, 168), name: 'Buzurgisma', shortName: 'Buzurg', category: 'comma', primeLimit: 13 },

    { ratio: { n: 17n, d: 16n }, cents: cents(17, 16), name: 'Septendecimal Semitone', shortName: '17-m2', category: 'melodic', primeLimit: 17 },
    { ratio: { n: 32n, d: 17n }, cents: cents(32, 17), name: 'Septendecimal Minor Seventh', shortName: '17-m7', category: 'harmonic', primeLimit: 17 },
    { ratio: { n: 17n, d: 12n }, cents: cents(17, 12), name: 'Septendecimal Augmented Fourth', shortName: '17-A4', category: 'harmonic', primeLimit: 17 },
    { ratio: { n: 24n, d: 17n }, cents: cents(24, 17), name: 'Septendecimal Diminished Fifth', shortName: '17-d5', category: 'harmonic', primeLimit: 17 },
    { ratio: { n: 17n, d: 15n }, cents: cents(17, 15), name: 'Septendecimal Whole Tone', shortName: '17-M2', category: 'melodic', primeLimit: 17 },
    { ratio: { n: 30n, d: 17n }, cents: cents(30, 17), name: 'Septendecimal Minor Seventh (alt)', shortName: '17-m7b', category: 'harmonic', primeLimit: 17 },
    { ratio: { n: 289n, d: 288n }, cents: cents(289, 288), name: 'Septendecimal Comma', shortName: '17-C', category: 'comma', primeLimit: 17 },

    { ratio: { n: 19n, d: 16n }, cents: cents(19, 16), name: 'Undevicesimal Minor Third', shortName: '19-m3', category: 'harmonic', primeLimit: 19 },
    { ratio: { n: 32n, d: 19n }, cents: cents(32, 19), name: 'Undevicesimal Major Sixth', shortName: '19-M6', category: 'harmonic', primeLimit: 19 },
    { ratio: { n: 19n, d: 18n }, cents: cents(19, 18), name: 'Undevicesimal Semitone', shortName: '19-m2', category: 'melodic', primeLimit: 19 },
    { ratio: { n: 36n, d: 19n }, cents: cents(36, 19), name: 'Undevicesimal Minor Seventh', shortName: '19-m7', category: 'harmonic', primeLimit: 19 },
    { ratio: { n: 19n, d: 15n }, cents: cents(19, 15), name: 'Undevicesimal Major Third', shortName: '19-M3', category: 'harmonic', primeLimit: 19 },
    { ratio: { n: 30n, d: 19n }, cents: cents(30, 19), name: 'Undevicesimal Minor Sixth', shortName: '19-m6', category: 'harmonic', primeLimit: 19 },
    { ratio: { n: 513n, d: 512n }, cents: cents(513, 512), name: 'Undevicesimal Comma', shortName: '19-C', category: 'comma', primeLimit: 19 },

    { ratio: { n: 23n, d: 16n }, cents: cents(23, 16), name: '23-limit Augmented Fifth', shortName: '23-A5', category: 'harmonic', primeLimit: 23 },
    { ratio: { n: 32n, d: 23n }, cents: cents(32, 23), name: '23-limit Diminished Fourth', shortName: '23-d4', category: 'harmonic', primeLimit: 23 },
    { ratio: { n: 23n, d: 18n }, cents: cents(23, 18), name: '23-limit Augmented Fourth', shortName: '23-A4', category: 'harmonic', primeLimit: 23 },
    { ratio: { n: 36n, d: 23n }, cents: cents(36, 23), name: '23-limit Diminished Fifth', shortName: '23-d5', category: 'harmonic', primeLimit: 23 },
    { ratio: { n: 529n, d: 528n }, cents: cents(529, 528), name: '23-limit Comma', shortName: '23-C', category: 'comma', primeLimit: 23 },

    { ratio: { n: 29n, d: 16n }, cents: cents(29, 16), name: '29-limit Major Seventh', shortName: '29-M7', category: 'harmonic', primeLimit: 29 },
    { ratio: { n: 32n, d: 29n }, cents: cents(32, 29), name: '29-limit Minor Second', shortName: '29-m2', category: 'melodic', primeLimit: 29 },
    { ratio: { n: 29n, d: 24n }, cents: cents(29, 24), name: '29-limit Augmented Third', shortName: '29-A3', category: 'harmonic', primeLimit: 29 },
    { ratio: { n: 48n, d: 29n }, cents: cents(48, 29), name: '29-limit Diminished Sixth', shortName: '29-d6', category: 'harmonic', primeLimit: 29 },
    { ratio: { n: 841n, d: 840n }, cents: cents(841, 840), name: '29-limit Comma', shortName: '29-C', category: 'comma', primeLimit: 29 },

    { ratio: { n: 31n, d: 16n }, cents: cents(31, 16), name: '31-limit Major Seventh', shortName: '31-M7', category: 'harmonic', primeLimit: 31 },
    { ratio: { n: 32n, d: 31n }, cents: cents(32, 31), name: '31-limit Minor Second', shortName: '31-m2', category: 'melodic', primeLimit: 31 },
    { ratio: { n: 31n, d: 24n }, cents: cents(31, 24), name: '31-limit Augmented Third', shortName: '31-A3', category: 'harmonic', primeLimit: 31 },
    { ratio: { n: 48n, d: 31n }, cents: cents(48, 31), name: '31-limit Diminished Sixth', shortName: '31-d6', category: 'harmonic', primeLimit: 31 },
    { ratio: { n: 961n, d: 960n }, cents: cents(961, 960), name: '31-limit Comma', shortName: '31-C', category: 'comma', primeLimit: 31 },

    { ratio: { n: 4375n, d: 4374n }, cents: cents(4375, 4374), name: 'Ragisma', shortName: 'Ragis', category: 'comma', primeLimit: 13 },
    { ratio: { n: 2401n, d: 2400n }, cents: cents(2401, 2400), name: 'Breedsma', shortName: 'Breeds', category: 'comma', primeLimit: 7 },
    { ratio: { n: 3136n, d: 3125n }, cents: cents(3136, 3125), name: 'Hemifamity', shortName: 'Hemif', category: 'comma', primeLimit: 7 },
    { ratio: { n: 6561n, d: 6400n }, cents: cents(6561, 6400), name: 'Mathieu Superdiesis', shortName: 'Mathieu', category: 'comma', primeLimit: 5 },
    { ratio: { n: 15625n, d: 15552n }, cents: cents(15625, 15552), name: 'Kleisma', shortName: 'Kleis', category: 'comma', primeLimit: 5 },
    { ratio: { n: 32805n, d: 32768n }, cents: cents(32805, 32768), name: 'Schisma', shortName: 'Schis', category: 'comma', primeLimit: 5 },
];

export function getIntervalsByLimit(limit: number): IntervalEntry[] {
    return DEFAULT_INTERVALS.filter(i => i.primeLimit <= limit);
}

export function getIntervalsByCategory(category: IntervalEntry['category']): IntervalEntry[] {
    return DEFAULT_INTERVALS.filter(i => i.category === category);
}

export function findIntervalByRatio(n: bigint, d: bigint): IntervalEntry | undefined {
    return DEFAULT_INTERVALS.find(i => i.ratio.n === n && i.ratio.d === d);
}

export function findClosestInterval(targetCents: number, maxLimit?: number): IntervalEntry {
    const candidates = maxLimit 
        ? DEFAULT_INTERVALS.filter(i => i.primeLimit <= maxLimit)
        : DEFAULT_INTERVALS;
    
    let closest = candidates[0];
    let minDiff = Math.abs(closest.cents - targetCents);
    
    for (const interval of candidates) {
        const diff = Math.abs(interval.cents - targetCents);
        if (diff < minDiff) {
            minDiff = diff;
            closest = interval;
        }
    }
    
    return closest;
}

export function getAllCommas(): IntervalEntry[] {
    return DEFAULT_INTERVALS.filter(i => i.category === 'comma');
}
