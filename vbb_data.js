


import { recordRequest, updateUI } from './rateLimitTracker.js';

export async function getData(bbox, polygonId = '?') {

    const url = `https://v6.vbb.transport.rest/radar?${bbox}`;



    const polyTag = `[Polygon ${polygonId}] `;




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





        return result.movements.map(movement => ({
            name: movement.line.name,
            direction: movement.direction,
            tripId: movement.tripId,
            latitude: movement.location.latitude,
            longitude: movement.location.longitude,
            type: movement.line.product
        }));
    } catch (error) {
        console.error(`${polyTag}[getData] CATCH block - error:`, error.message);
        console.error(`${polyTag}[getData] Full error:`, error);
        return [];
    }

}
