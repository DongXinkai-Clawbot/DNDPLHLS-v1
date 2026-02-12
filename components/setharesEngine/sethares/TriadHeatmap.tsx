import React, { useRef, useEffect } from 'react';
import { Partial, RoughnessModel, createProgram, HEATMAP_MAX_PARTIALS, S1, S2 } from './utils';

const TriadHeatmap = ({
    partials,
    roughnessModel,
    algoParams,
    cbScale,
    decayAmount,
    timeSlice,
    fixedF2Cents,
    gain
}: {
    partials: Partial[];
    roughnessModel: RoughnessModel;
    algoParams: { a: number; b: number };
    cbScale: number;
    decayAmount: number;
    timeSlice: number;
    fixedF2Cents: number;
    gain: number;
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const glRef = useRef<WebGL2RenderingContext | null>(null);
    const programRef = useRef<WebGLProgram | null>(null);
    const vaoRef = useRef<WebGLVertexArrayObject | null>(null);
    const uniformRef = useRef<{
        ratios: WebGLUniformLocation | null;
        amps: WebGLUniformLocation | null;
        count: WebGLUniformLocation | null;
        a: WebGLUniformLocation | null;
        b: WebGLUniformLocation | null;
        cbScale: WebGLUniformLocation | null;
        model: WebGLUniformLocation | null;
        decayAmount: WebGLUniformLocation | null;
        timeSlice: WebGLUniformLocation | null;
        gain: WebGLUniformLocation | null;
    } | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const gl = canvas.getContext('webgl2', { antialias: false });
        if (!gl) return;
        glRef.current = gl;

        const vsSource = `#version 300 es
            in vec2 aPos;
            out vec2 vUv;
            void main() {
                vUv = aPos * 0.5 + 0.5;
                gl_Position = vec4(aPos, 0.0, 1.0);
            }
        `;

        const fsSource = `#version 300 es
            precision highp float;
            in vec2 vUv;
            out vec4 outColor;
            uniform float uRatios[${HEATMAP_MAX_PARTIALS}];
            uniform float uAmps[${HEATMAP_MAX_PARTIALS}];
            uniform int uCount;
            uniform float uA;
            uniform float uB;
            uniform float uCbScale;
            uniform int uModel;
            uniform float uDecayAmount;
            uniform float uTimeSlice;
            uniform float uGain;
            const float S1 = ${S1.toFixed(4)};
            const float S2 = ${S2.toFixed(2)};

            float pairRough(float f1, float f2, float a1, float a2) {
                float lo = min(f1, f2);
                float hi = max(f1, f2);
                float cb = (S1 * lo + S2) * max(0.05, uCbScale);
                float x = (hi - lo) / cb;
                if (uModel == 1) {
                    float denom = pow(0.5 * (a1 + a2), 3.11);
                    float ampTerm = denom > 0.0 ? pow(a1 * a2, 0.1) / denom : 0.0;
                    return ampTerm * (exp(-uA * x) - exp(-uB * x));
                }
                return (a1 * a2) * (exp(-uA * x) - exp(-uB * x));
            }

            void main() {
                float cents2 = mix(0.0, 1200.0, vUv.y);
                float cents3 = mix(0.0, 1200.0, vUv.x);
                float r2 = pow(2.0, cents2 / 1200.0);
                float r3 = pow(2.0, cents3 / 1200.0);
                float toneRatios[3];
                toneRatios[0] = 1.0;
                toneRatios[1] = r2;
                toneRatios[2] = r3;
                float total = 0.0;
                for (int ta = 0; ta < 3; ta++) {
                    for (int i = 0; i < ${HEATMAP_MAX_PARTIALS}; i++) {
                        if (i >= uCount) break;
                        float baseRatioA = uRatios[i];
                        float ampA = uAmps[i] * exp(-uDecayAmount * (baseRatioA - 1.0) * uTimeSlice);
                        float fA = baseRatioA * toneRatios[ta];
                        for (int tb = ta; tb < 3; tb++) {
                            int startJ = (tb == ta) ? i + 1 : 0;
                            for (int j = 0; j < ${HEATMAP_MAX_PARTIALS}; j++) {
                                if (j < startJ) continue;
                                if (j >= uCount) break;
                                float baseRatioB = uRatios[j];
                                float ampB = uAmps[j] * exp(-uDecayAmount * (baseRatioB - 1.0) * uTimeSlice);
                                float fB = baseRatioB * toneRatios[tb];
                                total += pairRough(fA, fB, ampA, ampB);
                            }
                        }
                    }
                }
                float intensity = clamp(total * uGain, 0.0, 1.0);
                vec3 cold = vec3(0.06, 0.07, 0.09);
                vec3 hot = vec3(0.25, 0.95, 0.35);
                vec3 color = mix(cold, hot, pow(intensity, 0.6));
                outColor = vec4(color, 1.0);
            }
        `;

        const program = createProgram(gl, vsSource, fsSource);
        if (!program) return;
        programRef.current = program;

        const vao = gl.createVertexArray();
        const buffer = gl.createBuffer();
        if (!vao || !buffer) return;
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 1, -1, -1, 1,
            -1, 1, 1, -1, 1, 1
        ]), gl.STATIC_DRAW);
        const posLoc = gl.getAttribLocation(program, 'aPos');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
        vaoRef.current = vao;

        uniformRef.current = {
            ratios: gl.getUniformLocation(program, 'uRatios'),
            amps: gl.getUniformLocation(program, 'uAmps'),
            count: gl.getUniformLocation(program, 'uCount'),
            a: gl.getUniformLocation(program, 'uA'),
            b: gl.getUniformLocation(program, 'uB'),
            cbScale: gl.getUniformLocation(program, 'uCbScale'),
            model: gl.getUniformLocation(program, 'uModel'),
            decayAmount: gl.getUniformLocation(program, 'uDecayAmount'),
            timeSlice: gl.getUniformLocation(program, 'uTimeSlice'),
            gain: gl.getUniformLocation(program, 'uGain')
        };
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        const gl = glRef.current;
        const program = programRef.current;
        const uniforms = uniformRef.current;
        if (!canvas || !gl || !program || !uniforms) return;
        const width = 520;
        const height = 320;
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
        gl.useProgram(program);
        if (vaoRef.current) gl.bindVertexArray(vaoRef.current);

        const ratios = new Float32Array(HEATMAP_MAX_PARTIALS);
        const amps = new Float32Array(HEATMAP_MAX_PARTIALS);
        const count = Math.min(partials.length, HEATMAP_MAX_PARTIALS);
        for (let i = 0; i < count; i++) {
            ratios[i] = partials[i].ratio;
            amps[i] = partials[i].amplitude;
        }

        gl.uniform1fv(uniforms.ratios, ratios);
        gl.uniform1fv(uniforms.amps, amps);
        gl.uniform1i(uniforms.count, count);
        gl.uniform1f(uniforms.a, algoParams.a);
        gl.uniform1f(uniforms.b, algoParams.b);
        gl.uniform1f(uniforms.cbScale, cbScale);
        gl.uniform1i(uniforms.model, roughnessModel === 'vassilakis' ? 1 : 0);
        gl.uniform1f(uniforms.decayAmount, decayAmount);
        gl.uniform1f(uniforms.timeSlice, timeSlice);
        gl.uniform1f(uniforms.gain, gain);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }, [partials, roughnessModel, algoParams.a, algoParams.b, cbScale, decayAmount, timeSlice, gain]);

    useEffect(() => {
        const overlay = overlayRef.current;
        if (!overlay) return;
        const ctx = overlay.getContext('2d');
        if (!ctx) return;
        const dpr = Math.min(4, Math.max(2, window.devicePixelRatio || 1));
        const width = 520;
        const height = 320;
        overlay.width = width * dpr;
        overlay.height = height * dpr;
        overlay.style.width = `${width}px`;
        overlay.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        const y = (1 - fixedF2Cents / 1200) * height;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.fillText(`f2 slice: ${fixedF2Cents.toFixed(1)}c`, 8, Math.max(12, y - 6));
    }, [fixedF2Cents]);

    return (
        <div className="relative w-[520px]">
            <canvas ref={canvasRef} className="rounded-lg" />
            <canvas ref={overlayRef} className="absolute top-0 left-0 pointer-events-none" />
        </div>
    );
};

export default TriadHeatmap;
