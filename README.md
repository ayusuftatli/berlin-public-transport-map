# Berlin Transit Live Map

Real-time visualization of Berlin's public transportation network (U-Bahn, S-Bahn, Tram, Bus) using the VBB API.

**Data Source:** [v6.vbb.transport.rest](https://v6.vbb.transport.rest/) - REST API for Berlin & Brandenburg public transportation (VBB)

## Tech Stack

**Frontend:**
- Vanilla JavaScript (ES6 modules)
- Leaflet.js for interactive mapping
- Custom filtering and vehicle tracking

**Backend:**
- Node.js with Express
- RESTful API with CORS configuration
- In-memory caching system
- Rate limit monitoring
- Health check endpoints for deployment

## Architecture

**Backend polling service:**
- Queries VBB API every 20 seconds across multiple geographic bounding boxes
- Aggregates and caches vehicle movements in-memory
- Exposes cached data via REST endpoints
- Tracks API rate limits (100 requests/minute)

**Frontend client:**
- Renders vehicle positions on interactive map using Leaflet
- Supports real-time filtering by vehicle type
- Updates markers dynamically without full page refresh
- Uses GeoJSON layers for transit route visualization

## API Endpoints

- `GET /api/movements` - Returns all cached vehicle positions
- `GET /api/stats` - Cache statistics
- `GET /api/rate-limit` - VBB API usage metrics
- `GET /health` - Deployment health status

## Features

- Live tracking of 1000+ vehicles across Berlin
- Color-coded vehicle types with filtering
- Transit route overlays (U-Bahn, S-Bahn, Tram lines)
- Rate limit monitoring and optimization
- Graceful shutdown handling
- Stale cache detection

## Deployment

Frontend and backend deploy independently. Backend supports Railway.app configuration via [`railway.toml`](railway.toml:1). Frontend serves static files via HTTP server.

## Running Locally

**Backend:**
```bash
cd backend
npm install
npm start
```

**Frontend:**
```bash
npm install
npm start
```

Configure backend URL in [`frontend-config.js`](frontend-config.js:1).
