// Load and parse line colors from CSV
export const lineColors = {};

async function loadLineColors() {
    try {
        const response = await fetch('line_color.csv');
        const csvText = await response.text();
        const lines = csvText.split('\n');

        // Skip header line (line 0)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(',');
            if (parts.length >= 3) {
                const name = parts[0].trim();
                const background = parts[1].trim();
                const text = parts[2].trim();

                lineColors[name] = {
                    background: background,
                    text: text
                };
            }
        }
        console.log('Loaded line colors:', Object.keys(lineColors).length, 'entries');
    } catch (error) {
        console.error('Error loading line colors:', error);
    }
}

// Load colors on module initialization
await loadLineColors();

// Helper function to get colors for a line
export function getLineColors(lineName, vehicleType) {
    if (lineColors[lineName]) {
        return lineColors[lineName];
    }

    if (vehicleType === 'tram' && lineColors['Tram']) {
        return lineColors['Tram'];
    }

    if (vehicleType === 'bus' && lineColors['Bus']) {
        return lineColors['Bus'];
    }

    return {
        background: '#666666',
        text: '#ffffff'
    };
}
