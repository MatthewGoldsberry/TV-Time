/**
 * InfoPanel class definition; wrapper around all info displayed in character and scene info popover
 */

// Scene names pulled from the dropdown so JS and HTML stay in sync
const SCENE_NAMES = Array.from(document.querySelectorAll('#sceneSelect option')).map(o => o.textContent.trim());

const FILM_NAMES = [ 'The Fellowship of the Ring', 'The Two Towers', 'The Return of the King'];

const FELLOWSHIP = new Set(['Frodo', 'Sam', 'Merry', 'Pippin', 'Gandalf', 'Aragorn', 'Legolas', 'Gimli', 'Boromir']);

// Tolkien Gateway URLs keyed by character name
const CHARACTER_WIKI_URLS = {
    'Frodo': 'https://tolkiengateway.net/wiki/Frodo_Baggins',
    'Sam': 'https://tolkiengateway.net/wiki/Samwise_Gamgee',
    'Merry': 'https://tolkiengateway.net/wiki/Meriadoc_Brandybuck',
    'Pippin': 'https://tolkiengateway.net/wiki/Peregrin_Took',
    'Gandalf': 'https://tolkiengateway.net/wiki/Gandalf',
    'Aragorn': 'https://tolkiengateway.net/wiki/Aragorn',
    'Legolas': 'https://tolkiengateway.net/wiki/Legolas',
    'Gimli': 'https://tolkiengateway.net/wiki/Gimli',
    'Boromir': 'https://tolkiengateway.net/wiki/Boromir',
};

const EXPAND_HINT = `<button class="expand-hint" aria-label="Expand panel for more detail">&#x26F6;&ensp;Expand for more detail</button>`;


class InfoPanel {

    /**
     * @param {Object} config - characterStats and sceneStats lookup maps
     * @param {Array}  data - parsed CSV rows
     */
    constructor(_config, _data) {
        this.data = _data;
        this.characterStats = _config.characterStats;
        this.sceneStats = _config.sceneStats;
        this.characterData = _config.characterData;
        this.corpusWordFreq = _config.corpusWordFreq;
        this.SCENE_INDEX = _config.SCENE_INDEX;
        this.isExpanded = false;
        this.initVis();
    }

    /**
     * Binds DOM element references and wires panel interaction event listeners
     */
    initVis() {
        this.panel     = document.getElementById('infoPanel');
        this.backdrop  = document.getElementById('infoPanelBackdrop');
        this.expandBtn = document.getElementById('expandInfoBtn');
        this.titleEl   = document.querySelector('#infoPanel .panel-title');
        this.contentEl = document.querySelector('#infoPanel .info-content');

        this.expandBtn.addEventListener('click', () => this.setExpanded(!this.isExpanded));
        this.backdrop.addEventListener('click', () => this.setExpanded(false));

        // Delegate expand-hint clicks so re-rendered content is always covered
        this.panel.addEventListener('click', e => {
            if (e.target.closest('.expand-hint')) this.setExpanded(true);
        });
    }

    /**
     * Toggles the panel between its default and expanded (centered overlay) states
     * @param {boolean} expand
     */
    setExpanded(expand) {
        this.isExpanded = expand;
        this.panel.classList.toggle('expanded', expand);
        this.backdrop.classList.toggle('visible', expand);
        this.expandBtn.innerHTML = expand ? '&#x2715;' : '&#x26F6;';
        this.expandBtn.setAttribute('aria-label', expand ? 'Collapse' : 'Expand');
    }

    /**
     * Renders character portrait, wiki link, and stat labels for the given name
     * @param {string} name - character name
     */
    showCharacter(name) {
        const stats  = this.characterStats[name];
        const imgSrc = `data/images/${name.toLowerCase()}.png`;

        // Display Wiki links
        const wikiUrl = CHARACTER_WIKI_URLS[name];
        const wikiLinkHTML = wikiUrl
            ? `<a class="char-wiki-link" href="${wikiUrl}" target="_blank" rel="noopener">View ${name}'s Wiki Page ↗</a>`
            : '';

        const fmt = v => (v != null && v !== 0) ? v.toLocaleString() : '—';

        this.titleEl.textContent = name;
        this.contentEl.innerHTML = `
            <div class="char-info">
                <img class="char-portrait"
                     src="${imgSrc}"
                     alt="${name}"
                     onerror="this.style.display='none'">
                ${wikiLinkHTML}
                <div class="char-stats">
                    <div class="char-stat">
                        <span class="stat-label">Lines</span>
                        <span class="stat-value">${fmt(stats?.lines)}</span>
                    </div>
                    <div class="char-stat">
                        <span class="stat-label">Words</span>
                        <span class="stat-value">${fmt(stats?.words)}</span>
                    </div>
                    <div class="char-stat">
                        <span class="stat-label">Scenes</span>
                        <span class="stat-value">${fmt(stats?.sceneCount)}</span>
                    </div>
                </div>
                <div class="char-extended">
                    <div class="extended-section">
                        <p class="section-label">Top Scenes</p>
                        <ul class="bar-list"></ul>
                    </div>
                </div>
                ${EXPAND_HINT}
            </div>`;
    }

    /**
     * Renders scene name, film, and stat labels for the scene at the given index
     * @param {number} index - 0–95
     */
    showScene(index) {
        const sceneName = SCENE_NAMES[index] ?? '';
        const stats     = this.sceneStats[sceneName];
        const filmName  = FILM_NAMES[Math.floor(index / 32)] ?? '';
        const imgSrc    = `data/images/scene/${index}.png`;

        const fmt = v => (v != null && v !== 0) ? v.toLocaleString() : '—';

        this.titleEl.textContent = 'Scene Info';
        this.contentEl.innerHTML = `
            <div class="scene-info">
                <h3 class="scene-name">${sceneName}</h3>
                <p class="scene-film">${filmName}</p>
                <div class="scene-stats">
                    <div class="char-stat">
                        <span class="stat-label">Lines</span>
                        <span class="stat-value">${fmt(stats?.lines)}</span>
                    </div>
                    <div class="char-stat">
                        <span class="stat-label">Characters</span>
                        <span class="stat-value">${fmt(stats?.characterCount)}</span>
                    </div>
                    <div class="char-stat">
                        <span class="stat-label">Fellowship</span>
                        <span class="stat-value">${stats?.fellowshipCount != null ? `${stats.fellowshipCount} / 9` : '— / 9'}</span>
                    </div>
                </div>
                <div class="scene-extended">
                    <p class="section-label">Speaking Characters</p>
                    <ul class="bar-list"></ul>
                </div>
                ${EXPAND_HINT}
            </div>`;
    }
}
