
export const preprocessExpression = (raw: string, advanced: boolean): { processed: string, warnings: string[] } => {
    let processed = raw;
    const warnings: string[] = [];

    processed = processed.replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));

    processed = processed.replace(/[\u2212\u2013\u2014\uFE63]/g, '-');
    
    processed = processed.replace(/[\u00D7\u22C5\u00B7\u2022\u2217]/g, '*');
    
    processed = processed.replace(/[\u00F7\u2044\u2215]/g, '/');

    processed = processed.replace(/\*\*/g, '^');

    if (!advanced) {
        return { processed, warnings };
    }

    processed = processed.replace(/\u03C0/g, 'pi'); 
    processed = processed.replace(/\u03C4/g, 'tau'); 
    processed = processed.replace(/\u03C6/g, 'phi'); 
    processed = processed.replace(/\u212F/g, 'e'); 
	processed = processed.replace(/\u221E/g, 'inf');

	// Common Greek letters → ASCII identifiers (allows users to type/click Greek symbols while
	// still using the safe expression parser that expects ASCII identifiers).
	processed = processed.replace(/\u03B8/g, 'theta');
	processed = processed.replace(/\u03BB/g, 'lambda');
	processed = processed.replace(/\u03BC/g, 'mu');
	processed = processed.replace(/\u03C3/g, 'sigma');
	processed = processed.replace(/\u03C9/g, 'omega');
	processed = processed.replace(/\u03B1/g, 'alpha');
	processed = processed.replace(/\u03B2/g, 'beta');
	processed = processed.replace(/\u03B3/g, 'gamma');
	processed = processed.replace(/\u03B4/g, 'delta');
	processed = processed.replace(/\u03B5/g, 'epsilon');
	processed = processed.replace(/\u03C1/g, 'rho');
	processed = processed.replace(/\u2202/g, 'diff');

    processed = processed.replace(/\u2264/g, '<='); 
    processed = processed.replace(/\u2265/g, '>='); 
    processed = processed.replace(/\u2260/g, '!='); 
    processed = processed.replace(/\u2248/g, '=='); 

	// Square root and cube root symbols. Allow empty parentheses so editors can insert templates like "√()".
	processed = processed.replace(/\u221A\s*\(([^)]*)\)/g, 'sqrt($1)');
    processed = processed.replace(/\u221A\s*([a-zA-Z0-9_.]+)/g, 'sqrt($1)');
    
	processed = processed.replace(/\u221B\s*\(([^)]*)\)/g, 'cbrt($1)');
    processed = processed.replace(/\u221B\s*([a-zA-Z0-9_.]+)/g, 'cbrt($1)');

    processed = processed.replace(/\u00B2/g, '^2');
    processed = processed.replace(/\u00B3/g, '^3');
    processed = processed.replace(/\u00B9/g, '^1');
    processed = processed.replace(/\u2070/g, '^0');

    if (/\u2211/.test(processed)) { 
        processed = processed.replace(/\u2211/g, 'sum');
    }
    
    if (/\u220F/.test(processed)) { 
        processed = processed.replace(/\u220F/g, 'prod');
    }
    
    if (/\u222B/.test(processed)) { 
        processed = processed.replace(/\u222B/g, 'integrate');
    }

    return { processed, warnings };
};
