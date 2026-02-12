import React, { useEffect, useState } from 'react';

export const BufferedInput = ({ value, onChange, className, placeholder, disabled }: any) => {
    const [temp, setTemp] = useState<string | null>(null);
    useEffect(() => setTemp(null), [value]); 
    
    return (
        <input 
            type="text" 
            className={className}
            placeholder={placeholder}
            disabled={disabled}
            value={temp !== null ? temp : value}
            onChange={(e) => {
                const val = e.target.value;
                setTemp(val);
                const n = parseFloat(val);
                
                if (!isNaN(n) && !val.endsWith('.') && val !== '-' && val !== '') {
                    onChange(n);
                }
            }}
            onBlur={() => setTemp(null)} 
        />
    );
};
