import { EngineConfig, computeTile, TileRequest, CancelledError } from './engine';

type TileComputeMessage = {
  type: 'tile';
  payload: {
    requestId: string;
    tileId: number;
    config: EngineConfig;
    tile: TileRequest;
  };
};

type CancelMessage = { type: 'cancel'; payload: { requestId: string } };

type WorkerMessage = TileComputeMessage | CancelMessage;

let activeRequest: string | null = null;

const postResult = (
  requestId: string,
  tileId: number,
  result: ReturnType<typeof computeTile>
) => {
  const transfers: ArrayBuffer[] = [
    result.raw.buffer,
    result.normalized.buffer,
    result.diagOriginal.buffer,
    result.diagPruned.buffer,
    result.diagInvalid.buffer,
    result.diagSkipped.buffer,
    result.diagTotal.buffer,
    result.diagMaxPair.buffer
  ];
  (self as unknown as Worker).postMessage(
    {
      type: 'tileResult',
      payload: {
        requestId,
        tileId,
        tile: result.tile,
        diagnostics: result.diagnostics,
        raw: result.raw,
        normalized: result.normalized,
        diagOriginal: result.diagOriginal,
        diagPruned: result.diagPruned,
        diagInvalid: result.diagInvalid,
        diagSkipped: result.diagSkipped,
        diagTotal: result.diagTotal,
        diagMaxPair: result.diagMaxPair
      }
    },
    transfers
  );
};

const postError = (requestId: string, message: string) => {
  (self as unknown as Worker).postMessage({
    type: 'error',
    payload: { requestId, message }
  });
};

(self as unknown as Worker).onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  if (message.type === 'cancel') {
    if (activeRequest === message.payload.requestId) {
      activeRequest = null;
    }
    return;
  }
  if (message.type !== 'tile') return;
  const { requestId, tileId, config, tile } = message.payload;
  activeRequest = requestId;
  try {
    const shouldCancel = () => activeRequest !== requestId;
    const result = computeTile(config, tile, shouldCancel);
    if (activeRequest === requestId) {
      postResult(requestId, tileId, result);
    }
  } catch (err) {
    if (err instanceof CancelledError || (err && (err as any).name === 'CancelledError')) {
      return;
    }
    postError(requestId, err instanceof Error ? err.message : 'Tile worker error');
  }
};
