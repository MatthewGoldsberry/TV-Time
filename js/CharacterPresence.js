/**
 * CharacterPresence — GitHub contribution chart inspired 3-row × 32-column scene presence grid
 */
class CharacterPresence {

    /**
     * @param {Object} _config - parentElement
     * @param {Array}  _data - all CSV rows for the character
     * @param {Object} _sceneIndex - SCENE_INDEX map: scene_name -> {filmIndex, sceneIndex}
     */
    constructor(_config, _data, _sceneIndex) {
        this.config = {
            parentElement: _config.parentElement,
            cellW: 15,
            cellH: 22,
            cellGap: 3,
            rowGap: 12,
            labelW: 52,
            margin: { top: 4, right: 4, bottom: 4, left: 0 },
        };
        this.data       = _data;
        this.sceneIndex = _sceneIndex;
        this.initVis();
    }

    /**
     * Builds the SVG grid skeleton, color scale, and shared tooltip
     */
    initVis() {
        let vis = this;

        const totalW = vis.config.margin.left + vis.config.labelW + 32 * (vis.config.cellW + vis.config.cellGap) - vis.config.cellGap + vis.config.margin.right;
        const totalH = vis.config.margin.top + 3 * (vis.config.cellH + vis.config.rowGap) - vis.config.rowGap + vis.config.margin.bottom;

        // Color scale from near black to gold
        vis.colorScale = d3.scaleLinear()
            .range(['rgba(22,17,10,0.95)', 'rgba(232,217,181,0.95)']);

        vis.svg = d3.select(vis.config.parentElement)
            .append('svg')
            .attr('viewBox', `0 0 ${totalW} ${totalH}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .style('width', '100%')
            .style('display', 'block');

        // Draw cells
        vis.chart = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left + vis.config.labelW},${vis.config.margin.top})`);

        // Film label mappings between abbreviated and full name
        const filmLabels = [
            { abbr: 'FotR', full: 'The Fellowship of the Ring' },
            { abbr: 'TT',   full: 'The Two Towers' },
            { abbr: 'RotK', full: 'The Return of the King' },
        ];

        // Tooltip configuration
        vis.tooltip = d3.select('#presence-tooltip');
        if (vis.tooltip.empty()) {
            vis.tooltip = d3.select('body').append('div')
                .attr('id', 'presence-tooltip')
                .attr('class', 'presence-tooltip')
                .style('display', 'none');
        }

        filmLabels.forEach((f, i) => {
            // Center the label vertically on its film row
            const labelY = vis.config.margin.top + i * (vis.config.cellH + vis.config.rowGap) + vis.config.cellH / 2;
            const labelEl = vis.svg.append('text')
                .attr('x', vis.config.margin.left + vis.config.labelW - 8)
                .attr('y', labelY)
                .attr('text-anchor', 'end')
                .attr('dominant-baseline', 'middle')
                .attr('fill', 'rgba(232,217,181,0.65)')
                .style('font-family', 'Cinzel, serif')
                .style('font-size', '11px')
                .style('cursor', 'default')
                .text(f.abbr);

            // Abbreviation hover shows the full film name
            labelEl
                .on('mouseover', event => {
                    vis.tooltip
                        .style('display', 'block')
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top',  (event.pageY + 10) + 'px')
                        .html(`<span class="pt-name">${f.full}</span>`);
                })
                .on('mouseout', () => vis.tooltip.style('display', 'none'));
        });

        vis.updateVis();
    }

    /**
     * Computes per-cell line counts and updates the color scale domain
     */
    updateVis() {
        let vis = this;

        // Aggregate line count per grid cell using a string key
        const counts = {};
        vis.data.forEach(d => {
            const idx = vis.sceneIndex[d.scene_name];
            if (!idx) return;
            const key = `${idx.filmIndex}-${idx.sceneIndex}`;
            counts[key] = (counts[key] || 0) + 1;
        });

        // Build the full 3×32 cell array with every position, even if count is 0
        vis.cells = [];
        for (let fi = 0; fi < 3; fi++) {
            for (let si = 0; si < 32; si++) {
                vis.cells.push({
                    filmIndex:  fi,
                    sceneIndex: si,
                    sceneName:  SCENE_NAMES[fi * 32 + si] || '',
                    count:      counts[`${fi}-${si}`] || 0,
                });
            }
        }

        // prevents a zero-width domain when the character has no lines at all
        const maxCount = d3.max(vis.cells, d => d.count) || 1;
        vis.colorScale.domain([0, maxCount]);

        vis.renderVis();
    }

    /**
     * Draws or updates all cells with color encoding and tooltip binding
     */
    renderVis() {
        let vis = this;

        vis.chart.selectAll('.presence-cell')
            .data(vis.cells)
            .join('rect')
            .attr('class', 'presence-cell')
            .attr('x', d => d.sceneIndex * (vis.config.cellW + vis.config.cellGap))
            .attr('y', d => d.filmIndex  * (vis.config.cellH + vis.config.rowGap))
            .attr('width',  vis.config.cellW)
            .attr('height', vis.config.cellH)
            .attr('rx', 3)
            .attr('fill', d => vis.colorScale(d.count))
            .attr('stroke', 'rgba(232,217,181,0.18)')
            .attr('stroke-width', 0.6)
            .on('mouseover', (event, d) => {
                d3.select(event.currentTarget)
                    .attr('stroke', 'rgba(232,217,181,0.95)')
                    .attr('stroke-width', '2.5')
                    .style('filter', 'url(#arc-glow)');
                vis.chart.selectAll('.presence-cell')
                    .filter(b => b !== d)
                    .style('opacity', 0.68);
                vis.tooltip
                    .style('display', 'block')
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top',  (event.pageY + 10) + 'px')
                    .html(d.count
                        ? `<span class="pt-name">${d.sceneName}</span>${d.count} line${d.count !== 1 ? 's' : ''}`
                        : `<span class="pt-name">${d.sceneName}</span>Not present`
                    );
            })
            .on('mousemove', event => {
                vis.tooltip
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top',  (event.pageY + 10) + 'px');
            })
            .on('mouseout', event => {
                d3.select(event.currentTarget)
                    .attr('stroke', 'rgba(232,217,181,0.18)')
                    .attr('stroke-width', '0.6')
                    .style('filter', null);
                vis.chart.selectAll('.presence-cell').style('opacity', 1);
                vis.tooltip.style('display', 'none');
            });
    }
}
