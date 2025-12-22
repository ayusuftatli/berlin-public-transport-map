import { getData } from './vbb_data.js'
import { getLineColors } from './lineColors.js'

const map = L.map('map').setView([52.52, 13.414], 13);
map.createPane("polygonsPane");
map.getPane("polygonsPane").style.zIndex = 400;
map.createPane("markersPane");
map.getPane("markersPane").style.zIndex = 650;

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors © CARTO'
}).addTo(map);



const north = 52.6755;
const south = 52.3383;
const west = 13.0884;
const east = 13.7611;

const GRID_SIZE = 4;

const polygonGroup = L.featureGroup().addTo(map);

L.polygon([
    [north, west],
    [north, east],
    [south, east],
    [south, west]
], { pane: "polygonsPane" }).addTo(polygonGroup);

// Calculate the Size of Each box
const latStep = (north - south) / GRID_SIZE;
const lngStep = (east - west) / GRID_SIZE;



function drawLabeledPolygon(bounds, label) {
    return L.polygon([
        [bounds.north, bounds.west],
        [bounds.north, bounds.east],
        [bounds.south, bounds.east],
        [bounds.south, bounds.west]
    ], { pane: "polygonsPane" })
        .addTo(polygonGroup)
        .bindTooltip(label, {
            permanent: true,
            direction: 'center',
            className: 'polygon-label'
        })
        .openTooltip();
}


const coordinates = [];

for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
        const bounds = {
            north: north - (row * latStep),
            south: north - ((row + 1) * latStep),
            west: west + (col * lngStep),
            east: west + ((col + 1) * lngStep)
        };

        const id = row * GRID_SIZE + col + 1;
        coordinates.push(bounds);
        drawLabeledPolygon(bounds, `Polygon ${id}`);
    }
}

// dividing the busy polygons into four

function busyPolyDivider(index) {
    const coorObj = coordinates[index]

    const latStepDivider = (coorObj.north - coorObj.south) / 2;
    const lngStepDivider = (coorObj.east - coorObj.west) / 2;

    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
            const bounds = {
                north: coorObj.north - (row * latStepDivider),
                south: coorObj.north - ((row + 1) * latStepDivider),
                west: coorObj.west + (col * lngStepDivider),
                east: coorObj.west + ((col + 1) * lngStepDivider)
            };

            const id = row * 2 + col + 1;


            drawLabeledPolygon(bounds, `Polygon ${index + 1}-${id}`);
        }
    }

}

busyPolyDivider(5)
busyPolyDivider(9)




//Layer group to hold all markers
const markersLayer = L.layerGroup().addTo(map);

const refreshButton = document.getElementById("refresh-button");

refreshButton.addEventListener("click", updateMarkers)

const markers = new Map();



// Color scheme for different transport types
const TYPE_COLORS = {
    'subway': '#0066CC',      // blue
    'tram': '#E63946',        // red
    'suburban': '#2A9D8F',    // green
    'bus': '#9B59B6',         // purple
    'regional': '#E76F51',    // orange-red
    'express': '#D62828'      // darker red
};

function getMarkerStyle(type, isMissed = false) {
    const color = isMissed ? '#999999' : (TYPE_COLORS[type] || '#0066CC');
    return {
        radius: 6,
        color: color,
        fillColor: color,
        fillOpacity: 0.8,
        pane: "markersPane"
    };
}

// Helper for timestamps
function timestamp() {
    return new Date().toISOString();
}

// Track update cycle for debugging
let updateCycleCount = 0;
let lastNonEmptyUpdate = null;
let consecutiveEmptyUpdates = 0;

