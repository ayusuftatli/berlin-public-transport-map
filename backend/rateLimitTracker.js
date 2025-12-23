

const RATE_LIMIT = 100;
const WINDOW_MS = 60 * 1000;

let requestTimestamps = [];

function nowMs() {
    return Date.now();
}


export function recordRequest() {
    requestTimestamps.push(nowMs());

    cleanupOldRequests();

    return getStats();
}

function cleanupOldRequests() {
    const cutoff = nowMs() - WINDOW_MS;
    requestTimestamps = requestTimestamps.filter(ts => ts > cutoff);
}

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

export function reset() {
    requestTimestamps = [];
}
