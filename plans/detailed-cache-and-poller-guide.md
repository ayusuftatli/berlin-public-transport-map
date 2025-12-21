# Detailed Guide: Cache Module & VBB Poller

This guide provides step-by-step instructions for implementing the two core modules of your backend.

---

## Part 1: The Cache Module (`backend/cache.js`)

### What This Module Does

The cache module is your **in-memory data store**. Think of it as a simple container that:
1. Holds all current vehicle movements
2. Lets you update the data (when fresh data arrives from VBB)
3. Lets you read the data (when a user requests it)
4. Tracks metadata (when was it last updated, how many vehicles)

### Why In-Memory?

You might wonder "why not just use a database?" For this use case:
- Data expires every 20 seconds (it's real-time positions)
- You need microsecond reads (memory is instant, databases add milliseconds)
- You don't need persistence (if server restarts, new data arrives in 20s)
- You don't need complex queries (just "give me all movements")

A database would be overkill and slower.

### Data Structure Design

Here's how we'll structure the data:

```javascript
// We use a Map instead of an Object because:
// - Map preserves insertion order
// - Map.size is O(1) instead of Object.keys().length which is O(n)
// - Map has cleaner iteration methods

const cache = {
  // The main data store - keyed by tripId for fast lookups
  movements: new Map(),
  // Example entry:
  // 'trip-12345' => {
  //   name: 'U2',
  //   direction: 'Pankow',
  //   tripId: 'trip-12345',
  //   latitude: 52.52,
  //   longitude: 13.41,
  //   type: 'subway'
  // }

  // When was the cache last updated?
  lastUpdated: null,  // Date object or null if never updated

  // How many successful updates have occurred?
  updateCount: 0
};
```

### Functions to Implement

#### 1. `update(movements)` - Store fresh data

This function is called by the VBB Poller every 20 seconds with new data.

```javascript
/**
 * Replace all cached movements with fresh data.
 * 
 * @param {Array} movements - Array of movement objects from VBB API
 * 
 * Why we REPLACE instead of MERGE:
 * - Vehicles that have completed their trips should disappear
 * - Merging would cause "ghost" vehicles to stay forever
 * - It's simpler and matches your current frontend logic
 */
function update(movements) {
  // Clear the old data
  cache.movements.clear();

  // Add each new movement, keyed by tripId
  for (const movement of movements) {
    cache.movements.set(movement.tripId, movement);
  }

  // Update metadata
  cache.lastUpdated = new Date();
  cache.updateCount += 1;

  // Log for debugging (you'll see this in Railway logs)
  console.log(`[Cache] Updated with ${cache.movements.size} movements`);
}
```

#### 2. `getAll()` - Return all movements

This function is called by your API endpoint when a user requests data.

```javascript
/**
 * Get all current movements as an array.
 * 
 * @returns {Array} All movement objects
 * 
 * Why we return an array instead of the Map:
 * - Arrays serialize to JSON cleanly
 * - Frontend expects an array (matches current getData() return format)
 * - Easier to work with in the browser
 */
function getAll() {
  // Convert Map values to an array
  return Array.from(cache.movements.values());
}
```

#### 3. `getStats()` - Return metadata

This function is called by your `/api/stats` endpoint for monitoring.

```javascript
/**
 * Get cache statistics and health info.
 * 
 * @returns {Object} Stats object with count, timestamps, etc.
 * 
 * Why this is useful:
 * - Debugging: "Is the poller actually running?"
 * - Monitoring: "How fresh is the data?"
 * - Health checks: "Is the cache populated?"
 */
function getStats() {
  const now = new Date();
  
  return {
    // How many vehicles are currently tracked
    count: cache.movements.size,
    
    // When was the cache last updated (ISO string for JSON)
    lastUpdated: cache.lastUpdated ? cache.lastUpdated.toISOString() : null,
    
    // How old is the current data in milliseconds
    // Useful for frontend to show "data is X seconds old"
    ageMs: cache.lastUpdated ? now - cache.lastUpdated : null,
    
    // How many update cycles have completed since server start
    updateCount: cache.updateCount,
    
    // Is the cache considered "healthy"?
    // Data older than 60 seconds probably means poller is broken
    isHealthy: cache.lastUpdated && (now - cache.lastUpdated) < 60000
  };
}
```

### Complete Module Code

Here's the full `backend/cache.js` file:

```javascript
/**
 * In-Memory Cache for VBB Movement Data
 * 
 * This module stores real-time vehicle positions in memory.
 * Data is updated every 20 seconds by the VBB poller.
 */

// Private cache state (not exported directly)
const cache = {
  movements: new Map(),
  lastUpdated: null,
  updateCount: 0
};

/**
 * Replace all cached movements with fresh data
 * @param {Array} movements - Array of movement objects from VBB API
 */
function update(movements) {
  cache.movements.clear();
  
  for (const movement of movements) {
    cache.movements.set(movement.tripId, movement);
  }
  
  cache.lastUpdated = new Date();
  cache.updateCount += 1;
  
  console.log(`[Cache] Updated: ${cache.movements.size} movements`);
}

/**
 * Get all current movements as an array
 * @returns {Array} All movement objects
 */
function getAll() {
  return Array.from(cache.movements.values());
}

/**
 * Get cache statistics
 * @returns {Object} Stats including count, age, health status
 */
function getStats() {
  const now = new Date();
  
  return {
    count: cache.movements.size,
    lastUpdated: cache.lastUpdated?.toISOString() || null,
    ageMs: cache.lastUpdated ? now - cache.lastUpdated : null,
    updateCount: cache.updateCount,
    isHealthy: cache.lastUpdated && (now - cache.lastUpdated) < 60000
  };
}

// Export the public functions
module.exports = {
  update,
  getAll,
  getStats
};
```

---

## Part 2: The VBB Poller Module (`backend/vbbPoller.js`)

### What This Module Does

The VBB Poller is a **background job** that:
1. Runs continuously in the background (every 20 seconds)
2. Fetches vehicle positions from all 19 bounding boxes
3. Combines and deduplicates the results
4. Updates the cache with fresh data

### Understanding the VBB API

The VBB Transport REST API endpoint you're using:
```
https://v6.vbb.transport.rest/radar?north=X&west=X&south=X&east=X
```

Returns data like:
```json
{
  "movements": [
    {
      "tripId": "1|12345|...",
      "line": {
        "name": "U2",
        "product": "subway"
      },
      "direction": "Pankow",
      "location": {
        "latitude": 52.52,
        "longitude": 13.41
      }
    }
  ]
}
```

### Extracting Bounding Boxes from Your Current Code

Your current [`map.js`](../map.js:60) creates 16 grid squares, subdivides 2 of them, and removes 1. Let me extract the exact logic:

```javascript
// Base bounding box for Berlin (from map.js lines 16-19)
const BERLIN_BOUNDS = {
  north: 52.6755,
  south: 52.3383,
  west: 13.0884,
  east: 13.7611
};

// Grid configuration (from map.js line 21)
const GRID_SIZE = 4; // 4x4 = 16 cells

// Calculate step sizes
const latStep = (BERLIN_BOUNDS.north - BERLIN_BOUNDS.south) / GRID_SIZE;
const lngStep = (BERLIN_BOUNDS.east - BERLIN_BOUNDS.west) / GRID_SIZE;

// Generate all bounding boxes
function generateBoundingBoxes() {
  const boxes = [];
  
  // Create the 4x4 grid (16 boxes)
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const id = row * GRID_SIZE + col + 1; // 1-16
      
      boxes.push({
        id: String(id),
        north: BERLIN_BOUNDS.north - (row * latStep),
        south: BERLIN_BOUNDS.north - ((row + 1) * latStep),
        west: BERLIN_BOUNDS.west + (col * lngStep),
        east: BERLIN_BOUNDS.west + ((col + 1) * lngStep)
      });
    }
  }
  
  return boxes;
}

// Then apply the same subdivisions and removals as map.js:
// - busyPolyDivider(5)  -> splits polygon 6 into 6-1, 6-2, 6-3, 6-4
// - busyPolyDivider(9)  -> splits polygon 10 into 10-1, 10-2, 10-3, 10-4
// - remove polygon 4    -> polygon 4 is excluded
```

### Step-by-Step Implementation

#### Step 1: Define the bounding boxes

Hard-code them for simplicity (you can make it dynamic later):

```javascript
// These match exactly what your map.js creates
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
```

#### Step 2: Create the fetch function

This is similar to your current `getData()` but adapted for Node.js:

```javascript
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
```

#### Step 3: Fetch all boxes and deduplicate

```javascript
/**
 * Fetch all bounding boxes and combine results
 * @returns {Array} Deduplicated array of all movements
 */
async function fetchAllBoxes() {
  console.log(`[Poller] Fetching ${BOUNDING_BOXES.length} bounding boxes...`);
  
  // Fetch all boxes in parallel
  const results = await Promise.all(
    BOUNDING_BOXES.map(box => fetchBox(box))
  );
  
  // Flatten: [[movements], [movements], ...] -> [movements]
  const allMovements = results.flat();
  
  // Deduplicate by tripId
  // Why: A vehicle near a box boundary might appear in 2 adjacent boxes
  const seen = new Map();
  for (const movement of allMovements) {
    // Keep the first occurrence of each tripId
    // (they should be identical anyway)
    if (!seen.has(movement.tripId)) {
      seen.set(movement.tripId, movement);
    }
  }
  
  const deduplicated = Array.from(seen.values());
  
  console.log(`[Poller] Fetched ${allMovements.length} movements, ${deduplicated.length} unique`);
  
  return deduplicated;
}
```

#### Step 4: Create the polling loop

```javascript
const cache = require('./cache');

const POLL_INTERVAL_MS = 20000; // 20 seconds

let pollInterval = null;
let isPolling = false;

/**
 * Run one poll cycle
 */
async function poll() {
  // Prevent overlapping polls if previous one is slow
  if (isPolling) {
    console.log('[Poller] Previous poll still running, skipping...');
    return;
  }
  
  isPolling = true;
  const startTime = Date.now();
  
  try {
    const movements = await fetchAllBoxes();
    cache.update(movements);
    
    const duration = Date.now() - startTime;
    console.log(`[Poller] Poll completed in ${duration}ms`);
    
  } catch (error) {
    console.error('[Poller] Poll failed:', error.message);
  } finally {
    isPolling = false;
  }
}

/**
 * Start the polling loop
 */
function start() {
  console.log(`[Poller] Starting with ${POLL_INTERVAL_MS}ms interval`);
  
  // Run immediately on start
  poll();
  
  // Then run every POLL_INTERVAL_MS
  pollInterval = setInterval(poll, POLL_INTERVAL_MS);
}

/**
 * Stop the polling loop (useful for graceful shutdown)
 */
function stop() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log('[Poller] Stopped');
  }
}
```

### Complete Module Code

Here's the full `backend/vbbPoller.js` file:

```javascript
/**
 * VBB API Poller
 * 
 * Background job that fetches real-time vehicle positions from
 * the VBB Transport API every 20 seconds and updates the cache.
 */

const cache = require('./cache');

// Configuration
const VBB_BASE_URL = 'https://v6.vbb.transport.rest';
const POLL_INTERVAL_MS = 20000;

// Bounding boxes matching map.js grid
// 16 base boxes - polygon 4 + 4 subdivisions of 6 + 4 subdivisions of 10 = 19 total
const BOUNDING_BOXES = [
  // Row 1
  { id: '1', north: 52.6755, south: 52.5913, west: 13.0884, east: 13.2566 },
  { id: '2', north: 52.6755, south: 52.5913, west: 13.2566, east: 13.4248 },
  { id: '3', north: 52.6755, south: 52.5913, west: 13.4248, east: 13.5929 },
  // 4 removed
  
  // Row 2
  { id: '5', north: 52.5913, south: 52.5069, west: 13.0884, east: 13.2566 },
  { id: '6-1', north: 52.5913, south: 52.5491, west: 13.2566, east: 13.3407 },
  { id: '6-2', north: 52.5913, south: 52.5491, west: 13.3407, east: 13.4248 },
  { id: '6-3', north: 52.5491, south: 52.5069, west: 13.2566, east: 13.3407 },
  { id: '6-4', north: 52.5491, south: 52.5069, west: 13.3407, east: 13.4248 },
  { id: '7', north: 52.5913, south: 52.5069, west: 13.4248, east: 13.5929 },
  { id: '8', north: 52.5913, south: 52.5069, west: 13.5929, east: 13.7611 },
  
  // Row 3
  { id: '9', north: 52.5069, south: 52.4226, west: 13.0884, east: 13.2566 },
  { id: '10-1', north: 52.5069, south: 52.4648, west: 13.2566, east: 13.3407 },
  { id: '10-2', north: 52.5069, south: 52.4648, west: 13.3407, east: 13.4248 },
  { id: '10-3', north: 52.4648, south: 52.4226, west: 13.2566, east: 13.3407 },
  { id: '10-4', north: 52.4648, south: 52.4226, west: 13.3407, east: 13.4248 },
  { id: '11', north: 52.5069, south: 52.4226, west: 13.4248, east: 13.5929 },
  { id: '12', north: 52.5069, south: 52.4226, west: 13.5929, east: 13.7611 },
  
  // Row 4
  { id: '13', north: 52.4226, south: 52.3383, west: 13.0884, east: 13.2566 },
  { id: '14', north: 52.4226, south: 52.3383, west: 13.2566, east: 13.4248 },
  { id: '15', north: 52.4226, south: 52.3383, west: 13.4248, east: 13.5929 },
  { id: '16', north: 52.4226, south: 52.3383, west: 13.5929, east: 13.7611 }
];

// State
let pollInterval = null;
let isPolling = false;

/**
 * Fetch movements for a single bounding box
 */
async function fetchBox(box) {
  const url = `${VBB_BASE_URL}/radar?north=${box.north}&west=${box.west}&south=${box.south}&east=${box.east}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`[Poller] Box ${box.id} error: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    
    return (data.movements || []).map(m => ({
      name: m.line.name,
      direction: m.direction,
      tripId: m.tripId,
      latitude: m.location.latitude,
      longitude: m.location.longitude,
      type: m.line.product
    }));
    
  } catch (error) {
    console.error(`[Poller] Box ${box.id} failed:`, error.message);
    return [];
  }
}

/**
 * Fetch all boxes and deduplicate
 */
async function fetchAllBoxes() {
  const results = await Promise.all(
    BOUNDING_BOXES.map(box => fetchBox(box))
  );
  
  const allMovements = results.flat();
  
  // Deduplicate by tripId
  const seen = new Map();
  for (const movement of allMovements) {
    if (!seen.has(movement.tripId)) {
      seen.set(movement.tripId, movement);
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Run one poll cycle
 */
async function poll() {
  if (isPolling) {
    console.log('[Poller] Skipping (previous poll still running)');
    return;
  }
  
  isPolling = true;
  const start = Date.now();
  
  try {
    const movements = await fetchAllBoxes();
    cache.update(movements);
    console.log(`[Poller] Done in ${Date.now() - start}ms`);
  } catch (error) {
    console.error('[Poller] Failed:', error.message);
  } finally {
    isPolling = false;
  }
}

/**
 * Start the polling loop
 */
function start() {
  console.log(`[Poller] Starting (${POLL_INTERVAL_MS}ms interval, ${BOUNDING_BOXES.length} boxes)`);
  poll(); // Run immediately
  pollInterval = setInterval(poll, POLL_INTERVAL_MS);
}

/**
 * Stop the polling loop
 */
function stop() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log('[Poller] Stopped');
  }
}

module.exports = { start, stop };
```

---

## How These Modules Work Together

```
Server starts (index.js)
    │
    ├── require('./cache')     → Cache module loaded (empty Map)
    ├── require('./vbbPoller') → Poller module loaded
    │
    └── vbbPoller.start()
            │
            ├── poll() runs immediately
            │     │
            │     ├── fetchAllBoxes()
            │     │     └── 19x fetchBox() in parallel
            │     │           └── fetch() from VBB API
            │     │
            │     └── cache.update(movements)
            │           └── Map cleared and repopulated
            │
            └── setInterval(poll, 20000)
                  └── Repeats every 20 seconds

User requests /api/movements (index.js)
    │
    └── cache.getAll()
          └── Returns Array from Map
```

---

## Testing Your Implementation

### Test the cache module standalone:

```javascript
// test-cache.js (run with: node test-cache.js)
const cache = require('./cache');

// Should be empty initially
console.log('Initial:', cache.getStats());

// Add some test data
cache.update([
  { tripId: '1', name: 'U2', direction: 'Pankow', latitude: 52.52, longitude: 13.41, type: 'subway' },
  { tripId: '2', name: 'S1', direction: 'Wannsee', latitude: 52.50, longitude: 13.38, type: 'suburban' }
]);

// Should show 2 movements
console.log('After update:', cache.getStats());
console.log('Movements:', cache.getAll());
```

### Test the poller manually:

```javascript
// test-poller.js (run with: node test-poller.js)
const poller = require('./vbbPoller');
const cache = require('./cache');

// Start polling
poller.start();

// After 5 seconds, check the cache
setTimeout(() => {
  console.log('Cache stats:', cache.getStats());
  console.log('Sample movement:', cache.getAll()[0]);
  poller.stop();
  process.exit(0);
}, 5000);
```

---

## Common Issues and Solutions

### Issue: "fetch is not defined"
**Solution**: Make sure you're using Node.js 18+. Check with `node --version`.

### Issue: Empty cache after poll
**Solution**: Check the console for error messages. The VBB API might be rate limiting you, or there might be network issues.

### Issue: Duplicate vehicles on the map
**Solution**: The deduplication in `fetchAllBoxes()` should handle this. Make sure you're using the tripId as the key.

### Issue: Memory keeps growing
**Solution**: The `cache.update()` function calls `clear()` first, so the Map shouldn't grow unbounded. If you see memory issues, check that no other code is holding references to old movements.
