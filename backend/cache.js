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
export default {
    update,
    getAll,
    getStats
}


