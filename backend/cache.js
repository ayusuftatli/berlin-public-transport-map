// Helper for timestamps
function timestamp() {
    return new Date().toISOString();
}

// Private cache state (not exported directly)
const cache = {
    movements: new Map(),
    lastUpdated: null,
    updateCount: 0,
    lastEmptyUpdate: null,
    consecutiveEmptyUpdates: 0
};

/**
 * Replace all cached movements with fresh data
 * @param {Array} movements - Array of movement objects from VBB API
 */
function update(movements) {
    const previousCount = cache.movements.size;

    // FIX: Don't wipe cache when API returns empty data
    // This prevents the "flying vehicles" issue when VBB API temporarily fails
    if (movements.length === 0) {
        cache.consecutiveEmptyUpdates++;
        cache.lastEmptyUpdate = timestamp();
        console.warn(`[Cache] [${timestamp()}] ⚠️ EMPTY UPDATE RECEIVED - PRESERVING EXISTING CACHE!`);
        console.warn(`[Cache]   └─ Preserved cache size: ${previousCount}`);
        console.warn(`[Cache]   └─ Consecutive empty updates: ${cache.consecutiveEmptyUpdates}`);
        // Don't update lastUpdated - keep the old timestamp to show cache staleness
        return; // EXIT EARLY - don't wipe the cache!
    }

    // Reset counter when we get valid data
    if (cache.consecutiveEmptyUpdates > 0) {
        console.log(`[Cache] [${timestamp()}] ✅ DATA RECOVERED after ${cache.consecutiveEmptyUpdates} empty updates`);
    }
    cache.consecutiveEmptyUpdates = 0;

    // Step1: Preserve previous positions for existing vehicles
    const updatedVehicles = new Map();
    let existingCount = 0;
    let newCount = 0;

    for (const newMovement of movements) {
        const existing = cache.movements.get(newMovement.tripId);

        if (existing) {
            existingCount++;
            //Vehicle exists - shift current to previous
            updatedVehicles.set(newMovement.tripId, {
                current: {
                    ...newMovement,
                    timestamp: new Date()
                },
                previous: {
                    latitude: existing.current.latitude,
                    longitude: existing.current.longitude,
                    timestamp: existing.current.timestamp
                },
                firstSeen: existing.firstSeen
            })
        } else {
            newCount++;
            // New vehicle - no previous position
            updatedVehicles.set(newMovement.tripId, {
                current: {
                    ...newMovement,
                    timestamp: new Date()
                },
                previous: null,
                firstSeen: new Date()
            });
        }
    }
    // Step 2: Replace cache with updated data
    cache.movements = updatedVehicles;
    cache.lastUpdated = new Date();
    cache.updateCount += 1;

    console.log(`[Cache] [${timestamp()}] Update #${cache.updateCount}:`);
    console.log(`[Cache]   └─ Total: ${cache.movements.size} (was ${previousCount})`);
    console.log(`[Cache]   └─ Existing: ${existingCount}, New: ${newCount}`);
}

/**
 * Get all current movements as an array
 * @returns {Array} All movement objects
 */
function getAll() {
    return Array.from(cache.movements.values()).map(vehicle => ({
        // Current position data
        name: vehicle.current.name,
        direction: vehicle.current.direction,
        tripId: vehicle.current.tripId,
        latitude: vehicle.current.latitude,
        longitude: vehicle.current.longitude,
        type: vehicle.current.type,

        // Previous position for animation (new field)
        previousPosition: vehicle.previous ? {
            latitude: vehicle.previous.latitude,
            longitude: vehicle.previous.longitude
        } : null
    }));
}

/**
 * Get cache statistics
 * @returns {Object} Stats including count, age, health status
 */
function getStats() {
    const now = new Date();
    const ageMs = cache.lastUpdated ? now - cache.lastUpdated : null;

    // DIAGNOSTIC: Log when cache age is approaching stale threshold
    if (ageMs !== null && ageMs > 12000) {
        console.warn(`[Cache] ⚠️ Cache aging: ${ageMs}ms (last updated: ${cache.lastUpdated?.toISOString()})`);
    }

    return {
        count: cache.movements.size,
        lastUpdated: cache.lastUpdated?.toISOString() || null,
        ageMs: ageMs,
        updateCount: cache.updateCount,
        isHealthy: cache.lastUpdated && (now - cache.lastUpdated) < 60000
    };
}

// Export the public functions
export default {
    update,
    getAll,
    getStats
}


