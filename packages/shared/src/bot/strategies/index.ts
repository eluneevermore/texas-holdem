import { BotDifficulty } from '../types.js';
import type { BotStrategy } from '../types.js';
import { normalStrategy } from './normal.js';

export const botStrategies: Record<BotDifficulty, BotStrategy> = {
  [BotDifficulty.NORMAL]: normalStrategy,
};

export { normalStrategy };
