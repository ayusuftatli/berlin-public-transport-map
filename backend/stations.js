import stations from 'vbb-stations';

// Weight threshold to categorize stations
// Major stations are important hubs (Alexanderplatz, Hauptbahnhof, etc.)
// Adjust this value if too many/few stations appear at city-wide zoom
const MAJOR_STATION_WEIGHT = 5000;

/**
 * Get all VBB stations with categorization
 * @returns {Array} Array of station objects with flattened structure
 */
function getAllStations() {
    const all = stations('all');

    return all.map(station => ({
        id: station.id,
        name: station.name,
        latitude: station.location.latitude,
        longitude: station.location.longitude,
        weight: station.weight,
        isMajor: station.weight >= MAJOR_STATION_WEIGHT
    }));
}

/**
 * Get only major stations (high traffic hubs)
 * @returns {Array} Array of major station objects
 */
function getMajorStations() {
    return getAllStations().filter(s => s.isMajor);
}

/**
 * Get station statistics
 * @returns {Object} Stats about stations
 */
function getStats() {
    const all = getAllStations();
    return {
        total: all.length,
        major: all.filter(s => s.isMajor).length,
        minor: all.filter(s => !s.isMajor).length,
        threshold: MAJOR_STATION_WEIGHT
    };
}

export default {
    getAllStations,
    getMajorStations,
    getStats
};
