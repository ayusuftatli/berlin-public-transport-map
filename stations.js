const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'railway link'; //TODO: change this before deployment

/**
 * Fetch all VBB stations from backend
 * @returns {Promise<Array>} Array of station objects
 */
export async function getStations() {
    const url = `${API_BASE}/api/stations`;
    const tag = '[Stations]';

    try {
        console.log(`${tag} Fetching stations from backend...`);

        const response = await fetch(url);

        if (!response.ok) {
            const errorData = await response.text();
            console.error(`${tag} API Error (${response.status}):`, errorData);
            throw new Error(`Response status ${response.status}`);
        }

        const result = await response.json();
        console.log(`${tag} Loaded ${result.stations?.length || 0} stations`);
        console.log(`${tag} Major: ${result.meta?.major || 0}, Minor: ${result.meta?.minor || 0}`);

        return result.stations || [];
    } catch (error) {
        console.error(`${tag} Error fetching stations:`, error);
        return [];
    }
}
