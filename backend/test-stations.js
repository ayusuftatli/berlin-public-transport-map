import stationsModule from './stations.js';

console.log('Testing VBB Stations Module...\n');

// Get all stations
const allStations = stationsModule.getAllStations();
console.log(`✓ Total stations loaded: ${allStations.length}`);

// Get stats
const stats = stationsModule.getStats();
console.log(`✓ Major stations (weight ≥ ${stats.threshold}): ${stats.major}`);
console.log(`✓ Minor stations: ${stats.minor}`);

// Show sample major station
const majorStation = allStations.find(s => s.isMajor);
if (majorStation) {
    console.log('\nSample major station:');
    console.log(JSON.stringify(majorStation, null, 2));
}

// Show sample minor station
const minorStation = allStations.find(s => !s.isMajor);
if (minorStation) {
    console.log('\nSample minor station:');
    console.log(JSON.stringify(minorStation, null, 2));
}

console.log('\n✓ Test completed successfully!');
