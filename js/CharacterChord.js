/**
 * CharacterChord - chord diagram showing fellowship scene co-occurrence.
 * Arc size = co-occurrence weight (total shared-scene connections); ribbon weight = shared scenes between a pair.
 */

// Derived from CHARACTER_COLORS in main.js — same RGB base, chord-specific alpha
const CHORD_COLORS = FELLOWSHIP_ORDER.map(name => characterColor(name, 0.68));

class CharacterChord {

    /**
     * @param {Object} _config - parentElement (the .chord-container div)
     * @param {Object} _data - interactionMatrix (keyed by film) and fellowshipOrder array
     */
    constructor(_config, _data) {
        this.config = { parentElement: _config.parentElement };
        this.interactionMatrix = _data.interactionMatrix;
        this.sceneCounts = _data.sceneCounts;
        this.fellowshipOrder = _data.fellowshipOrder;
        this.film = 'all';
        this.selectedIndices = new Set();
        this.activeOrder = _data.fellowshipOrder;
        this.initVis();
    }

    /**
     * Builds SVG skeleton, D3 chord/arc/ribbon generators, and shared tooltip reference.
     */
    initVis() {
        let vis = this;

        // Measure the container so vis is sized to the actual available space
        const bbox = vis.config.parentElement.getBoundingClientRect();
        const w = bbox.width  || 400;
        const h = bbox.height || 400;

        vis.outerRadius = Math.min(w, h) * 0.40; // drives arc size
        vis.innerRadius = vis.outerRadius * 0.80; // where ribbons attach
        vis.labelRadius = vis.outerRadius + 14; // text placement location

        // viewBox is centered at origin with a 18 pixel shift up
        vis.svg = d3.select(vis.config.parentElement)
            .append('svg')
            .attr('width',  '100%')
            .attr('height', '100%')
            .attr('viewBox', `${-w / 2} ${-h / 2 + 6} ${w} ${h}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        // Background click clears all selections
        vis.svg.on('click', () => {
            vis.selectedIndices.clear();
            vis._applySelectionState();
        });

        // Black Speech inscription running along the midpoint of the arc band, behind the arcs
        const inscriptR = (vis.innerRadius + vis.outerRadius) / 1.88;

        // Store the gradient, circular text path, and drop-shadow filter
        const defs = vis.svg.append('defs');

        // Gold ring gradient
        const grad = defs.append('linearGradient')
            .attr('id', 'ring-gold-gradient')
            .attr('x1', '0%').attr('y1', '0%')
            .attr('x2', '0%').attr('y2', '100%');
            
        grad.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(120, 80, 15, 0.95)');
        grad.append('stop').attr('offset', '15%').attr('stop-color', 'rgba(255, 245, 180, 0.95)');
        grad.append('stop').attr('offset', '40%').attr('stop-color', 'rgba(215, 160, 30, 0.90)');
        grad.append('stop').attr('offset', '75%').attr('stop-color', 'rgba(90, 50, 5, 0.85)');
        grad.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(150, 100, 15, 0.90)');

        // Inscription Glow
        const shadow = defs.append('filter')
            .attr('id', 'inscription-shadow')
            .attr('x', '-20%').attr('y', '-20%')
            .attr('width', '140%').attr('height', '140%');
            
        // Outer orange blur
        shadow.append('feDropShadow')
            .attr('dx', '0').attr('dy', '0')
            .attr('stdDeviation', '2')
            .attr('flood-color', 'rgba(255, 151, 119, 0.8)');
            
        // Inner intense yellow/white blur
        shadow.append('feDropShadow')
            .attr('dx', '0').attr('dy', '0')
            .attr('stdDeviation', '0.5')
            .attr('flood-color', 'rgba(255, 200, 50, 0.9)');

        // Glow filter for hovered/selected arcs 
        const arcGlow = defs.append('filter').attr('id', 'arc-glow')
            .attr('x', '-30%').attr('y', '-30%').attr('width', '160%').attr('height', '160%');
        arcGlow.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', '4').attr('result', 'blur');
        const arcMerge = arcGlow.append('feMerge');
        arcMerge.append('feMergeNode').attr('in', 'blur');
        arcMerge.append('feMergeNode').attr('in', 'SourceGraphic');

        // Full circle creation
        defs.append('path')
            .attr('id', 'chord-ring-path')
            .attr('d', `M 0,-${inscriptR} A ${inscriptR},${inscriptR} 0 1,1 -0.01,-${inscriptR}`);

        // Gold disk gradient fill that gives the arc band a dimensional metallic look
        vis.svg.append('circle')
            .attr('r', vis.outerRadius + 3)
            .style('fill', 'url(#ring-gold-gradient)')
            .style('pointer-events', 'none');

        // Dark disk covers the center, leaving only the arc annulus gold
        vis.svg.append('circle')
            .attr('r', vis.innerRadius)
            .style('fill', 'rgba(8,5,3,0.82)')
            .style('pointer-events', 'none');

        // Ring Inscription
        const inscriptCircumference = 2 * Math.PI * inscriptR;
        vis.svg.append('text')
            .style('fill', 'rgba(255, 240, 200, 0.95)')
            .style('font-family', "'TengwarAnnatar', serif")
            .style('font-size', Math.max(8, inscriptR * 0.085) + 'px')
            .style('font-weight', '600')
            .style('pointer-events', 'none')
            .attr('filter', 'url(#inscription-shadow)')
            .attr('dy', Math.max(4, inscriptR * 0.075))
            .append('textPath')
            .attr('href', '#chord-ring-path')
            .attr('startOffset', '0%')
            .attr('textLength', inscriptCircumference)
            .attr('lengthAdjust', 'spacingAndGlyphs')
            .text('Ash nazg durbatuluk · ash nazg gimbatul · ash nazg thrakatuluk · agh burzum-ishi krimpatul · ');

        // Layer ribbons behind arcs, labels on top of everything
        vis.ribbonGroup = vis.svg.append('g').attr('class', 'chord-ribbons');
        vis.arcGroup = vis.svg.append('g').attr('class', 'chord-arcs');
        vis.labelGroup = vis.svg.append('g').attr('class', 'chord-labels');

        vis.arcGen = d3.arc()
            .innerRadius(vis.innerRadius)
            .outerRadius(vis.outerRadius);

        // Ribbon radius must match innerRadius so ribbons connect flush to arc inner edge
        vis.ribbonGen = d3.ribbon().radius(vis.innerRadius);

        vis.chordLayout = d3.chord()
            .padAngle(0.05)
            .sortSubgroups(d3.descending);

        // Reuse the shared tooltip element created by main.js at startup
        vis.tooltip  = d3.select('#presence-tooltip');
        vis.clearBtn = document.querySelector('.chord-clear-btn');

        vis.clearBtn.addEventListener('click', () => {
            vis.selectedIndices.clear();
            vis._applySelectionState();
        });

        // Escape key as a keyboard shortcut for clearing the selection
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && vis.selectedIndices.size > 0) {
                vis.selectedIndices.clear();
                vis._applySelectionState();
            }
        });

        vis.updateVis();
    }

    /**
     * Applies dim/highlight state based on current selectedIndices. Active ribbons are raised to the top of the DOM so they render above dimmed ones.
     */
    _applySelectionState() {
        let vis = this;

        // Show the clear button only while a selection is active
        vis.clearBtn.classList.toggle('visible', vis.selectedIndices.size > 0);

        if (vis.selectedIndices.size === 0) {
            vis.ribbonGroup.selectAll('.chord-ribbon')
                .classed('dimmed', false)
                .style('opacity', 0.35);
            vis.arcGroup.selectAll('.chord-arc')
                .style('opacity', 1)
                .style('stroke', 'rgba(232,217,181,0.25)')
                .style('stroke-width', '1px')
                .attr('filter', null);
            return;
        }

        const ribbons = vis.ribbonGroup.selectAll('.chord-ribbon');

        // A ribbon is active if either endpoint belongs to a selected arc
        ribbons.classed('dimmed', r =>
            !vis.selectedIndices.has(r.source.index) && !vis.selectedIndices.has(r.target.index)
        );

        // Raise active ribbons in the DOM so they paint over the dimmed ones
        const activeRibbons = ribbons.filter(r =>
            vis.selectedIndices.has(r.source.index) || vis.selectedIndices.has(r.target.index)
        );
        activeRibbons.raise().style('opacity', 0.7);

        // Selected arcs glow with a bright stroke, non-selected stay color-legible but clearly secondary
        vis.arcGroup.selectAll('.chord-arc')
            .style('opacity', a => vis.selectedIndices.has(a.index) ? 1 : 0.7)
            .style('stroke', a => vis.selectedIndices.has(a.index) ? 'rgba(232,217,181,0.95)' : 'rgba(232,217,181,0.25)')
            .style('stroke-width', a => vis.selectedIndices.has(a.index) ? '2.5px' : '1px')
            .attr('filter', a => vis.selectedIndices.has(a.index) ? 'url(#arc-glow)' : null);
    }

    /**
     * Selects the matrix for the current film and triggers a re-render.
     * @param {string} [film] - 'all' or a full film name
     */
    updateVis(film) {
        let vis = this;
        if (film !== undefined) vis.film = film;

        // Reset selection whenever the film filter changes so stale highlights don't persist
        vis.selectedIndices.clear();

        let matrix = vis.interactionMatrix[vis.film];

        // Exclude Boromir from Return of the King view
        if (vis.film === 'The Return of the King') {
            const boromirIdx = vis.fellowshipOrder.indexOf('Boromir');
            const keep = vis.fellowshipOrder.map((_, i) => i).filter(i => i !== boromirIdx);
            matrix = keep.map(i => keep.map(j => vis.interactionMatrix[vis.film][i][j]));
            vis.activeOrder = keep.map(i => vis.fellowshipOrder[i]);
        } else {
            vis.activeOrder = vis.fellowshipOrder;
        }

        const chords = vis.chordLayout(matrix);
        vis.renderVis(chords);
    }

    /**
     * Draws or updates arcs, labels, and ribbons from the completed chord layout.
     * @param {Object} chords - output of d3.chord()(matrix)
     */
    renderVis(chords) {
        let vis = this;

        // Guard used throughout to avoid fighting locked selection state during hover
        const noneSelected = () => vis.selectedIndices.size === 0;

        // Key ribbons by source-target pair so D3 reuses existing elements across film filter changes
        vis.ribbonGroup.selectAll('.chord-ribbon')
            .data(chords, d => `${d.source.index}-${d.target.index}`)
            .join(
                enter => enter.append('path')
                    .attr('class', 'chord-ribbon')
                    .style('opacity', 0)
                    // Fade in on first render
                    .call(e => e.transition().duration(400).style('opacity', 0.35)),
                update => update.call(u => u.transition().duration(400).style('opacity', 0.35)),
                exit => exit.call(x => x.transition().duration(200).style('opacity', 0).remove())
            )
            .attr('d', vis.ribbonGen)
            // Color ribbon by source character
            .style('fill', d => CHORD_COLORS[d.source.index])
            .style('stroke', d => CHORD_COLORS[d.source.index])
            .style('stroke-width', '0.5px')
            .on('mouseover', (event, d) => {
                const a = vis.activeOrder[d.source.index];
                const b = vis.activeOrder[d.target.index];
                const count = d.source.value;
                vis.tooltip
                    .style('display', 'block')
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY + 10) + 'px')
                    .html(`<span class="pt-name">${a} ↔ ${b}</span>${count} shared scene${count !== 1 ? 's' : ''}`);
            })
            .on('mousemove', event => {
                vis.tooltip
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY + 10) + 'px');
            })
            .on('mouseout', () => vis.tooltip.style('display', 'none'));

        // Arcs
        vis.arcGroup.selectAll('.chord-arc')
            .data(chords.groups)
            .join(
                enter => enter.append('path').attr('class', 'chord-arc'),
                update => update,
                exit => exit.remove()
            )
            .call(sel => sel.transition().duration(400).attr('d', vis.arcGen))
            .style('fill', d => CHORD_COLORS[d.index])
            .style('stroke', 'rgba(232,217,181,0.25)')
            .style('stroke-width', '1px')
            .on('mouseover', (event, d) => {
                // Only apply transient hover state when no arc is locked
                if (noneSelected()) {
                    const allRibbons = vis.ribbonGroup.selectAll('.chord-ribbon');
                    allRibbons.classed('dimmed', r => r.source.index !== d.index && r.target.index !== d.index);
                    allRibbons.filter(r => r.source.index === d.index || r.target.index === d.index)
                        .style('opacity', 0.7);
                    vis.arcGroup.selectAll('.chord-arc')
                        .style('opacity', a => a.index === d.index ? 1 : 0.68)
                        .style('stroke', a => a.index === d.index ? 'rgba(232,217,181,0.95)' : 'rgba(232,217,181,0.25)')
                        .style('stroke-width', a => a.index === d.index ? '2.5px' : '1px')
                        .attr('filter', a => a.index === d.index ? 'url(#arc-glow)' : null);
                }
                vis.tooltip
                    .style('display', 'block')
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top',  (event.pageY + 10) + 'px')
                    .html(`<span class="pt-name">${vis.activeOrder[d.index]}</span>${vis.sceneCounts?.[vis.film]?.[vis.activeOrder[d.index]] ?? d.value} scenes with dialogue`);
            })
            .on('mousemove', event => {
                vis.tooltip
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY + 10) + 'px');
            })
            .on('mouseout', () => {
                // Only reset if no arc is locked, otherwise the locked state takes precedence
                if (noneSelected()) {
                    vis.ribbonGroup.selectAll('.chord-ribbon')
                        .classed('dimmed', false)
                        .style('opacity', 0.45);
                    vis.arcGroup.selectAll('.chord-arc')
                        .style('opacity', 1)
                        .style('stroke', 'rgba(232,217,181,0.25)')
                        .style('stroke-width', '1px')
                        .attr('filter', null);
                }
                vis.tooltip.style('display', 'none');
            })
            .on('click', (event, d) => {
                event.stopPropagation();

                // Click a selected arc to deselect it, click an unselected arc to add it
                if (vis.selectedIndices.has(d.index)) {
                    vis.selectedIndices.delete(d.index);
                } else {
                    vis.selectedIndices.add(d.index);
                }
                vis._applySelectionState();
            });

        // Arc labels
        vis.labelGroup.selectAll('.chord-label')
            .data(chords.groups)
            .join('text')
            .attr('class', 'chord-label')
            .attr('dy', '0.35em')
            .attr('transform', d => {
                const angle = (d.startAngle + d.endAngle) / 2;
                const x = Math.sin(angle) * vis.labelRadius;
                const y = -Math.cos(angle) * vis.labelRadius;
                return `translate(${x},${y})`;
            })
            .attr('text-anchor', d => {
                // Anchor so text always extends away from the ring on each side
                const angle = (d.startAngle + d.endAngle) / 2;
                const sin = Math.sin(angle);
                if (sin > 0.1)  return 'start'
                if (sin < -0.1) return 'end';
                return 'middle';
            })
            .style('font-family', 'Cinzel, serif')
            .style('font-size', '12px')
            .style('fill', 'rgba(232,217,181,0.85)')
            .style('pointer-events', 'none')
            .text(d => vis.activeOrder[d.index]);
    }
}
