/**
 * Rate Limit UI - Frontend display of backend VBB API rate limit stats
 */

// Check if running locally (supports both localhost and 127.0.0.1)
const isLocal = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '';

const API_BASE = isLocal
    ? 'http://localhost:3000'
    : 'railway link'; //TODO: change this before deployment

/**
 * Fetch rate limit stats from backend
 */
async function fetchRateLimitStats() {
    try {
        const response = await fetch(`${API_BASE}/api/rate-limit`);

        if (!response.ok) {
            console.error('[RateLimit] Failed to fetch stats:', response.status);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('[RateLimit] Error fetching stats:', error.message);
        return null;
    }
}

/**
 * Update the UI with current rate limit stats
 */
async function updateUI() {
    const stats = await fetchRateLimitStats();

    if (!stats) {
        return;
    }

    const countElement = document.getElementById('rate-count');
    const cardElement = document.getElementById('rate-limit-card');

    if (countElement) {
        countElement.textContent = `${stats.count}/${stats.limit}`;
    }

    if (cardElement) {
        // Update card styling based on usage
        cardElement.classList.remove('warning', 'critical');
        if (stats.isCritical) {
            cardElement.classList.add('critical');
        } else if (stats.isWarning) {
            cardElement.classList.add('warning');
        }
    }
}

// Auto-update UI every second
setInterval(updateUI, 1000);

// Initial update
updateUI();

export { updateUI };
