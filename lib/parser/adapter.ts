import type { FrameworkAdapter } from './types.ts';

/**
 * Fallback adapter assuming no framework.
 * Classifies all parsed files as plain modules.
 */
export const fallbackAdapter: FrameworkAdapter = {
  name: 'fallback',
  classifyFile() {
    return {
      role: 'module',
      kind: 'file',
    };
  },
};
