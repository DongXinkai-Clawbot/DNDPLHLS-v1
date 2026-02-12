
import { simplify, calculateCents } from '../musicLogic';
import type { Fraction } from '../types';

const PRIME_ADJECTIVES: Record<number, string> = {
    5: 'Classic',
    7: 'Septimal',
    11: 'Undecimal',
    13: 'Tridecimal',
    17: 'Septendecimal',
    19: 'Undevicesimal',
    23: 'Vigesimal-third',
    29: 'Undetricesimai',
    31: 'Tricesimoprimal',
    37: '37-limit',
    41: '41-limit',
    43: '43-limit',
    47: '47-limit',
};

const MULTIPLICITY_PREFIXES: Record<number, string> = {
    1: '',
    2: 'Double-',
    3: 'Triple-',
    4: 'Quadruple-',
    5: 'Quintuple-',
    6: 'Sextuple-',
    7: 'Septuple-',
    8: 'Octuple-',
};

interface PythagoreanInterval {
    name: string;
    shortName: string;
    cents: number;
    threeExp: number; 
}

const PYTHAGOREAN_INTERVALS: PythagoreanInterval[] = (() => {
    const intervals: PythagoreanInterval[] = [];

    for (let exp = -12; exp <= 12; exp++) {
        
        let n = exp >= 0 ? BigInt(3) ** BigInt(exp) : 1n;
        let d = exp < 0 ? BigInt(3) ** BigInt(-exp) : 1n;

        while (n < d) { n *= 2n; }
        while (Number(n) / Number(d) >= 2) { d *= 2n; }

        const cents = 1200 * Math.log2(Number(n) / Number(d));

        intervals.push({
            name: getPythagoreanName(exp),
            shortName: getPythagoreanShortName(exp),
            cents,
            threeExp: exp
        });
    }

    return intervals.sort((a, b) => a.cents - b.cents);
})();

function getPythagoreanName(threeExp: number): string {
    
    const names: Record<number, string> = {
        0: 'Unison',
        1: 'Perfect Fifth',
        2: 'Major Second',
        3: 'Major Sixth',
        4: 'Major Third',
        5: 'Major Seventh',
        6: 'Augmented Fourth',
        7: 'Augmented Unison',
        8: 'Augmented Fifth',
        9: 'Augmented Second',
        10: 'Augmented Sixth',
        11: 'Augmented Third',
        12: 'Augmented Seventh',
        '-1': 'Perfect Fourth',
        '-2': 'Minor Seventh',
        '-3': 'Minor Third',
        '-4': 'Minor Sixth',
        '-5': 'Minor Second',
        '-6': 'Diminished Fifth',
        '-7': 'Diminished Octave',
        '-8': 'Diminished Fourth',
        '-9': 'Diminished Seventh',
        '-10': 'Diminished Third',
        '-11': 'Diminished Sixth',
        '-12': 'Diminished Second',
    };
    return names[threeExp] || `Pythagorean (3^${threeExp})`;
}

function getPythagoreanShortName(threeExp: number): string {
    const names: Record<number, string> = {
        0: 'P1',
        1: 'P5',
        2: 'M2',
        3: 'M6',
        4: 'M3',
        5: 'M7',
        6: 'A4',
        7: 'A1',
        '-1': 'P4',
        '-2': 'm7',
        '-3': 'm3',
        '-4': 'm6',
        '-5': 'm2',
        '-6': 'd5',
        '-7': 'd8',
    };
    return names[threeExp] || `3^${threeExp}`;
}

export interface PrimeFactorization {
    prime: number;
    exponent: number;
    inNumerator: boolean; 
}

export interface FJSResult {
    
    ratio: Fraction;
    cents: number;

    skeleton: PythagoreanInterval;
    skeletonCents: number;

    primeFactors: PrimeFactorization[];
    totalDeviation: number; 

    modifiers: string[]; 
    fullName: string; 
    shortName: string; 

    isComma: boolean; 
    commaName?: string; 
}

function factorize(n: bigint): Map<number, number> {
    const factors = new Map<number, number>();
    let remaining = n < 0n ? -n : n;

    let count = 0;
    while (remaining % 2n === 0n) {
        count++;
        remaining /= 2n;
    }
    if (count > 0) factors.set(2, count);

    let divisor = 3n;
    while (divisor * divisor <= remaining) {
        count = 0;
        while (remaining % divisor === 0n) {
            count++;
            remaining /= divisor;
        }
        if (count > 0) factors.set(Number(divisor), count);
        divisor += 2n;
    }

    if (remaining > 1n) {
        factors.set(Number(remaining), 1);
    }

    return factors;
}

