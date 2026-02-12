
import React from 'react';

export const TheoryOverlayPart2Content = ({ Section }: { Section: any }) => {
    return (
        <>
            <Section title="19) Temperament is not an enemy of just intonation">
                <p>Just intonation (pure ratios) offers clarity and transparency, but commas appear and spelling becomes exacting.</p>
                <p>Equal temperament offers: easy modulation, consistent step sizes, practical instruments.</p>
                <p>
                    A mature approach is not to choose sides. It is to know what you are trading:
                    convenience vs precision, closure vs truth, interchangeability vs identity.
                    The lattice lets you <em>see</em> the trade in geometry, not slogans.
                </p>
            </Section>

            <Section title="20) A compact glossary (for fast navigation)">
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-400">
                    <li><strong className="text-white">Tone</strong>: a pitch ratio relative to the source (e.g., 3/2)</li>
                    <li><strong className="text-white">Interval</strong>: a ratio between two tones (B ÷ A)</li>
                    <li><strong className="text-white">Natural</strong>: one of the seven letter tones A–G (diatonic core)</li>
                    <li><strong className="text-white">Wholestep</strong>: 8:9 (ratio 9/8)</li>
                    <li><strong className="text-white">Halfstep</strong>: 243:256 (ratio 256/243)</li>
                    <li><strong className="text-white">Diatonic</strong>: moves through adjacent letter positions</li>
                    <li><strong className="text-white">Chromatic</strong>: alters pitch by changing the accidental on the same letter</li>
                    <li><strong className="text-white">Comma</strong>: small non-closure residue created by looping through generators</li>
                    <li><strong className="text-white">Cent</strong>: 1/1200 of an octave on a log ruler</li>
                    <li><strong className="text-white">Prime limit</strong>: maximum prime allowed in ratios (defines the “universe”)</li>
                    <li><strong className="text-white">Monzo / prime vector</strong>: exponent vector of primes for a ratio</li>
                    <li><strong className="text-white">Shift</strong>: comma-zone movement used to keep spellings readable</li>
                    <li><strong className="text-white">Inflection</strong>: micro adjustment (JND-scale fine tuning)</li>
                </ul>
            </Section>

            <div className="mt-8 border-t border-gray-800 pt-6 text-gray-400 text-sm leading-relaxed">
                <p>Traditional music theory gave us letters, staffs, and interval names—tools that last because they work. This system keeps that tradition, but lets the underlying ratios speak plainly.</p>
                <p className="mt-4">A lattice is simply the old truth, drawn as a landscape: you can walk it, measure it, and—most importantly—hear where you are.</p>
            </div>
        </>
    );
};
