/**
 * Load data from CSV files and initialize visualizations and handlers
 */

// class elements (expose infoPanel to window for scene-slider.js access)
window.infoPanel = null;
let chordVis;

const FELLOWSHIP_ORDER = ['Frodo','Sam','Merry','Pippin','Gandalf','Aragorn','Legolas','Gimli','Boromir'];

// Derived Set for membership tests
const FELLOWSHIP = new Set(FELLOWSHIP_ORDER);

// Base RGB per character
const CHARACTER_COLORS = {
    'Frodo':   [158,  32,  62],
    'Sam':     [125,  72,  32],
    'Merry':   [172,  82,  28],
    'Pippin':  [192, 142,   8],
    'Gandalf': [161, 161, 161],
    'Aragorn': [ 42, 122,  52],
    'Legolas': [128,  48, 168],
    'Gimli':   [ 88,  78,  68],
    'Boromir': [ 42,  88, 172],
};

function characterColor(name, alpha) {
    const rgb = CHARACTER_COLORS[name];
    return rgb ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})` : `rgba(232,217,181,${alpha})`;
}

d3.csv('data/lotr_script_data.csv').then(data => {
    const characterStats = {};
    const characterData = {};
    const corpusWordFreq = {};
    const corpusNgramFreq = {};
    const sceneStats = {};
    const sceneFilm = {};

    data.forEach(d => {
        // Parse coordinates and word count
        if (d.location) {
            const [x, y] = d.location.trim().split(/\s+/);
            d.x = +x;
            d.y = +y;
        }
        d.wordCount = d.dialogue ? d.dialogue.trim().split(/\s+/).length : 0;

        // Per-character aggregation
        if (!characterStats[d.character]) {
            characterStats[d.character] = { lines: 0, words: 0, scenes: new Set() };
        }
        characterStats[d.character].lines++;
        characterStats[d.character].words += d.wordCount;
        characterStats[d.character].scenes.add(d.scene_name);

        if (!characterData[d.character]) characterData[d.character] = [];
        characterData[d.character].push(d);

        // Corpus-wide word frequency for unique-word scoring
        (d.dialogue_cleaned || '').split(' ').filter(Boolean).forEach(w => {
            corpusWordFreq[w] = (corpusWordFreq[w] || 0) + 1;
        });

        // Corpus-wide n-gram frequency (2–8 words) for phrase distinctiveness scoring.
        // Sentence-split and apostrophe-preserving to match CharacterPhrases extraction exactly.
        (d.dialogue || '').split(/[.!?]+/).forEach(sentence => {
            const rawWords = sentence.toLowerCase().replace(/-/g, ' ').replace(/[^a-z\s']/g, '').split(/\s+/).filter(Boolean);
            for (let n = 2; n <= 8; n++) {
                for (let i = 0; i <= rawWords.length - n; i++) {
                    const gram = rawWords.slice(i, i + n).join(' ');
                    corpusNgramFreq[gram] = (corpusNgramFreq[gram] || 0) + 1;
                }
            }
        });

        // Per-scene aggregation
        if (!sceneStats[d.scene_name]) {
            sceneStats[d.scene_name] = { lines: 0, characters: new Set(), fellowship: new Set() };
        }
        sceneStats[d.scene_name].lines++;
        sceneStats[d.scene_name].characters.add(d.character);
        if (FELLOWSHIP.has(d.character)) sceneStats[d.scene_name].fellowship.add(d.character);
        if (!sceneFilm[d.scene_name]) sceneFilm[d.scene_name] = d.film;
    });

    // Convert flattened sets to counts
    Object.values(characterStats).forEach(s => {
        s.sceneCount = s.scenes.size;
        delete s.scenes;
    });

    // Build fellowship interaction matrix from scene character sets
    const makeMatrix = () => FELLOWSHIP_ORDER.map(() => FELLOWSHIP_ORDER.map(() => 0));
    const interactionMatrix = {
        all: makeMatrix(),
        'The Fellowship of the Ring': makeMatrix(),
        'The Two Towers': makeMatrix(),
        'The Return of the King': makeMatrix(),
    };
    Object.entries(sceneStats).forEach(([scene, stats]) => {
        const film = sceneFilm[scene];
        const indices = [...stats.characters]
            .map(c => FELLOWSHIP_ORDER.indexOf(c))
            .filter(i => i >= 0);
        for (let a = 0; a < indices.length; a++) {
            for (let b = a + 1; b < indices.length; b++) {
                const [i, j] = [indices[a], indices[b]];
                interactionMatrix.all[i][j]++;
                interactionMatrix.all[j][i]++;
                if (film) {
                    interactionMatrix[film][i][j]++;
                    interactionMatrix[film][j][i]++;
                }
            }
        }
    });

    Object.values(sceneStats).forEach(s => {
        s.characterCount = s.characters.size;
        s.fellowshipCount = s.fellowship.size;
        delete s.characters;
        delete s.fellowship;
    });

    // Map scene name to {filmIndex, sceneIndex} for presence matrix
    const SCENE_INDEX = {};
    SCENE_NAMES.forEach((name, i) => {
        SCENE_INDEX[name] = { filmIndex: Math.floor(i / 32), sceneIndex: i % 32 };
    });

    // Initialize the InfoPanel
    window.infoPanel = new InfoPanel(
        { characterStats, sceneStats, characterData, corpusWordFreq, corpusNgramFreq, SCENE_INDEX },
        data
    );
    window.infoPanel.showScene(0);

    // Initialize chord diagram in the viz panel
    chordVis = new CharacterChord(
        { parentElement: document.querySelector('.chord-container') },
        { interactionMatrix, fellowshipOrder: FELLOWSHIP_ORDER }
    );

}).catch(err => console.error('Data load error:', err));


/**
 * Event handlers
 */

// Ensure the shared tooltip element exists at startup so chord + info icons can use it immediately
if (!document.getElementById('presence-tooltip')) {
    const tip = document.createElement('div');
    tip.id = 'presence-tooltip';
    tip.className = 'presence-tooltip';
    tip.style.display = 'none';
    document.body.appendChild(tip);
}

// Chord diagram info icon tooltip
const chordInfoIcon = document.querySelector('.chord-info-icon');
if (chordInfoIcon) {
    const getTooltip = () => document.getElementById('presence-tooltip');
    chordInfoIcon.addEventListener('mouseover', e => {
        const tip = getTooltip();
        if (!tip) return;
        tip.style.display = 'block';
        tip.style.left = (e.pageX + 10) + 'px';
        tip.style.top  = (e.pageY + 10) + 'px';
        tip.innerHTML  = '<span class="pt-name">Scene Co-occurrence</span>'
            + '<strong>Arcs</strong> represent each Fellowship member — size reflects total scenes with spoken dialogue. '
            + '<strong>Ribbons</strong> connect pairs who share scenes — thickness reflects how many scenes they share. '
            + '<br><br>Click an arc to lock its connections. Click again or press <strong>Esc</strong> to clear.';
    });
    chordInfoIcon.addEventListener('mousemove', e => {
        const tip = getTooltip();
        if (!tip) return;
        tip.style.left = (e.pageX + 10) + 'px';
        tip.style.top  = (e.pageY + 10) + 'px';
    });
    chordInfoIcon.addEventListener('mouseout', () => {
        const tip = getTooltip();
        if (tip) tip.style.display = 'none';
    });
}

// Film filter dropdown for chord visualization
document.querySelector('.chord-film-select').addEventListener('change', e => {
    chordVis.updateVis(e.target.value);
});

// Toggle character view when a fellowship card is clicked; re-click deselects
document.querySelectorAll('.character-card').forEach(card => {
    card.addEventListener('click', e => {
        const name = e.currentTarget.querySelector('.character-name').textContent.trim();
        const isActive = e.currentTarget.classList.contains('active');
        document.querySelectorAll('.character-card').forEach(c => c.classList.remove('active'));
        if (!isActive) {
            e.currentTarget.classList.add('active');
            window.infoPanel.showCharacter(name);
        } else {
            window.infoPanel.showScene(+document.getElementById('timelineSlider').value);
        }
    });
});


// Toggle fellowship card and info panel when a character marker is clicked
document.getElementById('svgMap').addEventListener('click', e => {
    const marker = e.target.closest('.character-marker');
    if (marker) {
        const name = marker.getAttribute('data-character');
        const card = Array.from(document.querySelectorAll('.character-card'))
            .find(c => c.querySelector('.character-name')?.textContent.trim() === name);
        const isActive = card && card.classList.contains('active');
        document.querySelectorAll('.character-card').forEach(c => c.classList.remove('active'));
        if (card && !isActive) {
            card.classList.add('active');
            window.infoPanel.showCharacter(name);
        } else {
            window.infoPanel.showScene(+document.getElementById('timelineSlider').value);
        }
        // Prevent map click handler from immediately deselecting
        e.stopPropagation();
    }
});

// Sync dropdown and update scene info on slider move
document.getElementById('timelineSlider').addEventListener('input', e => {
    const idx = +e.target.value;
    document.getElementById('sceneSelect').value = idx;
    // Clear character selection
    document.querySelectorAll('.character-card').forEach(c => c.classList.remove('active'));
    window.showFellowshipStartPositionsForCurrentScene();
    infoPanel.showScene(idx);
});

// Sync slider and update scene info on dropdown change
document.getElementById('sceneSelect').addEventListener('change', e => {
    const idx = +e.target.value;
    document.getElementById('timelineSlider').value = idx;
    // Clear character selection
    document.querySelectorAll('.character-card').forEach(c => c.classList.remove('active'));
    window.showFellowshipStartPositionsForCurrentScene();
    window.infoPanel.showScene(idx);
});

// Deselect character and return to scene view on map background click
document.getElementById('svgMap').addEventListener('click', e => {
    // Ignore clicks on character markers
    if (e.target.closest('.character-marker')) return;
    document.querySelectorAll('.character-card').forEach(c => c.classList.remove('active'));
    window.infoPanel.showScene(+document.getElementById('timelineSlider').value);
});
