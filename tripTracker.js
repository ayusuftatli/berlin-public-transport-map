/**
 * TripId Tracker - Standalone Node.js script
 * 
 * Tracks ALL VBB tripIds to distinguish between:
 * - False destroys (256 limit caused drop, trip reappears)
 * - True journey completions (trip disappears permanently)
 * 
 * Usage: node tripTracker.js
 * Output: tracking_log.csv
 */

import fs from 'fs';

// ============ CONFIGURATION ============

const FOCUS_TRIP_IDS = [
    '1|76134|28|86|16122025',
    '1|72324|3|86|16122025',
    '1|76166|0|86|16122025'
];

const POLL_INTERVAL = 10000; // 20 seconds
const CSV_FILE = 'tracking_log.csv';

// API parameters (same as vbb_data.js)
const north = 52.6755;
const south = 52.3383;
const west = 13.0884;
const east = 13.7611;

// ============ STATE MANAGEMENT ============

// Track ALL tripIds
// Key: tripId
// Value: { present, firstSeen, lastSeen, destroyCount, reappearCount, data }
const allTrips = new Map();

let pollCount = 0;

// ============ CSV FUNCTIONS ============

function initCSV() {
    const header = 'timestamp,tripId,event,isFocused,totalVehiclesInResponse,destroyCount,reappearCount,name,direction,latitude,longitude\n';

    // Create new file with header (or overwrite existing)
    fs.writeFileSync(CSV_FILE, header);
    console.log(`[Tracker] Initialized CSV file: ${CSV_FILE}`);
}

function appendToCSV(row) {
    const line = [
        row.timestamp,
        `"${row.tripId}"`, // Quote tripId as it contains pipe characters
        row.event,
        row.isFocused,
        row.totalVehicles,
        row.destroyCount,
        row.reappearCount,
        row.name || '',
        `"${row.direction || ''}"`,
        row.latitude || '',
        row.longitude || ''
    ].join(',') + '\n';

    fs.appendFileSync(CSV_FILE, line);
}

// ============ API FUNCTIONS ============

async function fetchVBBData() {
    const bbox = `north=${north}&west=${west}&south=${south}&east=${east}`;
    const url = `https://v6.vbb.transport.rest/radar?${bbox}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`[Tracker] API Error: ${response.status}`);
            return null;
        }

        const result = await response.json();

        if (Array.isArray(result) && result.length === 0) {
            console.warn('[Tracker] API returned empty array');
            return null;
        }

        if (!result.movements) {
            console.error('[Tracker] No movements in response');
            return null;
        }

        return result.movements;

    } catch (error) {
        console.error('[Tracker] Fetch error:', error.message);
        return null;
    }
}

// ============ TRACKING LOGIC ============

function processMovements(movements) {
    const timestamp = new Date().toISOString();
    const totalVehicles = movements.length;

    // Get current tripIds from response
    const currentTripIds = new Set(movements.map(m => m.tripId));

    // Create lookup for movement data
    const movementData = new Map();
    movements.forEach(m => {
        movementData.set(m.tripId, {
            name: m.line?.name || '',
            direction: m.direction || '',
            latitude: m.location?.latitude || '',
            longitude: m.location?.longitude || ''
        });
    });

    const events = [];

    // Check for CREATED and REAPPEARED
    for (const tripId of currentTripIds) {
        const data = movementData.get(tripId);
        const isFocused = FOCUS_TRIP_IDS.includes(tripId);

        if (!allTrips.has(tripId)) {
            // CREATED - first time seeing this tripId
            allTrips.set(tripId, {
                present: true,
                firstSeen: timestamp,
                lastSeen: timestamp,
                destroyCount: 0,
                reappearCount: 0,
                data: data
            });

            events.push({
                timestamp,
                tripId,
                event: 'CREATED',
                isFocused,
                totalVehicles,
                destroyCount: 0,
                reappearCount: 0,
                ...data
            });

        } else {
            const trip = allTrips.get(tripId);

            if (!trip.present) {
                // REAPPEARED - was destroyed, now back!
                trip.reappearCount++;
                trip.present = true;
                trip.lastSeen = timestamp;
                trip.data = data;

                events.push({
                    timestamp,
                    tripId,
                    event: 'REAPPEARED',
                    isFocused,
                    totalVehicles,
                    destroyCount: trip.destroyCount,
                    reappearCount: trip.reappearCount,
                    ...data
                });

            } else {
                // STILL_PRESENT - log for ALL trips
                trip.lastSeen = timestamp;
                trip.data = data;

                events.push({
                    timestamp,
                    tripId,
                    event: 'STILL_PRESENT',
                    isFocused,
                    totalVehicles,
                    destroyCount: trip.destroyCount,
                    reappearCount: trip.reappearCount,
                    ...data
                });
            }
        }
    }

    // Check for DESTROYED
    for (const [tripId, trip] of allTrips) {
        if (trip.present && !currentTripIds.has(tripId)) {
            // DESTROYED - was present, now gone
            trip.destroyCount++;
            trip.present = false;

            const isFocused = FOCUS_TRIP_IDS.includes(tripId);

            events.push({
                timestamp,
                tripId,
                event: 'DESTROYED',
                isFocused,
                totalVehicles,
                destroyCount: trip.destroyCount,
                reappearCount: trip.reappearCount,
                name: '',
                direction: '',
                latitude: '',
                longitude: ''
            });
        }
    }

    return events;
}

// ============ MAIN LOOP ============

async function poll() {
    pollCount++;
    console.log(`\n[Tracker] Poll #${pollCount} at ${new Date().toISOString()}`);

    const movements = await fetchVBBData();

    if (!movements) {
        console.log('[Tracker] No data received, skipping this poll');
        return;
    }

    console.log(`[Tracker] Received ${movements.length} vehicles (limit: 256)`);

    const events = processMovements(movements);

    // Log events to CSV
    events.forEach(event => appendToCSV(event));

    // Console summary
    const created = events.filter(e => e.event === 'CREATED').length;
    const destroyed = events.filter(e => e.event === 'DESTROYED').length;
    const reappeared = events.filter(e => e.event === 'REAPPEARED').length;
    const stillPresent = events.filter(e => e.event === 'STILL_PRESENT').length;

    console.log(`[Tracker] Events: CREATED=${created}, DESTROYED=${destroyed}, REAPPEARED=${reappeared}, STILL_PRESENT=${stillPresent}`);
    console.log(`[Tracker] Total tracked tripIds: ${allTrips.size}`);

    // Report on focused trips
    const focusedStatus = FOCUS_TRIP_IDS.map(id => {
        const trip = allTrips.get(id);
        if (!trip) return `${id}: NOT_SEEN`;
        return `${id}: ${trip.present ? 'PRESENT' : 'ABSENT'} (D:${trip.destroyCount}/R:${trip.reappearCount})`;
    });
    console.log('[Tracker] Focused trips:');
    focusedStatus.forEach(s => console.log(`  - ${s}`));
}

