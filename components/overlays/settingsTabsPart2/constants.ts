export const SYM_LIMITS = [5, 7, 11, 13, 17, 19, 23, 29, 31] as const;
export const MEANTONE_PRESETS = [
    { id: '1-4', name: 'Quarter-Comma (1/4)', fraction: 1 / 4 },
    { id: '1-5', name: 'Fifth-Comma (1/5)', fraction: 1 / 5 },
    { id: '1-6', name: 'Sixth-Comma (1/6)', fraction: 1 / 6 },
    { id: '1-7', name: 'Seventh-Comma (1/7)', fraction: 1 / 7 },
    { id: '1-8', name: 'Eighth-Comma (1/8)', fraction: 1 / 8 },
    { id: '1-9', name: 'Ninth-Comma (1/9)', fraction: 1 / 9 },
    { id: '1-10', name: 'Tenth-Comma (1/10)', fraction: 1 / 10 },
    { id: '1-11', name: 'Eleventh-Comma (1/11)', fraction: 1 / 11 },
    { id: '1-12', name: 'Twelfth-Comma (1/12)', fraction: 1 / 12 },
    { id: '1-13', name: 'Thirteenth-Comma (1/13)', fraction: 1 / 13 },
    { id: '1-14', name: 'Fourteenth-Comma (1/14)', fraction: 1 / 14 },
    { id: '1-15', name: 'Fifteenth-Comma (1/15)', fraction: 1 / 15 },
    { id: '1-16', name: 'Sixteenth-Comma (1/16)', fraction: 1 / 16 },
    { id: '1-17', name: 'Seventeenth-Comma (1/17)', fraction: 1 / 17 },
    { id: '1-18', name: 'Eighteenth-Comma (1/18)', fraction: 1 / 18 }
];
export const FIFTH_ORDER = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'] as const;
export const CHROMATIC_ORDER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const WELL_TEMPERED_PRESETS = (() => {
    const comma = 1200 * Math.log2(81 / 80);
    const quarter = -comma / 4;
    const sixth = -comma / 6;
    const fifth = -comma / 5;
    const eighth = -comma / 8;
    const twelfth = -comma / 12;
    return [
        { id: 'werckmeister-iii', name: 'Werckmeister III (1691)', adjustments: [quarter, quarter, quarter, quarter, 0, 0, 0, 0, 0, 0, 0] },
        { id: 'kirnberger-iii', name: 'Kirnberger III', adjustments: [quarter, quarter, sixth, sixth, sixth, sixth, 0, 0, 0, 0, 0] },
        { id: 'kirnberger-ii', name: 'Kirnberger II', adjustments: [quarter, sixth, sixth, 0, 0, 0, 0, 0, 0, 0, 0] },
        { id: 'vallotti', name: 'Vallotti', adjustments: [sixth, sixth, sixth, sixth, sixth, sixth, 0, 0, 0, 0, 0] },
        { id: 'young-ii', name: 'Young II (1799)', adjustments: [0, 0, 0, sixth, sixth, sixth, sixth, sixth, sixth, 0, 0] },
        { id: 'kellner', name: 'Kellner', adjustments: [quarter, sixth, sixth, twelfth, twelfth, 0, 0, 0, 0, 0, 0] },
        { id: 'neidhardt-village', name: 'Neidhardt (Village)', adjustments: [sixth, sixth, sixth, sixth, 0, 0, 0, 0, 0, 0, 0] },
        { id: 'neidhardt-small', name: 'Neidhardt (Small City)', adjustments: [sixth, sixth, sixth, sixth, sixth, twelfth, twelfth, 0, 0, 0, 0] },
        { id: 'neidhardt-large', name: 'Neidhardt (Large City)', adjustments: [sixth, sixth, sixth, sixth, sixth, sixth, sixth, 0, 0, 0, 0] },
        { id: 'rameau', name: 'Rameau (1726)', adjustments: [quarter, quarter, quarter, 0, 0, 0, 0, 0, 0, 0, 0] },
        { id: 'marpurg', name: 'Marpurg', adjustments: [fifth, fifth, sixth, sixth, eighth, eighth, 0, 0, 0, 0, 0] }
    ];
})();
