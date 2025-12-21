import cache from './cache.js';
import poller from './vbbPoller.js';

// Should be empty initially
console.log('Initial:', cache.getStats());

// Add some test data
cache.update([
    { tripId: '1', name: 'U2', direction: 'Pankow', latitude: 52.52, longitude: 13.41, type: 'subway' },
    { tripId: '2', name: 'S1', direction: 'Wannsee', latitude: 52.50, longitude: 13.38, type: 'suburban' }
]);

// Should show 2 movements
console.log('After update:', cache.getStats());
console.log('Movements:', cache.getAll());




// Start polling
poller.start();

// After 5 seconds, check the cache
setTimeout(() => {
    console.log('Cache stats:', cache.getStats());
    console.log('Sample movement:', cache.getAll()[0]);
    poller.stop();
    process.exit(0);
}, 5000);