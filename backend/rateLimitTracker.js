/**
 * Rate Limit Tracker
 * Tracks API requests within a rolling 1-minute window
 * API limit: 100 requests/minute
 */

const RATE_LIMIT = 100;
const WINDOW_MS = 60 * 1000; // 1 minute in milliseconds

// Store timestamps of each request
let requestTimestamps = [];

function nowMs() {
    return Date.now();
}

/**
 * Record a new API request
 * @returns {object} Current stats after recording
 */
export function recordRequest() {
    requestTimestamps.push(nowMs());

    // Clean up old timestamps outside the window
    cleanupOldRequests();

    return getStats();
}

/**
 * Remove requests older than 1 minute
 */
function cleanupOldRequests() {
    const cutoff = nowMs() - WINDOW_MS;
    requestTimestamps = requestTimestamps.filter(ts => ts > cutoff);
}

/**
 * Get current rate limit statistics
 * @returns {object} Stats object with count, limit, and percentage
 */
export function getStats() {
    cleanupOldRequests();

    const count = requestTimestamps.length;
    const percentage = Math.round((count / RATE_LIMIT) * 100);
    const remaining = RATE_LIMIT - count;

    return {
        count,
        limit: RATE_LIMIT,
        remaining,
        percentage,
        isWarning: percentage >= 50,
        isCritical: percentage >= 80
    };
}

/**
 * Reset the tracker (useful for testing)
 */
export function reset() {
    requestTimestamps = [];
}
