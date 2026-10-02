import axios, {
    type AxiosError,
    type InternalAxiosRequestConfig,
} from "axios";

import {
    clearTokens,
    getAccessToken,
    getRefreshToken,
    setTokens,
} from "@/lib/auth";
import { toApiError } from "@/lib/api-error";
import { SESSION_EXPIRED_EVENT } from "@/lib/session";

const baseURL = import.meta.env.VITE_API_BASE_URL;

const api = axios.create({
    baseURL,
    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.request.use((config) => {
    const token = getAccessToken();

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

/**
 * Token refresh, with one refresh at a time.
 *
 * When an access token expires, every request in flight fails with 401 at
 * once. The old code refreshed for the first one and rejected the rest,
 * so a dashboard that loads six things would show five errors. Now the
 * others wait on the same promise and are retried with the new token.
 */
let refreshPromise: Promise<string> | null = null;

type RetriableConfig = InternalAxiosRequestConfig & {
    _retry?: boolean;
};

function endSession() {
    clearTokens();

    // AuthContext listens for this and clears the user, which sends the
    // app to the login screen through the existing route guards.
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

async function refreshAccessToken(): Promise<string> {
    const refreshToken = getRefreshToken();

    if (!refreshToken) {
        throw new Error("No refresh token");
    }

    // A bare axios call, so this request does not loop back through the
    // interceptor that is calling it.
    const response = await axios.post(
        `${baseURL}auth/refresh/`,
        { refresh: refreshToken },
        { headers: { "Content-Type": "application/json" } },
    );

    const { access, refresh } = response.data;

    setTokens(access, refresh ?? refreshToken);

    return access;
}

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as RetriableConfig | undefined;

        const status = error.response?.status;

        const shouldTryRefresh =
            status === 401 &&
            originalRequest &&
            !originalRequest._retry &&
            // Never try to refresh the refresh call itself.
            !originalRequest.url?.includes("auth/refresh") &&
            !originalRequest.url?.includes("auth/login");

        if (!shouldTryRefresh) {
            return Promise.reject(error);
        }

        if (!getRefreshToken()) {
            endSession();
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        try {
            // Everyone waits on the first refresh rather than starting
            // their own.
            refreshPromise =
                refreshPromise ??
                refreshAccessToken().finally(() => {
                    refreshPromise = null;
                });

            const access = await refreshPromise;

            originalRequest.headers.Authorization = `Bearer ${access}`;

            return api(originalRequest);
        } catch (refreshError) {
            endSession();

            return Promise.reject(refreshError);
        }
    },
);

export { toApiError };

export default api;
