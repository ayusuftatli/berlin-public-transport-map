# VBB Stations Implementation Plan

## Overview
Add Berlin Brandenburg public transport stations to the map using the `vbb-stations` npm package. Implementation focuses on simplicity with zoom-based visibility for better UX.

## Key Requirements
- ✅ Simple implementation (no overcomplications)
- ✅ Major stations visible at all zoom levels
- ✅ Minor stations only visible when zoomed in
- ✅ Small filled square markers (distinct from circular vehicle markers)
- ✅ Static data (no real-time updates needed)

## Architecture

### Data Flow
```
vbb-stations package (backend)
    ↓
stations.js module (filters & categorizes)
    ↓
GET /api/stations endpoint
    ↓
Frontend stations module
    ↓
Leaflet map with zoom-based filtering
```

## Backend Implementation

### 1. Install Package
```bash
cd backend
npm install vbb-stations
```

### 2. Create [`stations.js`](backend/stations.js) Module

**Purpose**: Filter and categorize stations into major/minor based on weight

```javascript
import stations from 'vbb-stations';

// Weight thresholds
const MAJOR_STATION_WEIGHT = 5000;  // Adjust based on testing

function getAllStations() {
    const all = stations('all');
    
    return all.map(station => ({
        id: station.id,
        name: station.name,
        latitude: station.location.latitude,
        longitude: station.location.longitude,
        weight: station.weight,
        isMajor: station.weight >= MAJOR_STATION_WEIGHT
    }));
}

function getMajorStations() {
    return getAllStations().filter(s => s.isMajor);
}

export default {
    getAllStations,
    getMajorStations
};
```

**Key decisions**:
- Pre-categorize stations as major/minor using weight threshold
- Flatten data structure for easier frontend consumption
- Only include necessary fields (id, name, coords, weight, category)

### 3. Add API Endpoint in [`backend/index.js`](backend/index.js)

```javascript
import stationsModule from './stations.js';

// Add after existing routes
app.get('/api/stations', (req, res) => {
    try {
        const stations = stationsModule.getAllStations();
        
        res.json({
            stations: stations,
            meta: {
                total: stations.length,
                major: stations.filter(s => s.isMajor).length,
                minor: stations.filter(s => !s.isMajor).length
            }
        });
    } catch (error) {
        console.error('[API] /api/stations error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
```

## Frontend Implementation

### 1. Create [`stations.js`](stations.js) Module

**Purpose**: Fetch stations from backend API

```javascript
const API_BASE = 'http://localhost:3000';

export async function getStations() {
    try {
        const response = await fetch(`${API_BASE}/api/stations`);
        const data = await response.json();
        return data.stations || [];
    } catch (error) {
        console.error('Error fetching stations:', error);
        return [];
    }
}
```

### 2. Update [`map.js`](map.js)

**Add after existing imports**:
```javascript
import { getStations } from './stations.js';
```

**Add station layer group** (after line 106 where markersLayer is created):
```javascript
const stationsLayer = L.layerGroup().addTo(map);
```

**Create station marker styling**:
```javascript
// Station marker configuration
const STATION_CONFIG = {
    MAJOR_ZOOM_THRESHOLD: 0,   // Always visible
    MINOR_ZOOM_THRESHOLD: 13,  // Only visible when zoomed in
    MAJOR_SIZE: 6,             // Larger for major stations
    MINOR_SIZE: 4,             // Smaller for minor stations
    COLOR: '#FFD700'           // Gold color (distinct from vehicles)
};

function createStationMarker(station) {
    const size = station.isMajor ? 
        STATION_CONFIG.MAJOR_SIZE : 
        STATION_CONFIG.MINOR_SIZE;
    
    const icon = L.divIcon({
        className: 'station-marker',
        html: `<div style="
            width: ${size}px;
            height: ${size}px;
            background-color: ${STATION_CONFIG.COLOR};
            border: 1px solid #fff;
        "></div>`,
        iconSize: [size, size]
    });
    
    const popup = `
        <div class="station-popup">
            <strong>${station.name}</strong><br>
            <small>Weight: ${station.weight}</small>
        </div>
    `;
    
    return L.marker(
        [station.latitude, station.longitude],
        { icon: icon }
    ).bindPopup(popup);
}
```

**Load and display stations**:
```javascript
let allStations = [];

async function loadStations() {
    allStations = await getStations();
    updateStationVisibility();
}

function updateStationVisibility() {
    stationsLayer.clearLayers();
    
    const currentZoom = map.getZoom();
    
    allStations.forEach(station => {
        const shouldShow = station.isMajor || 
            currentZoom >= STATION_CONFIG.MINOR_ZOOM_THRESHOLD;
        
        if (shouldShow) {
            const marker = createStationMarker(station);
            marker.addTo(stationsLayer);
        }
    });
}

