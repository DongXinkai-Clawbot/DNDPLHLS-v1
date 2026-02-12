
import type { MathFunctionPreset } from '../types';

const P = (i: number) => `p${i.toString().padStart(4, '0')}`;
const presets: MathFunctionPreset[] = [];

const view = (d: { min: number, max: number, yMin?: number, yMax?: number }) => ({
    xMin: d.min, xMax: d.max, yMin: d.yMin ?? -10, yMax: d.yMax ?? 10, grid: true
});

presets.push(
  { id: P(1), name: 'Identity', category: 'Algebra', type: 'explicit', expression: 'x', params: { min: -10, max: 10 }, suggestedView: view({ min: -10, max: 10 }), tags: ['linear', 'core'] },
  { id: P(2), name: 'Absolute', category: 'Algebra', type: 'explicit', expression: 'abs(x)', params: { min: -10, max: 10 }, suggestedView: view({ min: -10, max: 10 }), tags: ['abs', 'core'] },
  { id: P(3), name: 'Square Root', category: 'Algebra', type: 'explicit', expression: 'sqrt(x)', params: { min: 0, max: 10 }, suggestedView: view({ min: -1, max: 10 }), tags: ['core', 'root'] },
  { id: P(6), name: 'Square', category: 'Polynomial', type: 'explicit', expression: 'x^2', params: { min: -5, max: 5 }, suggestedView: view({ min: -5, max: 5, yMin: -1, yMax: 26 }), tags: ['polynomial', 'core'] },
  { id: P(4), name: 'Cubic', category: 'Polynomial', type: 'explicit', expression: 'x^3', params: { min: -3, max: 3 }, suggestedView: view({ min: -3, max: 3 }), tags: ['polynomial'] },
  { id: P(7), name: 'Quartic (Double Well)', category: 'Polynomial', type: 'explicit', expression: 'x^4 - x^2', params: { min: -2.5, max: 2.5 }, suggestedView: view({ min: -2.5, max: 2.5, yMin: -1.5, yMax: 6 }), tags: ['polynomial'] },
  { id: P(5), name: 'Reciprocal', category: 'Rational', type: 'explicit', expression: '1/x', params: { min: -5, max: 5 }, suggestedView: view({ min: -5, max: 5 }), tags: ['rational', 'discontinuous'] },
  { id: P(8), name: 'Cauchy Kernel', category: 'Rational', type: 'explicit', expression: '1/(1+x^2)', params: { min: -8, max: 8 }, suggestedView: view({ min: -8, max: 8, yMin: -0.1, yMax: 1.2 }), tags: ['rational'] },
  { id: P(9), name: 'Fractional Part', category: 'Algebra', type: 'explicit', expression: 'frac(x)', params: { min: -5, max: 5 }, suggestedView: view({ min: -5, max: 5, yMin: -0.2, yMax: 1.2 }), tags: ['discrete'] },
  { id: P(10), name: 'Piecewise Sign', category: 'Algebra', type: 'explicit', expression: 'if(x<0, -1, if(x>0, 1, 0))', params: { min: -5, max: 5 }, suggestedView: view({ min: -5, max: 5, yMin: -1.5, yMax: 1.5 }), tags: ['piecewise', 'discontinuous'] },
);

