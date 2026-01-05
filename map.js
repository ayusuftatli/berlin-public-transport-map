import { getData } from './vbb_data.js'
import { getLineColors } from './lineColors.js'
import { initDebuggingUI, updateMarkerCount } from './debugging_ui.js'

const map = L.map('map').setView([52.52, 13.414], 13);
map.createPane("markersPane");
map.getPane("markersPane").style.zIndex = 650;

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: 'OpenStreetMap contributors | CARTO | derhuerst | VBB'
}).addTo(map);

//Layer group to hold all markers
const markersLayer = L.layerGroup().addTo(map);

const markers = new Map();



// Color scheme for different transport types
const TYPE_COLORS = {
    'subway': '#0066CC',
    'tram': '#E63946',
    'suburban': '#2A9D8F',
    'bus': '#9B59B6',
    'regional': '#E76F51',
    'express': '#D62828'
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

    console.log(`[Map] ${timestamp()} Cycle ${cycleId} start`);
    console.log(`[Map] Markers: ${markers.size}`);

    const result = await getData();
    const { movements: allData, cacheAge, isStale } = result;

    if (!Array.isArray(allData) || allData.length === 0) {
        consecutiveEmptyUpdates++;
        console.warn(`${tag} [${timestamp()}] EMPTY DATA - Skipping update`);
        console.log(`${tag} [${timestamp()}] ━━━ Update Cycle #${cycleId} END (empty) ━━━`);
        return;
    }

    // If data, reset counter and track time
    if (consecutiveEmptyUpdates > 0) {
        console.log(`${tag} [${timestamp()}] DATA RECOVERED after ${consecutiveEmptyUpdates} empty updates`);
    }
    consecutiveEmptyUpdates = 0;
    lastNonEmptyUpdate = timestamp();

    // If cache is stale (>40s, missed 2+ backend polls), use teleport mode (no animation)
    const useAnimation = !isStale;
    if (isStale) {
        console.warn(`${tag} [${timestamp()}] 📍 SEVERELY STALE CACHE (${cacheAge}ms > 40s) - Using TELEPORT mode`);
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

            // Add click handler for route selection
            createdMarker.on('click', function (e) {
                L.DomEvent.stopPropagation(e);
                selectRouteByRef(movement.name);
            });

            markers.set(movement.tripId, {
                marker: createdMarker,
                misses: 0,
                lastSeen: Date.now(),
                type: movement.type,
                lineName: movement.name
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
    updateMarkerCount(markers.size);
}


// Initialize debugging UI (polygons, refresh button, marker count)
initDebuggingUI(map, updateMarkers, markers);

updateMarkers();


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

// load public transport lines

const geoJSONLayers = new Map();
const routeFeatures = new Map(); // Store individual route features by ref
let selectedRoute = null; // Track currently selected route

async function loadGeoJSON(url, color, type) {
    try {
        const response = await fetch(url);
        const data = await response.json();
        const layer = L.geoJSON(data, {
            style: { "color": color },
            onEachFeature: function (feature, layer) {
                // Store each route feature by its ref property
                if (feature.properties && feature.properties.ref) {
                    const ref = feature.properties.ref;
                    console.log(`[DEBUG] Loading route feature with ref: "${ref}" from type: ${type}`);
                    if (!routeFeatures.has(ref)) {
                        routeFeatures.set(ref, []);
                    }
                    routeFeatures.get(ref).push({
                        layer: layer,
                        defaultColor: color,
                        type: type
                    });
                } else {
                    console.warn(`[DEBUG] Feature missing ref property in ${type}:`, feature.properties);
                }
            }
        }).addTo(map);

        geoJSONLayers.set(type, layer);
    } catch (error) {
        console.error('Error loading GeoJSON:', error);
    }
}

// Function to select a route by ref and dim others
function selectRouteByRef(ref) {
    if (!ref) {
        console.warn('[DEBUG] No ref provided for route selection');
        return;
    }

    console.log(`[DEBUG] selectRouteByRef called with: "${ref}"`);
    console.log(`[DEBUG] Available routes:`, Array.from(routeFeatures.keys()));
    console.log(`[DEBUG] Route exists in map:`, routeFeatures.has(ref));

    // If clicking the same route, deselect it
    if (selectedRoute === ref) {
        resetRouteSelection();
        return;
    }

    selectedRoute = ref;
    console.log(`[Route Selection] Selected route: ${ref}`);

    // Dim all routes
    routeFeatures.forEach((features, routeRef) => {
        features.forEach(featureData => {
            if (routeRef === ref) {
                // Highlight selected route
                featureData.layer.setStyle({
                    color: featureData.defaultColor,
                    opacity: 1,
                    weight: 5
                });
            } else {
                // Dim other routes
                featureData.layer.setStyle({
                    color: '#555555',
                    opacity: 0.2,
                    weight: 2
                });
            }
        });
    });
}

// Function to reset route selection 
function resetRouteSelection() {
    selectedRoute = null;

    // Restore all routes to their default colors
    routeFeatures.forEach((features) => {
        features.forEach(featureData => {
            featureData.layer.setStyle({
                color: featureData.defaultColor,
                opacity: 1,
                weight: 3
            });
        });
    });
}

// Add map click handler to deselect routes when clicking empty space
map.on('click', function (e) {
    // Only reset if there's a selected route and the click wasn't on a marker
    if (selectedRoute && !e.originalEvent.defaultPrevented) {
        resetRouteSelection();
    }
});

(async () => {
    await loadGeoJSON(`lines/ubahn_line.geojson`, "blue", "subway_line");
    await loadGeoJSON(`lines/s-bahn_lines.geojson`, "green", "suburban_line");
    await loadGeoJSON(`lines/tram_line.geojson`, "red", "tram_line");
    await loadGeoJSON(`lines/bus_bvg_only.geojson`, "purple", "bus_line");

    // Apply initial filter state after all layers are loaded
    filterLines();
})();



const lineFilter = document.getElementById("line-filter");
const lineCheckboxes = lineFilter.querySelectorAll('input[type="checkbox"');

function filterLines() {
    const checked = Array.from(lineCheckboxes)
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value)
        ;

    geoJSONLayers.forEach((layer, type) => {
        if (checked.includes(type)) {
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