function printSummary() {
    console.log('\n========== TRACKING SUMMARY ==========');
    console.log(`Total polls: ${pollCount}`);
    console.log(`Total unique tripIds tracked: ${allTrips.size}`);

    let totalDestroys = 0;
    let totalReappears = 0;
    let falseDestroys = 0;

    for (const [tripId, trip] of allTrips) {
        totalDestroys += trip.destroyCount;
        totalReappears += trip.reappearCount;
    }

    // False destroys = reappearances (each reappear proves a previous destroy was false)
    falseDestroys = totalReappears;
    const trueEnds = totalDestroys - totalReappears;

    console.log(`\nTotal DESTROYED events: ${totalDestroys}`);
    console.log(`Total REAPPEARED events: ${totalReappears}`);
    console.log(`False destroys (256 limit): ${falseDestroys}`);
    console.log(`True journey ends: ${trueEnds} (estimated - some may reappear later)`);

    console.log('\n--- Focused TripIds Final Status ---');
    FOCUS_TRIP_IDS.forEach(id => {
        const trip = allTrips.get(id);
        if (!trip) {
            console.log(`${id}: Never seen`);
        } else {
            console.log(`${id}:`);
            console.log(`  First seen: ${trip.firstSeen}`);
            console.log(`  Last seen: ${trip.lastSeen}`);
            console.log(`  Currently: ${trip.present ? 'PRESENT' : 'ABSENT'}`);
            console.log(`  Destroy count: ${trip.destroyCount}`);
            console.log(`  Reappear count: ${trip.reappearCount}`);
            if (trip.destroyCount > 0) {
                const falseDestroyRate = ((trip.reappearCount / trip.destroyCount) * 100).toFixed(1);
                console.log(`  False destroy rate: ${falseDestroyRate}%`);
            }
        }
    });

    console.log(`\nCSV saved to: ${CSV_FILE}`);
    console.log('==========================================\n');
}

// ============ STARTUP ============

console.log('========================================');
console.log('   VBB TripId Tracker');
console.log('========================================');
console.log(`Focus tripIds: ${FOCUS_TRIP_IDS.length}`);
console.log(`Poll interval: ${POLL_INTERVAL / 1000}s`);
console.log(`Output file: ${CSV_FILE}`);
console.log('Press Ctrl+C to stop and see summary');
console.log('========================================\n');

// Initialize CSV
initCSV();

// Handle graceful shutdown
process.on('SIGINT', () => {
    printSummary();
    process.exit(0);
});

// Start polling
poll(); // First poll immediately
setInterval(poll, POLL_INTERVAL);
