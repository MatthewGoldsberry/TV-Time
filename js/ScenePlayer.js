/**
 * ScenePlayer class - Handles scene-by-scene dialogue playback
 * Displays character dialogue in text boxes positioned on the map
 */

class ScenePlayer {
    constructor() {
        this.csvData = null;
        this.currentSceneData = [];
        this.currentLineIndex = 0;
        this.isPlaying = false;
        this.playInterval = null;
        this.playSpeed = 2500; // milliseconds per line
        this.skipSpeed = 200; // milliseconds for entries with no location
        
        // Load CSV data
        this.loadData();
        
        // Initialize button event listener
        this.initButton();
        
        // Setup scene change listeners
        this.setupSceneChangeListeners();
    }
    
    /**
     * Load CSV data on initialization
     */
    loadData() {
        d3.csv('data/lotr_script_data.csv').then(data => {
            // Parse coordinates for each entry
            this.csvData = data.map(d => {
                if (d.location) {
                    const [x, y] = d.location.trim().split(/\s+/);
                    d.cx = +x;
                    d.cy = +y;
                }
                return d;
            });
            // Update button availability after data loads
            this.updateButtonAvailability();
        }).catch(err => {
            console.error('ScenePlayer: Error loading CSV data:', err);
        });
    }
    
    /**
     * Initialize the scenePlayBtn event listener
     */
    initButton() {
        const btn = document.getElementById('scenePlayBtn');
        if (btn) {
            btn.addEventListener('click', () => this.togglePlay());
        }
    }
    
    /**
     * Setup listeners for scene changes to update button availability
     */
    setupSceneChangeListeners() {
        const slider = document.getElementById('timelineSlider');
        const dropdown = document.getElementById('sceneSelect');
        
        if (slider) {
            slider.addEventListener('input', () => this.updateButtonAvailability());
        }
        
        if (dropdown) {
            dropdown.addEventListener('change', () => this.updateButtonAvailability());
        }
    }
    
    /**
     * Get the currently selected scene name from dropdown
     */
    getCurrentSceneName() {
        const dropdown = document.getElementById('sceneSelect');
        if (!dropdown) return null;
        const selectedOption = dropdown.options[dropdown.selectedIndex];
        return selectedOption ? selectedOption.textContent : null;
    }
    
    /**
     * Check if the current scene has any dialogue entries with location data
     */
    sceneHasLocationData() {
        if (!this.csvData) return false;
        
        const sceneName = this.getCurrentSceneName();
        if (!sceneName) return false;
        
        const sceneData = this.csvData.filter(d => d.scene_name === sceneName);
        return sceneData.some(d => d.cx && d.cy && !isNaN(d.cx) && !isNaN(d.cy));
    }
    
    /**
     * Update button availability based on whether scene has location data
     */
    updateButtonAvailability() {
        const btn = document.getElementById('scenePlayBtn');
        if (!btn) return;
        
        const hasLocationData = this.sceneHasLocationData();
        
        if (hasLocationData) {
            btn.disabled = false;
            btn.classList.remove('disabled');
        } else {
            btn.disabled = true;
            btn.classList.add('disabled');
            // Stop playing if currently active
            if (this.isPlaying) {
                this.stop();
            }
        }
    }
    
