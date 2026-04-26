// marker-placer.js

let _markerData = null;

function getCurrentSceneName() {
    // Get the current scene name from the dropdown
    const dropdown = document.getElementById('sceneSelect');
    if (!dropdown) return null;
    const selectedOption = dropdown.options[dropdown.selectedIndex];
    return selectedOption ? selectedOption.textContent : null;
}


// Fellowship characters
const FELLOWSHIP = [
    'Frodo', 'Sam', 'Pippin', 'Merry', 'Aragorn', 'Strider', 'Boromir',
    'Gandalf', 'Gimli', 'Legolas'
];

// Get the starting position for each character in a given scene
function getFellowshipStartPositionsForScene(sceneName) {
    if (!_markerData || !sceneName) return [];
    const seen = new Set();
    const starts = [];
    for (const d of _markerData) {
        let charName = d.character;
        if (charName === 'Strider') charName = 'Aragorn';
        if (FELLOWSHIP.includes(d.character) && d.scene_name === sceneName && !seen.has(charName)) {
            starts.push({ ...d, character: charName });
            seen.add(charName);
        }
    }
    return starts;
}

function showCharacterMarkersAtPositions(positions, svgSelector = 'svg') {
    const svg = d3.select(svgSelector);
    if (svg.empty()) return;
    svg.selectAll('.character-marker').remove();

    // Group by (cx, cy) to find overlapping markers
    const grouped = {};
    positions.forEach(d => {
        const key = `${d.cx},${d.cy}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(d);
    });

    // Flatten with offset
    const offsetMarkers = [];
    Object.values(grouped).forEach(group => {
        if (group.length === 1) {
            offsetMarkers.push({ ...group[0], offsetX: 0, offsetY: 0 });
        } else {
            const angleStep = (2 * Math.PI) / group.length;
            group.forEach((d, i) => {
                const angle = i * angleStep;
                const offsetX = Math.round(Math.cos(angle) * 24);
                const offsetY = Math.round(Math.sin(angle) * 24);
                offsetMarkers.push({ ...d, offsetX, offsetY });
            });
        }
    });

    svg.selectAll('.character-marker')
        .data(offsetMarkers)
        .enter()
        .append('image')
        .attr('class', 'character-marker')
        .attr('x', d => d.cx - 16 + d.offsetX)
        .attr('y', d => d.cy - 16 + d.offsetY)
        .attr('width', 32)
        .attr('height', 32)
        .attr("xlink:href", d => {
            const imgName = (d.character === 'Strider') ? 'Aragorn' : d.character;
            return `${'data/images/'}${imgName}-modified.png`;
        })
        .attr('data-character', d => d.character)
        .append('title')
        .text(d => `${d.character}`);
}

// Show only the starting position for each character in the selected scene
function showFellowshipStartPositionsForCurrentScene(svgSelector = 'svg') {
    const sceneName = getCurrentSceneName();
    const starts = getFellowshipStartPositionsForScene(sceneName);
    showCharacterMarkersAtPositions(starts, svgSelector);
}

function placeMarkersOnMap(svgSelector = 'svg') {
    d3.csv('data/data.csv').then(data => {
        // Data format: scene_name,character,dialogue,dialogue_cleaned,location
        // location is either empty or 'cx cy' (e.g., '692.4 279')
        _markerData = data
            .filter(d => d.location && d.location.trim() !== '')
            .map(d => {
                const [cx, cy] = d.location.split(/\s+/).map(Number);
                return {
                    ...d,
                    cx,
                    cy
                };
            })
            .filter(d => !isNaN(d.cx) && !isNaN(d.cy));

        updateMarkersForCurrentScene(svgSelector);

        // Listen for scene changes
        const slider = document.getElementById('timelineSlider');
        const dropdown = document.getElementById('sceneSelect');
        if (slider) {
            slider.addEventListener('input', () => updateMarkersForCurrentScene(svgSelector));
        }
        if (dropdown) {
            dropdown.addEventListener('change', () => updateMarkersForCurrentScene(svgSelector));
        }
    }).catch(err => {
        console.error('Error loading marker data:', err);
    });
}

// Optionally, call automatically if SVG is present
if (document.readyState !== 'loading') {
    placeMarkersOnMap();
    setTimeout(() => showFellowshipStartPositionsForCurrentScene(), 500);
} else {
    document.addEventListener('DOMContentLoaded', () => {
        placeMarkersOnMap();
        setTimeout(() => showFellowshipStartPositionsForCurrentScene(), 500);
    });
}

// Listen for scene changes to update markers
document.addEventListener('DOMContentLoaded', () => {
    const slider = document.getElementById('timelineSlider');
    const dropdown = document.getElementById('sceneSelect');
    if (slider) {
        slider.addEventListener('input', () => showFellowshipStartPositionsForCurrentScene());
    }
    if (dropdown) {
        dropdown.addEventListener('change', () => showFellowshipStartPositionsForCurrentScene());
    }
});

// Export for manual use and animation
window.placeMarkersOnMap = placeMarkersOnMap;
window.showFellowshipStartPositionsForCurrentScene = showFellowshipStartPositionsForCurrentScene;
window.showCharacterMarkersAtPositions = showCharacterMarkersAtPositions;
