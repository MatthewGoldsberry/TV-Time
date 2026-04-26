/**
 * CharacterPhrases - phrase tag cloud of a character's most distinctive repeated phrases, scored by exclusivity vs. the full cast and sized by raw repetition count.
 */

const PHRASE_FILLER_WORDS = new Set([
    'a','an','the','and','or','but','for','nor','so','yet',
    'at','by','in','of','on','to','up','as','is','it','its','be','am','are','was',
    'were','been','have','has','had','do','does','did','i','my','me','we','our',
    'you','your','he','his','she','her','they','their','this','that','these','those',
    'not','no','if','then','than','when','where','what','which','who','how','all',
    'just','with','from','will','would','could','should','may','might','shall',
]);

// Named characters used to block "[filler word] [name]" address patterns in 2-grams
const SCRIPT_NAMES = new Set([
    'frodo','sam','merry','pippin','gandalf','aragorn','legolas','gimli','boromir',
    'sauron','saruman','gollum','smeagol','arwen','eowyn','faramir','theoden',
    'elrond','bilbo','treebeard','grima',
]);

/**
 * Returns a seeded PRNG closure so identical phrase sets always produce identical cloud layouts.
 * @param {number} seed
 */
function mulberry32(seed) {
    return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

/**
 * Returns true if every token of shorter appears consecutively inside longer.
 * @param {string} shorter
 * @param {string} longer
 */
function isSubPhrase(shorter, longer) {
    const s = shorter.split(' ');
    const l = longer.split(' ');
    if (s.length >= l.length) return false;
    for (let i = 0; i <= l.length - s.length; i++) {
        if (s.every((w, j) => l[i + j] === w)) return true;
    }
    return false;
}

class CharacterPhrases {

    /**
     * @param {Object} _config - parentElement (the phrases-bars div)
     * @param {Array}  _data - all CSV rows for the character
     * @param {Object} _corpusNgramFreq - corpus-wide n-gram counts for distinctiveness scoring
     */
    constructor(_config, _data, _corpusNgramFreq) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: 340,
            containerHeight: 85,
        };
        this.data = _data;
        this.corpusNgramFreq = _corpusNgramFreq;
        this.film = 'all';
        this._layout = null;
        this.initVis();
    }

    /**
     * Builds the SVG skeleton, font-size scale, and grabs the shared tooltip.
     */
    initVis() {
        let vis = this;

        // Linear so the highest-count phrase genuinely dominates at this small item count
        vis.fontScale = d3.scaleLinear().range([9, 24]);

        vis.svg = d3.select(vis.config.parentElement)
            .append('svg')
            .attr('viewBox', `0 0 ${vis.config.containerWidth} ${vis.config.containerHeight}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .style('width', '100%')
            .style('display', 'block');

        // D3-cloud positions words relative to layout center
        vis.chart = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.containerWidth / 2},${vis.config.containerHeight / 2})`);

        vis.tooltip = d3.select('#presence-tooltip');

        // Safety net: hide tooltip when the cursor leaves the chart area entirely
        vis.svg.on('mouseleave', () => vis.tooltip.style('display', 'none'));

        vis.updateVis();
    }

    /**
     * Scores and deduplicates candidate phrases for the current film, then triggers the cloud layout.
     * @param {string} [film] - 'all' or full film name
     */
    updateVis(film) {
        let vis = this;
        if (film !== undefined) vis.film = film;

        // Dismiss any open tooltip before the layout changes so removed elements can't leave it stranded
        vis.tooltip.style('display', 'none');

        const isAllFilms = vis.film === 'all';

        const filtered = isAllFilms
            ? vis.data
            : vis.data.filter(d => d.film === vis.film);

        const counts   = {};
        const examples = {};

        // Split on sentence boundaries so n-grams never cross a period/question/exclamation
        filtered.forEach(d => {
            const sentences = (d.dialogue || '').split(/[.!?]+/);
            sentences.forEach(sentence => {
                const words = sentence
                    .toLowerCase()
                    .replace(/-/g, ' ')         // split hyphenated compounds before stripping punctuation
                    .replace(/[^a-z\s']/g, '')
                    .split(/\s+/)
                    .filter(Boolean);

                for (let n = 2; n <= 8; n++) {
                    for (let i = 0; i <= words.length - n; i++) {
                        const gram = words.slice(i, i + n).join(' ');
                        counts[gram] = (counts[gram] || 0) + 1;
                        if (!examples[gram]) examples[gram] = d.dialogue;
                    }
                }
            });
        });

        // Block exact 2-word address patterns like "for frodo" or "gandalf the"; longer phrases and those without a character name are unaffected
        const hasContent = phrase => {
            const tokens = phrase.split(' ');
            if (tokens.length === 2) {
                const isStopName = PHRASE_FILLER_WORDS.has(tokens[0]) && SCRIPT_NAMES.has(tokens[1]);
                const isNameStop = SCRIPT_NAMES.has(tokens[0]) && PHRASE_FILLER_WORDS.has(tokens[1]);
                if (isStopName || isNameStop) return false;
            }
            return tokens.some(w => !PHRASE_FILLER_WORDS.has(w));
        };

        let qualifyingPhrases = Object.entries(counts)
            .filter(([phrase, count]) => count >= 3 && hasContent(phrase))
            .map(([phrase, count]) => {
                const corpusCount = vis.corpusNgramFreq[phrase] || count;
                const distinctiveness = count / ((corpusCount - count) + 1);
                // Length bonus favours structurally complete phrases over shorter fragments
                const lengthBonus = Math.pow(phrase.split(' ').length, 1.2);
                const score = count * distinctiveness * lengthBonus;
                return { text: phrase, score, count, example: examples[phrase] };
            });

        // Sort before deduplication
        // 'all' ranks by count so high-frequency cores beat exclusive fragments
        // single-film ranks by score in effort surface character-exclusive phrases first
        if (isAllFilms) {
            qualifyingPhrases.sort((a, b) => b.count - a.count);
        } else {
            qualifyingPhrases.sort((a, b) => b.score - a.score);
        }

        // Drop any phrase overlapping (in either direction) with a higher-ranked one
        const deduped = qualifyingPhrases.filter((p, index) => {
            const higher = qualifyingPhrases.slice(0, index);
            return !higher.some(q => isSubPhrase(p.text, q.text) || isSubPhrase(q.text, p.text));
        });

        const topPhrases = deduped.slice(0, 10);

        // Font size and opacity both track raw count so visual emphasis matches repetition
        vis.fontScale.domain([0, d3.max(topPhrases, d => d.count) || 1]);

        if (vis._layout) vis._layout.stop();

        // Reset seed so the same phrase set always yields the same placement
        const rng = mulberry32(0xDEADBEEF);

        vis._layout = d3.layout.cloud()
            .size([vis.config.containerWidth, vis.config.containerHeight])
            .words(topPhrases)
            .padding(6)
            .rotate(() => 0)
            .random(rng)
            .font('Cinzel')
            .fontSize(d => vis.fontScale(d.count))
            .on('end', words => vis.renderVis(words));

        vis._layout.start();
    }

    /**
     * Places or animates phrase elements from the completed cloud layout.
     * @param {Array} words - positioned phrase objects returned by d3-cloud
     */
    renderVis(words) {
        let vis = this;

        // Most-repeated phrase is always brightest
        const maxCount = d3.max(words, w => w.count) || 1;
        words.forEach(w => {
            if (w.opacity === undefined) w.opacity = 0.45 + (w.count / maxCount) * 0.55;
        });

        vis.chart.selectAll('.phrase-text')
            .data(words, d => d.text)
            .join(
                enter => enter.append('text')
                    .attr('class', 'phrase-text')
                    .attr('text-anchor', 'middle')
                    .style('font-family', 'Cinzel, serif')
                    .style('fill', d => `rgba(232,217,181,${d.opacity})`)
                    .attr('transform', d => `translate(${d.x},${d.y})rotate(${d.rotate})`)
                    .style('font-size', d => `${d.size}px`)
                    .style('opacity', 0)
                    .call(e => e.transition().duration(400).style('opacity', 1)),
                update => update
                    .call(u => u.transition().duration(400)
                        .attr('transform', d => `translate(${d.x},${d.y})rotate(${d.rotate})`)
                        .style('font-size', d => `${d.size}px`)
                        .style('fill', d => `rgba(232,217,181,${d.opacity})`)),
                exit => exit
                    .call(x => x.transition().duration(200).style('opacity', 0).remove())
            )
            .text(d => d.text)
            .on('mouseover', (event, d) => {
                const excerpt = d.example && d.example.length > 140
                    ? d.example.slice(0, 140) + '…'
                    : d.example || '';
                vis.tooltip
                    .style('display', 'block')
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top',  (event.pageY + 10) + 'px')
                    .html(`<span class="pt-name">"${d.text}"</span><span class="pt-count">said ${d.count} times</span>${excerpt}`);
            })
            .on('mousemove', event => {
                vis.tooltip
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top',  (event.pageY + 10) + 'px');
            })
            .on('mouseout', () => vis.tooltip.style('display', 'none'));
    }
}
