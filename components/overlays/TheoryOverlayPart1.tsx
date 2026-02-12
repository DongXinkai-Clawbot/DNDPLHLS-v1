
import React from 'react';
import { TheoryOverlayPart2Content } from './TheoryOverlayPart2';

export const TheoryOverlay = ({ onClose }: { onClose: () => void }) => {
  const Section = ({ title, children }: { title: string, children?: React.ReactNode }) => (
    <section className="mb-12 border-b border-gray-800 pb-8 last:border-0">
        <h2 className="text-2xl font-bold text-blue-400 mb-6 uppercase tracking-wider">{title}</h2>
        <div className="space-y-6 text-gray-300 leading-relaxed text-sm md:text-base">
            {children}
        </div>
    </section>
  );

  const SubSection = ({ title, children }: { title: string, children?: React.ReactNode }) => (
      <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <h3 className="text-lg font-bold text-white mb-3">{title}</h3>
          <div className="space-y-3">
              {children}
          </div>
      </div>
  );

  return (
    <div className="fixed inset-0 z-[200] bg-[#050505] text-white overflow-y-auto custom-scrollbar animate-in fade-in duration-300">
      <div className="max-w-5xl mx-auto min-h-screen flex flex-col">
        <div className="sticky top-0 bg-[#050505]/95 backdrop-blur-xl border-b border-gray-800 p-6 flex justify-between items-center z-50 shadow-2xl">
           <div>
               <h1 className="text-xl md:text-3xl font-black uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                   Systemic Music Theory
               </h1>
               <p className="text-sm md:text-lg text-gray-200 font-mono mt-1 font-bold">Dynamic N-Dimensional Prime-Limit Harmonic Lattice & Synthesizer</p>
               <p className="text-[10px] text-gray-500 font-mono mt-1">From Harmonics to an N-Dimensional Prime-Limit Lattice</p>
           </div>
           <button 
                onClick={onClose} 
                className="bg-gray-800 hover:bg-white hover:text-black text-white px-6 py-2 rounded-full font-bold transition-all shadow-lg border border-gray-700 text-xs md:text-sm"
            >
                CLOSE GUIDE X
           </button>
        </div>

        <div className="p-6 md:p-12 space-y-8">
            <div className="mb-8 text-gray-300 leading-relaxed border-l-4 border-blue-500 pl-4 bg-gray-900/30 p-4 rounded-r-lg">
                <p>
                    Music’s pitch world is older than notation and wider than any single tuning.
                    What we call a “note” is often a <strong>relationship</strong>: a ratio, a path, a place on a lattice.
                    This Theory panel explains that relationship step by step—starting from the most traditional foundation: <strong>whole numbers, strings, and the octave</strong>.
                </p>
            </div>

            <Section title="0) What this theory assumes (and why)">
                <p>You do <strong>not</strong> need prior music theory. You only need:</p>
                <ul className="list-disc pl-5 space-y-1 text-gray-400">
                    <li>High vs low pitch (the voice can glide upward and downward).</li>
                    <li>Counting numbers: 1, 2, 3, 4…</li>
                    <li>Simple fractions/ratios: 3/2, 5/4…</li>
                    <li>The first seven letters: A B C D E F G.</li>
                </ul>
                <p>From these, a complete pitch world can be built.</p>
            </Section>

            <Section title="1) Pitch as a ratio: the oldest definition">
                <SubSection title="1.1 The source tone: 1/1">
                    <p>
                        Take a vibrating string (or anything that produces a stable pitch).
                        Its first stable pitch is our <strong>source tone</strong>:
                    </p>
                    <ul className="list-disc pl-5 text-gray-400">
                        <li><strong>1/1</strong> = the reference pitch (the origin of the system).</li>
                    </ul>
                    <p>Everything else will be described as a ratio to 1/1.</p>
                </SubSection>

                <SubSection title="1.2 The octave: 2/1 is a “duplication,” not a new family">
                    <p>Halve the string length (or double frequency) and you get:</p>
                    <ul className="list-disc pl-5 text-gray-400">
                        <li><strong>2/1</strong> = the octave.</li>
                    </ul>
                    <p>
                        It feels like the “same note, brighter/higher.”
                        So the octave mainly <strong>extends range</strong> rather than creating a new harmonic identity.
                    </p>
                </SubSection>

                <SubSection title="1.3 The fifth (3/2): the prime-3 generator that builds a diatonic world">
                  <p>
                    In ratio-theory, the <strong>perfect fifth</strong> is not “just a nice sound.”
                    It is the first interval that behaves like a <strong>stable generator</strong>: a single operation you can repeat to
                    walk through a large, structured pitch landscape.
                  </p>

                  <div className="bg-gray-800/40 p-4 rounded-lg border border-gray-700">
                    <p className="font-bold text-white mb-2">Definition (harmonic meaning)</p>
                    <ul className="list-disc pl-5 text-gray-300 space-y-1">
                      <li>
                        A tone’s frequency ratio to the source is written as <strong>H/L</strong> (e.g., 3/2).
                      </li>
                      <li>
                        The ratio <strong>3/2</strong> arises from the simplest non-octave harmonic relationship:
                        the <strong>3rd harmonic</strong> compared to the <strong>2nd harmonic</strong>.
                      </li>
                      <li>
                        That is why the fifth is called the <strong>prime-3</strong> doorway: it is literally “where 3 enters the game.”
                      </li>
                    </ul>
                  </div>

                  <p>
                    The fifth matters because it is <strong>multiplicative</strong>.
                    “Going up a fifth” means: <strong>multiply by 3/2</strong>.
                    “Going down a fifth” means: <strong>multiply by 2/3</strong>.
                    This is the ancient engine behind fifths-chains, key-relations, and the diatonic backbone.
                  </p>

                  <div className="bg-gray-900/60 p-4 rounded-lg border border-gray-800">
                    <p className="font-bold text-white mb-2">A precise rule (what a “fifths chain” really is)</p>
                    <ul className="list-disc pl-5 text-gray-300 space-y-1">
                      <li><strong>Fifth-up step</strong>: r ↦ r × (3/2)</li>
                      <li><strong>Fifth-down step</strong>: r ↦ r × (2/3)</li>
                      <li>
                        After each step, we usually apply <strong>octave reduction</strong> (Section 2) so the result stays inside one octave.
                      </li>
                    </ul>
                  </div>

                  <p>
                    To show this without handwaving, start with the source tone <strong>1/1</strong> (your “home”).
                    Apply the fifth operation repeatedly and reduce into one octave each time.
                    What appears is not arbitrary: it is the staff’s diatonic skeleton emerging from pure arithmetic.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                      <p className="font-bold text-white mb-2">Fifths upward (× 3/2, then octave-reduce)</p>
                      <div className="font-mono text-xs text-gray-200 space-y-1">
                        <div>1/1  →  3/2</div>
                        <div>3/2  →  9/4  →  9/8</div>
                        <div>9/8  →  27/16</div>
                        <div>27/16 →  81/32 →  81/64</div>
                      </div>
                    </div>

                    <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                      <p className="font-bold text-white mb-2">Fifths downward (× 2/3, then octave-reduce)</p>
                      <div className="font-mono text-xs text-gray-200 space-y-1">
                        <div>1/1  →  2/3   →  4/3</div>
                        <div>4/3  →  8/9   →  16/9</div>
                        <div>16/9 →  32/27</div>
                        <div>32/27 → 64/81 → 128/81</div>
                      </div>
                    </div>
                  </div>

                  <p>
                    Two deep consequences follow, and they will matter later when you meet commas, spellings, and temperaments:
                  </p>
                  <ol className="list-decimal pl-5 text-gray-300 space-y-1">
                    <li>
                      The fifth is a <strong>single clean move</strong> (prime-3), but octave reduction (prime-2) is a second move.
                      Diatonic structure is already a <strong>two-prime dance</strong>: 2 and 3.
                    </li>
                    <li>
                      If you keep stacking fifths long enough, you eventually return “near” where you started but not exactly:
                      that near-miss residue is the seed of <strong>comma logic</strong>.
                    </li>
                  </ol>
                </SubSection>
            </Section>

            <Section title="2) Octave reduction: the exact operation that turns ‘infinite ratios’ into one pitch-class octave">
              <p>
                Ratios can grow without bound: 3/2, 9/4, 27/8, 81/16…
                But musical hearing treats pitches separated by octaves as the “same class” (same letter-family, different register).
                <strong>Octave reduction</strong> is the precise arithmetic that enforces that tradition.
              </p>

              <div className="bg-gray-900/50 p-5 rounded-xl border border-gray-800">
                <p className="font-bold text-white mb-2">Core idea (octave equivalence)</p>
                <p className="text-gray-300">
                  Two ratios r and s represent the same pitch-class if they differ by a power of 2:
                  <span className="font-mono"> s = r × 2^k </span>
                  for some integer k. The power of 2 is “just an octave shift.”
                </p>
              </div>

              <div className="bg-gray-800/40 p-4 rounded-lg border border-gray-700">
                <p className="font-bold text-white mb-2">Canonical target range</p>
                <ul className="list-disc pl-5 text-gray-300 space-y-1">
                  <li>
                    We choose a single octave as the comparison window: <strong>[1, 2)</strong>.
                  </li>
                  <li>
                    Octave reduction means: find the unique <strong>r′</strong> such that
                    <strong> r′ = r × 2^k </strong> and <strong>1 ≤ r′ &lt; 2</strong>.
                  </li>
                </ul>
              </div>

              <div className="bg-gray-900/60 p-4 rounded-lg border border-gray-800">
                <p className="font-bold text-white mb-2">Practical algorithm (no ambiguity)</p>
                <ul className="list-disc pl-5 text-gray-300 space-y-1">
                  <li><strong>If r ≥ 2</strong>: repeatedly divide by 2 until it lands in [1, 2).</li>
                  <li><strong>If r &lt; 1</strong>: repeatedly multiply by 2 until it lands in [1, 2).</li>
                  <li>
                    Keep the integer count of how many times you multiplied/divided by 2 if you care about register.
                    (Pitch-class ignores it; full pitch remembers it.)
                  </li>
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                  <p className="font-bold text-white mb-2">Example A</p>
                  <p className="font-mono text-xs text-gray-200">
                    9/4 ≥ 2 → (9/4)/2 = 9/8<br/>
                    Result: 9/8 ∈ [1,2)
                  </p>
                </div>
                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                  <p className="font-bold text-white mb-2">Example B</p>
                  <p className="font-mono text-xs text-gray-200">
                    2/3 &lt; 1 → (2/3)×2 = 4/3<br/>
                    Result: 4/3 ∈ [1,2)
                  </p>
                </div>
                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                  <p className="font-bold text-white mb-2">Example C</p>
                  <p className="font-mono text-xs text-gray-200">
                    81/32 ≥ 2 → /2 = 81/64<br/>
                    Result: 81/64 ∈ [1,2)
                  </p>
                </div>
              </div>

              <p>
                This matters because later you will measure distances (intervals) and build lattices.
                Without octave reduction, the lattice is still valid—but hard to read.
                Octave reduction is the old practice of “same letter across octaves,” stated as exact number theory.
              </p>
            </Section>

            <Section title="3) D as “Delta”: why the source tone is labeled D">
                <p>A poetic naming choice helps memory without breaking the math:</p>
                <ul className="list-disc pl-5 space-y-1 text-gray-400">
                    <li>The Greek letter <strong>Δ (delta)</strong> corresponds to Latin <strong>D</strong>.</li>
                    <li>The source tone is like a river mouth opening into a sea of tonal possibilities.</li>
                    <li>So the source is called <strong>Delta → D</strong>.</li>
                </ul>
                <p>This matters because the system will treat <strong>Dorian</strong> as the structural center for the natural letters.</p>
            </Section>

            <Section title="4) The seven naturals: the diatonic skeleton">
                <SubSection title="4.1 Naturals are letters, but numbers are the true organizers">
                    <p>
                        The letters A–G are easier to remember than ratios.
                        Still, the <strong>ratios</strong> determine where those letters truly sit.
                        The “natural letters” (A through G) are the seven tones that form the core diatonic organization.
                    </p>
                </SubSection>

                <SubSection title="4.2 Dorian as the “unshifted” diatonic chain">
                    <p>
                        Dorian is presented here not as a mood label but as a <strong>neutral structural arrangement</strong> of the seven naturals.
                        A canonical ascending Dorian ratio set (within one octave) is:
                    </p>
                    <div className="grid grid-cols-4 gap-2 font-mono text-center text-xs md:text-sm my-2">
                        <div className="bg-gray-800 p-1 rounded">1/1</div>
                        <div className="bg-gray-800 p-1 rounded">9/8</div>
                        <div className="bg-gray-800 p-1 rounded">32/27</div>
                        <div className="bg-gray-800 p-1 rounded">4/3</div>
                        <div className="bg-gray-800 p-1 rounded">3/2</div>
                        <div className="bg-gray-800 p-1 rounded">27/16</div>
                        <div className="bg-gray-800 p-1 rounded">16/9</div>
                        <div className="bg-gray-800 p-1 rounded">2/1</div>
                    </div>
                    <p>Two immediate truths fall out:</p>
                    <ol className="list-decimal pl-5 space-y-1 text-gray-400">
                        <li>Steps on the staff <em>look</em> evenly spaced, but <strong>their real sizes are not equal</strong>.</li>
                        <li>The system contains both <strong>larger</strong> and <strong>smaller</strong> adjacent steps—this drives everything that follows (accidentals, chromaticism, temperaments, microtonality).</li>
                    </ol>
                </SubSection>
            </Section>

            <Section title="5) Two notations: “tone ratios” vs “interval ratios”">
                <p>This theory keeps two ideas cleanly separated:</p>
                
                <SubSection title="5.1 A tone is a position: written with a slash">
                    <p>A tone is a pitch relative to the source:</p>
                    <ul className="list-disc pl-5 text-gray-400">
                        <li><strong>higher / lower</strong> (e.g., 3/2, 5/4, 9/8)</li>
                    </ul>
                </SubSection>

                <SubSection title="5.2 An interval is a distance: written with a colon">
                    <p>An interval is the ratio between two tones. If you have a higher tone H and a lower tone L, then:</p>
                    <ul className="list-disc pl-5 text-gray-400">
                        <li>Interval = H ÷ L</li>
                        <li>Often written <strong>L : H</strong></li>
                    </ul>
                    <p>Two key “building-block” intervals are introduced early:</p>
                    <ul className="list-disc pl-5 text-gray-400">
                        <li><strong>wholestep</strong> = <strong>8:9</strong> (meaning higher/lower = 9/8)</li>
                        <li><strong>halfstep</strong> = <strong>243:256</strong> (meaning higher/lower = 256/243)</li>
                    </ul>
                </SubSection>

                <SubSection title="5.3 Melodic vs harmonic intervals">
                    <ul className="list-disc pl-5 text-gray-400">
                        <li><strong>Melodic interval</strong>: the distance you traverse in sequence (one after another).</li>
                        <li><strong>Harmonic interval</strong>: the distance created by two simultaneous tones.</li>
                    </ul>
                    <p>The ratio math is the same; the difference is time.</p>
                </SubSection>
            </Section>

            <Section title="6) Interval names come from the staff first">
                <p>Traditional naming begins with notation distance:</p>
                <div className="bg-gray-800 p-2 rounded text-center text-sm font-mono mb-2">Unison, Second, Third … Octave</div>
                <p>
                    Important: a “Second” on the staff can be <strong>large</strong> or <strong>small</strong> (e.g., wholestep vs halfstep), because the staff encodes letter steps, not equal cents.
                    This is one of the oldest sources of confusion—and one reason careful theory is needed.
                </p>
            </Section>

            <Section title="7) Interval qualities">
                <SubSection title="7.1 Perfect intervals">
                    <p>
                        Certain structural intervals (Unison, Fourth, Fifth, Octave) are grouped as <strong>perfect</strong>.
                        When a perfect interval becomes larger than its natural perfect form, it is <strong>augmented</strong>.
                        When smaller, it is <strong>diminished</strong>.
                    </p>
                    <p>Example logic (expressed in ratios and traditional language):</p>
                    <ul className="list-disc pl-5 text-gray-400">
                        <li>A fourth larger than the natural perfect fourth is an <strong>augmented fourth</strong>.</li>
                        <li>A fifth smaller than the natural perfect fifth is a <strong>diminished fifth</strong>.</li>
                    </ul>
                </SubSection>

                <SubSection title="7.2 Imperfect intervals">
                    <p>Seconds, Thirds, Sixths, Sevenths come in two sizes:</p>
                    <ul className="list-disc pl-5 text-gray-400">
                        <li>larger = <strong>Major</strong></li>
                        <li>smaller = <strong>Minor</strong></li>
                    </ul>
                    <p>This is not opinion; it is classification by size within the diatonic system.</p>
                </SubSection>

                <SubSection title="7.3 Inversion symmetry (a traditional truth)">
                    <p>Intervals invert around the octave:</p>
                    <ul className="list-disc pl-5 text-gray-400">
                        <li>A fourth inverts to a fifth.</li>
                        <li>A minor third inverts to a major sixth.</li>
                        <li>etc.</li>
                    </ul>
                    <p>This is one of the “hidden geometries” that later becomes visible on lattices.</p>
                </SubSection>
            </Section>

            <Section title="8) Why accidentals were invented (it was never “accidental”)">
                <p>Accidentals were developed to solve <strong>practical</strong> problems in the diatonic naturals.</p>
                
                <SubSection title="8.1 The tritone problem">
                    <p>The diatonic system contains a famously unstable interval between its “end tones” (historically treated as a defect needing correction).</p>
                    <ul className="list-disc pl-5 text-gray-400">
                        <li>divides the octave nearly in half,</li>
                        <li>sits uncomfortably between perfect fourth and perfect fifth,</li>
                        <li>and traditionally demanded “fixing” by raising or lowering one endpoint.</li>
                    </ul>
                </SubSection>

                <SubSection title="8.2 The leading-tone problem">
                    <p>
                        Only a couple of natural halfsteps exist (notably E–F and B–C).
                        Those small steps create strong melodic “arrival” tendencies (leading tones).
                    </p>
                    <p>
                        Musicians wanted <strong>more</strong> such directed halfstep attractions.
                        To get them, the system had to expand beyond the seven naturals.
                        Accidentals are the earliest standardized expansion tool.
                    </p>
                </SubSection>
            </Section>

            <Section title="9) From 7 tones to 13: diatonic vs chromatic halfsteps">
                <p>When the system expands (classically via a fifths chain), two kinds of halfsteps become clear:</p>
                
                <SubSection title="9.1 Diatonic halfsteps (small halfsteps)">
                    <ul className="list-disc pl-5 text-gray-400">
                        <li>Notated on <strong>adjacent staff positions</strong></li>
                        <li>The letter changes (e.g., E→F, B→C)</li>
                        <li>“Diatonic” because you move through the natural letter framework</li>
                    </ul>
                </SubSection>

                <SubSection title="9.2 Chromatic halfsteps (large halfsteps)">
                    <ul className="list-disc pl-5 text-gray-400">
                        <li>Notated on <strong>the same staff position</strong></li>
                        <li>The letter stays the same but the accidental changes (e.g., F→F♯)</li>
                        <li>“Chromatic” because it adds “color” via alteration rather than letter movement</li>
                    </ul>
                </SubSection>

                <div className="p-2 bg-gray-800 rounded border border-gray-700 text-xs">
                    <strong className="text-white block mb-1">Structural View:</strong>
                    Diatonic naturals contain wholesteps (major seconds).
                    Adding tones splits each wholestep into <strong>one diatonic halfstep</strong> and <strong>one chromatic halfstep</strong>.
                    This is the seed of the “chromatic scale” idea—yet still grounded in ratio logic.
                </div>
            </Section>

            <Section title="10) Measurement: why cents exist (and why the ruler is logarithmic)">
                <p>
                    Ratios live in a multiplicative world.
                    Human perception of distance behaves more additively.
                    So measurement uses a logarithmic ruler.
                </p>
                
                <SubSection title="10.1 The cent">
                    <p>The octave is divided into <strong>1200 equal parts</strong> (cents). This is historically popularized as a practical, base-10 friendly measurement unit.</p>
                </SubSection>

                <SubSection title="10.2 The core formula">
                    <p>To measure an interval ratio R in cents:</p>
                    <div className="bg-black/40 p-2 rounded text-center font-mono">cents = 1200 × log₂(R)</div>
                </SubSection>

                <SubSection title="10.3 Why cents are useful (especially for commas)">
                    <p>
                        Small discrepancies that are hard to “see” in ratios become easy to read as differences in cents.
                        For example, a comma-sized gap can be measured as a small cent difference near ~23 cents in the classic 13-tone context.
                    </p>
                </SubSection>
            </Section>

            <Section title="11) Prime limits: choosing which harmonics are “allowed”">
                <p>A pitch ratio can be factored into primes:</p>
                <ul className="list-disc pl-5 text-gray-400 mb-2 font-mono text-xs">
                    <li>3/2 = 2⁻¹ · 3¹</li>
                    <li>5/4 = 2⁻² · 5¹</li>
                    <li>7/4 = 2⁻² · 7¹</li>
                </ul>
                <p>A <strong>prime limit</strong> says: “we will only use primes up to N.”</p>
                <div className="space-y-2 mt-2">
                    <div className="p-2 border-l-2 border-blue-500 pl-3"><strong>3-limit:</strong> primes {"{2, 3}"} → octave + fifth world</div>
                    <div className="p-2 border-l-2 border-green-500 pl-3"><strong>5-limit:</strong> primes {"{2, 3, 5}"} → adds strong thirds (triadic harmony)</div>
                    <div className="p-2 border-l-2 border-yellow-500 pl-3"><strong>7-limit:</strong> adds harmonic seventh colors</div>
                    <div className="p-2 border-l-2 border-purple-500 pl-3"><strong>11-limit, 13-limit…:</strong> increasingly rich microtonal territory</div>
                </div>
                <p className="mt-2 text-xs text-gray-500">Prime limits are not aesthetic rules; they are <strong>structural boundaries</strong> for what relationships can exist in your pitch universe.</p>
            </Section>

            <Section title="12) The lattice idea: pitch as an integer vector (Monzo)">
                <p>A ratio built from primes can be represented as an exponent vector.</p>
                <div className="bg-gray-900 p-3 rounded font-mono text-xs my-2">
                    Example: 3/2 = 2⁻¹ · 3¹ · 5⁰ · 7⁰ …<br/>
                    Vector form: (−1, +1, 0, 0, …)
                </div>
                <p>Interpretation:</p>
                <ul className="list-disc pl-5 text-gray-400">
                    <li>moving +1 on the “3 axis” multiplies by 3</li>
                    <li>moving −1 divides by 3</li>
                    <li>similarly for 5, 7, 11, …</li>
                </ul>
                <p>
                    This turns pitch space into something walkable:
                    <strong>nodes</strong> = ratios (pitches), 
                    <strong>edges/steps</strong> = multiplying/dividing by primes, 
                    <strong>paths</strong> = harmonic logic made visible.
                </p>
                <p>
                    Octave equivalence is handled by the 2-prime dimension:
                    you can “fold” pitches into a reference octave while keeping their prime-vector identity.
                </p>
            </Section>

            <Section title="13) 5-limit triads and the birth of a 2-D tone lattice">
                <p>When prime 5 enters, harmony gains depth: thirds become structurally central, not just approximations.</p>
                <p>A traditional structural model emerges:</p>
                <ul className="list-disc pl-5 text-gray-400">
                    <li>horizontal axis: <strong>3rd harmonic (prime 3)</strong> → fifth relationships</li>
                    <li>vertical axis: <strong>5th harmonic (prime 5)</strong> → third relationships</li>
                </ul>
                <p>
                    This creates a <strong>Two-Dimensional Tone Lattice</strong>:
                    a geometry where diatonic structure (the central unshifted chain, Dorian) can be expanded symmetrically using tones derived from the 5th harmonic and its subharmonic relationships.
                </p>
                <p>
                    Key idea: The lattice is not inherently bounded. It can extend beyond two dimensions when higher primes are included.
                    Past harmonics &gt; 6, richer structures appear naturally.
                </p>
            </Section>

            <Section title="14) Superscales: extending the fifths chain beyond 13">
                <p>Even without prime 5, the fifths chain can be extended to build larger pitch collections (“superscales”).</p>
                <p>As systems grow:</p>
                <ul className="list-disc pl-5 text-gray-400">
                    <li>notation pressure increases (more accidentals, more spellings)</li>
                    <li>commas and near-matches become unavoidable</li>
                    <li>equal divisions become useful as practical approximations</li>
                </ul>
                <p>The point is not “bigger is better,” but: bigger systems reveal what the smaller system was hiding.</p>
            </Section>

            <Section title="15) Two unavoidable realities: commas and human perception (JND)">
                <p>Traditional theory often treats enharmonic equivalence as “the same pitch” (especially under 12-ET). But in ratio-based systems:</p>
                <ol className="list-decimal pl-5 space-y-1 text-gray-400">
                    <li><strong>Comma gaps</strong> exist: loops don’t perfectly close.</li>
                    <li>Humans have perceptual thresholds: below some size, differences blur.</li>
                </ol>
                <p>A modern system that respects tradition while acknowledging reality must integrate both.</p>
            </Section>

            <Section title="16) The Hunt System (H-System): a fully specified tuning grammar (comma + JND) integrated into Western theory">
              <p>
                The Hunt System is not a “microtonal add-on.” It is a completion of Western practice:
                it integrates the ancient idea of the <strong>comma</strong> with the modern perceptual idea of the
                <strong>just noticeable difference (JND)</strong>, and then rebuilds the familiar categories—scale, pitch names,
                interval names, notation, and keyboard—so that <em>spelling</em> and <em>tuning</em> can both be true at the same time.
              </p>

              <div className="bg-gray-900/60 p-4 rounded-lg border border-gray-800">
                <p className="font-bold text-white mb-2">16.1 The measurement grid: 12ET halfsteps vs 41ET commas vs 205ET JND steps</p>
                <ul className="list-disc pl-5 text-gray-300 space-y-1">
                  <li>
                    In the traditional system, the smallest default step is the <strong>halfstep</strong> of 12ET
                    (100 cents). Each halfstep behaves like a “tuning zone” centered on the 12ET pitch.
                  </li>
                  <li>
                    In the H-System, categorical pitch steps are <strong>commas</strong> in <strong>41ET</strong>.
                    A comma step is written as <strong>Ç</strong>.
                  </li>
                  <li>
                    Each comma is subdivided into <strong>five</strong> perceptual steps called <strong>JNDs</strong>,
                    written <strong>J</strong>, so <strong>1Ç = 5J</strong>.
                  </li>
                  <li>
                    Therefore the default fine grid is <strong>205ET</strong>:
                    <strong>41Ç × 5J = 205J per octave</strong>.
                  </li>
                </ul>
              </div>

              <div className="bg-gray-800/40 p-4 rounded-lg border border-gray-700">
                <p className="font-bold text-white mb-2">16.2 The H-System “adds two optional attributes” to pitch names (so spelling and tuning separate cleanly)</p>
                <p className="text-gray-300">
                  Traditional pitch naming uses <strong>letter + accidental</strong>. The H-System keeps that,
                  but adds two optional tuning attributes so that notation can say two truths at once:
                  <em>what the note is</em> (spelling) and <em>where it sits</em> (tuning).
                </p>

                <ol className="list-decimal pl-5 text-gray-300 space-y-1 mt-3">
                  <li>
                    <strong>JND inflection</strong> (fine tuning): steps of <strong>1J</strong> (very small).
                  </li>
                  <li>
                    <strong>Comma shift</strong> (comma-zone movement): steps of <strong>1Ç = 5J</strong> (medium).
                  </li>
                  <li>
                    <strong>Letter</strong>: one of <strong>A B C D E F G</strong> (the diatonic anchor).
                  </li>
                  <li>
                    <strong>Accidental</strong>: the traditional chromatic-category move, but extended to include triples.
                  </li>
                </ol>

                <p className="text-gray-300 mt-3">
                  This means a pitch label may be “short” (just a letter), or fully explicit (inflection + shift + letter + accidental),
                  depending on how much tuning precision is required.
                </p>
              </div>

              <div className="bg-gray-900/60 p-4 rounded-lg border border-gray-800 mt-3">
                <p className="font-bold text-white mb-2">16.3 Hard definitions: how far each symbol moves (units are not negotiable)</p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <p className="font-bold text-white mb-2">A) Inflections (JND-level)</p>
                    <ul className="list-disc pl-5 text-gray-300 space-y-1">
                      <li>Seven inflections exist: triple-flat, double-flat, flat, natural, sharp, double-sharp, triple-sharp.</li>
                      <li>They are defined as <strong>-3J, -2J, -1J, 0J, +1J, +2J, +3J</strong>.</li>
                      <li>
                        Meaning: an inflection is <strong>not</strong> a 100-cent semitone in this system; it is fine tuning in single-J steps.
                      </li>
                    </ul>
                  </div>

                  <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <p className="font-bold text-white mb-2">B) Comma shifts (41ET-level)</p>
                    <ul className="list-disc pl-5 text-gray-300 space-y-1">
                      <li>Four shift symbols exist, each defined in Ç and J:</li>
                    </ul>
                    <div className="font-mono text-xs text-gray-200 space-y-1 mt-2">
                      <div>≈  “grave”  =  -2Ç  =  -10J</div>
                      <div>∼  “sub”    =  -1Ç  =   -5J</div>
                      <div>+  “super”  =  +1Ç  =   +5J</div>
                      <div>‡  “acute”  =  +2Ç  =  +10J</div>
                    </div>
                    <p className="text-gray-300 mt-2">
                      A shift changes pitch by a comma-step category while preserving the note’s spelling logic.
                    </p>
                  </div>

                  <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <p className="font-bold text-white mb-2">C) Accidentals (chromatic-category level)</p>
                    <ul className="list-disc pl-5 text-gray-300 space-y-1">
                      <li>Accidentals expand to seven values (including triples).</li>
                      <li>
                        One “sharp/flat” accidental category step equals a <strong>chromatic halfstep concept</strong>,
                        defined here as <strong>4Ç = 20J</strong>.
                      </li>
                      <li>
                        Thus the accidental ladder is: <strong>±4Ç, ±8Ç, ±12Ç</strong> (and 0), which in J is
                        <strong>±20J, ±40J, ±60J</strong>.
                      </li>
                    </ul>
                  </div>

                  <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <p className="font-bold text-white mb-2">D) How to compute a pitch (a literal parsing algorithm)</p>
                    <ol className="list-decimal pl-5 text-gray-300 space-y-1">
                      <li>Start from the letter’s base position in the system’s pitch families.</li>
                      <li>Add accidental offset (multiples of <strong>4Ç</strong>).</li>
                      <li>Add shift offset (multiples of <strong>1Ç</strong>).</li>
                      <li>Add inflection offset (multiples of <strong>1J</strong>).</li>
                      <li>
                        Result is a single location on the 205-step octave ruler (205J per octave).
                      </li>
                    </ol>
                  </div>
                </div>
              </div>

              <SubSection title="16.4 Intervals are expanded the same way: spelling + two optional precision modifiers">
                <p>
                  Traditional interval naming is <strong>quality + ordinal size</strong> (e.g., m3, P5).
                  The H-System keeps that, but adds two optional precision attributes so that “what interval it is”
                  can remain stable while its exact tuning can be specified:
                </p>
                <ul className="list-disc pl-5 text-gray-300 space-y-1">
                  <li><strong>Comma shift type</strong>: a categorical comma-level modification of the interval.</li>
                  <li><strong>JND intonation quality</strong>: a fine-tuning descriptor in JND steps.</li>
                </ul>
                <p>
                  The point is disciplined: interval <em>grammar</em> remains readable, while tuning becomes explicit rather than guessed.
                </p>
              </SubSection>

              <SubSection title="16.5 Enharmonics are clarified (not erased): the system increases distinct pitch identities">
                <p>
                  In 12ET, many spellings collapse into the same pitch. The H-System prevents that collapse by adding shifts and JND inflections.
                  This creates a controlled expansion of distinct pitch categories:
                </p>
                <ul className="list-disc pl-5 text-gray-300 space-y-1">
                  <li>
                    The system explicitly describes how comma-shifted spellings can become enharmonic in a more subtle way than 12ET.
                  </li>
                  <li>
                    It also notes that categorical pitch names multiply:
                    <strong>5 comma shifts × 7 letters × 7 accidentals = 245</strong> possible categorical spellings (not all preferred in practice).
                  </li>
                  <li>
                    The text further states that the system yields <strong>41 unique categorical pitch names</strong> per octave step-grid,
                    and that each such pitch may be spelled multiple ways (spelling flexibility is preserved, but now it maps to real structure).
                  </li>
                </ul>
              </SubSection>
            </Section>

            <Section title="17) MegaScore / MegaStaff: how the H-System becomes readable on a staff (41 positions + shifts + inflections)">
              <p>
                A theory that cannot be read will not live.
                MegaScore is the notational realization of the H-System: it replaces the traditional “7 staff positions per octave”
                premise with a staff that can show the system’s true categorical resolution.
              </p>

              <div className="bg-gray-900/60 p-4 rounded-lg border border-gray-800">
                <p className="font-bold text-white mb-2">17.1 What changes from the traditional staff (and why)</p>
                <ul className="list-disc pl-5 text-gray-300 space-y-1">
                  <li>
                    Traditional notation uses a five-line staff where staff positions correspond to the <strong>7 diatonic naturals</strong> per octave,
                    and sharps/flats written on the staff act as <strong>halfstep accidentals</strong>.
                  </li>
                  <li>
                    MegaScore uses an expanded staff (described as a <strong>twenty-five line staff</strong>) where positions correspond to
                    <strong>41 comma steps per octave</strong>.
                  </li>
                  <li>
                    In this scheme, sharps/flats placed as left-of-note signs are used as <strong>JND inflections</strong> (fine tuning),
                    not as 100-cent semitone switches.
                  </li>
                </ul>
              </div>

              <SubSection title="17.2 Staff positions begin from tradition: letters follow a chain-of-fifths logic">
                <p>
                  MegaStaff does not discard letters A–G. Instead it treats them as the historical backbone: the staff’s position logic
                  is based on the conventional premise that the seven letters represent a chain of fifths.
                  In other words, the old grammar is kept as the reference skeleton, then refined.
                </p>
              </SubSection>

              <SubSection title="17.3 Shifts: four symbols that replace ugly triple-accidental spellings with principled comma-shifting">
                <p>
                  Western musicians already “comma shift” in practice (especially strings): they preserve an interval’s spelling while nudging its tuning.
                  MegaScore formalizes that practice using <strong>four shift symbols</strong>.
                  Their job is not decoration; their job is to prevent the notation from collapsing into unreadable stacks of double/triple accidentals.
                </p>

                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                  <p className="font-bold text-white mb-2">Shift meanings and distances</p>
                  <ul className="list-disc pl-5 text-gray-300 space-y-1">
                    <li><strong>grave</strong> and <strong>sub</strong> are negative (lower positions); <strong>super</strong> and <strong>acute</strong> are positive (higher positions).</li>
                    <li><strong>sub</strong> and <strong>super</strong> are single shifts (one staff position); <strong>grave</strong> and <strong>acute</strong> are double shifts (two staff positions).</li>
                    <li>
                      Consecutive shifts differ by about <strong>29.3 cents</strong> (the comma-position size), so a shift is literally a comma-zone move.
                    </li>
                    <li>
                      Important reading rule: shifted positions are not “drawn by printing the shift symbol on the staff.”
                      Instead, the shift symbol is part of the <em>label</em>, while the <em>notehead position</em> itself is moved up/down to the appropriate shifted staff slot.
                    </li>
                  </ul>
                </div>

                <p className="text-gray-300 mt-3">
                  A single unshifted position becomes the center of a <strong>five-position region</strong>:
                  grave / sub / unshifted / super / acute. This is the crucial readability trick: you learn one stable pattern,
                  then apply it everywhere.
                </p>
              </SubSection>

              <SubSection title="17.4 Inflections: JND-level tuning marks (≈ 5.9 cents per step) that refine any staff position">
                <p>
                  Once categorical staff positions exist (comma zones), MegaScore still needs a disciplined way to specify fine tuning.
                  That is the role of <strong>inflections</strong>—signs written to the left of notes.
                </p>

                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                  <p className="font-bold text-white mb-2">Extended inflections (the microtonal meaning)</p>
                  <ul className="list-disc pl-5 text-gray-300 space-y-1">
                    <li>
                      Conventional inflections in modern notation imply ±100-cent changes, but MegaScore defines extended inflections
                      as <strong>±5.9-cent increments</strong> (JND-level steps).
                    </li>
                    <li>
                      Inflections may be applied to <em>any</em> position: their function is pure fine tuning, not respelling.
                    </li>
                    <li>
                      Spoken and written order must match the notation left-to-right to remain unambiguous.
                    </li>
                  </ul>
                </div>

                <div className="bg-gray-900/60 p-4 rounded-lg border border-gray-800 mt-3">
                  <p className="font-bold text-white mb-2">Essential vs nonessential (a practical rule about duplicates)</p>
                  <ul className="list-disc pl-5 text-gray-300 space-y-1">
                    <li>
                      <strong>Single and double inflections</strong> are called <strong>essential</strong> because they produce distinct pitches
                      in an unbroken microscale context.
                    </li>
                    <li>
                      <strong>Triple inflections</strong> are called <strong>nonessential</strong> because they duplicate pitches (enharmonics),
                      providing flexibility of interval spelling rather than new pitch content.
                    </li>
                    <li>
                      The text states a specific enharmonic pairing rule: <strong>triple sharps</strong> are enharmonic with
                      <strong>double flats</strong> of the position above, and <strong>triple flats</strong> are enharmonic with
                      <strong>double sharps</strong> of the position below.
                    </li>
                  </ul>
                </div>
              </SubSection>

              <SubSection title="17.5 The complete label can carry four layers at once (and that is the whole point)">
                <p>
                  When shifts are used, MegaScore explicitly allows a full pitch label to involve up to four symbols
                  (inflection + shift + letter + accidental). This is not complexity for its own sake:
                  it is the minimum structure required to keep Western spelling meaningful while making tuning explicit.
                </p>

                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                  <p className="font-bold text-white mb-2">A reader’s workflow (what to learn first, in the intended order)</p>
                  <ol className="list-decimal pl-5 text-gray-300 space-y-1">
                    <li>Master <strong>unshifted naturals</strong> (letters on the staff).</li>
                    <li>Master <strong>unshifted accidentals</strong> (positions that extend letter families).</li>
                    <li>Learn the <strong>five-position shift region</strong> pattern around each unshifted position.</li>
                    <li>Add <strong>inflections</strong> for fine tuning (JND steps) only when the music demands it.</li>
                  </ol>
                </div>
              </SubSection>
            </Section>

            <Section title="18) Reading the lattice in practice (how theory becomes movement)">
                <p>When you interact with a prime-limit lattice, three reliable habits keep you grounded:</p>
                
                <SubSection title="18.1 A node is a pitch identity">
                    <p>Select a node = select a ratio = select a harmonic relationship to the source.</p>
                    <p>Small integers tend to sound “closer” (denser consonance), large integers feel “further” (more complex color).</p>
                </SubSection>

                <SubSection title="18.2 An interval is the ratio between two nodes">
                    <p>Interval(node B, node A) = B ÷ A. The lattice makes this visible as “the vector from A to B.”</p>
                </SubSection>

                <SubSection title="18.3 Loops reveal commas (and tuning choices)">
                    <p>
                        If you travel through prime steps and return “almost” where you started, the leftover difference is a comma-sized residue.
                        That residue is not an error—it is the system telling the truth.
                    </p>
                </SubSection>
            </Section>

            <TheoryOverlayPart2Content Section={Section} />

        </div>
      </div>
    </div>
  );
};
