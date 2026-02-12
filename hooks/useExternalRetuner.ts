import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { ExternalRetunerService } from '../engine/retuner/retunerService';
import type { AppSettings, NodeData } from '../types';

export const useExternalRetuner = () => {
  const settings = useStore((s) => s.settings);
  const nodes = useStore((s) => s.nodes);
  const updateSettings = useStore((s) => s.updateSettings);
  const serviceRef = useRef<ExternalRetunerService | null>(null);

  useEffect(() => {
    if (!serviceRef.current) {
      serviceRef.current = new ExternalRetunerService(updateSettings);
    }
    return () => {
      serviceRef.current?.dispose();
      serviceRef.current = null;
    };
  }, [updateSettings]);

  useEffect(() => {
    if (!serviceRef.current) return;
    serviceRef.current.updateContext(settings as AppSettings, nodes as NodeData[]);
  }, [settings, nodes]);

  useEffect(() => {
    if (!serviceRef.current) return;
    const enabled = (settings.retuner as any)?.enabled;
    if (enabled) {
      void serviceRef.current.start();
    } else {
      serviceRef.current.stop();
    }
  }, [settings.retuner]);
};
