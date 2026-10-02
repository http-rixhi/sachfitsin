import { useSyncExternalStore } from "react";

const TICK_MS = 30_000;

/**
 * A clock that components can read during render.
 *
 * Date.now() called straight from a render is impure, and setting state from
 * an effect causes cascading renders. useSyncExternalStore is the supported
 * way to read a changing external value: the snapshot only moves when the
 * subscription fires, so React sees a stable value within each tick.
 */
function subscribe(onChange: () => void) {
    const timer = window.setInterval(onChange, TICK_MS);

    return () => window.clearInterval(timer);
}

function getSnapshot() {
    return Math.floor(Date.now() / TICK_MS);
}

export function useNow(): number {
    const tick = useSyncExternalStore(
        subscribe,
        getSnapshot,
        getSnapshot,
    );

    return tick * TICK_MS;
}
