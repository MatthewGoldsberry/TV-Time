/**
 * HorizontalBarChart - scrollable horizontal bar chart.
 * dataMode 'words': top words from character dialogue with film filter and freq/unique/rate toggle.
 * dataMode 'lines': line counts per character, aggregated from scene rows.
 */
class HorizontalBarChart {

    /**
     * @param {Object} _config - parentElement, dataMode, colorFn, maxRows, rowHeight
     * @param {Array}  _data - CSV rows (character rows for 'words', scene rows for 'lines')
     * @param {Object} _corpusWordFreq - corpus-wide word frequencies (only used in 'words' mode)
     */
    constructor(_config, _data, _corpusWordFreq) {
        this.config = {
            parentElement:  _config.parentElement,
            containerWidth: 420,
            rowHeight:  _config.rowHeight ?? 22,
            margin: { top: 6, right: 52, bottom: 6, left: 95 },
            colorFn:  _config.colorFn  || null,
            maxRows:  _config.maxRows  ?? 10,
            dataMode: _config.dataMode || 'words',  // 'words' | 'lines'
        };
        this.data = _data;
        this.corpusWordFreq = _corpusWordFreq;
        this.film = 'all';
        this.scoreMode = 'freq';  // 'freq' | 'unique' | 'rate' 
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
     * Aggregates data, updates scales and SVG height
     * @param {string} [film] - 'all' or full film name (words mode only)
     * @param {string} [scoreMode] - 'freq' | 'unique' | 'rate' (words mode only)
     */
    updateVis(film, scoreMode) {
        let vis = this;
        if (film !== undefined) vis.film = film;
        if (scoreMode !== undefined) vis.scoreMode = scoreMode;

        if (vis.config.dataMode === 'lines') {
            // Count dialogue lines per character
            const counts = {};
            vis.data.forEach(r => { counts[r.character] = (counts[r.character] || 0) + 1; });
            vis.words = Object.entries(counts)
                .map(([name, n]) => ({ word: name, score: n }))
                .sort((a, b) => b.score - a.score);
        } else {
            // Word frequency with a filter by film, and score by freq/unique/rate
            const filtered = vis.film === 'all'
                ? vis.data
                : vis.data.filter(d => d.film === vis.film);

            const charFreq = {};
            filtered.forEach(d => {
                (d.dialogue_cleaned || '').split(' ').filter(Boolean).forEach(w => {
                    charFreq[w] = (charFreq[w] || 0) + 1;
                });
            });

            const totalLines = filtered.length || 1;
            const scored = Object.entries(charFreq).map(([w, f]) => ({
                word:  w,
                score: vis.scoreMode === 'unique'
                    ? (f / ((vis.corpusWordFreq[w] || 0) + 1)) * 100
                    : vis.scoreMode === 'rate'
                        ? (f / totalLines) * 100
                        : f,
            }));
            vis.words = scored.sort((a, b) => b.score - a.score);
        }

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
     * Sets the scroll container height so exactly maxRows (or fewer) are visible.
     */
    _syncScrollHeight() {
        let vis = this;
        const containerW = vis.config.parentElement.getBoundingClientRect().width;
        if (!containerW) return;

        // Convert viewBox units to pixels using the ratio of rendered width to viewBox width
        const scale = containerW / vis.config.containerWidth;
        const rowPx = vis.config.rowHeight * scale;
        const marginPx = (vis.config.margin.top + vis.config.margin.bottom) * scale;

        const visibleRows = Math.min(vis.config.maxRows, vis.words.length);
        vis.config.parentElement.style.height = Math.round(visibleRows * rowPx + marginPx) + 'px';
    }

    /**
     * Draws or updates bars, end-labels, and y-axis labels
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
            .attr('fill', d => vis.config.colorFn ? vis.config.colorFn(d) : 'rgba(232,217,181,0.55)')
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
            .text(d => vis.scoreMode === 'freq' ? d.score : `${d.score.toFixed(1)}%`);

        // Y-axis with labels only
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
