import type { ComponentType, LazyExoticComponent } from 'react';
import type { LucideIcon } from 'lucide-react';

export type RoleCheck = (role?: string | null) => boolean;

/**
 * One feature of a console (Studio or Admin). The console builds both its navigation and its routes
 * from a list of these, so adding a feature = adding a folder under features/<console>/ and one entry
 * in that console's modules.ts.
 */
export interface ConsoleModule {
  /** URL segment under the console ('' = the console's home). The module owns everything below it (path/*). */
  path: string;
  label: string;
  icon: LucideIcon;
  /** Navigation group heading; modules without one are listed first. */
  group?: string;
  /** Who sees this module, on top of the console's own access rule. */
  access?: RoleCheck;
  element: ComponentType | LazyExoticComponent<ComponentType>;
  /** Number shown next to the nav item (e.g. items waiting). Re-read on navigation and after actions. */
  badge?: () => Promise<number>;
}

export interface ConsoleConfig {
  id: 'studio' | 'admin';
  title: string;
  /** Absolute mount point, e.g. '/studio'. */
  basePath: string;
  access: RoleCheck;
  modules: ConsoleModule[];
}