function getPrimeAdjective(prime: number): string {
    if (PRIME_ADJECTIVES[prime]) {
        return PRIME_ADJECTIVES[prime];
    }
    
    return `${prime}-limit`;
}

function getMultiplicityPrefix(count: number): string {
    if (count <= 0) return '';
    if (MULTIPLICITY_PREFIXES[count]) {
        return MULTIPLICITY_PREFIXES[count];
    }
    
    return `${count}×`;
}

function findClosestPythagorean(cents: number): PythagoreanInterval {
    
    let normalizedCents = ((cents % 1200) + 1200) % 1200;

    let closest = PYTHAGOREAN_INTERVALS[0];
    let minDiff = Infinity;

    for (const interval of PYTHAGOREAN_INTERVALS) {
        const diff = Math.abs(interval.cents - normalizedCents);
        
        const wrapDiff = Math.abs(1200 - Math.abs(interval.cents - normalizedCents));
        const actualDiff = Math.min(diff, wrapDiff);

        if (actualDiff < minDiff) {
            minDiff = actualDiff;
            closest = interval;
        }
    }

    return closest;
}

export function computeFJS(ratio: Fraction): FJSResult {
    const { n, d } = simplify(ratio);
    const cents = calculateCents({ n, d });

    const numFactors = factorize(n);
    const denFactors = factorize(d);

    const primeFactors: PrimeFactorization[] = [];

    const allPrimes = new Set<number>();
    numFactors.forEach((_, p) => { if (p > 3) allPrimes.add(p); });
    denFactors.forEach((_, p) => { if (p > 3) allPrimes.add(p); });

    for (const prime of Array.from(allPrimes).sort((a, b) => a - b)) {
        const numExp = numFactors.get(prime) || 0;
        const denExp = denFactors.get(prime) || 0;
        const netExp = numExp - denExp;

        if (netExp !== 0) {
            primeFactors.push({
                prime,
                exponent: Math.abs(netExp),
                inNumerator: netExp > 0
            });
        }
    }

    const skeleton = findClosestPythagorean(cents);
    const totalDeviation = cents - skeleton.cents;

    const modifiers: string[] = [];
    const shortModifiers: string[] = [];

    for (const factor of primeFactors) {
        const prefix = getMultiplicityPrefix(factor.exponent);
        const adjective = getPrimeAdjective(factor.prime);
        const direction = factor.inNumerator ? '' : 'Sub-';

        modifiers.push(`${direction}${prefix}${adjective}`);

        const shortPrefix = factor.exponent > 1 ? `${factor.exponent}×` : '';
        const shortDir = factor.inNumerator ? '' : '↓';
        shortModifiers.push(`${shortDir}${shortPrefix}${factor.prime}`);
    }

    const isComma = Math.abs(cents) < 50 || Math.abs(cents - 1200) < 50 || Math.abs(cents % 1200) < 50;

    let fullName: string;
    if (modifiers.length === 0) {
        fullName = skeleton.name;
    } else if (isComma && skeleton.name === 'Unison') {
        fullName = `${modifiers.join(' ')} Comma`;
    } else {
        fullName = `${modifiers.join(' ')} ${skeleton.name}`;
    }

    const shortName = shortModifiers.length > 0
        ? `${shortModifiers.join(',')} ${skeleton.shortName}`
        : skeleton.shortName;

    return {
        ratio: { n, d },
        cents,
        skeleton,
        skeletonCents: skeleton.cents,
        primeFactors,
        totalDeviation,
        modifiers,
        fullName,
        shortName,
        isComma,
    };
}

export function formatRatioSimple(ratio: Fraction): string {
    return `${ratio.n}/${ratio.d}`;
}

export function getFJSBreakdown(fjs: FJSResult): string[] {
    const lines: string[] = [];

    lines.push(`Ratio: ${fjs.ratio.n}/${fjs.ratio.d}`);
    lines.push(`Cents: ${fjs.cents.toFixed(2)}¢`);
    lines.push(`Pythagorean Skeleton: ${fjs.skeleton.name} (${fjs.skeleton.cents.toFixed(2)}¢)`);

    if (fjs.primeFactors.length > 0) {
        lines.push('Prime Adjustments:');
        for (const factor of fjs.primeFactors) {
            const dir = factor.inNumerator ? '↑' : '↓';
            lines.push(`  ${dir} ${factor.prime}^${factor.exponent}`);
        }
        lines.push(`Total Deviation: ${fjs.totalDeviation > 0 ? '+' : ''}${fjs.totalDeviation.toFixed(2)}¢`);
    }

    lines.push(`FJS Name: ${fjs.fullName}`);

    return lines;
}
