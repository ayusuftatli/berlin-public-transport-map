// Debugging UI Module - Handles polygon overlays, refresh button, and marker count display

// Berlin boundary coordinates
const north = 52.6755;
const south = 52.3383;
const west = 13.0884;
const east = 13.7611;

const GRID_SIZE = 4;

let polygonGroup = null;
let markerCountDiv = null;

export function initDebuggingUI(map, updateMarkersCallback, markersMap) {
    map.createPane("polygonsPane");
    map.getPane("polygonsPane").style.zIndex = 400;

    polygonGroup = L.featureGroup().addTo(map);

    L.polygon([
        [north, west],
        [north, east],
        [south, east],
        [south, west]
    ], { pane: "polygonsPane" }).addTo(polygonGroup);

    const latStep = (north - south) / GRID_SIZE;
    const lngStep = (east - west) / GRID_SIZE;

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

    // Divide busy polygons into sub-grids
    busyPolyDivider(5, coordinates);
    busyPolyDivider(9, coordinates);


    map.removeLayer(polygonGroup);

    setupPolygonButton(map);

    setupRefreshButton(updateMarkersCallback);

    setupMarkerCount(markersMap, updateMarkersCallback);
}

// original polygons
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

// sub-polgyons
function busyPolyDivider(index, coordinates) {
    const coorObj = coordinates[index];

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


function setupPolygonButton(map) {
    const polygonButton = document.getElementById("polygon-button");
    const polygonButtonSpan = document.getElementById("polygon-button-span");

    if (!polygonButton || !polygonButtonSpan) {
        console.warn('[Debugging UI] Polygon button elements not found');
        return;
    }

    polygonButton.addEventListener("click", () => {
        if (map.hasLayer(polygonGroup)) {
            map.removeLayer(polygonGroup);
            polygonButtonSpan.textContent = "Off";
        } else {
            polygonGroup.addTo(map);
            polygonButtonSpan.textContent = "On";
        }
    });
}

function setupRefreshButton(updateMarkersCallback) {
    const refreshButton = document.getElementById("refresh-button");

    if (!refreshButton) {
        console.warn('[Debugging UI] Refresh button not found');
        return;
    }

    refreshButton.addEventListener("click", updateMarkersCallback);
}

function setupMarkerCount(markersMap, updateMarkersCallback) {
    markerCountDiv = document.getElementById("marker-count");

    if (!markerCountDiv) {
        console.warn('[Debugging UI] Marker count div not found');
        return;
    }

    return function updateMarkerCount() {
        if (markerCountDiv) {
            markerCountDiv.innerHTML = `<p>Marker count is ${markersMap.size}</p>`;
        }
    };
}


export function updateMarkerCount(count) {
    if (markerCountDiv) {
        markerCountDiv.innerHTML = `<p>Marker count is ${count}</p>`;
    }
}
