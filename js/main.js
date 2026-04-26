/**
 * Load data from CSV files and initialize visualizations and handlers
 */

// class elements
let infoPanel;

d3.csv('data/data.csv').then(data => {
    data.forEach(d => {
        if (d.location) {
            const [x, y] = d.location.trim().split(/\s+/);
            d.x = +x;
            d.y = +y;
        }
        d.wordCount = d.dialogue ? d.dialogue.trim().split(/\s+/).length : 0;
    });

    // Instantiate the info panel and show the opening scene by default
    infoPanel = new InfoPanel({ characterStats: {}, sceneStats: {} }, []);
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
