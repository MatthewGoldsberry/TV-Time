// svg-marker-drag.js
// Makes the SVG marker draggable and shows coordinates in image-relative units

document.addEventListener('DOMContentLoaded', function () {
    const svg = document.getElementById('svgMap');
    const marker = document.getElementById('svgMarker');
    if (!svg || !marker) return;

    // Create a floating label for coordinates
    let coordLabel = document.createElement('div');
    coordLabel.style.position = 'fixed';
    coordLabel.style.left = '0';
    coordLabel.style.top = '0';
    coordLabel.style.background = 'rgba(0,0,0,0.7)';
    coordLabel.style.color = '#fff';
    coordLabel.style.fontSize = '0.85rem';
    coordLabel.style.padding = '2px 8px';
    coordLabel.style.borderRadius = '6px';
    coordLabel.style.pointerEvents = 'none';
    coordLabel.style.zIndex = '3001';
    coordLabel.style.transform = 'translate(-50%, -120%)';
    coordLabel.style.display = 'none';
    document.body.appendChild(coordLabel);

    let isDragging = false;
    let offset = {x: 0, y: 0};
    let svgRect = svg.getBoundingClientRect();
    let viewBox = svg.viewBox.baseVal;

    function svgCoords(clientX, clientY) {
        svgRect = svg.getBoundingClientRect();
        const x = ((clientX - svgRect.left) / svgRect.width) * viewBox.width;
        const y = ((clientY - svgRect.top) / svgRect.height) * viewBox.height;
        return {x, y};
    }

    function setMarker(cx, cy) {
        marker.setAttribute('cx', cx);
        marker.setAttribute('cy', cy);
        // Show label in screen coords above marker
        const percentX = (cx / viewBox.width) * 100;
        const percentY = (cy / viewBox.height) * 100;
        const screenX = svgRect.left + (cx / viewBox.width) * svgRect.width;
        const screenY = svgRect.top + (cy / viewBox.height) * svgRect.height;
        coordLabel.textContent = `cx: ${cx.toFixed(1)}, cy: ${cy.toFixed(1)}  (${percentX.toFixed(2)}%, ${percentY.toFixed(2)}%)`;
        coordLabel.style.left = `${screenX}px`;
        coordLabel.style.top = `${screenY}px`;
        coordLabel.style.display = 'block';
        marker.title = `cx: ${cx.toFixed(1)}, cy: ${cy.toFixed(1)}  (${percentX.toFixed(2)}%, ${percentY.toFixed(2)}%)`;
    }

    marker.addEventListener('mousedown', function (e) {
        isDragging = true;
        document.body.style.userSelect = 'none';
        svgRect = svg.getBoundingClientRect();
        viewBox = svg.viewBox.baseVal;
        const pt = svgCoords(e.clientX, e.clientY);
        offset.x = pt.x - parseFloat(marker.getAttribute('cx'));
        offset.y = pt.y - parseFloat(marker.getAttribute('cy'));
        coordLabel.style.display = 'block';
    });

    document.addEventListener('mousemove', function (e) {
        if (!isDragging) return;
        const pt = svgCoords(e.clientX, e.clientY);
        let cx = pt.x - offset.x;
        let cy = pt.y - offset.y;
        // Clamp to image bounds
        cx = Math.max(0, Math.min(cx, viewBox.width));
        cy = Math.max(0, Math.min(cy, viewBox.height));
        setMarker(cx, cy);
    });

    document.addEventListener('mouseup', function (e) {
        if (!isDragging) return;
        isDragging = false;
        document.body.style.userSelect = '';
        setTimeout(() => { coordLabel.style.display = 'none'; }, 1800);
    });

    // On window resize, update label position
    window.addEventListener('resize', function () {
        const cx = parseFloat(marker.getAttribute('cx'));
        const cy = parseFloat(marker.getAttribute('cy'));
        setMarker(cx, cy);
    });

    // Initialize label
    setMarker(parseFloat(marker.getAttribute('cx')), parseFloat(marker.getAttribute('cy')));
});
