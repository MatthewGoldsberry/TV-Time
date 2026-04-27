// Update markers for the current scene
function updateMarkersForCurrentScene(svgSelector = '#svgMap') {
    showFellowshipStartPositionsForCurrentScene(svgSelector);
}
// marker-placer.js

let _markerData = null;

function getCurrentSceneName() {
    // Get the current scene name from the dropdown
    const dropdown = document.getElementById('sceneSelect');
    if (!dropdown) return null;
    const selectedOption = dropdown.options[dropdown.selectedIndex];
    return selectedOption ? selectedOption.textContent : null;
}

// Get the starting position for each character in a given scene
function getFellowshipStartPositionsForScene(sceneName) {
    if (!_markerData || !sceneName) return [];
    const seen = new Set();
    const starts = [];
    for (const d of _markerData) {
        if (FELLOWSHIP.has(d.character) && d.scene_name === sceneName && !seen.has(d.character)) {
            starts.push(d);
            seen.add(d.character);
        }
    }
    return starts;
}

function showCharacterMarkersAtPositions(positions, svgSelector = '#svgMap') {
    const svg = d3.select(svgSelector);
    if (svg.empty()) return;
    svg.selectAll('.character-marker').remove();

    // Add drop shadow filter if not present
    let defs = svg.select('defs');
    if (defs.empty()) {
        defs = svg.append('defs');
    }
    let shadow = defs.select('#marker-drop-shadow');
    if (shadow.empty()) {
        shadow = defs.append('filter')
            .attr('id', 'marker-drop-shadow')
            .attr('x', '-30%')
            .attr('y', '-30%')
            .attr('width', '160%')
            .attr('height', '160%');
        shadow.append('feDropShadow')
            .attr('dx', 2)
            .attr('dy', 2)
            .attr('stdDeviation', 2)
            .attr('flood-color', '#000')
            .attr('flood-opacity', 0.6);
    }

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
        .attr("xlink:href", d => `${'data/images/'}${d.character}.png`)
        .attr('data-character', d => d.character)
        .attr('filter', 'url(#marker-drop-shadow)')
        .append('title')
        .text(d => `${d.character}`);
}

// Show only the starting position for each character in the selected scene
function showFellowshipStartPositionsForCurrentScene(svgSelector = '#svgMap') {
    const sceneName = getCurrentSceneName();
    const starts = getFellowshipStartPositionsForScene(sceneName);
    showCharacterMarkersAtPositions(starts, svgSelector);
}

function placeMarkersOnMap(svgSelector = '#svgMap') {
    d3.csv('data/lotr_script_data.csv').then(data => {
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
    }).catch(err => {
        console.error('Error loading marker data:', err);
    });
}

// Initialize on load
placeMarkersOnMap();

// Export for manual use and animation
window.placeMarkersOnMap = placeMarkersOnMap;
window.showFellowshipStartPositionsForCurrentScene = showFellowshipStartPositionsForCurrentScene;
window.showCharacterMarkersAtPositions = showCharacterMarkersAtPositions;
