import cache from './cache.js';
import config from './config.js';
import * as rateLimitTracker from './rateLimitTracker.js';

const POLL_INTERVAL_MS = 20000;

function timestamp() {
    return new Date().toISOString();
}

// Track polling stats
let pollStats = {
    totalPolls: 0,
    successfulPolls: 0,
    emptyPolls: 0,
    failedPolls: 0,
    lastPollTime: null,
    lastNonEmptyPollTime: null,
    consecutiveEmptyPolls: 0
};




const VBB_BASE_URL = config.VBB_BASE_URL;
const BOUNDING_BOXES = config.BOUNDING_BOXES;


// Fetch movements for a single bounding box


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

        // Transform the data
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

//Fetch all bounding boxes and combine results
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
        console.log(`[Poller] [${timestamp()}] ⏳ Previous poll still running, skipping...`);
        return;
    }

    isPolling = true;
    pollStats.totalPolls++;
    pollStats.lastPollTime = timestamp();
    const pollId = pollStats.totalPolls;
    const startTime = Date.now();

    console.log(`[Poller] [${timestamp()}] ━━━ Poll #${pollId} START ━━━`);

    try {
        const movements = await fetchAllBoxes();
        const duration = Date.now() - startTime;

        // Track empty vs non-empty polls
        if (movements.length === 0) {
            pollStats.emptyPolls++;
            pollStats.consecutiveEmptyPolls++;
            console.warn(`[Poller] [${timestamp()}] EMPTY POLL - VBB returned 0 movements!`);

        } else {
            if (pollStats.consecutiveEmptyPolls > 0) {
                console.log(`[Poller] [${timestamp()}] DATA RECOVERED after ${pollStats.consecutiveEmptyPolls} empty polls`);
            }
            pollStats.successfulPolls++;
            pollStats.consecutiveEmptyPolls = 0;
            pollStats.lastNonEmptyPollTime = timestamp();
        }

        cache.update(movements);

        // DIAGNOSTIC: Track when next poll is expected
        const nextPollIn = POLL_INTERVAL_MS - duration;
        console.log(`[Poller] [${timestamp()}] Poll #${pollId} END - Dur: ${duration}ms - Mov: ${movements.length}`);
    } catch (error) {
        pollStats.failedPolls++;
        console.error(`[Poller] [${timestamp()}] Poll #${pollId} FAILED:`, error.message);
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

