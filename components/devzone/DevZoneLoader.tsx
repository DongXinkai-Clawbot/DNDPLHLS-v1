import React, { useState, useEffect, Suspense } from 'react';
import { createLogger } from '../../utils/logger';

const log = createLogger('devzone');

const DevZone = React.lazy(() => import('./DevZone').catch(err => {
    log.warn('DevZone failed to load', err);
    
    return { default: () => null }; 
}));

export const DevZoneLoader = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            
            if (e.ctrlKey && e.altKey && (e.key === 'd' || e.key === 'D')) {
                e.preventDefault(); 
                setIsVisible(prev => !prev);
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    if (!isVisible) return null;

    return (
        <Suspense fallback={null}>
            <DevZone onClose={() => setIsVisible(false)} />
        </Suspense>
    );
};
