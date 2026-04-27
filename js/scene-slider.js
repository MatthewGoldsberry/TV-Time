// scene-slider.js
// Dynamically generate slider markers and movie labels for the scene slider

const totalScenes = 96;
const scenesPerMovie = 32;
const movies = [
    { label: "The Fellowship of the Ring", start: 0 },
    { label: "The Two Towers", start: 32 },
    { label: "Return of the King", start: 64 }
];

document.addEventListener('DOMContentLoaded', function () {
    const sliderMarkers = document.getElementById('sliderMarkers');
    if (sliderMarkers) {
        // Add dividers between movies
        for (let i = 1; i < movies.length; i++) {
            const divider = document.createElement('div');
            divider.className = 'slider-divider';
            divider.style.left = ((movies[i].start / (totalScenes - 1)) * 100) + '%';
            sliderMarkers.appendChild(divider);
        }
        // Add movie labels
        movies.forEach((movie, idx) => {
            const label = document.createElement('span');
            label.className = 'movie-label';
            // Center label in its movie section
            const left = (((movie.start + scenesPerMovie / 2 - 0.5) / (totalScenes - 1)) * 100);
            label.style.left = left + '%';
            label.textContent = movie.label;
            sliderMarkers.appendChild(label);
        });
    }

    // Synchronize slider and dropdown
    const slider = document.getElementById('timelineSlider');
    const dropdown = document.getElementById('sceneSelect');
    if (slider && dropdown) {
        // When slider changes, update dropdown
        slider.addEventListener('input', function () {
            if (dropdown.selectedIndex !== slider.valueAsNumber) {
                dropdown.selectedIndex = slider.valueAsNumber;
            }
        });
        // When dropdown changes, update slider
        dropdown.addEventListener('change', function () {
            if (slider.valueAsNumber !== dropdown.selectedIndex) {
                slider.value = dropdown.selectedIndex;
            }
        });
    }
});

// --- PlayBtn Animation for Trilogy ---
document.addEventListener('DOMContentLoaded', function () {
    let playInterval = null;
    let isPlaying = false;
    const playBtn = document.getElementById('playBtn');
    const timelineSlider = document.getElementById('timelineSlider');
    const sceneSelect = document.getElementById('sceneSelect');
    
    if (!playBtn || !timelineSlider || !sceneSelect) return;
    
    const totalScenesDom = parseInt(timelineSlider.max, 10);

    function setPlayBtnState(playing) {
        playBtn.classList.toggle('playing', playing);
        playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
        playBtn.textContent = playing ? '⏸' : '▶';
    }

    function animateScenes() {
        let idx = parseInt(timelineSlider.value, 10);
        if (idx >= totalScenesDom) {
            stopAnimation();
            return;
        }
        idx++;
        timelineSlider.value = idx;
        sceneSelect.value = idx;
        document.querySelectorAll('.character-card').forEach(c => c.classList.remove('active'));
        if (window.showFellowshipStartPositionsForCurrentScene) {
            window.showFellowshipStartPositionsForCurrentScene();
        }
        if (window.infoPanel && window.infoPanel.showScene) {
            window.infoPanel.showScene(idx);
        }
        if (idx >= totalScenesDom) {
            stopAnimation();
        }
    }

    function startAnimation() {
        if (isPlaying) return;
        isPlaying = true;
        setPlayBtnState(true);
        playInterval = setInterval(animateScenes, 1200); // 1.2s per scene
    }

    function stopAnimation() {
        isPlaying = false;
        setPlayBtnState(false);
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
        }
    }

    // Set initial icon
    setPlayBtnState(false);

    playBtn.addEventListener('click', () => {
        if (isPlaying) {
            stopAnimation();
        } else {
            // If at end, reset to start
            if (parseInt(timelineSlider.value, 10) >= totalScenesDom) {
                timelineSlider.value = 0;
                sceneSelect.value = 0;
                if (window.infoPanel && window.infoPanel.showScene) {
                    window.infoPanel.showScene(0);
                }
            }
            startAnimation();
        }
    });
});

