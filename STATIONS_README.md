# VBB Stations Implementation

## Overview
VBB public transport stations have been added to your map with zoom-based visibility.

## What Was Implemented

### Backend
- **Package**: `vbb-stations` installed (26,692 total stations)
- **Module**: [`backend/stations.js`](backend/stations.js) - Filters and categorizes stations
- **API Endpoint**: `GET /api/stations` - Returns all stations with major/minor classification
- **Test Script**: [`backend/test-stations.js`](backend/test-stations.js) - Verify station data

### Frontend
- **Module**: [`stations.js`](stations.js) - Fetches station data from backend
- **Map Integration**: [`map.js`](map.js) - Displays stations as square markers
- **UI Control**: [`index.html`](index.html) - Toggle checkbox to show/hide stations
- **Styling**: [`map.css`](map.css) - Station marker and popup styles

## Station Categories

- **Major Stations** (211): Weight ≥ 5000 - Visible at all zoom levels
  - Examples: Hauptbahnhof, Alexanderplatz, Zoologischer Garten
- **Minor Stations** (26,481): Weight < 5000 - Only visible at zoom level ≥ 13
  - Local stops, smaller stations

## Visual Design

- **Marker Shape**: Small filled squares (distinct from circular vehicle markers)
- **Color**: Gold (#FFD700)
- **Size**: 
  - Major stations: 6px
  - Minor stations: 4px
- **Popup**: Shows station name and weight/importance

## How to Use

### Start the Backend
```bash
cd backend
npm start
```

The backend will load all 26,692 stations on startup.

### Test Backend (Optional)
```bash
cd backend
node test-stations.js
```

### View on Map
1. Open [`index.html`](index.html) in your browser
2. Major stations (211) appear immediately
3. Zoom in to level 13+ to see minor stations
4. Click any station to see details
5. Use the "Show Stations" checkbox to toggle visibility

## Configuration

You can adjust these settings in [`map.js`](map.js):

```javascript
const STATION_CONFIG = {
    MINOR_ZOOM_THRESHOLD: 13,  // When to show minor stations
    MAJOR_SIZE: 6,             // Major station marker size
    MINOR_SIZE: 4,             // Minor station marker size
    COLOR: '#FFD700'           // Station marker color
};
```

To change what qualifies as a "major" station, edit [`backend/stations.js`](backend/stations.js):

```javascript
const MAJOR_STATION_WEIGHT = 5000;  // Adjust threshold
```

## API Endpoints

The backend now exposes:
- `GET /api/movements` - Vehicle positions (existing)
- `GET /api/stats` - Cache statistics (existing)
- `GET /api/rate-limit` - Rate limit info (existing)
- **`GET /api/stations`** - All VBB stations (new)
- `GET /health` - Health check (existing)

## Response Format

```json
{
  "stations": [
    {
      "id": "de:12054:900230999",
      "name": "S Potsdam Hauptbahnhof",
      "latitude": 52.391447,
      "longitude": 13.067157,
      "weight": 9881,
      "isMajor": true
    }
  ],
  "meta": {
    "total": 26692,
    "major": 211,
    "minor": 26481,
    "threshold": 5000
  }
}
```

## Performance

- **Data Size**: ~500KB (one-time load)
- **Load Time**: Stations loaded once on page load
- **Rendering**: Dynamic based on zoom level
- **No polling**: Static data, no real-time updates needed

## What It Does

✅ Display all VBB stations as square markers  
✅ Zoom-based visibility (major always, minor when zoomed)  
✅ Click stations to see name and importance  
✅ Toggle stations on/off via UI  
✅ Distinct visual style from vehicle markers  

## What It Doesn't Do

❌ Real-time departure information  
❌ Station-specific route info  
❌ Search/filter by station name  
❌ Different icons for different station types  

These features can be added later if needed.

## Troubleshooting

**Stations not appearing?**
- Ensure backend is running (`npm start` in backend directory)
- Check browser console for fetch errors
- Verify "Show Stations" checkbox is checked
- For minor stations, zoom in to level 13+

**Too many/few major stations?**
- Adjust `MAJOR_STATION_WEIGHT` in [`backend/stations.js`](backend/stations.js)
- Higher value = fewer major stations
- Lower value = more major stations

**Station markers too small/large?**
- Adjust `MAJOR_SIZE` and `MINOR_SIZE` in [`map.js`](map.js)

## Data Source

Stations are from the `vbb-stations` npm package, which contains pre-processed data from VBB GTFS feeds.
