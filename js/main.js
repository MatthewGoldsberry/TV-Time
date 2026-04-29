/**
 * Load data from CSV files and initialize visualizations and handlers
 */

// class elements (expose infoPanel to window for scene-slider.js access)
window.infoPanel = null;
let chordVis;
let fellowshipLinesVis;

const SCENE_NAMES = Array.from(document.querySelectorAll('#sceneSelect option')).map(o => o.textContent.trim());

const FELLOWSHIP_ORDER = ['Frodo','Sam','Merry','Pippin','Gandalf','Aragorn','Legolas','Gimli','Boromir'];

// Derived Set for membership tests
const FELLOWSHIP = new Set(FELLOWSHIP_ORDER);

// Expose FELLOWSHIP to window for ScenePlayer access
window.FELLOWSHIP = FELLOWSHIP;

// Base RGB per character
const CHARACTER_COLORS = {
    'Frodo':   [158,  32,  62],
    'Sam':     [125,  72,  32],
    'Merry':   [172,  82,  28],
    'Pippin':  [192, 142,   8],
    'Gandalf': [200, 200, 200],
    'Aragorn': [ 42, 122,  52],
    'Legolas': [128,  48, 168],
    'Gimli':   [ 88,  78,  68],
    'Boromir': [ 42,  88, 172],
};

