export { getNoteKey } from './timbreEngine/noteKey';
export type { TimbreContext, TimbreVoiceExpression } from './timbreEngine/engineState';
export {
  reportTimbreEngineError,
  clearTimbreEngineError,
  getTimbreEngineError,
  getLimiterClipCounter,
  resetLimiterClipCounter,
  updateTimbreModState,
  updateTimbreVoiceExpression,
  resolveTimbrePatch,
  panicTimbreEngine,
  getActiveTimbreVoiceCount
} from './timbreEngine/engineState';
export { startTimbreVoice } from './timbreEngine/startTimbreVoice';
