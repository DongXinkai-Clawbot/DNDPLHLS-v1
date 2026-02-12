import { clamp } from '../utils';
import type { VoiceRuntime } from './types';

export const buildExpressionNodes = (state: VoiceRuntime) => {
  const { ctx, now, nodes, expressionSourcesNeeded, expressionValues } = state;

  const createExpressionNode = (value: number) => {
    const node = ctx.createConstantSource();
    node.offset.setValueAtTime(clamp(value, 0, 1), now);
    node.start(now);
    nodes.push(node);
    return node;
  };

  if (expressionSourcesNeeded.has('modWheel')) {
    state.expressionNodes.modWheel = createExpressionNode(expressionValues.modWheel ?? 0);
  }
  if (expressionSourcesNeeded.has('aftertouch')) {
    state.expressionNodes.aftertouch = createExpressionNode(expressionValues.aftertouch ?? 0);
  }
  if (expressionSourcesNeeded.has('mpePressure')) {
    state.expressionNodes.mpePressure = createExpressionNode(expressionValues.mpePressure ?? 0);
  }
  if (expressionSourcesNeeded.has('mpeTimbre')) {
    state.expressionNodes.mpeTimbre = createExpressionNode(expressionValues.mpeTimbre ?? 0);
  }
  if (expressionSourcesNeeded.has('cc7')) {
    state.expressionNodes.cc7 = createExpressionNode(expressionValues.cc7 ?? 0);
  }
  if (expressionSourcesNeeded.has('cc74')) {
    state.expressionNodes.cc74 = createExpressionNode(expressionValues.cc74 ?? 0);
  }
  if (expressionSourcesNeeded.has('pitchBend')) {
    state.expressionNodes.pitchBend = createExpressionNode(expressionValues.pitchBend ?? 0.5);
  }

  if (state.pitchBendRange > 0 && state.expressionNodes.pitchBend) {
    const bipolar = ctx.createGain();
    bipolar.gain.value = 2;
    state.expressionNodes.pitchBend.connect(bipolar);

    const offset = ctx.createConstantSource();
    offset.offset.setValueAtTime(-0.5, now);
    offset.start(now);
    offset.connect(bipolar);

    const gain = ctx.createGain();
    gain.gain.value = state.pitchBendRange * 100;
    bipolar.connect(gain);
    state.pitchBendGain = gain;
    nodes.push(bipolar, offset, gain);
  }
};