const SCENE_SUMMARIES = {
    "0": {
        summary: "Galadriel narrates the history of the Rings of Power and the Last Alliance's victory over Sauron."
    },
    "1": {
        summary: "Frodo greets Gandalf as the wizard arrives in the peaceful lands of Hobbiton."
    },
    "2": {
        summary: "Gandalf and Bilbo reunite at Bag End to discuss Bilbo's upcoming plans to leave the Shire."
    },
    "3": {
        summary: "Bilbo celebrates his 111th birthday and uses the Ring to vanish during his farewell speech."
    },
    "4": {
        summary: "Bilbo departs the Shire for good, leaving the Ring to Frodo after some firm persuasion from Gandalf."
    },
    "5": {
        summary: "Gandalf travels to Minas Tirith to research ancient scrolls regarding the history of the One Ring."
    },
    "6": {
        summary: "Gandalf tests the Ring in the fire, reveals its true, dangerous nature to Frodo, and catches Sam eavesdropping."
    },
    "7": {
        summary: "Frodo and Sam quietly watch a procession of Wood-elves departing Middle-earth for the Undying Lands."
    },
    "8": {
        summary: "Gandalf seeks counsel from Saruman in Isengard, only to discover his old friend's betrayal and alliance with Sauron."
    },
    "9": {
        summary: "Merry and Pippin crash into Frodo and Sam, leading to a terrifying close encounter with a Nazgûl."
    },
    "10": {
        summary: "The hobbits arrive at the inn in Bree, where Frodo accidentally wears the Ring and meets the mysterious Strider."
    },
    "11": {
        summary: "The Ringwraiths attack the hobbits at Weathertop, stabbing Frodo with a poisoned Morgul blade."
    },
    "12": {
        summary: "Arwen helps Frodo escape the pursuing Ringwraiths, ultimately washing the riders away at the river's crossing."
    },
    "13": {
        summary: "Frodo awakens healed in the Elven sanctuary, reuniting with Gandalf, Bilbo, and the rest of the hobbits."
    },
    "14": {
        summary: "Boromir arrives in Rivendell and examines the shattered remains of Narsil, the sword that cut the Ring from Sauron's hand."
    },
    "15": {
        summary: "Representatives of Men, Elves, and Dwarves debate the fate of the Ring, resulting in the formation of the Fellowship."
    },
    "16": {
        summary: "The newly formed Fellowship sets out from Rivendell to begin their perilous quest to Mordor."
    },
    "17": {
        summary: "The Fellowship travels southward and is forced into hiding from Saruman's spying crows."
    },
    "18": {
        summary: "Saruman conjures a fierce storm and avalanche, forcing the Fellowship to abandon the mountain pass for the mines below."
    },
    "19": {
        summary: "A terrifying tentacled monster attacks the group at the gates of Moria, sealing them inside the dark mines."
    },
    "20": {
        summary: "The Fellowship navigates the treacherous, goblin-infested ruins of the dwarven city of Khazad-dûm."
    },
    "21": {
        summary: "The Fellowship discovers the grim fate of Balin's colony and fights off a horde of goblins and a Cave Troll."
    },
    "22": {
        summary: "Gandalf confronts a demonic Balrog, sacrificing himself to the abyss so the rest of the Fellowship can escape."
    },
    "23": {
        summary: "The grieving Fellowship enters the golden woods of Lothlórien and is intercepted by the marchwarden Haldir."
    },
    "24": {
        summary: "The Fellowship meets Lord Celeborn and Lady Galadriel, who offer them safe haven and counsel."
    },
    "25": {
        summary: "Frodo peers into a magical basin, witnessing dark visions of a potential future and the terrifying Eye of Sauron."
    },
    "26": {
        summary: "In Isengard, Saruman breeds a new, stronger breed of orc specifically tasked to hunt down the Fellowship."
    },
    "27": {
        summary: "Galadriel bestows magical gifts upon the Fellowship as they depart the woods via boats down the river Anduin."
    },
    "28": {
        summary: "The Fellowship paddles down the Anduin River, passing the colossal, awe-inspiring Argonath statues."
    },
    "29": {
        summary: "Boromir succumbs to the Ring's temptation and tries to take it, leading Frodo to realize he must continue alone."
    },
    "30": {
        summary: "The Uruk-hai ambush the group; Boromir falls valiantly defending Merry and Pippin, who are subsequently captured."
    },
    "31": {
        summary: "Frodo and Sam cross the river to head toward Mordor, while Aragorn, Legolas, and Gimli decide to hunt the Uruk-hai."
    },
    "32": {
        summary: "Frodo and Sam navigate the sharp rocks of the Emyn Muil, utilizing the magical rope gifted by Galadriel."
    },
    "33": {
        summary: "Frodo and Sam ambush and capture Gollum, but Frodo shows him pity and recruits him as their guide to Mordor."
    },
    "34": {
        summary: "The Uruk-hai relentlessly push Merry and Pippin across the plains of Rohan, occasionally clashing with regular Mordor orcs."
    },
    "35": {
        summary: "Éomer is exiled from his homeland by Gríma Wormtongue, who acts on behalf of a bewitched King Théoden."
    },
    "36": {
        summary: "The Rohirrim ambush the Uruk-hai encampment at night, allowing Merry and Pippin to escape into Fangorn Forest."
    },
    "37": {
        summary: "Aragorn, Legolas, and Gimli encounter Éomer's riders and discover the smoldering remains of the Uruk-hai."
    },
    "38": {
        summary: "Fleeing into Fangorn, Merry and Pippin encounter the ancient, slow-speaking Ent known as Treebeard."
    },
    "39": {
        summary: "Gollum guides Frodo and Sam through the treacherous Dead Marshes, warning them not to follow the ghostly lights."
    },
    "40": {
        summary: "Aragorn, Legolas, and Gimli reunite with their fallen friend in Fangorn, who has returned as Gandalf the White."
    },
    "41": {
        summary: "Frodo and Sam arrive at the impregnable Black Gate of Mordor, prompting Gollum to suggest a secret, alternate path."
    },
    "42": {
        summary: "Merry and Pippin drink magical Ent-water in Fangorn Forest, leading to a humorous dispute over their newfound height."
    },
    "43": {
        summary: "Gandalf forcefully frees King Théoden from Saruman's magical possession and casts Gríma Wormtongue out of Edoras."
    },
    "44": {
        summary: "A newly awakened King Théoden mourns the death of his son and heir, who fell to Saruman's orcs."
    },
    "45": {
        summary: "Believing it to be the safest course, Théoden orders his people to evacuate Edoras and take refuge in Helm's Deep."
    },
    "46": {
        summary: "Sméagol argues with his darker alter ego, Gollum, in a schizophrenic internal debate, seemingly banishing 'Gollum' for good."
    },
    "47": {
        summary: "Sam cooks a small meal for Frodo before they witness the ambush of a Haradrim patrol and are captured by Rangers."
    },
    "48": {
        summary: "The refugees of Rohan travel to the stronghold."
    },
    "49": {
        summary: "Saruman's Warg-riders attack the refugee caravan, resulting in Aragorn being dragged off a cliff into a river."
    },
    "50": {
        summary: "Saruman addresses his massive, 10,000-strong Uruk-hai army as they march out to destroy Rohan."
    },
    "51": {
        summary: "Faramir interrogates Frodo and Sam, discovering that Frodo carries the ultimate weapon of the enemy."
    },
    "52": {
        summary: "Frodo and Sam are taken to Henneth Annûn, a hidden ranger outpost situated behind a massive waterfall."
    },
    "53": {
        summary: "To spare Sméagol from being executed by Faramir's archers, Frodo tricks him into capture, breaking Sméagol's fragile trust."
    },
    "54": {
        summary: "The outmatched defenders of Helm's Deep arm themselves with whatever weapons they can find."
    },
    "55": {
        summary: "The slow-moving Ents gather to debate whether they will involve themselves in the wars of Men and Wizards."
    },
    "56": {
        summary: "The Uruk-hai army arrives at the fortress in the dead of night, and the rain-soaked battle begins."
    },
    "57": {
        summary: "Uruk-hai sappers use Saruman's explosive powder to blow a massive hole through the previously impenetrable Deeping Wall."
    },
    "58": {
        summary: "Treebeard witnesses the devastating deforestation caused by Saruman and furiously rallies the Ents to go to war."
    },
    "59": {
        summary: "The Ents tear down Isengard's defenses and break the river dam, washing away Saruman's war machine."
    },
    "60": {
        summary: "Théoden and Aragorn lead a desperate final cavalry charge just as Gandalf and Éomer arrive with the rising sun."
    },
    "61": {
        summary: "During a Nazgûl attack in Osgiliath, Sam delivers an inspiring speech to Frodo about holding onto the good in the world."
    },
    "62": {
        summary: "Merry and Pippin discover and enjoy Saruman's private stash of pipe-weed amidst the flooded ruins of Isengard."
    },
    "63": {
        summary: "Frodo, Sam, and Gollum traverse the ruined landscapes of Ithilien, observing a defaced Gondorian statue."
    },
    "64": {
        summary: "A flashback reveals how the hobbit-like Sméagol murdered his friend Déagol to claim the Ring."
    },
    "65": {
        summary: "The victorious group confronts Saruman at the tower of Orthanc, ending when Gríma turns on the wizard."
    },
    "66": {
        summary: "The heroes celebrate their survival at the Golden Hall in Edoras with drinking games and songs."
    },
    "67": {
        summary: "Pippin's curiosity overcomes him; he looks into the Palantír and is subjected to psychic interrogation by Sauron."
    },
    "68": {
        summary: "Gandalf rescues the seer stone from Pippin and realizes Sauron intends to strike the capital of Gondor."
    },
    "69": {
        summary: "Gandalf rides Shadowfax with Pippin, arriving at the awe-inspiring, multi-tiered White City of Gondor."
    },
    "70": {
        summary: "En route to the Grey Havens, Arwen experiences a vision of a future child and turns back to Rivendell."
    },
    "71": {
        summary: "Gandalf and Pippin meet the grieving Lord Denethor, who angrily refuses to light the warning beacons."
    },
    "72": {
        summary: "The terrifying leader of the Ringwraiths dispatches an enormous dark army from the glowing green fortress of Minas Morgul."
    },
    "73": {
        summary: "Pippin scales the city's heights to secretly light the first beacon, setting off a chain reaction across the mountains."
    },
    "74": {
        summary: "Faramir's garrison is overrun by Orcs and retreats to Minas Tirith, harried by Nazgûl until Gandalf intervenes."
    },
    "75": {
        summary: "A resentful Denethor commands his son Faramir to ride out on a suicidal charge to retake the lost city of Osgiliath."
    },
    "76": {
        summary: "Gollum frames Sam for eating all their remaining rations, manipulating Frodo into sending his loyal friend away."
    },
    "77": {
        summary: "King Théoden gathers the riders of the Mark at the encampment of Dunharrow, preparing for the great ride to Gondor."
    },
    "78": {
        summary: "Elrond arrives at Dunharrow to present Aragorn with the newly forged sword of the king, remade from the shards of Narsil."
    },
    "79": {
        summary: "Aragorn, Legolas, and Gimli split off from the Rohirrim to seek a darker, more dangerous path to save Gondor."
    },
    "80": {
        summary: "Aragorn traverses the haunted mountain to compel the cursed Army of the Dead to fulfill their ancient oath."
    },
    "81": {
        summary: "Mordor's vast army surrounds Minas Tirith, utilizing massive catapults and a giant battering ram to break the city gates."
    },
    "82": {
        summary: "Gollum abandons Frodo in the pitch-black tunnels of Cirith Ungol, leaving him to be hunted by the giant spider, Shelob."
    },
    "83": {
        summary: "Sam fights off Shelob to protect Frodo, takes the Ring when he believes Frodo is dead, and then learns the tragic truth from passing orcs."
    },
    "84": {
        summary: "Driven mad by despair, Denethor attempts to burn himself and the severely wounded Faramir alive on a pyre."
    },
    "85": {
        summary: "Théoden's cavalry finally arrives at the Pelennor Fields, delivering a thunderous, overwhelming charge into the orc lines."
    },
    "86": {
        summary: "Gandalf and Pippin manage to save Faramir from the flames, but Denethor perishes by his own hand."
    },
    "87": {
        summary: "The massive conflict escalates as the Haradrim ride giant Mûmakil into battle against the forces of Men."
    },
    "88": {
        summary: "Aragorn arrives with the Army of the Dead to sweep the battlefield clear, afterward releasing the ghosts from their curse."
    },
    "89": {
        summary: "Sam infiltrates the watchtower to rescue Frodo, cutting his way through the surviving orcs and returning the Ring."
    },
    "90": {
        summary: "The surviving leaders decide to march their remaining forces to the Black Gate to act as a distraction for Frodo."
    },
    "91": {
        summary: "A twisted emissary of Sauron emerges from the Black Gate to mentally torture the heroes with Frodo's mithril shirt."
    },
    "92": {
        summary: "Aragorn leads a seemingly hopeless final stand as the gates open and the overwhelming numbers of Mordor pour out."
    },
    "93": {
        summary: "Frodo claims the Ring for himself at the volcano's edge; Gollum bites off his finger but falls into the fiery chasm."
    },
    "94": {
        summary: "Aragorn is officially crowned King of Gondor, reunites with Arwen, and bows in profound respect to the four hobbits."
    },
    "95": {
        summary: "Frodo, Bilbo, and Gandalf board an Elven ship to depart Middle-earth forever, leaving Sam to return to his family."
    }
};