presets.push(
  { id: P(20), name: 'Sine', category: 'Trig', type: 'explicit', expression: 'sin(x)', params: { min: -Math.PI*2, max: Math.PI*2 }, suggestedView: view({ min: -7, max: 7, yMin: -2, yMax: 2 }), tags: ['trig', 'periodic'] },
  { id: P(21), name: 'Cosine', category: 'Trig', type: 'explicit', expression: 'cos(x)', params: { min: -Math.PI*2, max: Math.PI*2 }, suggestedView: view({ min: -7, max: 7, yMin: -2, yMax: 2 }), tags: ['trig', 'periodic'] },
  { id: P(22), name: 'Tangent', category: 'Trig', type: 'explicit', expression: 'tan(x)', params: { min: -Math.PI, max: Math.PI }, suggestedView: view({ min: -4, max: 4, yMin: -5, yMax: 5 }), tags: ['trig', 'periodic', 'discontinuous'] },
  { id: P(27), name: 'Sinc', category: 'Trig', type: 'explicit', expression: 'sinc(x)', params: { min: -20, max: 20 }, suggestedView: view({ min: -20, max: 20, yMin: -0.4, yMax: 1.2 }), tags: ['trig', 'special'] },
  { id: P(28), name: 'Chirp (sin(x²))', category: 'Trig', type: 'explicit', expression: 'sin(x^2)', params: { min: -10, max: 10 }, suggestedView: view({ min: -10, max: 10, yMin: -1.5, yMax: 1.5 }), tags: ['trig', 'chirp'] },
  { id: P(29), name: 'Damped Sine', category: 'Trig', type: 'explicit', expression: 'exp(-0.15*abs(x))*sin(8*x)', params: { min: -20, max: 20 }, suggestedView: view({ min: -20, max: 20, yMin: -1.5, yMax: 1.5 }), tags: ['trig', 'damping'] },
  { id: P(23), name: 'Exponential', category: 'Exponential', type: 'explicit', expression: 'exp(x)', params: { min: -5, max: 5 }, suggestedView: view({ min: -5, max: 3, yMin: -1, yMax: 10 }), tags: ['exp', 'growth'] },
  { id: P(24), name: 'Log Natural', category: 'Logarithmic', type: 'explicit', expression: 'ln(x)', params: { min: 0.1, max: 10 }, suggestedView: view({ min: 0, max: 10, yMin: -3, yMax: 3 }), tags: ['log'] },
  { id: P(25), name: 'Sigmoid', category: 'Special', type: 'explicit', expression: '1/(1+exp(-x))', params: { min: -6, max: 6 }, suggestedView: view({ min: -6, max: 6, yMin: -0.5, yMax: 1.5 }), tags: ['activation', 'sigmoid'] },
  { id: P(26), name: 'Tanh', category: 'Hyperbolic', type: 'explicit', expression: 'tanh(x)', params: { min: -5, max: 5 }, suggestedView: view({ min: -5, max: 5, yMin: -1.5, yMax: 1.5 }), tags: ['hyperbolic'] },
  { id: P(37), name: 'Softsign', category: 'Hyperbolic', type: 'explicit', expression: 'x/(1+abs(x))', params: { min: -10, max: 10 }, suggestedView: view({ min: -10, max: 10, yMin: -1.5, yMax: 1.5 }), tags: ['activation'] },
);

presets.push(
  { id: P(30), name: 'Combinations', category: 'Special', type: 'explicit', expression: 'nCr(x, 2)', params: { min: 0, max: 10 }, suggestedView: view({ min: 0, max: 10, yMin: 0, yMax: 50 }), tags: ['combinatorics', 'discrete'] },
  { id: P(31), name: 'Sine Degree', category: 'Trig', type: 'explicit', expression: 'sind(x)', params: { min: 0, max: 360 }, suggestedView: view({ min: 0, max: 360, yMin: -1.5, yMax: 1.5 }), tags: ['trig', 'degrees'] },
  { id: P(32), name: 'Heaviside Step', category: 'Special', type: 'explicit', expression: 'heaviside(x)', params: { min: -5, max: 5 }, suggestedView: view({ min: -5, max: 5, yMin: -0.5, yMax: 1.5 }), tags: ['step', 'discontinuous'] },
  { id: P(33), name: 'Sine Integral', category: 'Special', type: 'explicit', expression: 'sinIntegral(x)', params: { min: -20, max: 20 }, suggestedView: view({ min: -15, max: 15, yMin: -2, yMax: 2 }), tags: ['integral'] },
  { id: P(34), name: 'Beta Function', category: 'Special', type: 'explicit', expression: 'beta(x, 2)', params: { min: 0.1, max: 5 }, suggestedView: view({ min: 0, max: 5, yMin: 0, yMax: 2 }), tags: ['gamma', 'beta'] },
  { id: P(38), name: 'Gamma Function', category: 'Special', type: 'explicit', expression: 'gamma(x)', params: { min: 0.2, max: 6 }, suggestedView: view({ min: 0, max: 6, yMin: -5, yMax: 20 }), tags: ['gamma', 'special'] },
  { id: P(39), name: 'Error Function', category: 'Special', type: 'explicit', expression: 'erf(x)', params: { min: -4, max: 4 }, suggestedView: view({ min: -4, max: 4, yMin: -1.2, yMax: 1.2 }), tags: ['special'] },
  { id: P(44), name: 'Bessel J0', category: 'Special', type: 'explicit', expression: 'besselJ0(x)', params: { min: -30, max: 30 }, suggestedView: view({ min: -30, max: 30, yMin: -0.8, yMax: 1.2 }), tags: ['bessel', 'special'] },
  { id: P(45), name: 'Airy Ai', category: 'Special', type: 'explicit', expression: 'airyAi(x)', params: { min: -10, max: 10 }, suggestedView: view({ min: -10, max: 10, yMin: -0.6, yMax: 0.8 }), tags: ['airy', 'special'] },
  { id: P(35), name: 'Complex Sqrt', category: 'Special', type: 'explicit', expression: 'sqrt(-x)', params: { min: -4, max: 4 }, suggestedView: view({ min: -4, max: 4, yMin: -2, yMax: 2 }), tags: ['complex'] },
  { id: P(36), name: 'Complex Log', category: 'Special', type: 'explicit', expression: 'ln(x)', params: { min: -4, max: 4 }, suggestedView: view({ min: -4, max: 4, yMin: -3, yMax: 3 }), tags: ['complex'] },
);

