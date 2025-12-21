import cache from './cache.js';
import config from './config.js';
import * as rateLimitTracker from './rateLimitTracker.js';

const POLL_INTERVAL_MS = 20000;



// Total: 19 boxes (16 - 1 removed + 4 added for polygon 6 + 4 added for polygon 10 - 2 original = 19)

const VBB_BASE_URL = config.VBB_BASE_URL;
const BOUNDING_BOXES = config.BOUNDING_BOXES;

/**
 * Fetch movements for a single bounding box
 * @param {Object} box - Bounding box with north, south, east, west
 * @returns {Array} Array of movement objects
 */

async function fetchBox(box) {
    const url = `${VBB_BASE_URL}/radar?north=${box.north}&west=${box.west}&south=${box.south}&east=${box.east}`;

    try {
        // Record API request for rate limit tracking
        rateLimitTracker.recordRequest();

        const response = await fetch(url);

        if (!response.ok) {
            console.error(`[Poller] API error for box ${box.id}: ${response.status}`);
            return [];
        }

        const data = await response.json();

        // Transform the data to match your frontend's expected format
        // (same transformation as in vbb_data.js lines 38-45)
        return (data.movements || []).map(movement => ({
            name: movement.line.name,
            direction: movement.direction,
            tripId: movement.tripId,
            latitude: movement.location.latitude,
            longitude: movement.location.longitude,
            type: movement.line.product
        }));

    } catch (error) {
        console.error(`[Poller] Fetch error for box ${box.id}:`, error.message);
        return [];
    }
}

/**
 * Fetch all bounding boxes and combine results
 * @returns {Array} Deduplicated array of all movements
 */

async function fetchAllBoxes() {
    console.log(`[Poller] Fetching ${BOUNDING_BOXES.length} bounding boxes...`);
    // fetch all boxes in parallel
    const results = await Promise.all(
        BOUNDING_BOXES.map(box => fetchBox(box))
    );

    //Flatten results
    const allMovements = results.flat();

    // Deduplicate by tripId
    const seen = new Map();
    for (const movement of allMovements) {
        if (!seen.has(movement.tripId)) {
            seen.set(movement.tripId, movement);
        }
    }

    const deduplicated = Array.from(seen.values());
    console.log(`[Poller] Fetched ${allMovements.length} movements, ${deduplicated.length} unique`);

    return deduplicated;
}

let pollInterval = null;
let isPolling = false;

async function poll() {
    if (isPolling) {
        console.log('[Poller] Previous poll still running, skipping...');
        return;
    }

    isPolling = true;
    const startTime = Date.now();

    try {
        const movements = await fetchAllBoxes(); // why issue here await has no effect???

        cache.update(movements);

        const duration = Date.now() - startTime;
        console.log(`[Poller] Poll completed in ${duration}ms`);
    } catch (error) {
        console.error('[Poller] Poll failed', error.message);
    } finally {
        isPolling = false;
    }
}

// start the polling loop
function start() {
    console.log(`[Poller] Starting (${POLL_INTERVAL_MS}ms interval, ${BOUNDING_BOXES.length} boxes)`);
    poll();
    pollInterval = setInterval(poll, POLL_INTERVAL_MS);
}

// stop polling
function stop() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
        console.log('[Poller] Stopped');
    }
}

export default {
    start,
    stop
}