function characterColor(name, alpha) {
    const rgb = CHARACTER_COLORS[name];
    return rgb ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})` : `rgba(232,217,181,${alpha})`;
}

// Expose for use in other modules
window.characterColor = characterColor;

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

    // Build fellowship interaction matrix and per-film scene-presence counts
    const makeMatrix = () => FELLOWSHIP_ORDER.map(() => FELLOWSHIP_ORDER.map(() => 0));
    const interactionMatrix = {
        all: makeMatrix(),
        'The Fellowship of the Ring': makeMatrix(),
        'The Two Towers': makeMatrix(),
        'The Return of the King': makeMatrix(),
    };
    const FILM_KEYS = ['all', 'The Fellowship of the Ring', 'The Two Towers', 'The Return of the King'];
    const sceneCounts = Object.fromEntries(
        FILM_KEYS.map(f => [f, Object.fromEntries(FELLOWSHIP_ORDER.map(n => [n, 0]))])
    );
    Object.entries(sceneStats).forEach(([scene, stats]) => {
        const film = sceneFilm[scene];
        const indices = [...stats.characters]
            .map(c => FELLOWSHIP_ORDER.indexOf(c))
            .filter(i => i >= 0);
        indices.forEach(i => {
            sceneCounts.all[FELLOWSHIP_ORDER[i]]++;
            if (film) sceneCounts[film][FELLOWSHIP_ORDER[i]]++;
        });
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
        { characterStats, sceneStats, characterData, corpusWordFreq, corpusNgramFreq, SCENE_INDEX, SCENE_SUMMARIES },
        data
    );
    window.infoPanel.showScene(0);

    // Initialize chord diagram in the viz panel
    chordVis = new CharacterChord(
        { parentElement: document.querySelector('.chord-container') },
        { interactionMatrix, fellowshipOrder: FELLOWSHIP_ORDER, sceneCounts }
    );

    // Initialize fellowship lines bar chart in the viz panel
    const fellowshipData = data.filter(d => FELLOWSHIP.has(d.character));
    fellowshipLinesVis = new HorizontalBarChart(
        {
            parentElement: document.querySelector('.fellowship-lines-chart'),
            dataMode: 'lines',
            colorFn: d => characterColor(d.word, 0.75),
            rowHeight: 40,
            maxRows: 9,
            noScrollClamp: true,
            labelFontSize: '13px',
            scoreFontSize: '11px',
        },
        fellowshipData,
        null
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

// Fellowship Lines info icon tooltip
const linesInfoIcon = document.querySelector('.lines-info-icon');
if (linesInfoIcon) {
    const getTooltip = () => document.getElementById('presence-tooltip');
    linesInfoIcon.addEventListener('mouseover', e => {
        const tip = getTooltip();
        if (!tip) return;
        tip.style.display = 'block';
        tip.style.left = (e.pageX + 10) + 'px';
        tip.style.top  = (e.pageY + 10) + 'px';
        tip.innerHTML  = '<span class="pt-name">Fellowship Lines</span>'
            + 'Each <strong>bar</strong> shows the total number of spoken dialogue lines for that Fellowship member across the selected film(s). '
            + 'One line = one uninterrupted turn of speech in the screenplay.';
    });
    linesInfoIcon.addEventListener('mousemove', e => {
        const tip = getTooltip();
        if (!tip) return;
        tip.style.left = (e.pageX + 10) + 'px';
        tip.style.top  = (e.pageY + 10) + 'px';
    });
    linesInfoIcon.addEventListener('mouseout', () => {
        const tip = getTooltip();
        if (tip) tip.style.display = 'none';
    });
}

// Film filter dropdown - updates whichever viz is currently active
document.querySelector('.chord-film-select').addEventListener('change', e => {
    chordVis.updateVis(e.target.value);
    if (fellowshipLinesVis) fellowshipLinesVis.updateVis(e.target.value);
});

// Viz panel tab toggle
document.querySelectorAll('.viz-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.viz-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const isChord = tab.dataset.tab === 'chord';
        document.querySelector('.chord-container').style.display = isChord ? '' : 'none';
        document.querySelector('.fellowship-lines-container').classList.toggle('active', !isChord);
        if (!isChord && fellowshipLinesVis) fellowshipLinesVis.resize();
    });
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


// Emphasize the hovered character's path; dim all others
document.getElementById('svgMap').addEventListener('mouseover', e => {
    const marker = e.target.closest('.character-marker');
    if (!marker) return;
    const name = marker.getAttribute('data-character');
    d3.selectAll('.character-path, .character-path-outline')
        .classed('path-dimmed', true)
        .classed('path-highlighted', false);
    d3.selectAll(`.character-path[data-character="${name}"], .character-path-outline[data-character="${name}"]`)
        .classed('path-dimmed', false)
        .classed('path-highlighted', true);
});

// Restore all paths when the pointer leaves a marker
document.getElementById('svgMap').addEventListener('mouseout', e => {
    const marker = e.target.closest('.character-marker');
    if (!marker) return;
    if (marker.contains(e.relatedTarget)) return;
    d3.selectAll('.character-path, .character-path-outline')
        .classed('path-dimmed', false)
        .classed('path-highlighted', false);
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

// Global flag read by SceneSlider.js animation loop and path-building calls
window.showPaths = true;

// Sync dropdown and update scene info on slider move
document.getElementById('timelineSlider').addEventListener('input', e => {
    const idx = +e.target.value;
    document.getElementById('sceneSelect').value = idx;
    document.querySelectorAll('.character-card').forEach(c => c.classList.remove('active'));
    if (window.showPaths) {
        window.buildPathsUpToScene(idx);
    } else {
        window.clearCharacterPaths();
    }
    window.showFellowshipStartPositionsForCurrentScene();
    infoPanel.showScene(idx);
});

// Sync slider and update scene info on dropdown change
document.getElementById('sceneSelect').addEventListener('change', e => {
    const idx = +e.target.value;
    document.getElementById('timelineSlider').value = idx;
    document.querySelectorAll('.character-card').forEach(c => c.classList.remove('active'));
    if (window.showPaths) {
        window.buildPathsUpToScene(idx);
    } else {
        window.clearCharacterPaths();
    }
    window.showFellowshipStartPositionsForCurrentScene();
    window.infoPanel.showScene(idx);
});

// Show/hide paths toggle
document.getElementById('showPathsToggle').addEventListener('change', e => {
    window.showPaths = e.target.checked;
    if (window.showPaths) {
        window.buildPathsUpToScene(+document.getElementById('timelineSlider').value);
    } else {
        window.clearCharacterPaths();
    }
});

// Deselect character and return to scene view on map background click
document.getElementById('svgMap').addEventListener('click', e => {
    // Ignore clicks on character markers
    if (e.target.closest('.character-marker')) return;
    document.querySelectorAll('.character-card').forEach(c => c.classList.remove('active'));
    window.infoPanel.showScene(+document.getElementById('timelineSlider').value);
});
