import { QueryClient } from "@tanstack/react-query";

import { toApiError } from "@/lib/api-error";

/**
 * One retry policy for the whole app.
 *
 * Retrying a 400 or a 403 is pointless — the answer will not change, and it
 * just delays the error the user needs to see. Retrying a 500 or a dropped
 * connection is worth it, because those often clear on their own.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
    const { status, isNetwork, code } = toApiError(error);

    if (
        code === "authentication_required" ||
        code === "invalid_token" ||
        code === "token_expired"
    ) {
        // The Axios layer is already refreshing or ending the session.
        return false;
    }

    if (isNetwork) {
        return failureCount < 2;
    }

    if (status >= 500) {
        return failureCount < 2;
    }

    return false;
}

export function createQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: shouldRetry,
                retryDelay: (attempt) =>
                    Math.min(1000 * 2 ** attempt, 8000),
                refetchOnWindowFocus: false,
                staleTime: 30_000,
            },
            mutations: {
                // A failed write is never retried on its own. The user
                // presses the button again, so they stay in control.
                retry: false,
            },
        },
    });
}
