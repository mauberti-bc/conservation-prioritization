import { ReactNode } from 'react';

interface ComponentSwitchProps<T extends string | number> {
  value: T;
  map: Partial<Record<T, ReactNode>>;
  fallback?: ReactNode;
}

/**
 * Renders the mapped component for the provided value, falling back when missing.
 */
export const ComponentSwitch = <T extends string | number>({
  value,
  map,
  fallback = null
}: ComponentSwitchProps<T>) => {
  return map[value] ?? fallback;
};
