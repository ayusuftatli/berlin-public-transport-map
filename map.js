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

const polygon = L.polygon([
    [north, west],
    [north, east],
    [south, east],
    [south, west]
]).addTo(map);

//Feature Group to store drawings

//Layer group to hold all markers
const markersLayer = L.layerGroup().addTo(map);

const refreshButton = document.getElementById("refresh-button");

refreshButton.addEventListener("click", updateMarkers)

const markers = new Map();

function checkMarkers(data) {

    const tripIds = data.map(item => item.tripId)

    const markerKeys = Object.keys(markers);
    markerKeys.forEach(markerKey => {
        if (!tripIds.some(tripId => tripId === markerKey)) {
            markers[markerKey].removeFrom(markersLayer)
            delete markers[markerKey]

        }
    })

}

async function updateMarkers() {

    const myData = await getData();


    if (!myData || !Array.isArray(myData)) {
        return;
    }

    if (myData.length === 0) {
        return;
    }

    for (const entry of markers.values()) {
        entry.misses += 1;
    }

    myData.forEach((movement, index) => {

        if (!markers.has(movement.tripId)) {
            const createdMarker = L.circleMarker([movement.latitude, movement.longitude],
                {
                    radius: 6,
                    color: "blue",
                    fillColor: "blue",
                    fillOpacity: 0.8
                }
            ).addTo(markersLayer).bindPopup(
                `Name: ${movement.name}<br>
            Direction: ${movement.direction}<br>
            tripId: ${movement.tripId}`
            );

            markers.set(movement.tripId, {
                marker: createdMarker,
                misses: 0,
                lastSeen: Date.now()
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
        if (entry.misses >= 3) {
            entry.marker.removeFrom(markersLayer);
            markers.delete(tripId);
        } else if (entry.misses >= 1) {
            entry.marker.setStyle({
                color: "red",
                fillColor: "red",
                radius: 6,
                fillOpacity: 0.8
            })
        }
    }
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