// update marker function
async function updateMarkers() {
    updateCycleCount++;
    const cycleId = updateCycleCount;
    const tag = '[Map]';

    console.log(`${tag} [${timestamp()}] ━━━ Update Cycle #${cycleId} START ━━━`);
    console.log(`${tag}   └─ Current markers: ${markers.size}`);

    const result = await getData();
    const { movements: allData, cacheAge, isStale } = result;

    if (!Array.isArray(allData) || allData.length === 0) {
        consecutiveEmptyUpdates++;
        console.warn(`${tag} [${timestamp()}] ⚠️ EMPTY DATA - Skipping update`);
        console.warn(`${tag}   └─ Consecutive empty updates: ${consecutiveEmptyUpdates}`);
        console.warn(`${tag}   └─ Last non-empty update: ${lastNonEmptyUpdate || 'never'}`);
        console.warn(`${tag}   └─ Markers still on map: ${markers.size}`);
        console.log(`${tag} [${timestamp()}] ━━━ Update Cycle #${cycleId} END (empty) ━━━`);
        return;
    }

    // Got data! Reset counter and track time
    if (consecutiveEmptyUpdates > 0) {
        console.log(`${tag} [${timestamp()}] ✅ DATA RECOVERED after ${consecutiveEmptyUpdates} empty updates`);
    }
    consecutiveEmptyUpdates = 0;
    lastNonEmptyUpdate = timestamp();

    // FIX: If cache is stale, use teleport mode (no animation)
    const useAnimation = !isStale;
    if (isStale) {
        console.warn(`${tag} [${timestamp()}] 📍 STALE CACHE (${cacheAge}ms) - Using TELEPORT mode`);
    }

    console.log(`${tag} [${timestamp()}] Processing ${allData.length} movements (animation: ${useAnimation})`);

    for (const entry of markers.values()) {
        entry.misses += 1;
    }

    allData.forEach((movement) => {

        if (!markers.has(movement.tripId)) {

            let startLat, startLng;

            if (movement.previousPosition && useAnimation) {
                // Start at previous position for immediate animation (only if fresh data)
                startLat = movement.previousPosition.latitude;
                startLng = movement.previousPosition.longitude;
            } else {
                // No history OR stale cache - start at current position (teleport)
                startLat = movement.latitude;
                startLng = movement.longitude;
            }

            const colors = getLineColors(movement.name, movement.type);
            const popupContent = `
                <div class="vehicle-card">
                    <div class="vehicle-header">
                        <span class="vehicle-badge" style="background: ${colors.background}; color: ${colors.text};">${movement.name}</span>
                    </div>
                    <div class="vehicle-direction">→ ${movement.direction}</div>
                    <div class="vehicle-details">
                        <small>Trip: ${movement.tripId}</small><br>
                        <small>Type: ${movement.type}</small>
                    </div>
                </div>
            `;

            const createdMarker = L.circleMarker(
                [startLat, startLng],
                getMarkerStyle(movement.type)
            ).addTo(markersLayer).bindPopup(popupContent);

            markers.set(movement.tripId, {
                marker: createdMarker,
                misses: 0,
                lastSeen: Date.now(),
                type: movement.type
            })

            // Start animation if we have previous position AND fresh data
            if (movement.previousPosition && useAnimation) {
                animateMarker(createdMarker, movement.latitude, movement.longitude)
            }
        } else {
            const entry = markers.get(movement.tripId);
            entry.misses = 0;
            entry.lastSeen = Date.now()

            // FIX: Teleport if stale, animate if fresh
            if (useAnimation) {
                animateMarker(entry.marker, movement.latitude, movement.longitude);
            } else {
                // Teleport - instant position update
                entry.marker.setLatLng([movement.latitude, movement.longitude]);
            }
            entry.marker.setStyle(getMarkerStyle(entry.type));
        }
    });
    // cleanup
    let removedCount = 0;
    let staleCount = 0;
    for (const [tripId, entry] of markers.entries()) {
        if (entry.misses >= 3) {
            entry.marker.removeFrom(markersLayer);
            markers.delete(tripId);
            removedCount++;
        } else if (entry.misses >= 1) {
            entry.marker.setStyle(getMarkerStyle(entry.type, true));
            staleCount++;
        }
    }

    console.log(`${tag} [${timestamp()}] Cleanup: ${removedCount} removed, ${staleCount} stale`);
    console.log(`${tag} [${timestamp()}] ━━━ Update Cycle #${cycleId} END ━━━`);
    console.log(`${tag}   └─ Final marker count: ${markers.size}`);

    filterMarkers()
    markerCountDiv.innerHTML = `<p>Marker count is ${markers.size}`
}