presets.push(
  { id: P(40), name: 'AM Synthesis', category: 'Audio', type: 'explicit', expression: '(1 + 0.5*sin(5*x)) * sin(50*x)', params: { min: 0, max: Math.PI }, suggestedView: view({ min: 0, max: Math.PI, yMin: -2, yMax: 2 }), tags: ['audio', 'am'] },
  { id: P(41), name: 'FM Synthesis', category: 'Audio', type: 'explicit', expression: 'sin(x + 2*sin(4*x))', params: { min: 0, max: Math.PI*4 }, suggestedView: view({ min: 0, max: 12, yMin: -2, yMax: 2 }), tags: ['audio', 'fm'] },
  { id: P(42), name: 'Additive Saw', category: 'Audio', type: 'explicit', expression: 'sin(x) + sin(2*x)/2 + sin(3*x)/3 + sin(4*x)/4', params: { min: 0, max: Math.PI*4 }, suggestedView: view({ min: 0, max: 12, yMin: -2, yMax: 2 }), tags: ['audio', 'additive'] },
  { id: P(43), name: 'Soft Clip', category: 'Audio', type: 'explicit', expression: 'tanh(1.5*x)', params: { min: -3, max: 3 }, suggestedView: view({ min: -3, max: 3, yMin: -1.5, yMax: 1.5 }), tags: ['audio', 'distortion'] },
  { id: P(46), name: 'Triangle Wave', category: 'Audio', type: 'explicit', expression: 'tri(x)', params: { min: 0, max: Math.PI*4 }, suggestedView: view({ min: 0, max: 12, yMin: -1.5, yMax: 1.5 }), tags: ['audio', 'waveform'] },
  { id: P(47), name: 'Square Wave', category: 'Audio', type: 'explicit', expression: 'square(x)', params: { min: 0, max: Math.PI*4 }, suggestedView: view({ min: 0, max: 12, yMin: -1.5, yMax: 1.5 }), tags: ['audio', 'waveform'] },
  { id: P(48), name: 'Pulse Wave (20%)', category: 'Audio', type: 'explicit', expression: 'pulse(x, 0.2)', params: { min: 0, max: Math.PI*4 }, suggestedView: view({ min: 0, max: 12, yMin: -1.5, yMax: 1.5 }), tags: ['audio', 'waveform'] },
  { id: P(49), name: 'Aliased Foldback', category: 'Audio', type: 'explicit', expression: 'sin(12*x) + 0.3*sin(41*x)', params: { min: 0, max: Math.PI*2 }, suggestedView: view({ min: 0, max: 6.5, yMin: -1.8, yMax: 1.8 }), tags: ['audio', 'noise'] },
);

