import type { ConsequentialScaleConfig } from '../../../types';

export const DEFAULT_CONFIG: ConsequentialScaleConfig = {
    id: 'temp',
    name: 'New Sequence',
    expressionRaw: '1/n',
    mode: 'Custom',
    advancedSymbols: true, 
    derivativeOrder: 0,
    derivVar: 'n',
    showOriginal: true,
    domain: {
        nStart: 1, nEnd: 16, nStep: 1,
        iStart: 0, iEnd: 0, iStep: 1,
        varyMode: 'FixI_VaryN',
        iList: [],
        variables: [
            { name: 'n', value: 1, min: 1, max: 16, step: 1, role: 'domain' }
        ]
    },
    mapping: {
        baseFreq: 261.63, 
        normalizeToOctave: true,
        quantizeMode: 'none',
        primeLimit: 11,
        handleNegative: 'mask', 
        linearMode: false,
        linearUnit: 100
    },
    display: {
        showOutOfRange: true,
        graphEnabled: true,
        xAxis: 'n',
        yAxis: 'Cents',
        showDerivative: false,
        derivAbsolute: false,
        derivStep: 1,
        
        showGraphPath: true,
        showNoteDots: true,
        drawOrder: 'graph_first',
        revealMsPerNote: 20,
        revealMaxDots: 2000,
        xSpacingMode: 'from_xaxis',
        uniformXStep: 1
    },
    playback: {
        chordNoteCount: 8,
        spreadOctaves: 2,
        minSpacingCents: 70,
        strategy: 'stack',
        scaleNoteDuration: 300,
        scaleNoteGap: 100,
        speedUnit: 'ms',
        bpm: 120,
        gate: 0.8
    }
};
