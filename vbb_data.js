


import { recordRequest, updateUI } from './rateLimitTracker.js';

export async function getData(bbox, retryCount = 0, maxRetries = 2) {

    const url = `https://v6.vbb.transport.rest/radar?${bbox}`;



    console.log(`[getData] Starting API call (attempt ${retryCount + 1}/${maxRetries + 1}) to:`, url);

    try {
        // Record this request for rate limiting
        const stats = recordRequest();
        updateUI();
        console.log(`[RateLimit] ${stats.count}/${stats.limit} requests in last minute (${stats.percentage}%)`);

        const response = await fetch(url);
        console.log('[getData] Response status:', response.status);


        if (!response.ok) {
            const errorData = await response.text();
            console.error(`[getData] API Error (${response.status}):`, errorData);
            throw new Error(`Response status ${response.status}: ${errorData}`);
        }

        const result = await response.json();
        console.log('[getData] Movements count:', result.movements?.length || 0);

        // Handle case where API returns empty array instead of object
        if (Array.isArray(result) && result.length === 0) {
            console.warn('[getData] WARNING: API returned empty array instead of object. This is an API issue.');

            // Retry with exponential backoff
            if (retryCount < maxRetries) {
                const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s...
                console.warn(`[getData] Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return getData(retryCount + 1, maxRetries);
            }

            console.warn('[getData] Max retries reached. Returning empty array.');
            return [];
        }

        if (!result.movements) {
            console.error('[getData] ERROR: No movements property in response!');
            console.error('[getData] Response structure:', Object.keys(result));

            // Retry for unexpected response structure
            if (retryCount < maxRetries) {
                const delay = Math.pow(2, retryCount) * 1000;
                console.warn(`[getData] Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return getData(retryCount + 1, maxRetries);
            }

            return [];
        }

        if (result.movements.length === 0) {
            console.warn('[getData] WARNING: Movements array is empty');
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

        console.log('[getData] Transformed data count:', data.length);
        console.log('[getData] First item sample:', data[0]);
        console.log('[getData] Returning data array of length:', data.length);

        return data;

    } catch (error) {
        console.error('[getData] CATCH block - error:', error.message);
        console.error('[getData] Full error:', error);
        return [];
    }

}

