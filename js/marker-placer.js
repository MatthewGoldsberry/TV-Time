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
        .attr("xlink:href", d => `data/images/${d.character.toLowerCase()}.png`)
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

// Draw path lines for all characters
function drawCharacterPaths(svgSelector = '#svgMap') {
    const svg = d3.select(svgSelector);
    if (svg.empty()) return;
    
    // Remove existing paths
    svg.selectAll('.character-path, .character-path-outline').remove();
    
    // Create a group for paths (insert before markers)
    let pathGroup = svg.select('.path-group');
    if (pathGroup.empty()) {
        pathGroup = svg.insert('g', '.character-marker')
            .attr('class', 'path-group');
    }
    
    // Calculate offsets for overlapping paths
    const pathsWithOffsets = calculatePathOffsets(_characterPaths);
    
    // Draw paths with outlines for visibility
    pathsWithOffsets.forEach(({ character, positions, offset }) => {
        if (positions.length < 2) return; // Need at least 2 points for a line
        
        // Apply offset to positions if needed
        const offsetPositions = positions.map((pos, i) => {
            if (offset === 0) return pos;
            
            // Calculate perpendicular offset direction
            let dx = 0, dy = 0;
            if (i < positions.length - 1) {
                // Use direction to next point
                dx = positions[i + 1].cx - pos.cx;
                dy = positions[i + 1].cy - pos.cy;
            } else if (i > 0) {
                // Use direction from previous point
                dx = pos.cx - positions[i - 1].cx;
                dy = pos.cy - positions[i - 1].cy;
            }
            
            // Normalize and create perpendicular offset
            const length = Math.sqrt(dx * dx + dy * dy);
            if (length > 0) {
                const perpX = -dy / length * offset;
                const perpY = dx / length * offset;
                return { cx: pos.cx + perpX, cy: pos.cy + perpY, sceneIndex: pos.sceneIndex };
            }
            return pos;
        });
        
        // Get character color with higher vibrancy
        const color = window.characterColor ? window.characterColor(character, 0.95) : 'rgba(232,217,181,0.95)';
        
        // Create line generator
        const lineGenerator = d3.line()
            .x(d => d.cx)
            .y(d => d.cy)
            .curve(d3.curveCatmullRom.alpha(0.5));
        
        // Draw black outline first
        pathGroup.append('path')
            .datum(offsetPositions)
            .attr('class', 'character-path-outline')
            .attr('d', lineGenerator)
            //.attr('stroke', '#000')
            //.attr('stroke-width', 5)
            .attr('fill', 'none')
            .attr('stroke-linecap', 'round')
            .attr('stroke-linejoin', 'round')
            .attr('opacity', 0.7)
            .attr('data-character', character);
        
        // Draw colored path on top
        pathGroup.append('path')
            .datum(offsetPositions)
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

// Calculate offsets for overlapping paths to place them side-by-side
function calculatePathOffsets(characterPaths) {
    const pathsArray = Object.entries(characterPaths).map(([character, positions]) => ({
        character,
        positions
    }));
    
    // Simple offset assignment: if paths share many points, offset them
    const offsetMap = {};
    const offsetAmount = 6; // pixels to offset
    let currentOffset = 0;
    
    // Group characters by shared path segments
    const groups = [];
    pathsArray.forEach(pathData => {
        let foundGroup = false;
        for (const group of groups) {
            // Check if this path shares positions with any in the group
            if (pathsSharePositions(pathData.positions, group[0].positions)) {
                group.push(pathData);
                foundGroup = true;
                break;
            }
        }
        if (!foundGroup) {
            groups.push([pathData]);
        }
    });
    
    // Assign offsets within each group
    const result = [];
    groups.forEach(group => {
        if (group.length === 1) {
            result.push({ ...group[0], offset: 0 });
        } else {
            // Offset paths in group symmetrically around center
            const totalWidth = (group.length - 1) * offsetAmount;
            group.forEach((pathData, i) => {
                const offset = (i * offsetAmount) - (totalWidth / 2);
                result.push({ ...pathData, offset });
            });
        }
    });
    
    return result;
}

// Check if two paths share similar positions
function pathsSharePositions(positions1, positions2, threshold = 50) {
    if (!positions1 || !positions2) return false;
    
    let sharedCount = 0;
    for (const pos1 of positions1) {
        for (const pos2 of positions2) {
            const dist = Math.sqrt(
                Math.pow(pos1.cx - pos2.cx, 2) + 
                Math.pow(pos1.cy - pos2.cy, 2)
            );
            if (dist < threshold) {
                sharedCount++;
                break;
            }
        }
    }
    
    // Consider paths as overlapping if they share at least 30% of points
    return sharedCount >= Math.min(positions1.length, positions2.length) * 0.3;
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

// Export for manual use and animation
window.placeMarkersOnMap = placeMarkersOnMap;
window.showFellowshipStartPositionsForCurrentScene = showFellowshipStartPositionsForCurrentScene;
window.showCharacterMarkersAtPositions = showCharacterMarkersAtPositions;
window.clearCharacterPaths = clearCharacterPaths;
window.updateCharacterPathsForScene = updateCharacterPathsForScene;
