import { createContext, useContext } from 'react';
import type { ConsoleConfig } from './types';

interface ConsoleContextValue {
  config: ConsoleConfig;
  /** Absolute path of a module, e.g. to('uploads/new') → '/studio/uploads/new'. */
  to: (path?: string) => string;
  /** Re-reads the navigation badges, e.g. after approving something. */
  refreshBadges: () => void;
}

export const ConsoleContext = createContext<ConsoleContextValue | null>(null);

export function useConsole() {
  const value = useContext(ConsoleContext);
  if (!value) throw new Error('useConsole must be used inside a console');
  return value;
}
