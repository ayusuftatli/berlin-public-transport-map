import cache from './cache.js';

const POLL_INTERVAL_MS = 20000;


const BOUNDING_BOXES = [
    // Row 1: Polygons 1, 2, 3 (4 is removed)
    { id: '1', north: 52.6755, south: 52.5913, west: 13.0884, east: 13.2566 },
    { id: '2', north: 52.6755, south: 52.5913, west: 13.2566, east: 13.4248 },
    { id: '3', north: 52.6755, south: 52.5913, west: 13.4248, east: 13.5929 },
    // Polygon 4 is REMOVED (line 117 in map.js)

    // Row 2: Polygon 5, then 6 is SUBDIVIDED, 7, 8
    { id: '5', north: 52.5913, south: 52.5069, west: 13.0884, east: 13.2566 },
    // Polygon 6 subdivisions:
    { id: '6-1', north: 52.5913, south: 52.5491, west: 13.2566, east: 13.3407 },
    { id: '6-2', north: 52.5913, south: 52.5491, west: 13.3407, east: 13.4248 },
    { id: '6-3', north: 52.5491, south: 52.5069, west: 13.2566, east: 13.3407 },
    { id: '6-4', north: 52.5491, south: 52.5069, west: 13.3407, east: 13.4248 },
    { id: '7', north: 52.5913, south: 52.5069, west: 13.4248, east: 13.5929 },
    { id: '8', north: 52.5913, south: 52.5069, west: 13.5929, east: 13.7611 },

    // Row 3: 9, then 10 is SUBDIVIDED, 11, 12
    { id: '9', north: 52.5069, south: 52.4226, west: 13.0884, east: 13.2566 },
    // Polygon 10 subdivisions:
    { id: '10-1', north: 52.5069, south: 52.4648, west: 13.2566, east: 13.3407 },
    { id: '10-2', north: 52.5069, south: 52.4648, west: 13.3407, east: 13.4248 },
    { id: '10-3', north: 52.4648, south: 52.4226, west: 13.2566, east: 13.3407 },
    { id: '10-4', north: 52.4648, south: 52.4226, west: 13.3407, east: 13.4248 },
    { id: '11', north: 52.5069, south: 52.4226, west: 13.4248, east: 13.5929 },
    { id: '12', north: 52.5069, south: 52.4226, west: 13.5929, east: 13.7611 },

    // Row 4: 13, 14, 15, 16
    { id: '13', north: 52.4226, south: 52.3383, west: 13.0884, east: 13.2566 },
    { id: '14', north: 52.4226, south: 52.3383, west: 13.2566, east: 13.4248 },
    { id: '15', north: 52.4226, south: 52.3383, west: 13.4248, east: 13.5929 },
    { id: '16', north: 52.4226, south: 52.3383, west: 13.5929, east: 13.7611 }
];
// Total: 19 boxes (16 - 1 removed + 4 added for polygon 6 + 4 added for polygon 10 - 2 original = 19)

const VBB_BASE_URL = 'https://v6.vbb.transport.rest';

/**
 * Fetch movements for a single bounding box
 * @param {Object} box - Bounding box with north, south, east, west
 * @returns {Array} Array of movement objects
 */

async function fetchBox(box) {
    const url = `${VBB_BASE_URL}/radar?north=${box.north}&west=${box.west}&south=${box.south}&east=${box.east}`;

    try {
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

