


import { recordRequest, updateUI } from './rateLimitTracker.js';

export async function getData(bbox, polygonId = '?', retryCount = 0, maxRetries = 2) {

    const url = `https://v6.vbb.transport.rest/radar?${bbox}`;



    const polyTag = `[Polygon ${polygonId}] `;
    console.log(`${polyTag}[getData] Starting API call (attempt ${retryCount + 1}/${maxRetries + 1}) to:`, url);

    try {
        // Record this request for rate limiting
        const stats = recordRequest();
        updateUI();
        console.log(`${polyTag}[RateLimit] ${stats.count}/${stats.limit} requests in last minute (${stats.percentage}%)`);

        const response = await fetch(url);


        if (!response.ok) {
            const errorData = await response.text();
            console.error(`${polyTag}[getData] API Error (${response.status}):`, errorData);
            throw new Error(`Response status ${response.status}: ${errorData}`);
        }

        const result = await response.json();
        console.log(`${polyTag}[getData] Movements count:`, result.movements?.length || 0);

        // Handle case where API returns empty array instead of object
        if (Array.isArray(result) && result.length === 0) {
            console.warn(`${polyTag}[getData] WARNING: API returned empty array instead of object. This is an API issue.`);

            // Retry with exponential backoff
            if (retryCount < maxRetries) {
                const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s...
                console.warn(`${polyTag}[getData] Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                // FIX: preserve bbox argument when retrying
                return getData(bbox, polygonId, retryCount + 1, maxRetries);
            }

            console.warn(`${polyTag}[getData] Max retries reached. Returning empty array.`);
            return [];
        }

        if (!result.movements) {
            console.error(`${polyTag}[getData] ERROR: No movements property in response!`);
            console.error(`${polyTag}[getData] Response structure:`, Object.keys(result));

            // Retry for unexpected response structure
            if (retryCount < maxRetries) {
                const delay = Math.pow(2, retryCount) * 1000;
                console.warn(`${polyTag}[getData] Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                // FIX: preserve bbox argument when retrying
                return getData(bbox, polygonId, retryCount + 1, maxRetries);
            }

            return [];
        }

        if (result.movements.length === 0) {
            console.warn(`${polyTag}[getData] WARNING: Movements array is empty`);
            return [];
        }

        const data = result.movements.map(movement => ({
            name: movement.line.name,
            direction: movement.direction,
            tripId: movement.tripId,
            latitude: movement.location.latitude,
            longitude: movement.location.longitude,
            type: movement.line.product
        }));



        return data;

    } catch (error) {
        console.error(`${polyTag}[getData] CATCH block - error:`, error.message);
        console.error(`${polyTag}[getData] Full error:`, error);
        return [];
    }

}