presets.push(
  { id: P(60), name: 'Unit Circle', category: 'Parametric', type: 'parametric', expression: 'x=cos(t), y=sin(t)', params: { min: 0, max: Math.PI*2 }, suggestedView: view({ min: -2, max: 2, yMin: -2, yMax: 2 }), tags: ['circle', 'parametric'] },
  { id: P(61), name: 'Spiral', category: 'Parametric', type: 'parametric', expression: 'x=0.1*t*cos(t), y=0.1*t*sin(t)', params: { min: 0, max: 50 }, suggestedView: view({ min: -6, max: 6, yMin: -6, yMax: 6 }), tags: ['spiral', 'parametric'] },
  { id: P(62), name: 'Lissajous 3:2', category: 'Parametric', type: 'parametric', expression: 'x=sin(3*t), y=sin(2*t)', params: { min: 0, max: Math.PI*2 }, suggestedView: view({ min: -1.5, max: 1.5, yMin: -1.5, yMax: 1.5 }), tags: ['lissajous'] },
  { id: P(65), name: 'Hypotrochoid', category: 'Parametric', type: 'parametric', expression: 'x=(3-1)*cos(t) + 1.5*cos((3-1)/1*t), y=(3-1)*sin(t) - 1.5*sin((3-1)/1*t)', params: { min: 0, max: Math.PI*10 }, suggestedView: view({ min: -5, max: 5, yMin: -5, yMax: 5 }), tags: ['spirograph', 'parametric'] },
  { id: P(66), name: 'Lemniscate (Param)', category: 'Parametric', type: 'parametric', expression: 'x=cos(t)/(1+sin(t)^2), y=sin(t)*cos(t)/(1+sin(t)^2)', params: { min: 0, max: Math.PI*2 }, suggestedView: view({ min: -1.2, max: 1.2, yMin: -0.8, yMax: 0.8 }), tags: ['lemniscate'] },
  { id: P(63), name: 'Rose 4-Petal', category: 'Polar', type: 'polar', expression: 'r=cos(2*theta)', params: { min: 0, max: Math.PI*2 }, suggestedView: view({ min: -1.5, max: 1.5, yMin: -1.5, yMax: 1.5 }), tags: ['polar', 'rose'] },
  { id: P(64), name: 'Cardioid', category: 'Polar', type: 'polar', expression: 'r=1-cos(theta)', params: { min: 0, max: Math.PI*2 }, suggestedView: view({ min: -2.5, max: 1, yMin: -2, yMax: 2 }), tags: ['polar'] },
  { id: P(67), name: 'Archimedean Spiral', category: 'Polar', type: 'polar', expression: 'r=0.15*theta', params: { min: 0, max: Math.PI*10 }, suggestedView: view({ min: -5, max: 5, yMin: -5, yMax: 5 }), tags: ['polar', 'spiral'] },
  { id: P(68), name: 'Lemniscate (Polar)', category: 'Polar', type: 'polar', expression: 'r=sqrt(abs(cos(2*theta)))', params: { min: 0, max: Math.PI*2 }, suggestedView: view({ min: -1.2, max: 1.2, yMin: -1.2, yMax: 1.2 }), tags: ['polar', 'lemniscate'] },
);

presets.push(
  { id: P(80), name: 'Circle Eq', category: 'Implicit', type: 'implicit', expression: 'x^2 + y^2 - 4', params: { min: -3, max: 3 }, suggestedView: view({ min: -3, max: 3, yMin: -3, yMax: 3 }), tags: ['implicit'] },
  { id: P(81), name: 'Hyperbola', category: 'Implicit', type: 'implicit', expression: 'x^2 - y^2 - 1', params: { min: -3, max: 3 }, suggestedView: view({ min: -3, max: 3, yMin: -3, yMax: 3 }), tags: ['implicit'] },
  { id: P(83), name: 'Heart Curve', category: 'Implicit', type: 'implicit', expression: '(x^2 + y^2 - 1)^3 - x^2*y^3', params: { min: -2, max: 2 }, suggestedView: view({ min: -2, max: 2, yMin: -2, yMax: 2 }), tags: ['implicit', 'classic'] },
  { id: P(84), name: 'Cassini Oval', category: 'Implicit', type: 'implicit', expression: '(x^2 + y^2)^2 - 2*(1.2^2)*(x^2 - y^2) + (1.2^4) - (1^4)', params: { min: -3, max: 3 }, suggestedView: view({ min: -3, max: 3, yMin: -3, yMax: 3 }), tags: ['implicit'] },
  { id: P(85), name: 'Mandelbrot Contour', category: 'Fractal', type: 'implicit', expression: 'mandel(x, y, 64) - 0.5', params: { min: -2.5, max: 1 }, suggestedView: view({ min: -2.5, max: 1, yMin: -1.5, yMax: 1.5 }), tags: ['fractal', 'implicit'] },
  { id: P(82), name: 'Rotational Field', category: 'Special', type: 'vector_field', expression: 'x=-y, y=x', params: { min: -3, max: 3 }, suggestedView: view({ min: -3, max: 3, yMin: -3, yMax: 3 }), tags: ['vector', 'field'] },
  { id: P(86), name: 'Saddle Field', category: 'Special', type: 'vector_field', expression: 'x=x, y=-y', params: { min: -3, max: 3 }, suggestedView: view({ min: -3, max: 3, yMin: -3, yMax: 3 }), tags: ['vector', 'field'] },
  { id: P(87), name: 'Uniform Field', category: 'Special', type: 'vector_field', expression: 'x=1, y=0', params: { min: -3, max: 3 }, suggestedView: view({ min: -3, max: 3, yMin: -3, yMax: 3 }), tags: ['vector', 'field'] },
);

presets.sort((a, b) => (a.category === b.category ? a.name.localeCompare(b.name) : a.category.localeCompare(b.category)));

export const MATH_FUNCTION_PRESETS = presets;
