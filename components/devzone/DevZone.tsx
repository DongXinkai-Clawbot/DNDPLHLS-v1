import React, { Suspense } from 'react';

const TrichromaticExperiment = React.lazy(() => import('./experiments/TrichromaticExperiment'));
const SetharesExperiment = React.lazy(() => import('../setharesEngine/SetharesExperiment'));

const DevZone = ({ onClose }: { onClose: () => void }) => {
    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(10, 10, 10, 0.95)',
            zIndex: 100000,
            color: '#00ff41',
            fontFamily: '"Courier New", Courier, monospace',
            padding: '2rem',
            overflow: 'auto',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '2rem',
                borderBottom: '2px solid #00ff41',
                paddingBottom: '1rem'
            }}>
                <div>
                    <h1 style={{ fontSize: '2rem', margin: 0, letterSpacing: '2px', fontWeight: 900 }}>[ DEVELOPER ZONE ]</h1>
                    <span style={{ fontSize: '0.8rem', opacity: 0.7 }}></span>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        background: 'transparent',
                        border: '2px solid #00ff41',
                        color: '#00ff41',
                        padding: '0.5rem 1.5rem',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.background = '#00ff41';
                        e.currentTarget.style.color = '#000';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#00ff41';
                    }}
                >
                    [X] TERMINATE SESSION
                </button>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
                gap: '2rem',
                flex: 1
            }}>

                <section style={{
                    border: '1px dashed #00ff41',
                    padding: '1.5rem',
                    background: 'rgba(0, 255, 65, 0.05)',
                    gridColumn: '1 / -1'
                }}>
                    <h2 style={{ fontSize: '1.2rem', margin: '0 0 1rem 0', textDecoration: 'underline' }}>EXP: TRICHROMATIC CYLINDER</h2>
                    <p style={{ opacity: 0.7, marginBottom: '1rem' }}>
                        Base Layer: Trichromatic (RGB) Circle. <br />
                        Vertical Evolution: Adjacent nodes add up to form next layer (Pascal's Cylinder).
                    </p>
                    <Suspense fallback={<div style={{ color: 'white' }}>Loading Experiment...</div>}>
                        <TrichromaticExperiment />
                    </Suspense>
                </section>

                <section style={{
                    border: '1px dashed #00ff41',
                    padding: '1.5rem',
                    background: 'rgba(0, 255, 65, 0.05)'
                }}>
                    <h2 style={{ fontSize: '1.2rem', margin: '0 0 1rem 0', textDecoration: 'underline' }}>// SYSTEM STATUS</h2>
                    <div style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                        <p>STATUS: <span style={{ fontWeight: 'bold' }}>ONLINE</span></p>
                        <p>MODE: <span style={{ fontWeight: 'bold' }}>SANDBOX</span></p>
                        <p>TIMESTAMP: {new Date().toISOString()}</p>
                    </div>
                </section>
                <section style={{
                    border: '1px dashed #00ff41',
                    padding: '1.5rem',
                    background: 'rgba(0, 255, 65, 0.05)',
                    gridColumn: '1 / -1' // Full width for Sethares Engine
                }}>
                    <h2 style={{ fontSize: '1.2rem', margin: '0 0 1rem 0', textDecoration: 'underline' }}>// EXP: SETHARES ENGINE</h2>
                    <p style={{ opacity: 0.7, marginBottom: '1rem' }}>
                        Timbre-Scale Isomorphism Engine.<br />
                        Spectra dictate scales, and scales reinforce spectra.
                    </p>
                    <Suspense fallback={<div style={{ color: 'white' }}>Loading Sethares Engine...</div>}>
                        <SetharesExperiment />
                    </Suspense>
                </section>

                <section style={{
                    border: '1px dashed #00ff41',
                    padding: '1.5rem',
                    background: 'rgba(0, 255, 65, 0.05)'
                }}>
                    <h2 style={{ fontSize: '1.2rem', margin: '0 0 1rem 0', textDecoration: 'underline' }}>// EXTENSION SLOT B</h2>
                    <p style={{ opacity: 0.7, fontStyle: 'italic' }}>No active function.</p>
                </section>
            </div>

        </div>
    );
};

export default DevZone;
