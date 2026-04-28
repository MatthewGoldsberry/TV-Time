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
        this.playSpeed = 3500;
        this.skipSpeed = 200;
        
        // Load CSV data
        this.loadData();
        
        // Initialize button event listener
        this.initButton();
        
        // Setup scene change listeners
        this.setupSceneChangeListeners();

        // Esc key stops active scene playback
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && this.isPlaying) this.stop();
        });
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
            slider.addEventListener('input', () => {
                if (this.isPlaying) this.stop();
                this.updateButtonAvailability();
            });
        }

        if (dropdown) {
            dropdown.addEventListener('change', () => {
                if (this.isPlaying) this.stop();
                this.updateButtonAvailability();
            });
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
     * Check if the current scene has any dialogue entries
     */
    sceneHasDialogue() {
        if (!this.csvData) return false;
        const sceneName = this.getCurrentSceneName();
        if (!sceneName) return false;
        return this.csvData.some(d => d.scene_name === sceneName);
    }

    /**
     * Update button availability based on whether scene has dialogue
     */
    updateButtonAvailability() {
        const btn = document.getElementById('scenePlayBtn');
        if (!btn) return;

        const hasDialogue = this.sceneHasDialogue();

        if (hasDialogue) {
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
     * Called by the timeline play button to lock or unlock the scene play button.
     */
    setTimelineActive(isActive) {
        const btn = document.getElementById('scenePlayBtn');
        if (!btn) return;
        if (isActive) {
            if (this.isPlaying) this.stop();
            btn.disabled = true;
            btn.classList.add('disabled');
        } else {
            this.updateButtonAvailability();
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
        
        this.showCurrentLine();

        this.playInterval = setTimeout(() => {
            this.currentLineIndex++;
            this.showCurrentLineAndScheduleNext();
        }, this.playSpeed);
    }
    
    /**
     * Dispatch the current line to the appropriate renderer based on scene and character type.
     */
    showCurrentLine() {
        const line = this.currentSceneData[this.currentLineIndex];
        if (!line) return;

        const character = line.character;
        const dialogue = line.dialogue;

        // Prologue has no character markers on the map, so use centered box
        const sceneIndex = +document.getElementById('timelineSlider').value;
        if (sceneIndex === 0) {
            const svg = d3.select('#svgMap');
            this.createNarrationBox(character, dialogue, svg);
            return;
        }

        if (window.FELLOWSHIP && window.FELLOWSHIP.has(character)) {
            this.showDialogueOnMarker(character, dialogue, line.cx, line.cy);
        } else {
            this.showDialogueForNonFellowship(character, dialogue, line.cx, line.cy);
        }
    }

    /**
     * Render a wide, centered narration box used for the Prologue and any scene with no map markers.
     */
    createNarrationBox(character, dialogue, svg) {
        svg.selectAll('.dialogue-box-group').remove();

        const boxGroup = svg.append('g').attr('class', 'dialogue-box-group');

        // Narration box consts
        const maxWidth = 560;
        const padding = 18;
        const lineHeight = 20;
        const centerX = 960;
        const centerY = 540;

        // Build lines until the next word would exceed maxWidth
        const words = dialogue.split(/\s+/);
        const lines = [];
        let currentLine = '';
        words.forEach(word => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (testLine.length * 8 > maxWidth - padding * 2) {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });
        if (currentLine) lines.push(currentLine);

        // Reserve space for the bold character-name header above the dialogue lines
        const boxHeight = lines.length * lineHeight + padding * 2 + 28;
        const boxX = centerX - maxWidth / 2;
        const boxY = centerY - boxHeight / 2;

        this.ensureDropShadowFilter(svg);

        boxGroup.append('rect')
            .attr('class', 'narration-box-bg')
            .attr('x', boxX)
            .attr('y', boxY)
            .attr('width', maxWidth)
            .attr('height', boxHeight)
            .attr('rx', 16)
            .attr('ry', 16);

        boxGroup.append('text')
            .attr('class', 'narration-char-name')
            .attr('x', centerX)
            .attr('y', boxY + padding + 16)
            .text(character);

        lines.forEach((l, i) => {
            boxGroup.append('text')
                .attr('class', 'narration-text')
                .attr('x', centerX)
                .attr('y', boxY + padding + 36 + i * lineHeight)
                .text(l);
        });
    }

    /**
     * Show dialogue box on a fellowship member's marker
     */
    showDialogueOnMarker(character, dialogue, cx, cy) {
        const svg = d3.select('#svgMap');

        // Markers rendered position
        let markerX = cx || 960;
        let markerY = cy || 700;

        const marker = svg.select(`.character-marker[data-character="${character}"]`);
        if (!marker.empty()) {
            markerX = +marker.attr('x') + 16;
            markerY = +marker.attr('y');
        }

        this.createDialogueBox(character, dialogue, markerX, markerY, svg);
    }

    /**
     * Show dialogue for a non-fellowship character
     * Create a misc marker if coordinates are available
     */
    showDialogueForNonFellowship(character, dialogue, cx, cy) {
        const svg = d3.select('#svgMap');

        // Fall back to map center with no dot
        if (!cx || !cy) {
            this.createDialogueBox(character, dialogue, 960, 700, svg);
            return;
        }

        // Shift for an exact positional match
        const threshold = 5;
        const shift = 36;
        let nx = cx;
        svg.selectAll('.character-marker').each(function() {
            const el = d3.select(this);
            const mx = +el.attr('x') + 16;
            const my = +el.attr('y') + 16;
            const dist = Math.sqrt((cx - mx) ** 2 + (cy - my) ** 2);
            if (dist < threshold) nx = cx - shift;
        });

        svg.append('circle')
            .attr('class', 'misc-dialogue-marker')
            .attr('cx', nx)
            .attr('cy', cy)
            .attr('r', 8);

        // Show dialogue box above this marker
        this.createDialogueBox(character, dialogue, nx, cy - 8, svg);
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
        const headerEl = document.querySelector('header');
        const headerBottomPx = headerEl ? headerEl.getBoundingClientRect().bottom : 0;
        const svgScale = 1080 / window.innerHeight;
        const minBoxY = headerBottomPx * svgScale + 6;
        const naturalBoxY = y - boxHeight - 10;
        const fitsAbove = naturalBoxY >= minBoxY;

        const boxX = x - boxWidth / 2;
        
        // When flipped, offset by 32 (marker height) + 10 gap so the box clears the icon
        const boxY = fitsAbove ? naturalBoxY : y + 42;

        boxGroup.append('rect')
            .attr('class', 'dialogue-box-bg')
            .attr('x', boxX)
            .attr('y', boxY)
            .attr('width', boxWidth)
            .attr('height', boxHeight)
            .attr('rx', 12)
            .attr('ry', 12);

        boxGroup.append('text')
            .attr('class', 'dialogue-char-name')
            .attr('x', boxX + boxWidth / 2)
            .attr('y', boxY + padding + 14)
            .text(character);

        lines.forEach((line, i) => {
            boxGroup.append('text')
                .attr('class', 'dialogue-text')
                .attr('x', boxX + padding)
                .attr('y', boxY + padding + 30 + i * lineHeight)
                .text(line);
        });

        // Arrow tip points at the marker top (above) or the marker bottom (below)
        const arrowPath = fitsAbove
            ? `M ${x - 6} ${boxY + boxHeight} L ${x} ${y} L ${x + 6} ${boxY + boxHeight} Z`
            : `M ${x - 6} ${boxY} L ${x} ${y + 32} L ${x + 6} ${boxY} Z`;
        boxGroup.append('path')
            .attr('class', 'dialogue-arrow')
            .attr('d', arrowPath);

        this.ensureDropShadowFilter(svg);
    }

    /**
     * Ensure the drop shadow filter exists for dialogue boxes
     */
    ensureDropShadowFilter(svg) {
        let defs = svg.select('defs');
        if (defs.empty()) defs = svg.append('defs');

        // Only append if not already present
        if (defs.select('#dialogue-drop-shadow').empty()) {
            // Oversized filter region (200%) prevents the shadow from being clipped at box edges
            const filter = defs.append('filter')
                .attr('id', 'dialogue-drop-shadow')
                .attr('x', '-50%')
                .attr('y', '-50%')
                .attr('width', '200%')
                .attr('height', '200%');
            filter.append('feDropShadow')
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
