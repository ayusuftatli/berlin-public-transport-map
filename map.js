import { getData } from './vbb_data.js'

const map = L.map('map').setView([52.52, 13.414], 11);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);



const north = 52.6755;
const south = 52.3383;
const west = 13.0884;
const east = 13.7611;

const GRID_SIZE = 4;

L.polygon([
    [north, west],
    [north, east],
    [south, east],
    [south, west]
]).addTo(map);

// Calculate the Size of Each box
const latStep = (north - south) / GRID_SIZE;
const lngStep = (east - west) / GRID_SIZE;

function buildBBox({ north, west, south, east }) {
    return `north=${north}&west=${west}&south=${south}&east=${east}`;
}

function drawLabeledPolygon(bounds, label) {
    return L.polygon([
        [bounds.north, bounds.west],
        [bounds.north, bounds.east],
        [bounds.south, bounds.east],
        [bounds.south, bounds.west]
    ])
        .addTo(map)
        .bindTooltip(label, {
            permanent: true,
            direction: 'center',
            className: 'polygon-label'
        })
        .openTooltip();
}

// Array items: { bbox: string, polygonId: string }
const boxes = [];
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
        boxes.push({ bbox: buildBBox(bounds), polygonId: String(id) });
        drawLabeledPolygon(bounds, `Polygon ${id}`);
    }
}

// dividing the busy polygons into four

function busyPolyDivider(index) {
    const coorObj = coordinates[index]

    const originalPolygonId = String(index + 1);
    const originalIdx = boxes.findIndex((b) => b.polygonId === originalPolygonId);
    if (originalIdx !== -1) {
        boxes.splice(originalIdx, 1);
    }


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

            boxes.push({
                bbox: buildBBox(bounds),
                polygonId: `${index + 1}-${id}`
            });
            drawLabeledPolygon(bounds, `Polygon ${index + 1}-${id}`);
        }
    }
    return boxes;
}

busyPolyDivider(5)
busyPolyDivider(9)
// Remove Polygon 4 by id (indexes shift after splits)
{
    const idx = boxes.findIndex((b) => b.polygonId === '4');
    if (idx !== -1) boxes.splice(idx, 1);
}




//Layer group to hold all markers
const markersLayer = L.layerGroup().addTo(map);

const refreshButton = document.getElementById("refresh-button");

refreshButton.addEventListener("click", updateMarkers)

const markers = new Map();

const MARKER_STYLE_DEFAULT = {
    radius: 6,
    color: 'blue',
    fillColor: 'blue',
    fillOpacity: 0.8
};

const MARKER_STYLE_MISSED = {
    radius: 6,
    color: 'red',
    fillColor: 'red',
    fillOpacity: 0.8
};

// update marker function
async function updateMarkers() {

    const results = await Promise.all(
        boxes.map(({ bbox, polygonId }) => getData(bbox, polygonId))
    );

    const allData = results.flat();

    if (!Array.isArray(allData) || allData.length === 0) {
        return;
    }

    for (const entry of markers.values()) {
        entry.misses += 1;
    }

    allData.forEach((movement) => {

        if (!markers.has(movement.tripId)) {
            const createdMarker = L.circleMarker(
                [movement.latitude, movement.longitude],
                MARKER_STYLE_DEFAULT
            ).addTo(markersLayer).bindPopup(
                `Name: ${movement.name}<br>
            Direction: ${movement.direction}<br>
            tripId: ${movement.tripId}<br>
            type: ${movement.type}`
            );

            markers.set(movement.tripId, {
                marker: createdMarker,
                misses: 0,
                lastSeen: Date.now(),
                type: movement.type
            })
        } else {
            const entry = markers.get(movement.tripId);
            entry.misses = 0;
            entry.lastSeen = Date.now()
            animateMarker(entry.marker, movement.latitude, movement.longitude);
        }
    });
    // cleanup
    for (const [tripId, entry] of markers.entries()) {
        if (entry.misses >= 6) {
            entry.marker.removeFrom(markersLayer);
            markers.delete(tripId);
        } else if (entry.misses >= 1) {
            entry.marker.setStyle(MARKER_STYLE_MISSED)
        }
    }
    filterMarkers()
    markerCountDiv.innerHTML = `<p>Marker count is ${markers.size}`
}


updateMarkers();

setInterval(updateMarkers, 20000)

function animateMarker(marker, newLat, newLng) {
    const start = marker.getLatLng();
    const end = { lat: newLat, lng: newLng };
    const duration = 20000;
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

const checkboxes = document.querySelectorAll('input[type="checkbox"]');

checkboxes.forEach(checkbox => {
    checkbox.addEventListener("change", filterMarkers);
});

function filterMarkers() {
    const checked = new Set(Array.from(checkboxes)
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

const markerCountDiv = document.getElementById("marker-count")
