// Request counter to track API usage (Rate limit: 100 req/min, burst 200 req/min)
let requestCounter = {
    total: 0,
    lastMinute: [],
    lastReset: Date.now()
};

function updateStatsDisplay(total, lastMinute) {
    const totalEl = document.getElementById('total-requests');
    const minuteEl = document.getElementById('minute-requests');

    if (totalEl) totalEl.textContent = `Total: ${total}`;
    if (minuteEl) {
        minuteEl.textContent = `Last minute: ${lastMinute}/100`;

        // Color code based on usage
        if (lastMinute > 90) {
            minuteEl.style.color = 'red';
            minuteEl.style.fontWeight = 'bold';
        } else if (lastMinute > 70) {
            minuteEl.style.color = 'orange';
        } else {
            minuteEl.style.color = 'green';
        }
    }
}

function trackRequest() {
    const now = Date.now();
    requestCounter.total++;
    requestCounter.lastMinute.push(now);

    // Remove requests older than 1 minute
    requestCounter.lastMinute = requestCounter.lastMinute.filter(time => now - time < 60000);

    // Reset counter every minute for display
    if (now - requestCounter.lastReset > 60000) {
        requestCounter.lastReset = now;
    }

    const requestsThisMinute = requestCounter.lastMinute.length;
    console.log(`[API Counter] Total requests: ${requestCounter.total} | Last minute: ${requestsThisMinute}/100 | Burst limit: 200/min`);

    // Update visual display
    updateStatsDisplay(requestCounter.total, requestsThisMinute);

    if (requestsThisMinute > 80) {
        console.warn(`[API Counter] WARNING: Approaching rate limit (${requestsThisMinute}/100 requests in last minute)`);
    }

    if (requestsThisMinute > 100) {
        console.error(`[API Counter] ERROR: Rate limit exceeded! (${requestsThisMinute}/100 requests in last minute)`);
    }

    return requestsThisMinute;
}

export async function getData(retryCount = 0, maxRetries = 2) {
    const bbox = 'north=52.52411&west=13.41002&south=52.51942&east=13.41709';
    const url = `https://v6.vbb.transport.rest/radar?${bbox}&results=10`;

    // Track this request
    const requestsThisMinute = trackRequest();

    console.log(`[getData] Starting API call (attempt ${retryCount + 1}/${maxRetries + 1}) to:`, url);

    try {
        const response = await fetch(url);
        console.log('[getData] Response status:', response.status);
        console.log('[getData] Response ok:', response.ok);

        if (!response.ok) {
            const errorData = await response.text();
            console.error(`[getData] API Error (${response.status}):`, errorData);
            throw new Error(`Response status ${response.status}: ${errorData}`);
        }

        const result = await response.json();
        console.log('[getData] Raw API result:', result);
        console.log('[getData] Result type:', typeof result);
        console.log('[getData] Is result an array?:', Array.isArray(result));
        console.log('[getData] Movements array exists:', !!result.movements);
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
            longitude: movement.location.longitude
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

