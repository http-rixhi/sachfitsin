/**
 * Fired by the Axios layer when a session can no longer be recovered —
 * the refresh token is missing, expired, or was rejected.
 *
 * It lives in its own module so `services/api.ts` and `contexts/
 * AuthContext.tsx` can share it without importing each other.
 */
export const SESSION_EXPIRED_EVENT = "sachfitsin:session-expired";
