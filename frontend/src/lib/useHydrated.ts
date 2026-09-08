import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during SSR and the first client render, true afterwards.
 *
 * Preferred over the `useState(false)` + `useEffect(() => setMounted(true))`
 * idiom, which trips react-hooks/set-state-in-effect - this reads the value
 * from an external store instead of scheduling a cascading render.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
