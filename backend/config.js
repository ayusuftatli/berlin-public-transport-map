export default {
    // Server
    PORT: process.env.PORT || 3000,

    // CORS
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:5500',
        'http://localhost:5000',
        'http://127.0.0.1:5000',
        'http://127.0.0.1:5500'
    ],

    // VBB API
    VBB_BASE_URL: 'https://v6.vbb.transport.rest',
    POLL_INTERVAL_MS: 20000,

    // Bounding boxes
    BOUNDING_BOXES: [
        // Row 1: Polygons 1, 2, 3 (4 is removed)
        { id: '1', north: 52.6755, south: 52.5913, west: 13.0884, east: 13.2566 },
        { id: '2', north: 52.6755, south: 52.5913, west: 13.2566, east: 13.4248 },
        { id: '3', north: 52.6755, south: 52.5913, west: 13.4248, east: 13.5929 },
        // Polygon 4 is REMOVED

        // Row 2: Polygon 5, then 6 is SUBDIVIDED, 7, 8
        { id: '5', north: 52.5913, south: 52.5069, west: 13.0884, east: 13.2566 },
        // Polygon 6 subdivisions:
        { id: '6-1', north: 52.5913, south: 52.5491, west: 13.2566, east: 13.3407 },
        { id: '6-2', north: 52.5913, south: 52.5491, west: 13.3407, east: 13.4248 },
        { id: '6-3', north: 52.5491, south: 52.5069, west: 13.2566, east: 13.3407 },
        { id: '6-4', north: 52.5491, south: 52.5069, west: 13.3407, east: 13.4248 },
        { id: '7', north: 52.5913, south: 52.5069, west: 13.4248, east: 13.5929 },
        { id: '8', north: 52.5913, south: 52.5069, west: 13.5929, east: 13.7611 },

        // Row 3: 9, then 10 is SUBDIVIDED, 11, 12
        { id: '9', north: 52.5069, south: 52.4226, west: 13.0884, east: 13.2566 },
        // Polygon 10 subdivisions:
        { id: '10-1', north: 52.5069, south: 52.4648, west: 13.2566, east: 13.3407 },
        { id: '10-2', north: 52.5069, south: 52.4648, west: 13.3407, east: 13.4248 },
        { id: '10-3', north: 52.4648, south: 52.4226, west: 13.2566, east: 13.3407 },
        { id: '10-4', north: 52.4648, south: 52.4226, west: 13.3407, east: 13.4248 },
        { id: '11', north: 52.5069, south: 52.4226, west: 13.4248, east: 13.5929 },
        { id: '12', north: 52.5069, south: 52.4226, west: 13.5929, east: 13.7611 },

        // Row 4: 13, 14, 15, 16
        { id: '13', north: 52.4226, south: 52.3383, west: 13.0884, east: 13.2566 },
        { id: '14', north: 52.4226, south: 52.3383, west: 13.2566, east: 13.4248 },
        { id: '15', north: 52.4226, south: 52.3383, west: 13.4248, east: 13.5929 },
        { id: '16', north: 52.4226, south: 52.3383, west: 13.5929, east: 13.7611 }
    ]
};