// Update visibility on zoom
map.on('zoomend', updateStationVisibility);

// Initial load
loadStations();
```

### 3. Update [`index.html`](index.html)

Add stations filter to controls section (after line 80, within the filters area):

```html
<fieldset id="stations-filter" class="filter">
    <legend>Stations</legend>
    <div>
        <input type="checkbox" id="show_stations" name="show_stations" value="stations" checked />
        <label for="show_stations">Show Stations</label>
    </div>
</fieldset>
```

**Add filter toggle functionality in [`map.js`](map.js)**:
```javascript
const stationsCheckbox = document.getElementById('show_stations');

stationsCheckbox.addEventListener('change', () => {
    if (stationsCheckbox.checked) {
        stationsLayer.addTo(map);
    } else {
        map.removeLayer(stationsLayer);
    }
});
```

### 4. Add CSS Styling (optional, in [`map.css`](map.css))

```css
.station-marker {
    border: none;
    background: transparent;
}

.station-popup {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

## Zoom Threshold Logic

### How It Works
1. **Major stations** (weight ≥ 5000): Always visible
2. **Minor stations** (weight < 5000): Only visible at zoom ≥ 13
3. Zoom level 13 is approximately "neighborhood level" in Leaflet
4. User can still toggle all stations off via checkbox

### Why This Approach
- Prevents map clutter at city-wide zoom levels
- Major hubs (like Alexanderplatz, Hauptbahnhof) always visible for orientation
- Detailed view when zooming in to specific areas
- Simple to implement and understand

## Testing Strategy

1. **Backend test** (use existing [`backend/test-stations.js`](backend/test-stations.js)):
   ```javascript
   import stationsModule from './stations.js';
   
   const stations = stationsModule.getAllStations();
   console.log(`Total stations: ${stations.length}`);
   console.log(`Major: ${stations.filter(s => s.isMajor).length}`);
   console.log(`Minor: ${stations.filter(s => !s.isMajor).length}`);
   console.log('\nSample major station:', stations.find(s => s.isMajor));
   ```

2. **Frontend test**:
   - Load map and verify major stations appear
   - Zoom in past level 13 and verify minor stations appear
   - Toggle stations checkbox to verify show/hide
   - Test popup display by clicking stations

3. **Weight threshold adjustment**:
   - If too many/few major stations, adjust `MAJOR_STATION_WEIGHT`
   - Test with values: 3000, 5000, 8000, 10000

## Configuration Constants

All magic numbers consolidated for easy tuning:

```javascript
const STATION_CONFIG = {
    MAJOR_STATION_WEIGHT: 5000,    // Backend: categorization threshold
    MAJOR_ZOOM_THRESHOLD: 0,       // Frontend: always show major
    MINOR_ZOOM_THRESHOLD: 13,      // Frontend: zoom level for minor
    MAJOR_SIZE: 6,                 // Visual: major station marker size
    MINOR_SIZE: 4,                 // Visual: minor station marker size
    COLOR: '#FFD700'               // Visual: station marker color (gold)
};
```

## Performance Considerations

### Why This is Efficient
1. **One-time fetch**: Stations loaded once on page load
2. **Static data**: No polling or real-time updates
3. **Client-side filtering**: Zoom-based filtering happens in browser
4. **Minimal payload**: Only essential station data sent
5. **Lazy rendering**: Minor stations only rendered when needed

### Expected Data Size
- ~3000-4000 stations in VBB network
- Each station: ~150 bytes (JSON)
- Total payload: ~500KB (acceptable for one-time load)
- Can add compression if needed

## Implementation Order

1. ✅ Backend installation and module creation
2. ✅ Backend API endpoint
3. ✅ Test backend with test script
4. ✅ Frontend stations module
5. ✅ Frontend map integration
6. ✅ Zoom-based visibility
7. ✅ UI toggle control
8. ✅ Fine-tune weight threshold and zoom levels

## Future Enhancements (Out of Scope)

These are NOT included in the simple implementation:
- ❌ Station search/filtering by name
- ❌ Real-time departure info at stations
- ❌ Route visualization between stations
- ❌ Different icons for different station types (U-Bahn vs S-Bahn)
- ❌ Clustering for very high density areas

## Summary

This plan provides a **simple, clean implementation** of station markers:
- Minimal code changes
- Uses existing patterns from your codebase
- Clear separation of concerns (backend/frontend)
- Zoom-based UX for better map readability
- Easy to understand and maintain

The implementation follows your existing architecture style with separate modules, clear data flow, and consistent UI patterns.
