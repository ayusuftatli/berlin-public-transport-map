


// Helper to get timestamp for logs
function timestamp() {
    return new Date().toISOString();
}

const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'railway link'; //TODO: change this before deployment

// Track fetch history for debugging
let fetchHistory = [];
const MAX_HISTORY = 20;

export async function getData() {

    const url = `${API_BASE}/api/movements`;
    const tag = '[Frontend]';
    const fetchStart = Date.now();

    try {
        console.log(`${tag} [${timestamp()}] Fetching from: ${url}`);

        const response = await fetch(url);
        const fetchDuration = Date.now() - fetchStart;

        if (!response.ok) {
            const errorData = await response.text();
            console.error(`${tag} [${timestamp()}] ❌ API Error (${response.status}): ${errorData}`);
            throw new Error(`Response status ${response.status}`);
        }

        const result = await response.json();
        const movementCount = result.movements?.length || 0; // FIXED: was "legnth" typo
        const cacheAge = result.meta?.ageMs || 0;
        const isHealthy = result.meta?.isHealthy;

        // Detailed logging
        console.log(`${tag} [${timestamp()}] ✅ Response received:`);
        console.log(`${tag}   └─ Movements: ${movementCount}`);
        console.log(`${tag}   └─ Cache age: ${cacheAge}ms`);
        console.log(`${tag}   └─ Cache healthy: ${isHealthy}`);
        console.log(`${tag}   └─ Fetch duration: ${fetchDuration}ms`);

        // Track history for debugging
        fetchHistory.push({
            time: timestamp(),
            count: movementCount,
            cacheAge,
            isHealthy,
            fetchDuration
        });
        if (fetchHistory.length > MAX_HISTORY) fetchHistory.shift();

        // CRITICAL: Alert when we get 0 movements
        if (movementCount === 0) {
            console.warn(`${tag} [${timestamp()}] ⚠️ ZERO MOVEMENTS RECEIVED!`);
            console.warn(`${tag}   └─ Cache age: ${cacheAge}ms (stale if > 60000)`);
            console.warn(`${tag}   └─ Last ${fetchHistory.length} fetches:`,
                fetchHistory.map(h => `${h.count} @ ${h.time}`).join(', '));
        }

        // DIAGNOSTIC: Track timing pattern
        const isStale = cacheAge > 15000;
        if (isStale) {
            console.warn(`${tag} ⚠️ STALE DETECTED: Cache age ${cacheAge}ms exceeds 15s threshold`);
        }

        // Return both movements and cache age so frontend can decide animation strategy
        return {
            movements: result.movements || [],
            cacheAge: cacheAge,
            isStale: isStale  // Pre-calculate if cache is stale (>15 seconds)
        };
    } catch (error) {
        console.error(`${tag} [${timestamp()}] ❌ Fetch Error: ${error.message}`);
        fetchHistory.push({
            time: timestamp(),
            count: -1,
            error: error.message
        });
        return { movements: [], cacheAge: 0, isStale: false };
    }





}