    /**
     * Toggle play/pause state
     */
    togglePlay() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.start();
        }
    }
    
    /**
     * Start playing the current scene
     */
    start() {
        if (!this.csvData) {
            console.warn('ScenePlayer: CSV data not loaded yet');
            return;
        }
        
        const sceneName = this.getCurrentSceneName();
        if (!sceneName) {
            console.warn('ScenePlayer: No scene selected');
            return;
        }
        
        // Filter data for current scene
        this.currentSceneData = this.csvData.filter(d => d.scene_name === sceneName);
        
        if (this.currentSceneData.length === 0) {
            console.warn('ScenePlayer: No dialogue data for scene:', sceneName);
            return;
        }
        
        // Reset to beginning
        this.currentLineIndex = 0;
        this.isPlaying = true;
        
        // Update button appearance
        this.updateButtonState();
        
        // Clear any existing dialogue boxes
        this.clearDialogueBoxes();
        
        // Show first line and schedule next
        this.showCurrentLineAndScheduleNext();
    }
    
    /**
     * Stop playing
     */
    stop() {
        this.isPlaying = false;
        
        if (this.playInterval) {
            clearTimeout(this.playInterval);
            this.playInterval = null;
        }
        
        // Update button appearance
        this.updateButtonState();
        
        // Clear dialogue boxes after a short delay
        setTimeout(() => {
            this.clearDialogueBoxes();
        }, 1000);
    }
    
    /**
     * Update button text and style based on play state
     */
    updateButtonState() {
        const btn = document.getElementById('scenePlayBtn');
        if (btn) {
            if (this.isPlaying) {
                btn.textContent = 'Stop Scene';
                btn.classList.add('playing');
            } else {
                btn.textContent = 'Play Scene';
                btn.classList.remove('playing');
            }
        }
    }
    
    /**
     * Show the current dialogue line and schedule the next one
     */
    showCurrentLineAndScheduleNext() {
        if (this.currentLineIndex >= this.currentSceneData.length) {
            // Reached the end
            this.stop();
            return;
        }
        
        const line = this.currentSceneData[this.currentLineIndex];
        const hasLocation = line.cx && line.cy && !isNaN(line.cx) && !isNaN(line.cy);
        
        // Display the line if it has location data
        if (hasLocation) {
            this.showCurrentLine();
        }
        
        // Determine delay: short for no location, normal for with location
        const delay = hasLocation ? this.playSpeed : this.skipSpeed;
        
        // Schedule next line
        this.playInterval = setTimeout(() => {
            this.currentLineIndex++;
            this.showCurrentLineAndScheduleNext();
        }, delay);
    }
    
    /**
     * Show the current dialogue line
     */
    showCurrentLine() {
        const line = this.currentSceneData[this.currentLineIndex];
        if (!line) return;
        
        const character = line.character;
        const dialogue = line.dialogue;
        
        // Check if character is in the fellowship
        if (window.FELLOWSHIP && window.FELLOWSHIP.has(character)) {
            // Show dialogue on their marker
            this.showDialogueOnMarker(character, dialogue, line.cx, line.cy);
        } else {
            // Create a misc marker and show dialogue
            this.showDialogueForNonFellowship(character, dialogue, line.cx, line.cy);
        }
    }
    
    /**
     * Show dialogue box on a fellowship member's marker
     */
    showDialogueOnMarker(character, dialogue, cx, cy) {
        const svg = d3.select('#svgMap');
        
        // Find the character's marker to get its position
        let markerX = cx;
        let markerY = cy;
        
        const marker = svg.select(`.character-marker[data-character="${character}"]`);
        if (!marker.empty()) {
            markerX = +marker.attr('x') + 16; // Center of 32px marker
            markerY = +marker.attr('y');
        } else if (!cx || !cy) {
            // No marker and no coordinates - can't display
            console.warn(`ScenePlayer: No position for ${character}`);
            return;
        }
        
        this.createDialogueBox(character, dialogue, markerX, markerY, svg);
    }
    
    /**
     * Show dialogue for a non-fellowship character
     * Create a misc marker if coordinates are available
     */
    showDialogueForNonFellowship(character, dialogue, cx, cy) {
        const svg = d3.select('#svgMap');
        
        if (!cx || !cy) {
            // No coordinates - just show character name in a notification
            console.log(`${character}: ${dialogue}`);
            return;
        }
        
        // Create a simple misc marker
        const miscMarker = svg.append('circle')
            .attr('class', 'misc-dialogue-marker')
            .attr('cx', cx)
            .attr('cy', cy)
            .attr('r', 8)
            .attr('fill', 'rgba(200, 150, 100, 0.7)')
            .attr('stroke', 'rgba(232, 217, 181, 0.9)')
            .attr('stroke-width', 2);
        
        // Show dialogue box above this marker
        this.createDialogueBox(character, dialogue, cx, cy - 8, svg);
    }
    
    /**
     * Create a dialogue box at the specified position
     */
    createDialogueBox(character, dialogue, x, y, svg) {
        // Remove previous dialogue boxes
        svg.selectAll('.dialogue-box-group').remove();
        
        // Create a group for the dialogue box
        const boxGroup = svg.append('g')
            .attr('class', 'dialogue-box-group');
        
        // Calculate text dimensions (approximate)
        const maxWidth = 200;
        const padding = 10;
        const lineHeight = 16;
        
        // Wrap text
        const words = dialogue.split(/\s+/);
        const lines = [];
        let currentLine = '';
        
        words.forEach(word => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            // Rough estimate: 7 pixels per character
            if (testLine.length * 7 > maxWidth - padding * 2) {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });
        if (currentLine) lines.push(currentLine);
        
        const boxHeight = lines.length * lineHeight + padding * 2 + 20; // +20 for character name
        const boxWidth = maxWidth;
        
        // Position box above the marker
        const boxX = x - boxWidth / 2;
        const boxY = y - boxHeight - 10;
        
        // Background rectangle with rounded corners
        boxGroup.append('rect')
            .attr('x', boxX)
            .attr('y', boxY)
            .attr('width', boxWidth)
            .attr('height', boxHeight)
            .attr('rx', 12)
            .attr('ry', 12)
            .attr('fill', 'rgba(10, 10, 10, 0.5)')
            .attr('stroke', 'rgba(232, 217, 181, 0.3)')
            .attr('stroke-width', 1)
            .attr('filter', 'url(#dialogue-drop-shadow)');
        
        // Add character name (bold)
        boxGroup.append('text')
            .attr('x', boxX + boxWidth / 2)
            .attr('y', boxY + padding + 14)
            .attr('text-anchor', 'middle')
            .attr('font-family', 'Cinzel, serif')
            .attr('font-size', '13px')
            .attr('font-weight', 'bold')
            .attr('fill', 'rgba(232, 217, 181, 0.95)')
            .text(character);
        
        // Add dialogue text (wrapped)
        lines.forEach((line, i) => {
            boxGroup.append('text')
                .attr('x', boxX + padding)
                .attr('y', boxY + padding + 30 + i * lineHeight)
                .attr('font-family', 'Cinzel, serif')
                .attr('font-size', '11px')
                .attr('fill', 'rgba(232, 217, 181, 0.85)')
                .text(line);
        });
        
        // Add a small pointer/arrow pointing to the marker
        const arrowPath = `M ${x - 6} ${y - 10} L ${x} ${y} L ${x + 6} ${y - 10} Z`;
        boxGroup.append('path')
            .attr('d', arrowPath)
            .attr('fill', 'rgba(10, 10, 10, 0.5)')
            .attr('stroke', 'rgba(232, 217, 181, 0.3)')
            .attr('stroke-width', 1);
        
        // Ensure drop shadow filter exists
        this.ensureDropShadowFilter(svg);
    }
    
    /**
     * Ensure the drop shadow filter exists for dialogue boxes
     */
    ensureDropShadowFilter(svg) {
        let defs = svg.select('defs');
        if (defs.empty()) {
            defs = svg.append('defs');
        }
        
        let shadow = defs.select('#dialogue-drop-shadow');
        if (shadow.empty()) {
            shadow = defs.append('filter')
                .attr('id', 'dialogue-drop-shadow')
                .attr('x', '-50%')
                .attr('y', '-50%')
                .attr('width', '200%')
                .attr('height', '200%');
            shadow.append('feDropShadow')
                .attr('dx', 2)
                .attr('dy', 3)
                .attr('stdDeviation', 3)
                .attr('flood-color', '#000')
                .attr('flood-opacity', 0.7);
        }
    }
    
    /**
     * Clear all dialogue boxes and misc markers from the map
     */
    clearDialogueBoxes() {
        const svg = d3.select('#svgMap');
        svg.selectAll('.dialogue-box-group').remove();
        svg.selectAll('.misc-dialogue-marker').remove();
    }
}

// Initialize ScenePlayer when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.scenePlayer = new ScenePlayer();
});
