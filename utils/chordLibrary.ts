export type ChordLibraryItem = {
  id: string;
  label: string;
  ratios: string;
};

export type ChordLibraryGroup = {
  title: string;
  items: ChordLibraryItem[];
};

export const CHORD_LIBRARY_GROUPS: ChordLibraryGroup[] = [
  {
    title: 'JI Triads',
    items: [
      { id: 'triad_dim', label: 'Diminished', ratios: '729:864:1024' },
      { id: 'triad_dim_l', label: 'L Diminished', ratios: '5:6:7' },
      { id: 'triad_dim_s', label: 'S Diminished', ratios: '12:14:17' },
      { id: 'triad_min_small', label: 'Small Minor', ratios: '6:7:9' },
      { id: 'triad_min', label: 'Minor', ratios: '27:32:81' },
      { id: 'triad_min_h', label: 'H Minor', ratios: '16:19:24' },
      { id: 'triad_min_large', label: 'Large Minor', ratios: '10:12:15' },
      { id: 'triad_min_wide', label: 'Wide Minor', ratios: '18:22:27' },
      { id: 'triad_maj_narrow', label: 'Narrow Major', ratios: '13:16:19' },
      { id: 'triad_maj_small', label: 'Small Major', ratios: '4:5:6' },
      { id: 'triad_maj', label: 'Major', ratios: '64:81:96' },
      { id: 'triad_maj_large', label: 'Large Major', ratios: '14:18:21' }
    ]
  },
  {
    title: 'Augmented',
    items: [
      { id: 'aug_n', label: 'N Augmented', ratios: '169:208:256' },
      { id: 'aug_s', label: 'S Augmented', ratios: '16:20:25' },
      { id: 'aug_h', label: 'H Augmented', ratios: '7:9:11' },
      { id: 'aug', label: 'Augmented', ratios: '4096:5184:6561' }
    ]
  },
  {
    title: 'JI 7th Chords',
    items: [
      { id: '7th_h_dim', label: 'H Diminished 7', ratios: '10:12:14:17' },
      { id: '7th_dim_m7', label: 'Dim M7', ratios: '15:18:21:28' },
      { id: '7th_h_half_dim', label: 'H Half Dim 7', ratios: '5:6:7:9' },
      { id: '7th_s_min', label: 'S Minor 7', ratios: '12:14:18:21' },
      { id: '7th_l_min', label: 'L Minor 7', ratios: '10:12:15:18' },
      { id: '7th_sn_minmaj', label: 'SN minMaj 7', ratios: '6:7:9:11' },
      { id: '7th_minmaj', label: 'minMaj 7', ratios: '16:19:24:30' }
    ]
  },
  {
    title: 'JI 9th Chords',
    items: [
      { id: '9th_half_dim', label: 'Half Dim 9', ratios: '10:12:14:18:22' },
      { id: '9th_s_min', label: 'S Minor 9', ratios: '12:14:18:21:27' },
      { id: '9th_l_min', label: 'L Minor 9', ratios: '20:24:30:36:45' },
      { id: '9th_h_dom_b9', label: 'H Dominant b9', ratios: '8:10:12:14:17' },
      { id: '9th_h_dom', label: 'H Dominant 9', ratios: '4:5:6:7:9' },
      { id: '9th_h_dom_sharp9', label: 'H Dominant #9', ratios: '12:15:18:21:28' },
      { id: '9th_h_maj', label: 'H Major 9', ratios: '8:10:12:15:18' },
      { id: '9th_aug', label: 'Aug 9', ratios: '14:18:22:26:33' },
      { id: '9th_aug_sharp9', label: 'Aug #9', ratios: '7:9:11:13:17' }
    ]
  },
  {
    title: 'JI 11th & 13th Chords',
    items: [
      { id: '11_s_min', label: 'S Min 11', ratios: '24:28:36:42:54:63' },
      { id: '11_l_min', label: 'L Min 11', ratios: '20:24:30:36:45:54' },
      { id: '13_s_min', label: 'S Min 13', ratios: '24:28:36:42:54:63:80' },
      { id: '11_s_maj_sharp11', label: 'S Maj 7#11', ratios: '16:20:24:30:36:45' },
      { id: '11_h_maj_sharp11', label: 'H Maj 7#11', ratios: '8:10:12:15:18:22' },
      { id: '13_h_maj_sharp11b13', label: 'H Maj 7#11b13', ratios: '8:10:12:15:18:22:26' },
      { id: '13_s_maj', label: 'S Maj 13', ratios: '24:30:36:45:54:63:80' },
      { id: '13_h_maj', label: 'H Maj 13', ratios: '8:10:12:15:18:21:28' },
      { id: '13_s_maj_sharp11n13', label: 'S Maj 7#11n13', ratios: '24:30:36:45:54:63:80' },
      { id: '13_hs_maj_sharp11n13', label: 'HS Maj 7#11n13', ratios: '24:30:36:45:54:63:68:80' }
    ]
  },
  {
    title: 'JI Other Chords',
    items: [
      { id: 'aug6_german', label: 'German aug6', ratios: '20:25:30:36' },
      { id: 'aug6_french', label: 'French aug6', ratios: '28:35:40:50' },
      { id: 'aug6_french_h', label: 'H French aug6', ratios: '7:9:10:13' },
      { id: 'add6_s_minor', label: 'S Minor add6', ratios: '12:14:18:20' },
      { id: 'add6_major', label: 'Major add6', ratios: '12:15:18:20' },
      { id: 'sus_s', label: 'S Sus', ratios: '16:21:24:28:36' },
      { id: 'sus', label: 'Sus', ratios: '72:96:108:128:163' },
      { id: 'minor_6_9', label: 'Minor 6 9', ratios: '18:21:30:40:54' },
      { id: 'major_6_9', label: 'Major 6 9', ratios: '16:20:27:36:48' }
    ]
  }
];
