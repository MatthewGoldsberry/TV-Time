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
        // Use lowercase for character PNG file name
        .attr("xlink:href", d => `data/images/characters/${d.character.toLowerCase()}.png`)
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

        // Build initial path state for scene 0 (empty for Prologue, but consistent)
        buildPathsUpToScene(0);
    }).catch(err => {
        console.error('Error loading marker data:', err);
    });
}

// Initialize on load
placeMarkersOnMap();

// --- Character Movement Path Tracking ---
let _characterPaths = {}; // Store {character: [{cx, cy, sceneIndex}]}

// Add a position to a character's path
function addCharacterPosition(character, cx, cy, sceneIndex) {
    if (!_characterPaths[character]) {
        _characterPaths[character] = [];
    }
    // Only add if position is different from last position
    const lastPos = _characterPaths[character][_characterPaths[character].length - 1];
    if (!lastPos || lastPos.cx !== cx || lastPos.cy !== cy) {
        _characterPaths[character].push({ cx, cy, sceneIndex });
    }
}

// Clear all character paths
function clearCharacterPaths() {
    _characterPaths = {};
    const svg = d3.select('#svgMap');
    svg.selectAll('.character-path, .character-path-outline').remove();
}

// Draw path lines for all characters, forming side-by-side bands on shared segments
function drawCharacterPaths(svgSelector = '#svgMap') {
    const svg = d3.select(svgSelector);
    if (svg.empty()) return;

    svg.selectAll('.character-path, .character-path-outline').remove();

    // Create a group for paths (insert before markers)
    let pathGroup = svg.select('.path-group');
    if (pathGroup.empty()) {
        pathGroup = svg.insert('g', '.character-marker').attr('class', 'path-group');
    }

    const bandWidth = 5;
    const tolerance = 5;

    // Build segment to [characters] map
    const segmentGroups = {};
    Object.entries(_characterPaths).forEach(([character, positions]) => {
        for (let i = 0; i < positions.length - 1; i++) {
            const key = segmentKey(positions[i], positions[i + 1], tolerance);
            if (!segmentGroups[key]) segmentGroups[key] = [];
            if (!segmentGroups[key].includes(character)) segmentGroups[key].push(character);
        }
    });
    Object.values(segmentGroups).forEach(g => g.sort());

    // Apply offset to positions if needed
    const offsetPathMap = {};
    Object.entries(_characterPaths).forEach(([character, positions]) => {
        if (positions.length < 2) return;

        const acc = positions.map(() => ({ ox: 0, oy: 0, n: 0 }));

        for (let i = 0; i < positions.length - 1; i++) {
            const key = segmentKey(positions[i], positions[i + 1], tolerance);
            const group = segmentGroups[key];
            if (!group || group.length < 2) continue;

            const myIndex = group.indexOf(character);
            const dx = positions[i + 1].cx - positions[i].cx;
            const dy = positions[i + 1].cy - positions[i].cy;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) continue;

            // Offset perpendicular units centered on the bundle midpoint
            const perpX = -dy / len;
            const perpY =  dx / len;
            const offset = (myIndex - (group.length - 1) / 2) * bandWidth;

            // Accumulate on both endpoints
            acc[i].ox += perpX * offset; acc[i].oy += perpY * offset; acc[i].n++;
            acc[i + 1].ox += perpX * offset; acc[i + 1].oy += perpY * offset; acc[i + 1].n++;
        }

        offsetPathMap[character] = positions.map((pos, i) => {
            const { ox, oy, n } = acc[i];
            return n > 0
                ? { cx: pos.cx + ox / n, cy: pos.cy + oy / n, sceneIndex: pos.sceneIndex }
                : pos;
        });
    });

    const lineGenerator = d3.line()
        .x(d => d.cx)
        .y(d => d.cy)
        .curve(d3.curveCatmullRom.alpha(0.5));

    Object.entries(offsetPathMap).forEach(([character, positions]) => {
        const color = window.characterColor ? window.characterColor(character, 0.95) : 'rgba(232,217,181,0.95)';

        // Outline drawn first so it sits beneath the colored stroke
        pathGroup.append('path')
            .datum(positions)
            .attr('class', 'character-path-outline')
            .attr('d', lineGenerator)
            .attr('fill', 'none')
            .attr('stroke-linecap', 'round')
            .attr('stroke-linejoin', 'round')
            .attr('opacity', 0.7)
            .attr('data-character', character);

        pathGroup.append('path')
            .datum(positions)
            .attr('class', 'character-path')
            .attr('d', lineGenerator)
            .attr('stroke', color)
            .attr('stroke-width', 3)
            .attr('fill', 'none')
            .attr('stroke-linecap', 'round')
            .attr('stroke-linejoin', 'round')
            .attr('opacity', 1)
            .attr('data-character', character);
    });
}

// Canonical key for a directed segment; snaps to tolerance grid to absorb float noise
function segmentKey(p1, p2, tolerance) {
    const r = v => Math.round(v / tolerance) * tolerance;
    return `${r(p1.cx)},${r(p1.cy)}|${r(p2.cx)},${r(p2.cy)}`;
}

// Update character paths for a given scene
function updateCharacterPathsForScene(sceneIndex) {
    // Get scene name from the scene index, not from the current dropdown selection
    const sceneOptions = document.querySelectorAll('#sceneSelect option');
    const sceneName = sceneOptions[sceneIndex] ? sceneOptions[sceneIndex].textContent.trim() : null;
    
    if (!sceneName) return;
    
    const positions = getFellowshipStartPositionsForScene(sceneName);
    
    // Add each character's position to their path
    positions.forEach(pos => {
        addCharacterPosition(pos.character, pos.cx, pos.cy, sceneIndex);
    });
    
    // Redraw all paths
    drawCharacterPaths();
}

// Rebuild all character paths from scene 0 up to sceneIndex from the loaded marker data
function buildPathsUpToScene(sceneIndex) {
    _characterPaths = {};
    const sceneOptions = document.querySelectorAll('#sceneSelect option');
    for (let i = 0; i <= sceneIndex; i++) {
        const sceneName = sceneOptions[i] ? sceneOptions[i].textContent.trim() : null;
        if (!sceneName) continue;
        const positions = getFellowshipStartPositionsForScene(sceneName);
        positions.forEach(pos => addCharacterPosition(pos.character, pos.cx, pos.cy, i));
    }
    drawCharacterPaths();
}

// Export for manual use and animation
window.placeMarkersOnMap = placeMarkersOnMap;
window.showFellowshipStartPositionsForCurrentScene = showFellowshipStartPositionsForCurrentScene;
window.showCharacterMarkersAtPositions = showCharacterMarkersAtPositions;
window.clearCharacterPaths = clearCharacterPaths;
window.updateCharacterPathsForScene = updateCharacterPathsForScene;
window.buildPathsUpToScene = buildPathsUpToScene;
