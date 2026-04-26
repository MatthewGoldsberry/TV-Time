/**
 * Load data from CSV files and initialize visualizations and handlers
 */

// class elements
let infoPanel;

d3.csv('data/lotr_script_data.csv').then(data => {
    const characterStats = {};
    const characterData = {};
    const corpusWordFreq = {};
    const corpusNgramFreq = {};
    const sceneStats = {};

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
    });

    // Convert flattened sets to counts
    Object.values(characterStats).forEach(s => {
        s.sceneCount = s.scenes.size;
        delete s.scenes;
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
    infoPanel = new InfoPanel(
        { characterStats, sceneStats, characterData, corpusWordFreq, corpusNgramFreq, SCENE_INDEX },
        data
    );
    infoPanel.showScene(0);

}).catch(err => console.error('Data load error:', err));


/**
 * Event handlers
 */

// Toggle character view when a fellowship card is clicked; re-click deselects
document.querySelectorAll('.character-card').forEach(card => {
    card.addEventListener('click', e => {
        const name = e.currentTarget.querySelector('.character-name').textContent.trim();
        const isActive = e.currentTarget.classList.contains('active');
        document.querySelectorAll('.character-card').forEach(c => c.classList.remove('active'));
        if (!isActive) {
            e.currentTarget.classList.add('active');
            infoPanel.showCharacter(name);
        } else {
            infoPanel.showScene(+document.getElementById('timelineSlider').value);
        }
    });
});

// TODO add handler to toggle fellowship card when character icon is clicked

// Sync dropdown and update scene info on slider move
document.getElementById('timelineSlider').addEventListener('input', e => {
    const idx = +e.target.value;
    document.getElementById('sceneSelect').value = idx;
    if (!document.querySelector('.character-card.active')) infoPanel.showScene(idx);
});

// Sync slider and update scene info on dropdown change
document.getElementById('sceneSelect').addEventListener('change', e => {
    const idx = +e.target.value;
    document.getElementById('timelineSlider').value = idx;
    if (!document.querySelector('.character-card.active')) infoPanel.showScene(idx);
});

// Deselect character and return to scene view on map background click
document.getElementById('svgMap').addEventListener('click', e => {
    if (!e.target.closest('circle')) {
        document.querySelectorAll('.character-card').forEach(c => c.classList.remove('active'));
        infoPanel.showScene(+document.getElementById('timelineSlider').value);
    }
});
