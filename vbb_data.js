


const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'railway link'; //TODO: change this before deployment

export async function getData() {

    const url = `${API_BASE}/api/movements`;
    const tag = '[Backend] '; // what does this do?

    try {
        console.log(`${tag}Fetching from backend...`);

        const response = await fetch(url);

        if (!response.ok) {
            const errorData = await response.text();
            console.error(`${tag}API Error (${response.status}):`, errorData);
            throw new Error(`Response status ${response.status}`);
        }

        const result = await response.json();
        console.log(`${tag}Movements`, result.movements?.legnth || 0);
        console.log(`${tag}Cache age:`, result.meta?.ageMs, 'ms');

        // backend returns pre-processed data
        return result.movements || [];
    } catch (error) {
        console.error(`${tag}Error:`, error.message);
        return [];
    }





}

