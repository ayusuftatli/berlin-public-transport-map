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

const markers = {};

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
    console.log('[updateMarkers] Function called at:', new Date().toISOString());

    const myData = await getData();
    console.log('[updateMarkers] Received data from getData():', myData);
    console.log('[updateMarkers] Data type:', typeof myData);
    console.log('[updateMarkers] Is array:', Array.isArray(myData));
    console.log('[updateMarkers] Data length:', myData?.length || 0);

    if (!myData || !Array.isArray(myData)) {
        console.error('[updateMarkers] ERROR: myData is not an array!', myData);
        return;
    }

    if (myData.length === 0) {
        console.warn('[updateMarkers] WARNING: myData array is empty, no markers to update');
        return;
    }

    checkMarkers(myData);

    console.log('[updateMarkers] Processing', myData.length, 'movements');
    myData.forEach((movement, index) => {
        console.log(`[updateMarkers] Processing movement ${index + 1}/${myData.length}:`, movement.tripId);

        if (!markers[movement.tripId]) {
            console.log(`[updateMarkers] Creating new marker for tripId: ${movement.tripId}`);
            markers[movement.tripId] = L.marker([movement.latitude, movement.longitude]).addTo(markersLayer).bindPopup(
                `Name: ${movement.name}<br>
            Direction: ${movement.direction}<br>
            tripId: ${movement.tripId}`
            );
        } else {
            console.log(`[updateMarkers] Updating existing marker for tripId: ${movement.tripId}`);
            animateMarker(markers[movement.tripId], movement.latitude, movement.longitude);
        }
    });

    console.log('[updateMarkers] Finished processing. Total markers:', Object.keys(markers).length);
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



