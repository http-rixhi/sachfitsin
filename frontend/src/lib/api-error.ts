/**
 * Turning anything Axios throws into one predictable object.
 *
 * The backend always answers with:
 *
 *   { "error": { code, message, status, fields? } }
 *
 * but a request can also fail before it ever reaches the backend — the
 * server is down, the user is offline, the request timed out. Those have
 * no response body at all, so they are normalised here too. Every page
 * then deals with one type instead of three.
 */

export type ApiErrorCode =
    | "validation_error"
    | "authentication_required"
    | "invalid_token"
    | "token_expired"
    | "invalid_credentials"
    | "permission_denied"
    | "entitlement_required"
    | "not_found"
    | "method_not_allowed"
    | "unsupported_media_type"
    | "throttled"
    | "conflict"
    | "server_error"
    | "service_unavailable"
    | "network_error"
    | "unknown_error";

export interface ApiError {
    code: ApiErrorCode;
    message: string;
    status: number;
    fields?: Record<string, string[]>;
    /** True when the request never got an answer at all. */
    isNetwork: boolean;
}

const NETWORK_MESSAGE =
    "We could not reach the server. Check your connection and try again.";

const UNKNOWN_MESSAGE = "Something went wrong. Please try again.";

interface ErrorBody {
    error?: {
        code?: string;
        message?: string;
        status?: number;
        fields?: Record<string, string[]>;
    };
    detail?: string;
}

function hasResponse(
    error: unknown,
): error is { response: { status: number; data: unknown } } {
    return (
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: unknown }).response === "object" &&
        (error as { response?: unknown }).response !== null
    );
}

export function toApiError(error: unknown): ApiError {
    if (isApiError(error)) {
        return error;
    }

    if (!hasResponse(error)) {
        return {
            code: "network_error",
            message: NETWORK_MESSAGE,
            status: 0,
            isNetwork: true,
        };
    }

    const { status, data } = error.response;
    const body = data as ErrorBody | undefined;

    // The standard shape.
    if (body?.error?.code) {
        return {
            code: body.error.code as ApiErrorCode,
            message: body.error.message || UNKNOWN_MESSAGE,
            status: body.error.status ?? status,
            fields: body.error.fields,
            isNetwork: false,
        };
    }

    // A response that predates the standard shape, or comes from something
    // outside our backend (a proxy, a gateway).
    return {
        code: status >= 500 ? "server_error" : "unknown_error",
        message: body?.detail || UNKNOWN_MESSAGE,
        status,
        isNetwork: false,
    };
}

export function isApiError(value: unknown): value is ApiError {
    return (
        typeof value === "object" &&
        value !== null &&
        "code" in value &&
        "message" in value &&
        "isNetwork" in value
    );
}

/** The message to show the user. Safe to call with anything. */
export function errorMessage(error: unknown): string {
    return toApiError(error).message;
}

/** The first message for one form field, if the backend flagged it. */
export function fieldError(
    error: unknown,
    field: string,
): string | undefined {
    return toApiError(error).fields?.[field]?.[0];
}

/** All field messages, for driving a form. */
export function fieldErrors(error: unknown): Record<string, string> {
    const { fields } = toApiError(error);

    if (!fields) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(fields)
            .filter(([, messages]) => messages?.length)
            .map(([field, messages]) => [field, messages[0]]),
    );
}

export function isAuthError(error: unknown): boolean {
    const { code } = toApiError(error);

    return (
        code === "authentication_required" ||
        code === "invalid_token" ||
        code === "token_expired"
    );
}

export function isPermissionError(error: unknown): boolean {
    return toApiError(error).code === "permission_denied";
}

/** The customer is logged in, but this feature is not in their plan. */
export function isEntitlementError(error: unknown): boolean {
    return toApiError(error).code === "entitlement_required";
}

/** Worth offering a retry button: the same request might work next time. */
export function isRetryable(error: unknown): boolean {
    const { isNetwork, status } = toApiError(error);

    return isNetwork || status >= 500 || status === 429;
}
