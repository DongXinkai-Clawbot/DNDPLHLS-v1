/// <reference lib="webworker" />
import type { AppSettings } from '../../types';
import { generateLattice } from './generator';
import { serializeLattice } from './serialization';

type WorkerRequest = {
  id: number;
  settings: AppSettings;
};

type WorkerResponse = {
  id: number;
  payload?: ReturnType<typeof serializeLattice>;
  error?: { message: string; stack?: string };
};

const ctx: DedicatedWorkerGlobalScope = self as any;

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, settings } = event.data;
  try {
    const { nodes, edges } = generateLattice(settings);
    const payload = serializeLattice(nodes, edges);
    const response: WorkerResponse = { id, payload };
    ctx.postMessage(response, [payload.positions.buffer]);
  } catch (err: any) {
    const response: WorkerResponse = {
      id,
      error: { message: err?.message || String(err), stack: err?.stack }
    };
    ctx.postMessage(response);
  }
};
