/**
 * CharacterWords - scrollable horizontal bar chart of a character's top words, with a film filter and a Most Used / Most Unique toggle.
 */
class CharacterWords {

    /**
     * @param {Object} _config - parentElement (the scroll container div)
     * @param {Array}  _data - all CSV rows for the character
     * @param {Object} _corpusWordFreq - corpus-wide word frequencies for unique-word scoring
     */
    constructor(_config, _data, _corpusWordFreq) {
        this.config = {
            parentElement:  _config.parentElement,
            containerWidth: 420,
            rowHeight: 22,
            margin: { top: 6, right: 52, bottom: 6, left: 95 },
        };
        this.data = _data;
        this.corpusWordFreq = _corpusWordFreq;
        this.film = 'all';
        this.mode = 'freq';
        this.initVis();
    }

    /**
     * Builds the SVG skeleton, scales, and axis groups
     */
    initVis() {
        let vis = this;

        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;

        // Set scale with visible gap between bars
        vis.xScale = d3.scaleLinear().range([0, vis.width]);
        vis.yScale = d3.scaleBand().padding(0.22);

        vis.svg = d3.select(vis.config.parentElement)
            .append('svg')
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .style('width', '100%')
            .style('display', 'block');

        vis.chart = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        // Y-axis group
        vis.yAxisG = vis.chart.append('g').attr('class', 'words-y-axis');

        vis.updateVis();
    }

    /**
     * Filters data by film, scores words by freq or uniqueness, updates scales and SVG height
     * @param {string} [film] - 'all' or full film name
     * @param {string} [mode] - 'freq' or 'unique'
     */
    updateVis(film, mode) {
        let vis = this;
        if (film !== undefined) vis.film = film;
        if (mode !== undefined) vis.mode = mode;

        const filtered = vis.film === 'all'
            ? vis.data
            : vis.data.filter(d => d.film === vis.film);

        // Build per-character word frequency from dialogue_cleaned
        const charFreq = {};
        filtered.forEach(d => {
            (d.dialogue_cleaned || '').split(' ').filter(Boolean).forEach(w => {
                charFreq[w] = (charFreq[w] || 0) + 1;
            });
        });

        const totalLines = filtered.length || 1;

        // Score each word by raw frequency, relative uniqueness vs. corpus, or % of lines
        const scored = Object.entries(charFreq).map(([w, f]) => ({
            word:  w,
            score: vis.mode === 'unique'
                ? (f / ((vis.corpusWordFreq[w] || 0) + 1)) * 100
                : vis.mode === 'rate'
                    ? (f / totalLines) * 100
                    : f,
        }));

        // Sort descending, all words; band scale maps index 0 → top of chart
        vis.words = scored.sort((a, b) => b.score - a.score);

        // Grow the SVG height to fit all bars exactly
        vis.height = vis.words.length * vis.config.rowHeight;
        const totalH = vis.height + vis.config.margin.top + vis.config.margin.bottom;
        vis.yScale.range([0, vis.height]).domain(vis.words.map(d => d.word));
        vis.svg.attr('viewBox', `0 0 ${vis.config.containerWidth} ${totalH}`);

        vis.xScale.domain([0, d3.max(vis.words, d => d.score) || 1]);

        vis.renderVis();
        vis._syncScrollHeight();
    }

    /**
     * Sets the scroll container height so exactly 10 rows (or fewer if less data) are visible.
     * Measures the container's rendered pixel width and converts viewBox units to pixels.
     */
    _syncScrollHeight() {
        let vis = this;
        const containerW = vis.config.parentElement.getBoundingClientRect().width;
        if (!containerW) return;

        // Convert viewBox units to pixels using the ratio of rendered width to viewBox width
        const scale = containerW / vis.config.containerWidth;
        const rowPx = vis.config.rowHeight * scale;
        const marginPx = (vis.config.margin.top + vis.config.margin.bottom) * scale;

        // Cap at actual word count so characters with < 10 unique words don't leave dead space
        const visibleRows = Math.min(10, vis.words.length);
        vis.config.parentElement.style.height = Math.round(visibleRows * rowPx + marginPx) + 'px';
    }

    /**
     * Draws or updates bars, end-labels, and y-axis word labels
     */
    renderVis() {
        let vis = this;

        // Bars
        vis.chart.selectAll('.word-bar')
            .data(vis.words, d => d.word)
            .join('rect')
            .attr('class', 'word-bar')
            .attr('y',      d => vis.yScale(d.word))
            .attr('height', vis.yScale.bandwidth())
            .attr('x', 0)
            .attr('rx', 2)
            .attr('fill', 'rgba(232,217,181,0.55)')
            .transition().duration(280)
            .attr('width', d => vis.xScale(d.score));

        // Score label at the right end of each bar
        vis.chart.selectAll('.word-score')
            .data(vis.words, d => d.word)
            .join('text')
            .attr('class', 'word-score')
            .attr('y', d => vis.yScale(d.word) + vis.yScale.bandwidth() / 2)
            .attr('dominant-baseline', 'middle')
            .attr('fill', 'rgba(232,217,181,0.45)')
            .style('font-family', 'Cinzel, serif')
            .style('font-size', '8px')
            .transition().duration(280)
            .attr('x', d => vis.xScale(d.score) + 5)
            .text(d => vis.mode === 'freq' ? d.score : `${d.score.toFixed(1)}%`);

        // Y-axis with word labels only
        vis.yAxisG
            .call(d3.axisLeft(vis.yScale).tickSize(0))
            .call(g => g.select('.domain').remove())
            .selectAll('text')
            .attr('x', -8)
            .attr('fill', 'rgba(232,217,181,0.8)')
            .style('font-family', 'Cinzel, serif')
            .style('font-size', '9px')
            .style('text-anchor', 'end');
    }
}
