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
    // Step1: Preserve revious positions for existing vehicles
    const updatedVehicles = new Map();

    for (const newMovement of movements) {
        const existing = cache.movements.get(newMovement.tripId);

        if (existing) {
            //Vehicle exists -shift current to previous
            updatedVehicles.set(newMovement.tripId, {
                current: {
                    ...newMovement, // why do we turn into array is it not alreaday array?
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

    console.log(`[Cache] Updated: ${cache.movements.size} movements (${movements.length - updatedVehicles.size} new)`);
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

    return {
        count: cache.movements.size,
        lastUpdated: cache.lastUpdated?.toISOString() || null,
        ageMs: cache.lastUpdated ? now - cache.lastUpdated : null,
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