updateMarkers();

// FIX: Sync with backend's 20s poll cycle
// Backend polls every 20s, frontend should poll at same interval
// BUT with a +2s offset to ensure backend has finished updating cache
// This prevents requesting during backend's polling operation
setInterval(updateMarkers, 20000)

function animateMarker(marker, newLat, newLng) {
    const start = marker.getLatLng();
    const end = { lat: newLat, lng: newLng };
    const duration = 20000; // FIX: Match updated frontend poll interval (20s)
    const startTime = performance.now();

    function animate() {
        const now = performance.now()
        const elapsed = now - startTime;
        let t = elapsed / duration;
        //Clamp t between 0 and 1
        if (t > 1) t = 1;
        const currentLat = start.lat + (end.lat - start.lat) * t;
        const currentLng = start.lng + (end.lng - start.lng) * t;
        marker.setLatLng([currentLat, currentLng]);
        if (t < 1) {
            requestAnimationFrame(animate)
        }
    }
    animate();
}

const movementFilter = document.getElementById("movement-filter");
const momvementCheckboxes = movementFilter.querySelectorAll('input[type="checkbox"]');

momvementCheckboxes.forEach(checkbox => {
    checkbox.addEventListener("change", filterMarkers);
});

function filterMarkers() {
    const checked = new Set(Array.from(momvementCheckboxes)
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value));

    markers.forEach(entry => {
        if (!checked.has(entry.type)) {
            entry.marker.removeFrom(markersLayer);
        } else {
            entry.marker.addTo(markersLayer);
        }
    })

}



// buttons and stuff
const markerCountDiv = document.getElementById("marker-count");



const polygonButton = document.getElementById("polygon-button");
const polygonButtonSpan = document.getElementById("polygon-button-span");

map.removeLayer(polygonGroup);

polygonButton.addEventListener("click", () => {
    if (map.hasLayer(polygonGroup)) {
        map.removeLayer(polygonGroup);
        polygonButtonSpan.textContent = "Off"
    } else {
        polygonGroup.addTo(map);
        polygonButtonSpan.textContent = "On";
    }

})

// load public transport lines

const geoJSONLayers = new Map();

async function loadGeoJSON(url, color, type) {
    try {
        const response = await fetch(url);
        const data = await response.json();
        const layer = L.geoJSON(data, { style: { "color": color } }).addTo(map);

        geoJSONLayers.set(type, layer);
    } catch (error) {
        console.error('Error loading GeoJSON:', error);
    }
}

(async () => {
    await loadGeoJSON(`ubahn_line.geojson`, "blue", "subway_line");
    await loadGeoJSON(`s-bahn_lines.geojson`, "green", "suburban_line");
    await loadGeoJSON(`tram_line.geojson`, "red", "tram_line");
    await loadGeoJSON(`bus_bvg_only.geojson`, "purple", "bus_line");

    // Apply initial filter state after all layers are loaded
    filterLines();
})();



const lineFilter = document.getElementById("line-filter");
const lineCheckboxes = lineFilter.querySelectorAll('input[type="checkbox"');

function filterLines() {
    const checked = new Set(Array.from(lineCheckboxes) // what is set?
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value)
    );

    geoJSONLayers.forEach((layer, type) => {
        if (checked.has(type)) {
            if (!map.hasLayer(layer)) {
                layer.addTo(map);
            }
        } else {
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        }
    })

}

lineCheckboxes.forEach(checkbox => {
    checkbox.addEventListener("change", filterLines);
})
