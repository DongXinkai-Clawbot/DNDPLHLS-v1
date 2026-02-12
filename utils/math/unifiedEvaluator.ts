
import { mathParser, Complex, MathValue } from '../safeMath';
import { preprocessExpression as originalPreprocess } from '../mathExpressionPreprocess';

export const preprocessExpression = originalPreprocess;

export const buildMathContext = (
    bindings: Record<string, number>, 
    constants: Record<string, number> = {}
): Record<string, any> => {
    
    const ctx: Record<string, any> = { 
        ...constants, 
        ...bindings, 
        pi: Math.PI, 
        e: Math.E, 
        tau: Math.PI * 2,
        phi: 1.61803398875
    };
    return ctx;
};

export interface EvalResult {
    value: number;
    isComplex: boolean;
    isValid: boolean;
    error?: string;
    raw?: MathValue;
}

export const evalScalar = (expr: string, ctx: Record<string, any>): EvalResult => {
    try {
        const raw = mathParser.evaluate(expr, ctx);
        
        if (typeof raw === 'number') {
            if (!Number.isFinite(raw)) {
                return { value: NaN, isComplex: false, isValid: false, error: "Infinity/NaN", raw };
            }
            return { value: raw, isComplex: false, isValid: true, raw };
        }
        
        if (raw instanceof Complex) {
            
            if (Math.abs(raw.im) < 1e-9) {
                if (!Number.isFinite(raw.re)) {
                    return { value: NaN, isComplex: true, isValid: false, error: "Complex Inf", raw };
                }
                return { value: raw.re, isComplex: true, isValid: true, raw };
            }
            
            return { value: NaN, isComplex: true, isValid: false, error: "Complex Result", raw };
        }
        
        if (Array.isArray(raw)) {
            
            const val = raw[0];
            if (typeof val === 'number' && Number.isFinite(val)) {
                return { value: val, isComplex: false, isValid: true, raw };
            }
            return { value: NaN, isComplex: false, isValid: false, error: "Vector/Invalid", raw };
        }

        return { value: NaN, isComplex: false, isValid: false, error: "Unknown Type", raw };

    } catch (e: any) {
        return { value: NaN, isComplex: false, isValid: false, error: e.message || "Eval Error" };
    }
};

export const evalScalarWithComplex = (
    expr: string,
    ctx: Record<string, any>,
    complexComponent: 're' | 'im' | 'abs' | 'arg' = 'abs'
): EvalResult => {
    const res = evalScalar(expr, ctx);
    if (res.isValid) return res;
    const raw = res.raw;
    if (raw instanceof Complex) {
        let value = NaN;
        if (complexComponent === 're') value = raw.re;
        else if (complexComponent === 'im') value = raw.im;
        else if (complexComponent === 'arg') value = raw.arg();
        else value = raw.abs();
        if (Number.isFinite(value)) {
            return { value, isComplex: true, isValid: true, raw };
        }
        return { value: NaN, isComplex: true, isValid: false, error: 'Complex Invalid', raw };
    }
    return res;
};

export const evalVector = (
    expr: string,
    ctx: Record<string, any>,
    complexComponent: 're' | 'im' | 'abs' | 'arg' = 'abs'
): { x: number, y: number, isValid: boolean, isComplex?: boolean, error?: string } => {
    
    if (expr.includes('=')) {
        
        const parts = expr.split(',');
        if (parts.length >= 2) {
            const xPart = parts[0].replace(/^x\s*=\s*/, '');
            const yPart = parts[1].replace(/^y\s*=\s*/, '');
            
            const resX = evalScalarWithComplex(xPart, ctx, complexComponent);
            const resY = evalScalarWithComplex(yPart, ctx, complexComponent);
            
            if (resX.isValid && resY.isValid) {
                return { x: resX.value, y: resY.value, isValid: true, isComplex: !!(resX.isComplex || resY.isComplex) };
            }
            return { x: 0, y: 0, isValid: false, error: resX.error || resY.error };
        }
    }

    try {
        const raw = mathParser.evaluate(expr, ctx);
        if (Array.isArray(raw) && raw.length >= 2) {
            const xRaw = raw[0];
            const yRaw = raw[1];
            const x = Number(xRaw);
            const y = Number(yRaw);
            if (Number.isFinite(x) && Number.isFinite(y)) {
                const isComplex = xRaw instanceof Complex || yRaw instanceof Complex;
                return { x, y, isValid: true, isComplex };
            }
        }
    } catch(e) {}

    return { x: 0, y: 0, isValid: false, error: "Invalid Vector Expr" };
};
