import { useEffect } from 'react';
import { useLatticeStore } from '../store/latticeStoreContext';
import { shallow } from 'zustand/shallow';
import type { PrimeLimit } from '../types';

export const useSmartArrowNavigation = () => {
    const {
      selectedNode,
      settings,
      selectNode,
      nodes,
      panels
    } = useLatticeStore((s) => ({
      selectedNode: s.selectedNode,
      settings: s.settings,
      selectNode: s.selectNode,
      nodes: s.nodes,
      panels: s.panels
    }), shallow);
    useEffect(() => {
        
        if (!selectedNode) return;
        const isKeyboardFullscreen = !!(panels.keyboard && panels.keyboard.isOpen && panels.keyboard.mode === 'fullscreen');

        const activeLimits: PrimeLimit[] = [];

        const latticeSettings = (settings as any)?.lattice;

        if (latticeSettings?.rootLimits) {
            for (const prime of latticeSettings.rootLimits) {
                if (prime !== 2) { 
                    activeLimits.push(prime);
                }
            }
        }

        if (activeLimits.length < 1 || activeLimits.length > 2) {
            return; 
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (isKeyboardFullscreen) return;
            
            if ((e.target as HTMLElement).tagName === 'INPUT' ||
                (e.target as HTMLElement).tagName === 'TEXTAREA') {
                return;
            }

            const key = e.key;
            let targetPrime: PrimeLimit | null = null;
            let direction: number = 0;

            if (activeLimits.length === 1) {
                
                const prime = activeLimits[0];
                if (key === 'ArrowUp') {
                    targetPrime = prime;
                    direction = 1;
                } else if (key === 'ArrowDown') {
                    targetPrime = prime;
                    direction = -1;
                }
            } else if (activeLimits.length === 2) {
                
                const [prime1, prime2] = activeLimits;

                if (key === 'ArrowUp') {
                    targetPrime = prime1;
                    direction = 1;
                } else if (key === 'ArrowDown') {
                    targetPrime = prime1;
                    direction = -1;
                } else if (key === 'ArrowRight') {
                    targetPrime = prime2;
                    direction = 1;
                } else if (key === 'ArrowLeft') {
                    targetPrime = prime2;
                    direction = -1;
                }
            }

            if (targetPrime && direction !== 0) {
                if (e.defaultPrevented || e.repeat) return;
                e.preventDefault();
                e.stopPropagation();

                const newVector = { ...selectedNode.primeVector };
                newVector[targetPrime] = (newVector[targetPrime] || 0) + direction;

                const targetNode = nodes.find(n => {
                    
                    const allPrimes = new Set([
                        ...Object.keys(n.primeVector).map(Number),
                        ...Object.keys(newVector).map(Number)
                    ]);

                    for (const p of allPrimes) {
                        const prime = p as PrimeLimit;
                        if ((n.primeVector[prime] || 0) !== (newVector[prime] || 0)) {
                            return false;
                        }
                    }
                    return true;
                });

                if (targetNode) {
                    selectNode(targetNode);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNode, settings, nodes, selectNode, panels]);
};
