export type ExhibitType = 'model' | 'text' | 'interactive' | 'audio';

export interface Exhibit {
  id: string;
  type: ExhibitType;
  position: [number, number, number];
  rotation: [number, number, number];
  standSize?: 's' | 'm' | 'l';
  assets: {
    modelUrl?: string;
    
    modelTransform?: {
      position?: [number, number, number];
      rotation?: [number, number, number];
      scale?: number | [number, number, number];
    };
    
    audioUrl?: string;
    
    audioClips?: Array<{ id: string; label: string; url: string; description?: string }>;
  };
  content: {
    title: string;
    
    description: string;
    
    shortDescription?: string;
    
    longDescription?: string;
    
    sections?: Array<{ heading: string; body: string }>;
    
    keyTakeaways?: string[];
    
    references?: Array<{ label: string; url?: string; author?: string; year?: string }>;
  };
  lighting?: {
    intensity: number;
    castShadow: boolean;
  };
}

export const museumExhibits: Exhibit[] = [
  {
    id: 'harry-partch-corner',
    type: 'interactive',
    position: [-8.5, 0, 8.6],
    rotation: [0, Math.PI / 4, 0],
    standSize: 'l',
    assets: {
      
    },
    content: {
      title: 'The Harry Partch Corner',
      description: 'A composer-builder who designed instruments for 43-tone just intonation.',
      shortDescription: 'Partch rejected 12-TET and rebuilt music around pure intervals and physical resonance.',
      longDescription:
        'Harry Partch (1901–1974) argued that Western 12-tone equal temperament (12-TET) is a compromise that blurs many interval identities.\n\n'
        + 'Instead of squeezing the harmonic world into 12 fixed semitones, Partch organized pitch around rational frequency ratios (just intonation) and built an entire orchestra of new instruments to perform it.',
      sections: [
        {
          heading: 'What does “43-tone” mean?',
          body:
            'Partch’s “43-tone scale” is a curated collection of 43 pitch classes within an octave, drawn from ratio relationships that occur naturally in the harmonic series.\n\n'
            + 'It is not “43 equal steps.” The spacing is unequal because ratios like 7/6, 9/8, 5/4, 11/8, etc. are all different sizes in cents.'
        },
        {
          heading: 'Why build new instruments?',
          body:
            'Many just intervals do not align with standard Western instrument layouts. Partch created instruments (e.g., Chromelodeon, Cloud-Chamber Bowls, Adapted Viola) whose tuning and ergonomics match his ratio-based pitch world.'
        },
        {
          heading: 'How to listen here',
          body:
            'When you later compare tunings in the audio exhibit, listen for: \n'
            + '• “Locking” consonance (pure ratios) vs. slightly “beating” consonance (tempered approximations)\n'
            + '• Color changes in 7-limit and 11-limit intervals (ratios involving prime 7 or 11)'
        }
      ],
      keyTakeaways: [
        'Microtonality is not only “more notes”; it is often a different logic for organizing pitch.',
        'Just intonation uses rational ratios, producing intervals with distinct colors and stability.',
        'Instrument design matters: tuning systems and interfaces are inseparable in practice.'
      ],
      references: [
        {
          label: 'Harry Partch — Genesis of a Music (2nd ed.)',
          author: 'Harry Partch',
          year: '1974'
        },
        {
          label: 'Partch instruments overview (Wikipedia)',
          url: 'https://en.wikipedia.org/wiki/Harry_Partch',
          author: 'Wikipedia'
        }
      ]
    }},
  {
    id: 'microtonal-piano',
    type: 'audio',
    position: [-5.8, 0, 11.2],
    rotation: [0, -Math.PI / 6, 0],
    standSize: 'm',
    assets: {
      audioClips: [
        {
          id: '12tet',
          label: '12-TET (baseline)',
          url: '/audio/microtonal-demo-12tet.mp3',
          description: 'Standard Western equal temperament: 12 equal semitones per octave.'
        },
        {
          id: '19tet',
          label: '19-TET (microtonal equal temperament)',
          url: '/audio/microtonal-demo-19tet.mp3',
          description: '19 equal steps per octave; major/minor thirds shift noticeably.'
        },
        {
          id: 'ji',
          label: 'Just Intonation (pure ratios)',
          url: '/audio/microtonal-demo-ji.mp3',
          description: 'Intervals tuned to ratios (e.g., 5/4, 3/2). Listen for reduced beating.'
        }
      ]
    },
    content: {
      title: 'Microtonal Piano Exhibit',
      description: 'Compare the same musical phrase under different tuning systems.',
      shortDescription: 'Switch tunings and listen for how “the same notes” change color and tension.',
      longDescription:
        'Microtonality becomes intuitive when you hear controlled comparisons. Here you can listen to the same short phrase in three tuning approaches:\n\n'
        + '• 12-TET (baseline)\n'
        + '• 19-TET (more, smaller steps)\n'
        + '• Just Intonation (ratio-based)\n\n'
        + 'Focus on thirds and sixths: these are often where equal temperaments diverge most from simple ratios.',
      sections: [
        {
          heading: 'What to listen for',
          body:
            '1) Beating vs. stability: pure ratios often “lock” with less beating.\n'
            + '2) Emotional tilt: small tuning shifts can change perceived brightness/sadness.\n'
            + '3) Chord identity: in 19-TET, some familiar chords may feel “reshaped.”'
        },
        {
          heading: 'Tip for fair comparison',
          body:
            'Keep your volume constant and switch clips back-to-back. Small differences are easier to hear in immediate alternation.'
        }
      ],
      keyTakeaways: [
        'Equal temperament is a design choice; changing the division changes harmonic “geometry.”',
        'Just intonation emphasizes consonant ratio relationships.',
        'A/B comparison is the fastest way to learn microtonal hearing.'
      ],
      references: [
        {
          label: 'Cents (interval measurement) — Wikipedia',
          url: 'https://en.wikipedia.org/wiki/Cent_(music)'
        },
        {
          label: 'Equal temperament — Wikipedia',
          url: 'https://en.wikipedia.org/wiki/Equal_temperament'
        }
      ]
    }},
  {
    id: 'ratio-wall',
    type: 'text',
    position: [-8.2, 0, 24.6],
    rotation: [0, Math.PI, 0],
    standSize: 's',
    assets: {},
    content: {
      title: 'Ratio Wall',
      description: 'A visual map of intervals as ratios — and why “commas” matter.',
      shortDescription: 'Intervals are ratios. Small mismatches (commas) explain why tunings diverge.',
      longDescription:
        'If pitch is frequency, then musical intervals are frequency ratios.\n\n'
        + 'A perfect fifth is close to 3/2. A major third is close to 5/4. These are not abstractions: they are literal relationships between vibrations.\n\n'
        + 'But different ways of building scales create small residual mismatches called commas. Those commas are the reason we have many temperaments.',
      sections: [
        {
          heading: 'Ratios → cents',
          body:
            'To compare ratios with equal-tempered steps, we often convert to cents:\n'
            + 'cents = 1200 × log2(ratio).\n\n'
            + 'Example: 3/2 ≈ 701.955¢ (a just fifth), while a 12-TET fifth is exactly 700¢.'
        },
        {
          heading: 'Commas (small but powerful)',
          body:
            'Two famous commas:\n'
            + '• Pythagorean comma: (3/2)^12 / 2^7 ≈ 23.46¢\n'
            + '• Syntonic comma: 81/80 ≈ 21.51¢\n\n'
            + 'Temperaments “spread” these commas across intervals so the scale closes neatly.'
        },
        {
          heading: 'Why this matters for microtonality',
          body:
            'Microtonal systems often choose a different compromise: they may preserve certain ratios more accurately, allow more pitch classes, or organize pitches by a lattice of primes (5-limit, 7-limit, 11-limit...).'
        }
      ],
      keyTakeaways: [
        'Intervals are frequency ratios; temperament is how you manage the leftover error (commas).',
        'Cents provide a common ruler to compare unequal interval systems.',
        'Microtonality can be explained as alternative strategies for distributing commas.'
      ],
      references: [
        {
          label: 'Just intonation — Wikipedia',
          url: 'https://en.wikipedia.org/wiki/Just_intonation'
        },
        {
          label: 'Pythagorean comma — Wikipedia',
          url: 'https://en.wikipedia.org/wiki/Pythagorean_comma'
        },
        {
          label: 'Syntonic comma — Wikipedia',
          url: 'https://en.wikipedia.org/wiki/Syntonic_comma'
        }
      ]
    }
  }
];
