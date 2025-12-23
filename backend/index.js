import express from 'express';
import cors from 'cors';
import cache from './cache.js';
import poller from './vbbPoller.js';
import config from './config.js';
import * as rateLimitTracker from './rateLimitTracker.js';

const app = express();
const PORT = config.PORT;

//cors

const ALLOWED_ORIGINS = config.ALLOWED_ORIGINS;

const corsOptions = {
    origin: function (origin, callback) {
        // allow requests with no origin 
        if (!origin) return callback(null, true);

        if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionSuccessStatus: 200
}

app.use(cors(corsOptions));
app.use(express.json());

// Request logging middleware
const SILENT_PATHS = ['/api/rate-limit', '/health'];

app.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        // Skip logging for silent paths
        if (SILENT_PATHS.includes(req.path)) {
            return;
        }

        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
    });

    next();
});

// Return all currently cached vehicle movements
app.get('/api/movements', (req, res) => {
    try {
        const movements = cache.getAll();
        const stats = cache.getStats();

        res.json({
            movements: movements,
            meta: {
                count: stats.count,
                lastUpdated: stats.lastUpdated,
                ageMs: stats.ageMs,
                isHealthy: stats.isHealthy
            }
        })
    } catch (error) {
        console.error('[API] /api/movements error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }

});

// return cache statistics without movement data

app.get('/api/stats', (req, res) => {
    try {
        const stats = cache.getStats();
        res.json(stats);

        console.log(`[API] /api/stats - Cache has ${stats.count} movements, age: ${stats.ageMs}`)
    } catch (error) {
        console.error('[API] /api/stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// return VBB API rate limit statistics
app.get('/api/rate-limit', (req, res) => {
    try {
        const stats = rateLimitTracker.getStats();
        res.json(stats);
    } catch (error) {
        console.error('[API] /api/rate-limit error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// deployment health check

app.get('/health', (req, res) => {
    const stats = cache.getStats();

    const health = {
        status: stats.isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        cache: {
            count: stats.count,
            agemMs: stats.ageMs,
            isHealthy: stats.isHeathy
        }
    }

    // Return 503 if cache is stale

    const statusCode = stats.isHealthy ? 200 : 503;
    res.status(statusCode).json(health);

    if (!stats.isHealthy) {
        console.warn('[Health] Cache unhealthy, returning 503');
    }
});

// starting poller
poller.start();

// Start express server
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('VBB Poller active');
    console.log(`CORS allowed origins:`)
    ALLOWED_ORIGINS.forEach(origin => {
        console.log(`│     - ${origin.padEnd(33)}│`)
    })
    console.log(``);
    console.log('API Endpoints');
    console.log(` GET http://localhost:${PORT}/api/movements`);
    console.log(` GET http://localhost:${PORT}/api/stats`);
    console.log(` GET http://localhost:${PORT}/api/rate-limit`);
    console.log(` GET http://localhost:${PORT}/health`)

});

// graceful shutdown handler

function shutdown() {
    console.log('\n[Shutdown] Received shutdown signal');

    // Force shutdown after 10 seconds if graceful shutdown hangs
    const forceTimeout = setTimeout(() => {
        console.error('[Shutdown] Forced shutdown after timeout');
        process.exit(1);
    }, 10000);

    console.log('[Shutdown] Stopping VBB poller...');
    poller.stop();

    console.log('[Shutdown] Closing Express server...');
    server.close(() => {
        clearTimeout(forceTimeout);  // Cancel force shutdown
        console.log('[Shutdown] Server closed.');
        process.exit(0);
    });
}


process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);


