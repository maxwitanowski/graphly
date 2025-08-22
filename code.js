/*
  Equation Grapher using p5.js
  - Enter equations like: y=2x+3, y=-0.5x^2+3x-1, f(x)=x^2-4x+3, or x=2 (vertical)
  - Pan: click and drag
  - Zoom: use the zoom slider
  - Reset: click Reset View
*/

// Viewport state (math <-> screen)
let pixelsPerUnit = 40; // controlled by slider and limited mouse wheel
let originX; // screen x of math origin (0,0)
let originY; // screen y of math origin (0,0)
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

// Parsed equation (disabled primary equation feature)
let currentEquation = {
  type: 'none',
  fn: (x) => 0,
  xConst: null,
  raw: '',
  error: ''
};

// DOM
let equationInput;
let plotButton;
let zoomSlider;
let resetButton;
let themeSelect;
let parabolaBtn;
let aInput; let bInput; let cInput;
let quadMode; let faInput; let fbInput; let r1Input; let r2Input;
let canvasParent;
let toolbarEl;
let leftPanelEl;
let plotPanelHeaderEl;
let isDraggingPanel = false;
let panelDragOffsetX = 0;
let panelDragOffsetY = 0;
let minimizeBtnEl;
let toolboxBtnEl;
let toolboxDrawerEl;
// Removed tool chips: we embed the Plot Point panel only
let toolboxBtnLabelEl;
let toolboxEmbeddedAreaEl;
let toolboxCloseEl;
let lastTouchX = 0;
let lastTouchY = 0;
let lastPinchDistance = null;

// Theme state
let currentThemeKey = 'vscode-dark-plus';
let themeColors = {
  canvasBg: '#1e1e1e',
  gridMinor: 'rgba(255,255,255,0.10)',
  gridMajor: 'rgba(255,255,255,0.25)',
  axis: '#569cd6',
  plot: '#ce9178',
  hudBg: 'rgba(0,0,0,0.70)',
  hudText: '#e6e6e6',
  muted: '#b8c0dc'
};

// Axis labels (editable)
let axisLabels = { x: 'x', y: 'y' };
let axisLabelRects = {
  x: { x: 0, y: 0, w: 0, h: 0 },
  y: { x: 0, y: 0, w: 0, h: 0 }
};

// Extra user-defined curves. Each can be linear (m,b) or quadratic (a,b,c). Max 3.
const maxExtraLines = 3;
let extraLines = [];

// User-placed markers on lines
// { id, lineId, x: worldX, y: worldY, label, color?, size? }
let markers = [];

// Drag state for markers
let draggingMarkerId = null;

// Two-point lines tool
// { id, p1:{x,y}, p2:{x,y}, color, name }
let twoPointLines = [];
let draggingTwoPoint = { lineId: null, pointKey: null };
let toolLine2ChipEl;
let twoPointDotsHidden = false;

// Curved lines tool (multi-point Catmull–Rom spline)
// { id, points:[{x,y}, ...], color, name }
let curvedLines = [];
let curvedDotsHidden = false;
let draggingCurved = { id: null, pointIndex: -1 };
let pendingAddCurved = null; // { id }
let pendingPlace4 = null; // { id, needed: number }
let curvedPlaceCount = 4;

// Parabolas tool (three points define a parabola)
// { id, p1:{x,y}, p2:{x,y}, p3:{x,y}, color, name, a, b, c }
let parabolas = [];
let parabolaDotsHidden = false;
let isDraggingParabolaPanel = false;
let parabolaDragOffsetX = 0;
let parabolaDragOffsetY = 0;
// Dragging a parabola vertex
let draggingParabolaId = null;
// Dragging an x-intercept (root) of a parabola
let draggingParabolaRoot = { id: null, which: null };
// Snapped cursor target (if hovering near a handle)
let snappedCursor = null;
// Snap-to-grid step (0.25, 0.5, 1)
let snapStep = 1;
// True while the user is interacting with any UI control (e.g., sliders)
let uiPointerDown = false;
// Pending curved-line click-to-place marker (resolved on mouseReleased if no drag)
let pendingCurvedMarker = null; // { xWorld, yWorld, sx, sy }
let mousePressStartX = 0;
let mousePressStartY = 0;

function setup() {
  canvasParent = document.getElementById('canvas-holder');
  leftPanelEl = document.getElementById('left-panel');
  plotPanelHeaderEl = document.getElementById('plotPanelHeader');
  toolbarEl = document.getElementById('toolbar');
  minimizeBtnEl = document.getElementById('minimizePlotPanel');
  toolboxBtnEl = document.getElementById('toolboxBtn');
  toolboxDrawerEl = document.getElementById('toolboxDrawer');
  // no chips now
  toolboxBtnLabelEl = document.getElementById('toolboxBtnLabel');
  toolboxEmbeddedAreaEl = document.getElementById('toolboxEmbeddedArea');
  toolboxCloseEl = document.getElementById('toolboxClose');
  updateCanvasHolderSize();
  const c = createCanvas(canvasParent.clientWidth, canvasParent.clientHeight);
  c.parent(canvasParent);

  // Ensure both tools start in toolbox
  if (toolboxEmbeddedAreaEl && leftPanelEl) {
    leftPanelEl.classList.add('embedded');
    leftPanelEl.style.display = 'block';
    const toolboxContent = document.querySelector('.toolbox-content');
    (toolboxContent || toolboxEmbeddedAreaEl).appendChild(leftPanelEl);
  }
  const l2 = document.getElementById('line2Tool');
  if (l2 && toolboxEmbeddedAreaEl) {
    const toolboxContent = document.querySelector('.toolbox-content');
    (toolboxContent || toolboxEmbeddedAreaEl).appendChild(l2);
  }
  const ctool = document.getElementById('curvedTool');
  if (ctool && toolboxEmbeddedAreaEl) {
    const toolboxContent = document.querySelector('.toolbox-content');
    (toolboxContent || toolboxEmbeddedAreaEl).appendChild(ctool);
  }
  const ptool = document.getElementById('parabolaTool');
  if (ptool && toolboxEmbeddedAreaEl) {
    const toolboxContent = document.querySelector('.toolbox-content');
    (toolboxContent || toolboxEmbeddedAreaEl).appendChild(ptool);
  }

  // Initial origin at canvas center
  originX = width / 2;
  originY = height / 2;

  // Hook up UI
  equationInput = document.getElementById('equationInput') || null;
  plotButton = document.getElementById('plotBtn') || null;
  zoomSlider = document.getElementById('zoomSlider');
  resetButton = document.getElementById('resetBtn');
  themeSelect = document.getElementById('themeSelect');
  const addLineBtn = document.getElementById('addLineBtn');
  const linesContainer = document.getElementById('linesContainer');
  parabolaBtn = null;
  aInput = null;
  bInput = null;
  cInput = null;
  quadMode = null;
  faInput = null;
  fbInput = null;
  r1Input = null;
  r2Input = null;

  if (equationInput) {
    equationInput.value = 'y=2x+3';
  }
  zoomSlider.value = pixelsPerUnit;

  if (plotButton && equationInput) {
    plotButton.addEventListener('click', () => {
      parseAndSetEquation(equationInput.value);
    });
  }
  // Primary equation input removed
  zoomSlider.addEventListener('input', () => {
    pixelsPerUnit = clamp(parseFloat(zoomSlider.value), 10, 120);
  });
  resetButton.addEventListener('click', () => {
    pixelsPerUnit = 40;
    zoomSlider.value = pixelsPerUnit;
    originX = width / 2;
    originY = height / 2;
  });

  // Lines UI
  if (addLineBtn && linesContainer) {
    addLineBtn.addEventListener('click', () => {
      if (extraLines.length >= maxExtraLines) return;
      const id = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      const hue = (hashString(id) % 360);
      const col = hslToRgb(hue / 360, 0.65, 0.60);
      const hex = rgbToHex(col.r, col.g, col.b);
      const line = { id, kind: 'linear', slope: 1, intercept: 0, a: 1, b: 0, c: 0, color: hex, quadMode: 'coeff', label: '' };
      extraLines.push(line);
      renderLinesUI(linesContainer);
    });
  }

  // Left panel: plot a point by coordinates
  const addPointBtn = document.getElementById('addPointBtn');
  const pointX = document.getElementById('pointX');
  const pointY = document.getElementById('pointY');
  const pointLabel = document.getElementById('pointLabel');
  const pointColor = document.getElementById('pointColor');
  const pointSize = document.getElementById('pointSize');
  const pointList = document.getElementById('pointList');
  if (addPointBtn && pointX && pointY) {
    addPointBtn.addEventListener('click', () => {
      const x = parseFloat(pointX.value || '0');
      const y = parseFloat(pointY.value || '0');
      const label = (pointLabel && pointLabel.value) ? pointLabel.value : '';
      const color = (pointColor && pointColor.value) ? pointColor.value : '#ffd166';
      const size = Math.max(2, Math.min(24, parseInt(pointSize?.value || '6', 10)));
      // Create a standalone marker (lineId null) with its own color
      const id = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      markers.push({ id, lineId: null, x, y, label: String(label).slice(0, 60), color, size });
      renderPointList(pointList);
    });
  }

  // Two-point line tool wiring
  const line2AddBtn = document.getElementById('line2AddBtn');
  const line2SpawnBtn = document.getElementById('line2SpawnBtn');
  const line2ToggleDotsBtn = document.getElementById('line2ToggleDotsBtn');
  const line2x1 = document.getElementById('line2x1');
  const line2y1 = document.getElementById('line2y1');
  const line2x2 = document.getElementById('line2x2');
  const line2y2 = document.getElementById('line2y2');
  const line2Color = document.getElementById('line2Color');
  const line2List = document.getElementById('line2List');
  if (line2AddBtn && line2x1 && line2y1 && line2x2 && line2y2) {
    line2AddBtn.addEventListener('click', () => {
      const p1 = { x: parseFloat(line2x1.value || '0'), y: parseFloat(line2y1.value || '0') };
      const p2 = { x: parseFloat(line2x2.value || '1'), y: parseFloat(line2y2.value || '1') };
      const color = (line2Color && line2Color.value) ? line2Color.value : '#66d9ef';
      const id = Date.now() + '-' + Math.random().toString(36).slice(2,7);
      // Respect math coordinates entered: screen y increases down, so convert from math to internal world
      // Inputs are already in world coords (math). We store directly and let rendering convert.
      const ln = { id, p1: { x: p1.x, y: p1.y }, p2: { x: p2.x, y: p2.y }, color, name: '', showDots: true };
      twoPointLines.push(ln);
      renderLine2List(line2List);
      if (typeof showOrUpdateLineEq === 'function') showOrUpdateLineEq(ln);
    });
  }

  // Curved line tool wiring
  const curvedSpawnBtn = document.getElementById('curvedSpawnBtn');
  const curvedToggleDotsBtn = document.getElementById('curvedToggleDotsBtn');
  const curvedPlace4Btn = document.getElementById('curvedPlace4Btn');
  const curvedN = document.getElementById('curvedN');
  const curvedNLabel = document.getElementById('curvedNLabel');
  const curveColor = document.getElementById('curveColor');
  const curvedStraightInput = document.getElementById('curvedStraightInput');
  const curvedList = document.getElementById('curvedList');
  if (curvedN && curvedNLabel) {
    const updateN = () => {
      const n = Math.max(2, Math.min(10, parseInt(curvedN.value || '4', 10)));
      curvedPlaceCount = n;
      curvedNLabel.textContent = String(n);
    };
    curvedN.addEventListener('input', updateN);
    updateN();
  }
  if (curvedSpawnBtn) {
    curvedSpawnBtn.addEventListener('click', () => {
      const color = (curveColor && curveColor.value) ? curveColor.value : '#a16ee8';
      const id = Date.now() + '-' + Math.random().toString(36).slice(2,7);
      // Spawn a default gentle S-curve around center
      const cx = screenToWorldX(width / 2);
      const cy = screenToWorldY(height / 2);
      const pts = [
        { x: cx - 4, y: cy - 2 },
        { x: cx - 2, y: cy + 1 },
        { x: cx + 2, y: cy - 1 },
        { x: cx + 4, y: cy + 2 }
      ];
      curvedLines.push({ id, points: pts, color, name: '', straight: !!(curvedStraightInput && curvedStraightInput.checked), showDots: true });
      renderCurvedList(curvedList);
    });
  }
  if (curvedPlace4Btn) {
    curvedPlace4Btn.addEventListener('click', () => {
      const color = (curveColor && curveColor.value) ? curveColor.value : '#a16ee8';
      const id = Date.now() + '-' + Math.random().toString(36).slice(2,7);
      curvedLines.push({ id, points: [], color, name: '', straight: !!(curvedStraightInput && curvedStraightInput.checked), showDots: true });
      const n = Math.max(2, Math.min(10, curvedPlaceCount || 4));
      pendingPlace4 = { id, needed: n };
      renderCurvedList(curvedList);
    });
  }
  if (curvedToggleDotsBtn) {
    let dotsHidden = false;
    curvedToggleDotsBtn.addEventListener('click', () => {
      dotsHidden = !dotsHidden;
      curvedToggleDotsBtn.textContent = dotsHidden ? 'Show dots' : 'Hide dots';
      curvedDotsHidden = dotsHidden;
    });
  }
  if (line2SpawnBtn) {
    line2SpawnBtn.addEventListener('click', () => {
      const centerX = screenToWorldX(width / 2);
      const centerY = screenToWorldY(height / 2);
      const color = (line2Color && line2Color.value) ? line2Color.value : '#66d9ef';
      const id = Date.now() + '-' + Math.random().toString(36).slice(2,7);
      // Spawn near center in world coords
      const ln = { id, p1: { x: centerX - 2, y: centerY - 1 }, p2: { x: centerX + 2, y: centerY + 1 }, color, name: '', showDots: true };
      twoPointLines.push(ln);
      renderLine2List(line2List);
      showOrUpdateLineEq(ln);
    });
  }
  if (line2ToggleDotsBtn) {
    let dotsHidden = false;
    line2ToggleDotsBtn.addEventListener('click', () => {
      dotsHidden = !dotsHidden;
      line2ToggleDotsBtn.textContent = dotsHidden ? 'Show dots' : 'Hide dots';
      twoPointDotsHidden = dotsHidden;
    });
  }

  // Parabola tool wiring
  const paraAddBtn = document.getElementById('paraAddBtn');
  const paraSpawnBtn = document.getElementById('paraSpawnBtn');
  const paraToggleDotsBtn = document.getElementById('paraToggleDotsBtn');
  const paraX1 = document.getElementById('paraX1');
  const paraX2 = document.getElementById('paraX2');
  const paraVY = document.getElementById('paraVY');
  const paraColor = document.getElementById('paraColor');
  const paraList = document.getElementById('paraList');
  const showOrUpdateParaEq = (a, b, c) => {
    if (!paraEqCard || !paraEqBody) return;
    paraEqBody.textContent = formatParabolaEquation(a, b, c);
    if (paraEqHeaderTitle) {
      // Try to use the last parabola's name for context
      const last = parabolas[parabolas.length - 1];
      const title = last && last.name ? `${last.name} – Parabola Equation` : 'Parabola Equation';
      paraEqHeaderTitle.textContent = title;
    }
    const wasHidden = paraEqCard.style.display === 'none' || !paraEqCard.style.display;
    paraEqCard.style.display = 'flex';
    if (wasHidden) {
      // Spawn under the theme toolbar, top-left
      if (!paraEqCard.classList.contains('tool-floating')) {
        document.body.appendChild(paraEqCard);
        paraEqCard.classList.add('tool-floating');
      }
      const top = (toolbarEl ? (toolbarEl.offsetTop + toolbarEl.offsetHeight + 8) : 12);
      paraEqCard.style.left = '12px';
      paraEqCard.style.top = top + 'px';
    }
  };

  const showOrUpdateLineEq = (ln) => {
    if (!ln) return;
    // This now solely updates the formula modal's list; the separate line card was removed
    // When the formulas modal is open, rebuild its content to reflect updates
    const modal = document.getElementById('formulasModal');
    const filter = document.getElementById('formulasFilter');
    if (modal && modal.style.display === 'flex') {
      const sel = filter ? filter.value : 'all';
      // Reuse builder via change event
      filter && filter.dispatchEvent(new Event('change'));
    }
  };

  if (paraAddBtn && paraX1 && paraX2) {
    paraAddBtn.addEventListener('click', () => {
      const r1In = parseFloat(paraX1.value || '0');
      const r2In = parseFloat(paraX2.value || '1');
      const halfSpan = (r2In - r1In) / 2;
      const vx = (r1In + r2In) / 2;
      const r1 = vx - halfSpan;
      const r2 = vx + halfSpan;
      const color = (paraColor && paraColor.value) ? paraColor.value : '#e67e22';
      const denom = (vx - r1) * (vx - r2);
      const vyProvided = (paraVY && paraVY.value !== '') ? Math.round(parseFloat(paraVY.value)) : (1 * denom);
      const a = Math.abs(denom) > 1e-12 ? (vyProvided / denom) : 1;
      const coeffs = computeQuadraticFromRoots(r1, r2, a);
      const vy = Math.round(coeffs.a * denom);
      const p1 = { x: r1, y: 0 };
      const p2 = { x: r2, y: 0 };
      const p3 = { x: vx, y: vy };
      const id = Date.now() + '-' + Math.random().toString(36).slice(2,7);
      parabolas.push({ id, p1, p2, p3, color, name: '', ...coeffs });
      // Show/update equation card
      showOrUpdateParaEq(coeffs.a, coeffs.b, coeffs.c);
      renderParabolaList(paraList);
    });
  }
  if (paraSpawnBtn) {
    paraSpawnBtn.addEventListener('click', () => {
      const cx = screenToWorldX(width / 2);
      const color = (paraColor && paraColor.value) ? paraColor.value : '#e67e22';
      const r1In = (paraX1 && paraX1.value !== '') ? parseFloat(paraX1.value) : (cx - 1);
      const r2In = (paraX2 && paraX2.value !== '') ? parseFloat(paraX2.value) : (cx + 1);
      const halfSpan = (r2In - r1In) / 2;
      const vx = (r1In + r2In) / 2;
      const r1 = vx - halfSpan;
      const r2 = vx + halfSpan;
      const denom = (vx - r1) * (vx - r2);
      const vyProvided = (paraVY && paraVY.value !== '') ? Math.round(parseFloat(paraVY.value)) : (1 * denom);
      const a = Math.abs(denom) > 1e-12 ? (vyProvided / denom) : 1;
      const coeffs = computeQuadraticFromRoots(r1, r2, a);
      const vy = Math.round(coeffs.a * denom);
      const p1 = { x: r1, y: 0 };
      const p2 = { x: r2, y: 0 };
      const p3 = { x: vx, y: vy };
      const id = Date.now() + '-' + Math.random().toString(36).slice(2,7);
      parabolas.push({ id, p1, p2, p3, color, name: '', ...coeffs });
      showOrUpdateParaEq(coeffs.a, coeffs.b, coeffs.c);
      renderParabolaList(paraList);
    });
  }
  if (paraToggleDotsBtn) {
    let dotsHidden = false;
    paraToggleDotsBtn.addEventListener('click', () => {
      dotsHidden = !dotsHidden;
      paraToggleDotsBtn.textContent = dotsHidden ? 'Show dots' : 'Hide dots';
      parabolaDotsHidden = dotsHidden;
    });
  }

  // Make Parabola tool draggable out of the toolbox
  const parabolaTool = document.getElementById('parabolaTool');
  const parabolaHeader = document.getElementById('parabolaHeader');
  const dockParabolaPanel = document.getElementById('dockParabolaPanel');
  const paraEqCard = document.getElementById('paraEqCard');
  const paraEqBody = document.getElementById('paraEqBody');
  const dockParaEqPanel = document.getElementById('dockParaEqPanel');
  if (parabolaTool && parabolaHeader) {
    const startParaDrag = (clientX, clientY) => {
      if (!parabolaTool.classList.contains('tool-floating')) {
        const rect = parabolaTool.getBoundingClientRect();
        document.body.appendChild(parabolaTool);
        parabolaTool.classList.add('tool-floating');
        parabolaTool.style.left = rect.left + 'px';
        parabolaTool.style.top = rect.top + 'px';
      }
      const r2 = parabolaTool.getBoundingClientRect();
      isDraggingParabolaPanel = true;
      parabolaDragOffsetX = clientX - r2.left;
      parabolaDragOffsetY = clientY - r2.top;
    };
    parabolaHeader.addEventListener('mousedown', (e) => { startParaDrag(e.clientX, e.clientY); e.preventDefault(); e.stopPropagation(); });
    window.addEventListener('mousemove', (e) => {
      if (!isDraggingParabolaPanel) return;
      const x = Math.max(0, Math.min(window.innerWidth - parabolaTool.offsetWidth, e.clientX - parabolaDragOffsetX));
      const y = Math.max((toolbarEl ? toolbarEl.offsetHeight + 4 : 0), Math.min(window.innerHeight - parabolaTool.offsetHeight, e.clientY - parabolaDragOffsetY));
      parabolaTool.style.left = x + 'px';
      parabolaTool.style.top = y + 'px';
    });
    window.addEventListener('mouseup', (e) => { isDraggingParabolaPanel = false; e?.stopPropagation?.(); });
    // Touch support
    parabolaHeader.addEventListener('touchstart', (e) => {
      if (!e.touches || e.touches.length === 0) return;
      const t = e.touches[0];
      startParaDrag(t.clientX, t.clientY); e.preventDefault(); e.stopPropagation();
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      if (!isDraggingParabolaPanel || !e.touches || e.touches.length === 0) return;
      const t = e.touches[0];
      const x = Math.max(0, Math.min(window.innerWidth - parabolaTool.offsetWidth, t.clientX - parabolaDragOffsetX));
      const y = Math.max((toolbarEl ? toolbarEl.offsetHeight + 4 : 0), Math.min(window.innerHeight - parabolaTool.offsetHeight, t.clientY - parabolaDragOffsetY));
      parabolaTool.style.left = x + 'px';
      parabolaTool.style.top = y + 'px';
      e.preventDefault(); e.stopPropagation();
    }, { passive: false });
    window.addEventListener('touchend', (e) => { isDraggingParabolaPanel = false; e?.stopPropagation?.(); });

    if (dockParabolaPanel && toolboxEmbeddedAreaEl) {
      dockParabolaPanel.addEventListener('click', () => {
        const toolboxContent = document.querySelector('.toolbox-content');
        (toolboxContent || toolboxEmbeddedAreaEl).appendChild(parabolaTool);
        parabolaTool.classList.remove('tool-floating');
        parabolaTool.style.left = '';
        parabolaTool.style.top = '';
        // Do not force open the toolbox on dock
      });
    }
  }
  // Disable dragging for equation card (fixed position under toolbar)
  // Make equation card dockable back to toolbox area
  // Dock button removed from equation card (kept non-draggable, fixed)

  // Removed Line chip; Two-Point Line panel is draggable by header

  // Make Two-Point Line panel draggable out of the toolbox like Plot Point
  const line2Tool = document.getElementById('line2Tool');
  const line2Header = document.getElementById('line2Header');
  const dockLine2Panel = document.getElementById('dockLine2Panel');
  let draggingLine2Panel = false;
  let line2OffsetX = 0;
  let line2OffsetY = 0;
  if (line2Tool && line2Header) {
    const startDrag = (clientX, clientY) => {
      if (!line2Tool.classList.contains('tool-floating')) {
        const rect = line2Tool.getBoundingClientRect();
        document.body.appendChild(line2Tool);
        line2Tool.classList.add('tool-floating');
        line2Tool.style.left = rect.left + 'px';
        line2Tool.style.top = rect.top + 'px';
      }
      const rect2 = line2Tool.getBoundingClientRect();
      draggingLine2Panel = true;
      line2OffsetX = clientX - rect2.left;
      line2OffsetY = clientY - rect2.top;
    };
    line2Header.addEventListener('mousedown', (e) => { startDrag(e.clientX, e.clientY); e.preventDefault(); e.stopPropagation(); });
    window.addEventListener('mousemove', (e) => {
      if (!draggingLine2Panel) return;
      const x = Math.max(0, Math.min(window.innerWidth - line2Tool.offsetWidth, e.clientX - line2OffsetX));
      const y = Math.max((toolbarEl ? toolbarEl.offsetHeight + 4 : 0), Math.min(window.innerHeight - line2Tool.offsetHeight, e.clientY - line2OffsetY));
      line2Tool.style.left = x + 'px';
      line2Tool.style.top = y + 'px';
    });
    window.addEventListener('mouseup', (e) => { draggingLine2Panel = false; if (e) e.stopPropagation?.(); });
    // Touch
    line2Header.addEventListener('touchstart', (e) => {
      if (!e.touches || e.touches.length === 0) return;
      const t = e.touches[0];
      startDrag(t.clientX, t.clientY);
      e.preventDefault(); e.stopPropagation();
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      if (!draggingLine2Panel || !e.touches || e.touches.length === 0) return;
      const t = e.touches[0];
      const x = Math.max(0, Math.min(window.innerWidth - line2Tool.offsetWidth, t.clientX - line2OffsetX));
      const y = Math.max((toolbarEl ? toolbarEl.offsetHeight + 4 : 0), Math.min(window.innerHeight - line2Tool.offsetHeight, t.clientY - line2OffsetY));
      line2Tool.style.left = x + 'px';
      line2Tool.style.top = y + 'px';
      e.preventDefault(); e.stopPropagation();
    }, { passive: false });
    window.addEventListener('touchend', (e) => { draggingLine2Panel = false; if (e) e.stopPropagation?.(); });
    // Dock
    if (dockLine2Panel && toolboxEmbeddedAreaEl) {
      dockLine2Panel.addEventListener('click', () => {
        // Place next to other tools inside the toolbox content, not stacked
        const toolboxContent = document.querySelector('.toolbox-content');
        (toolboxContent || toolboxEmbeddedAreaEl).appendChild(line2Tool);
        line2Tool.classList.remove('tool-floating');
        line2Tool.style.left = '';
        line2Tool.style.top = '';
        // Do not force open the toolbox on dock
      });
    }
  }

  // Make Curved Line panel draggable out of the toolbox
  const curvedTool = document.getElementById('curvedTool');
  const curvedHeader = document.getElementById('curvedHeader');
  const dockCurvedPanel = document.getElementById('dockCurvedPanel');
  let draggingCurvedPanel = false;
  let curvedOffsetX = 0;
  let curvedOffsetY = 0;
  if (curvedTool && curvedHeader) {
    const startDragCurved = (clientX, clientY) => {
      if (!curvedTool.classList.contains('tool-floating')) {
        const rect = curvedTool.getBoundingClientRect();
        document.body.appendChild(curvedTool);
        curvedTool.classList.add('tool-floating');
        curvedTool.style.left = rect.left + 'px';
        curvedTool.style.top = rect.top + 'px';
      }
      const rect2 = curvedTool.getBoundingClientRect();
      draggingCurvedPanel = true;
      curvedOffsetX = clientX - rect2.left;
      curvedOffsetY = clientY - rect2.top;
    };
    curvedHeader.addEventListener('mousedown', (e) => { startDragCurved(e.clientX, e.clientY); e.preventDefault(); e.stopPropagation(); });
    window.addEventListener('mousemove', (e) => {
      if (!draggingCurvedPanel) return;
      const x = Math.max(0, Math.min(window.innerWidth - curvedTool.offsetWidth, e.clientX - curvedOffsetX));
      const y = Math.max((toolbarEl ? toolbarEl.offsetHeight + 4 : 0), Math.min(window.innerHeight - curvedTool.offsetHeight, e.clientY - curvedOffsetY));
      curvedTool.style.left = x + 'px';
      curvedTool.style.top = y + 'px';
    });
    window.addEventListener('mouseup', (e) => { draggingCurvedPanel = false; if (e) e.stopPropagation?.(); });
    // Touch
    curvedHeader.addEventListener('touchstart', (e) => {
      if (!e.touches || e.touches.length === 0) return;
      const t = e.touches[0];
      startDragCurved(t.clientX, t.clientY);
      e.preventDefault(); e.stopPropagation();
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      if (!draggingCurvedPanel || !e.touches || e.touches.length === 0) return;
      const t = e.touches[0];
      const x = Math.max(0, Math.min(window.innerWidth - curvedTool.offsetWidth, t.clientX - curvedOffsetX));
      const y = Math.max((toolbarEl ? toolbarEl.offsetHeight + 4 : 0), Math.min(window.innerHeight - curvedTool.offsetHeight, t.clientY - curvedOffsetY));
      curvedTool.style.left = x + 'px';
      curvedTool.style.top = y + 'px';
      e.preventDefault(); e.stopPropagation();
    }, { passive: false });
    if (dockCurvedPanel) {
      dockCurvedPanel.addEventListener('click', () => {
        const toolboxContent = document.querySelector('.toolbox-content');
        (toolboxContent || toolboxEmbeddedAreaEl).appendChild(curvedTool);
        curvedTool.classList.remove('tool-floating');
        curvedTool.style.left = '';
        curvedTool.style.top = '';
        // Do not force open the toolbox on dock
      });
    }
  }

  // Draggable left panel
  if (leftPanelEl && plotPanelHeaderEl) {
    plotPanelHeaderEl.addEventListener('mousedown', (e) => {
      // If panel is embedded in toolbox, pop it out before dragging
      if (leftPanelEl.classList && leftPanelEl.classList.contains('embedded')) {
        const rectBefore = leftPanelEl.getBoundingClientRect();
        document.body.appendChild(leftPanelEl);
      leftPanelEl.classList.remove('embedded');
        leftPanelEl.style.position = 'absolute';
        leftPanelEl.style.left = rectBefore.left + 'px';
        leftPanelEl.style.top = rectBefore.top + 'px';
      // Do not auto-close toolbox anymore
      }
      isDraggingPanel = true;
      const rect = leftPanelEl.getBoundingClientRect();
      panelDragOffsetX = e.clientX - rect.left;
      panelDragOffsetY = e.clientY - rect.top;
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!isDraggingPanel) return;
      const x = Math.max(0, Math.min(window.innerWidth - leftPanelEl.offsetWidth, e.clientX - panelDragOffsetX));
      const y = Math.max(toolbarEl ? toolbarEl.offsetTop + toolbarEl.offsetHeight + 4 : 0, Math.min(window.innerHeight - leftPanelEl.offsetHeight, e.clientY - panelDragOffsetY));
      leftPanelEl.style.left = x + 'px';
      leftPanelEl.style.top = y + 'px';
    });
    window.addEventListener('mouseup', () => { isDraggingPanel = false; });

    // Touch support
    plotPanelHeaderEl.addEventListener('touchstart', (e) => {
      if (!e.touches || e.touches.length === 0) return;
      if (leftPanelEl.classList && leftPanelEl.classList.contains('embedded')) {
        const rectBefore = leftPanelEl.getBoundingClientRect();
        document.body.appendChild(leftPanelEl);
      leftPanelEl.classList.remove('embedded');
        leftPanelEl.style.position = 'absolute';
        leftPanelEl.style.left = rectBefore.left + 'px';
        leftPanelEl.style.top = rectBefore.top + 'px';
      // Do not auto-close toolbox anymore
      }
      isDraggingPanel = true;
      const t = e.touches[0];
      const rect = leftPanelEl.getBoundingClientRect();
      panelDragOffsetX = t.clientX - rect.left;
      panelDragOffsetY = t.clientY - rect.top;
      e.preventDefault();
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      if (!isDraggingPanel || !e.touches || e.touches.length === 0) return;
      const t = e.touches[0];
      const x = Math.max(0, Math.min(window.innerWidth - leftPanelEl.offsetWidth, t.clientX - panelDragOffsetX));
      const y = Math.max(toolbarEl ? toolbarEl.offsetTop + toolbarEl.offsetHeight + 4 : 0, Math.min(window.innerHeight - leftPanelEl.offsetHeight, t.clientY - panelDragOffsetY));
      leftPanelEl.style.left = x + 'px';
      leftPanelEl.style.top = y + 'px';
      e.preventDefault();
    }, { passive: false });
    window.addEventListener('touchend', () => { isDraggingPanel = false; });
  }

  // Minimize panel to toolbox (only moves panel when you click the minimize button)
  if (minimizeBtnEl && leftPanelEl) {
    minimizeBtnEl.addEventListener('click', () => {
      if (toolboxEmbeddedAreaEl) {
        leftPanelEl.classList.add('embedded');
        // Reset inline positioning so it appears correctly inside the toolbox
        leftPanelEl.style.position = '';
        leftPanelEl.style.left = '';
        leftPanelEl.style.top = '';
        leftPanelEl.style.display = 'block';
        const toolboxContent = document.querySelector('.toolbox-content');
        (toolboxContent || toolboxEmbeddedAreaEl).appendChild(leftPanelEl);
      } else {
        leftPanelEl.style.display = 'none';
      }
    });
  }

  // Toolbox toggle
  if (toolboxBtnEl && toolboxDrawerEl) {
    const toggle = () => {
      const isOpen = toolboxDrawerEl.style.display !== 'none';
      toolboxDrawerEl.style.display = isOpen ? 'none' : 'block';
      try {
        if (toolboxDrawerEl.style.display !== 'none') {
          document.body.classList.add('toolbox-open');
        } else {
          document.body.classList.remove('toolbox-open');
        }
      } catch (_) {}
    };
    toolboxBtnEl.addEventListener('click', toggle);
    if (toolboxCloseEl) toolboxCloseEl.addEventListener('click', toggle);
  }

  // Snap slider wiring
  const snapSlider = document.getElementById('snapSlider');
  const snapLabel = document.getElementById('snapLabel');
  if (snapSlider) {
    const updateSnap = () => {
      const val = parseInt(snapSlider.value || '2', 10);
      // 0 = free (no snap), 1 = 0.25, 2 = 0.5, 3 = 1.0 (adjust slider range in HTML if needed)
      if (val === 0) {
        snapStep = 0; // free move
        if (snapLabel) snapLabel.textContent = 'free';
      } else if (val === 1) {
        snapStep = 0.25;
        if (snapLabel) snapLabel.textContent = snapStep.toFixed(2);
      } else if (val === 2) {
        snapStep = 0.5;
        if (snapLabel) snapLabel.textContent = snapStep.toFixed(2);
      } else {
        snapStep = 1;
        if (snapLabel) snapLabel.textContent = snapStep.toFixed(2);
      }
    };
    const onDown = (e) => { uiPointerDown = true; e.stopPropagation(); };
    const onUp = (e) => { uiPointerDown = false; e.stopPropagation(); };
    snapSlider.addEventListener('mousedown', onDown);
    snapSlider.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    snapSlider.addEventListener('input', updateSnap);
    updateSnap();
  }

  // Formulas modal wiring
  const formulasBtn = document.getElementById('formulasBtn');
  const formulasModal = document.getElementById('formulasModal');
  const formulasContent = document.getElementById('formulasContent');
  const formulasFilter = document.getElementById('formulasFilter');
  if (formulasBtn && formulasModal && formulasContent) {
    const buildList = (filter) => {
      const lines = [];
      const wantLine = filter === 'all' || filter === 'line';
      const wantPara = filter === 'all' || filter === 'parabola';
      const wantCurved = filter === 'all' || filter === 'curved';
      if (wantLine) {
        for (const ln of (twoPointLines || [])) {
          const name = ln.name || 'Line';
          if (Math.abs(ln.p2.x - ln.p1.x) < 1e-12) {
            lines.push(`${name}: x = ${ln.p1.x.toFixed(3)}`);
          } else {
            const m = (ln.p2.y - ln.p1.y) / (ln.p2.x - ln.p1.x);
            const b = ln.p1.y - m * ln.p1.x;
            lines.push(`${name}: y = ${round3(m)}x + ${signed(round3(b))}`);
          }
        }
      }
      if (wantPara) {
        for (const pb of (parabolas || [])) {
          const name = pb.name || 'Parabola';
          lines.push(`${name}: ${formatParabolaEquation(pb.a, pb.b, pb.c)}`);
        }
      }
      if (wantCurved) {
        for (const cl of (curvedLines || [])) {
          const name = cl.name || 'Curved';
          const pts = (cl.points || []).map(p => `(${round3(p.x)}, ${round3(p.y)})`).join(', ');
          lines.push(`${name}: control points ${pts}`);
        }
      }
      formulasContent.innerHTML = '';
      const pre = document.createElement('pre');
      pre.textContent = lines.length ? lines.join('\n') : 'No formulas yet.';
      formulasContent.appendChild(pre);
    };

    const openModal = () => {
      buildList(formulasFilter ? formulasFilter.value : 'all');
      formulasModal.style.display = 'flex';
    };
    const closeModal = (e) => {
      if (e && e.target && e.target !== formulasModal) return;
      formulasModal.style.display = 'none';
    };
    formulasBtn.addEventListener('click', openModal);
    formulasModal.addEventListener('click', closeModal);
    if (formulasFilter) {
      formulasFilter.addEventListener('change', () => {
        buildList(formulasFilter.value);
      });
    }
  }

  // Slide-out side panel toggle
  const sidePanelEl = document.getElementById('sidePanel');
  const sideToggleBtn = document.getElementById('sideToggleBtn');
  if (sidePanelEl && sideToggleBtn) {
    const open = () => {
      sidePanelEl.classList.add('open');
      sidePanelEl.setAttribute('aria-hidden', 'false');
      sideToggleBtn.textContent = '◀';
      sideToggleBtn.title = 'Close sidebar';
      // Hide the outer toggle when panel is open so only one arrow is visible
      sideToggleBtn.style.display = 'none';
    };
    const close = () => {
      sidePanelEl.classList.remove('open');
      sidePanelEl.setAttribute('aria-hidden', 'true');
      sideToggleBtn.textContent = '▶';
      sideToggleBtn.title = 'Open sidebar';
      // Show the outer toggle when panel is closed
      sideToggleBtn.style.display = '';
    };
    let isOpen = false;
    const toggle = () => { isOpen ? close() : open(); isOpen = !isOpen; };
    sideToggleBtn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
    const sideClose = document.getElementById('sideClose');
    const sideFloatClose = document.getElementById('sideFloatClose');
    const closeIfOpen = (e) => { e.stopPropagation(); if (isOpen) toggle(); };
    if (sideClose) sideClose.addEventListener('click', closeIfOpen);
    if (sideFloatClose) sideFloatClose.addEventListener('click', closeIfOpen);
    // Menu navigation: Menu -> Editing Tools
    const sideHeaderTitle = document.getElementById('sideHeaderTitle');
    const sideBack = document.getElementById('sideBack');
    const sideMenuView = document.getElementById('sideMenuView');
    const editingToolsView = document.getElementById('editingToolsView');
    const menuItemEditingTools = document.getElementById('menuItemEditingTools');
    const goMenu = () => {
      if (sideHeaderTitle) sideHeaderTitle.textContent = 'Menu';
      if (sideBack) sideBack.style.display = 'none';
      if (sideMenuView) sideMenuView.style.display = 'block';
      if (editingToolsView) editingToolsView.style.display = 'none';
    };
    const goEditingTools = () => {
      if (sideHeaderTitle) sideHeaderTitle.textContent = 'Editing Tools';
      if (sideBack) sideBack.style.display = 'inline';
      if (sideMenuView) sideMenuView.style.display = 'none';
      if (editingToolsView) editingToolsView.style.display = 'block';
    };
    if (menuItemEditingTools) menuItemEditingTools.addEventListener('click', goEditingTools);
    if (sideBack) sideBack.addEventListener('click', goMenu);
    // Initialize default view
    goMenu();
  }

  // Plot Point Editor tool: drag-out card and selection wiring
  // --- Global color picker wiring ---
  const colorPickerEl = document.getElementById('colorPicker');
  const cpArea = document.getElementById('cpArea');
  const cpHue = document.getElementById('cpHue');
  const cpHueBase = document.getElementById('cpHueBase');
  const cpCursor = document.getElementById('cpCursor');
  const cpPreview = document.getElementById('cpPreview');
  const cpHex = document.getElementById('cpHex');
  const cpApply = document.getElementById('cpApply');
  const cpCancel = document.getElementById('cpCancel');

  let activeColorInput = null; // input element being edited
  let cpState = { h: 0, s: 1, v: 1 };
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const hsvToRgb = (h, s, v) => {
    const c = v * s; const x = c * (1 - Math.abs(((h / 60) % 2) - 1)); const m = v - c;
    let r=0,g=0,b=0; if (h<60){r=c;g=x;} else if (h<120){r=x;g=c;} else if (h<180){g=c;b=x;} else if (h<240){g=x;b=c;} else if (h<300){r=x;b=c;} else {r=c;b=x;}
    return { r: Math.round((r+m)*255), g: Math.round((g+m)*255), b: Math.round((b+m)*255) };
  };
  const rgbToHex = (r,g,b) => '#' + [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
  const hexToRgbUtil = (hex) => {
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || '');
    if (!m) return { r: 255, g: 255, b: 255 };
    return { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) };
  };
  const rgbToHsv = (r, g, b) => {
    r/=255; g/=255; b/=255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b); const d = max - min;
    let h = 0; if (d !== 0) {
      switch(max){
        case r: h = 60 * (((g - b) / d) % 6); break;
        case g: h = 60 * (((b - r) / d) + 2); break;
        case b: h = 60 * (((r - g) / d) + 4); break;
      }
      if (h < 0) h += 360;
    }
    const s = max === 0 ? 0 : d / max; const v = max;
    return { h, s, v };
  };
  const setHueBase = () => { const { h } = cpState; cpHueBase.style.background = `hsl(${h}, 100%, 50%)`; };
  const updatePreview = () => { 
    const { h,s,v } = cpState; const { r,g,b } = hsvToRgb(h,s,v); const hex = rgbToHex(r,g,b);
    if (cpPreview) cpPreview.style.background = hex; if (cpHex) cpHex.value = hex;
    if (activeColorInput) { activeColorInput.value = hex; activeColorInput.dispatchEvent(new Event('input')); }
  };
  const openColorPicker = (inputEl) => {
    activeColorInput = inputEl;
    const rect = inputEl.getBoundingClientRect();
    colorPickerEl.style.display = 'flex';
    // delay position until layout
    setTimeout(()=>{
      const w = colorPickerEl.offsetWidth || 260; const h = colorPickerEl.offsetHeight || 220;
      colorPickerEl.style.left = Math.min(window.innerWidth - w - 8, rect.left) + 'px';
      colorPickerEl.style.top = Math.min(window.innerHeight - h - 8, rect.bottom + 8) + 'px';
    },0);
    // Initialize from current value
    const { r,g,b } = hexToRgbUtil(inputEl.value || '#ffffff');
    const hsv = rgbToHsv(r,g,b); cpState = { h: hsv.h, s: clamp01(hsv.s), v: clamp01(hsv.v) };
    if (cpHue) cpHue.value = String(Math.round(cpState.h));
    setHueBase();
    // place cursor
    setTimeout(()=>{
      if (!cpArea) return; const ar = cpArea.getBoundingClientRect();
      cpCursor.style.left = Math.round(cpState.s * ar.width) + 'px';
      cpCursor.style.top = Math.round((1 - cpState.v) * ar.height) + 'px';
    },0);
    updatePreview();
  };
  const closeColorPicker = () => { colorPickerEl.style.display = 'none'; activeColorInput = null; };
  const onAreaInteract = (clientX, clientY) => {
    const r = cpArea.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, clientX - r.left));
    const y = Math.max(0, Math.min(r.height, clientY - r.top));
    cpState.s = x / r.width; cpState.v = 1 - (y / r.height);
    cpCursor.style.left = x + 'px'; cpCursor.style.top = y + 'px';
    updatePreview();
  };
  if (cpHue) cpHue.addEventListener('input', () => { cpState.h = parseInt(cpHue.value||'0',10); setHueBase(); updatePreview(); });
  if (cpHex) cpHex.addEventListener('input', ()=>{
    const { r,g,b } = hexToRgbUtil(cpHex.value);
    const hsv = rgbToHsv(r,g,b); cpState = { h: hsv.h, s: clamp01(hsv.s), v: clamp01(hsv.v) };
    if (cpHue) cpHue.value = String(Math.round(cpState.h)); setHueBase();
    if (cpArea){ const ar=cpArea.getBoundingClientRect(); cpCursor.style.left = Math.round(cpState.s * ar.width) + 'px'; cpCursor.style.top = Math.round((1-cpState.v) * ar.height) + 'px'; }
    updatePreview();
  });
  let draggingCp = false;
  if (cpArea) {
    cpArea.addEventListener('mousedown', (e)=>{ draggingCp=true; onAreaInteract(e.clientX,e.clientY); e.preventDefault(); e.stopPropagation(); });
    window.addEventListener('mousemove', (e)=>{ if (draggingCp) onAreaInteract(e.clientX,e.clientY); });
    window.addEventListener('mouseup', ()=>{ draggingCp=false; });
    cpArea.addEventListener('touchstart', (e)=>{ const t=e.touches[0]; draggingCp=true; onAreaInteract(t.clientX,t.clientY); }, { passive:true });
    window.addEventListener('touchmove', (e)=>{ if (draggingCp && e.touches && e.touches[0]) { const t=e.touches[0]; onAreaInteract(t.clientX,t.clientY); }}, { passive:true });
    window.addEventListener('touchend', ()=>{ draggingCp=false; });
  }
  if (cpApply) cpApply.addEventListener('click', ()=>{ closeColorPicker(); });
  if (cpCancel) cpCancel.addEventListener('click', ()=> closeColorPicker());
  // Attach to all inputs with data-colorpicker
  const attachPicker = (el) => { el.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); openColorPicker(el); }); };
  document.querySelectorAll('input[type="color"][data-colorpicker="true"]').forEach(attachPicker);
  // Also attach to parabola editor if present later
  const plotEditTool = document.getElementById('plotEditTool');
  const plotEditHeader = document.getElementById('plotEditHeader');
  const dockPlotEditPanel = document.getElementById('dockPlotEditPanel');
  const plotSelectBtn = document.getElementById('plotSelectBtn');
  const plotNameInput = document.getElementById('plotNameInput');
  const plotSizeInput = document.getElementById('plotSizeInput');
  const plotColorInput = document.getElementById('plotColorInput');
  const plotShowCoordsInput = document.getElementById('plotShowCoordsInput');
  const plotOpacityInput = document.getElementById('plotOpacityInput');
  const plotDeleteBtn = document.getElementById('plotDeleteBtn');

  // Two-point line editor elements
  const line2EditTool = document.getElementById('line2EditTool');
  const line2EditHeader = document.getElementById('line2EditHeader');
  const dockLine2EditPanel = document.getElementById('dockLine2EditPanel');
  const line2SelectBtn = document.getElementById('line2SelectBtn');
  const line2NameInput = document.getElementById('line2NameInput');
  const line2OpacityInput = document.getElementById('line2OpacityInput');
  const line2ColorInput = document.getElementById('line2ColorInput');
  const line2DeleteBtn = document.getElementById('line2DeleteBtn');
  const line2ShowDotsInput = document.getElementById('line2ShowDotsInput');

  // Three-point parabola editor elements
  const paraEditTool = document.getElementById('paraEditTool');
  const paraEditHeader = document.getElementById('paraEditHeader');
  const dockParaEditPanel = document.getElementById('dockParaEditPanel');
  const paraSelectBtn = document.getElementById('paraSelectBtn');
  const paraNameInput = document.getElementById('paraNameInput');
  const paraOpacityInput = document.getElementById('paraOpacityInput');
  const paraColorInput = document.getElementById('paraColorInput');
  const paraShowDotsInput = document.getElementById('paraShowDotsInput');
  const paraDeleteBtn = document.getElementById('paraDeleteBtn');

  let draggingPlotPanel = false; let plotOffsetX = 0; let plotOffsetY = 0;
  let selectedMarkerId = null; // only standalone markers (lineId null)
  let selectingPoint = false;

  const setEditorDisabled = (disabled) => {
    if (plotNameInput) plotNameInput.disabled = disabled;
    if (plotSizeInput) plotSizeInput.disabled = disabled;
    if (plotColorInput) plotColorInput.disabled = disabled;
    if (plotShowCoordsInput) plotShowCoordsInput.disabled = disabled;
    if (plotOpacityInput) plotOpacityInput.disabled = disabled;
    if (plotDeleteBtn) plotDeleteBtn.disabled = disabled;
    // greyed style via opacity
    const opacity = disabled ? 0.98 : 1; // keep card readable while inputs disabled
    if (plotEditTool) plotEditTool.style.opacity = String(opacity);
  };
  setEditorDisabled(true);

  if (plotEditHeader && plotEditTool) {
    const startDragPlot = (cx, cy) => {
      if (!plotEditTool.classList.contains('tool-floating')) {
        const rect = plotEditTool.getBoundingClientRect();
        document.body.appendChild(plotEditTool);
        plotEditTool.classList.add('tool-floating');
        plotEditTool.style.left = rect.left + 'px';
        plotEditTool.style.top = rect.top + 'px';
      }
      const r = plotEditTool.getBoundingClientRect();
      draggingPlotPanel = true; plotOffsetX = cx - r.left; plotOffsetY = cy - r.top;
    };
    plotEditHeader.addEventListener('mousedown', (e) => { startDragPlot(e.clientX, e.clientY); e.preventDefault(); e.stopPropagation(); });
    window.addEventListener('mousemove', (e) => {
      if (!draggingPlotPanel) return;
      const x = Math.max(0, Math.min(window.innerWidth - plotEditTool.offsetWidth, e.clientX - plotOffsetX));
      const y = Math.max((toolbarEl ? toolbarEl.offsetHeight + 4 : 0), Math.min(window.innerHeight - plotEditTool.offsetHeight, e.clientY - plotOffsetY));
      plotEditTool.style.left = x + 'px'; plotEditTool.style.top = y + 'px';
    });
    window.addEventListener('mouseup', () => { draggingPlotPanel = false; });
    // Dock back to sidebar
    if (dockPlotEditPanel) dockPlotEditPanel.addEventListener('click', () => {
      const editingToolsView = document.getElementById('editingToolsView');
      if (editingToolsView) editingToolsView.appendChild(plotEditTool);
      plotEditTool.classList.remove('tool-floating');
      plotEditTool.style.left = ''; plotEditTool.style.top = '';
    });
  }

  if (plotSelectBtn) {
    plotSelectBtn.addEventListener('click', () => {
      selectingPoint = true;
      setEditorDisabled(true);
      plotSelectBtn.textContent = 'Click a point…';
    });
  }

  // Hook into existing mousePressed to capture selection (only standalone markers)
  const origMousePressed = window.mousePressed;
  window.mousePressed = function() {
    if (selectingPoint) {
      const near = findNearestMarker(mouseX, mouseY);
      if (near) {
        const mk = markers.find(m => m.id === near.id);
        if (mk && !mk.lineId) {
          selectedMarkerId = mk.id;
          setEditorDisabled(false);
          if (plotNameInput) plotNameInput.value = mk.label || '';
          if (plotSizeInput) plotSizeInput.value = String(Math.max(2, Math.min(24, mk.size || 6)));
          if (plotColorInput) plotColorInput.value = mk.color || '#ffd166';
          if (plotShowCoordsInput) plotShowCoordsInput.checked = !!mk.showCoords;
          if (plotOpacityInput) plotOpacityInput.value = String(Number.isFinite(mk.alphaPct) ? mk.alphaPct : 100);
          plotSelectBtn.textContent = 'Select point';
          selectingPoint = false;
          return; // do not propagate selection click further
        }
      }
      // If miss or non-standalone, remain in selection mode
    }
    if (selectingLine2) {
      // Try endpoints first for precision
      const endpoint = findNearestTwoPointEndpoint(mouseX, mouseY);
      let ln = endpoint ? twoPointLines.find(l => l.id === endpoint.lineId) : null;
      // If not on an endpoint, allow clicking anywhere on the line body
      if (!ln) {
        const hit = findNearestOnExtraLines(mouseX, mouseY);
        if (hit && hit.lineType === 'line2' && hit.lineRef) ln = hit.lineRef;
      }
      if (ln) {
        selectedLine2Id = ln.id;
        setLine2EditorDisabled(false);
        if (line2NameInput) line2NameInput.value = ln.name || '';
        if (line2ColorInput) line2ColorInput.value = ln.color || '#66d9ef';
        if (line2OpacityInput) line2OpacityInput.value = String(Number.isFinite(ln.alphaPct) ? ln.alphaPct : 100);
        if (line2ShowDotsInput) line2ShowDotsInput.checked = (ln.showDots !== false);
        if (line2SelectBtn) line2SelectBtn.textContent = 'Select line';
        selectingLine2 = false;
        return;
      }
      // Stay in selection mode if miss
      return;
    }
    if (selectingParabola) {
      // Try vertex/root first, then any point on curve
      const v = findNearestParabolaVertex(mouseX, mouseY);
      let pb = v ? parabolas.find(p => p.id === v.id) : null;
      if (!pb) {
        const hit = findNearestOnParabolas(mouseX, mouseY);
        if (hit && hit.pbRef) pb = hit.pbRef;
      }
      if (pb) {
        selectedParabolaId = pb.id;
        setParaEditorDisabled(false);
        if (paraNameInput) paraNameInput.value = pb.name || '';
        if (paraColorInput) paraColorInput.value = pb.color || '#e67e22';
        if (paraOpacityInput) paraOpacityInput.value = String(Number.isFinite(pb.alphaPct) ? pb.alphaPct : 100);
        if (paraShowDotsInput) paraShowDotsInput.checked = (pb.showDots !== false);
        if (paraSelectBtn) paraSelectBtn.textContent = 'Select parabola';
        selectingParabola = false;
        return;
      }
      return;
    }
    if (typeof origMousePressed === 'function') return origMousePressed();
  };

  // Wire inputs to update the selected marker
  const updateSelectedMarker = () => {
    if (!selectedMarkerId) return;
    const mk = markers.find(m => m.id === selectedMarkerId);
    if (!mk) return;
    if (plotNameInput) mk.label = String(plotNameInput.value || '').slice(0, 60);
    if (plotSizeInput) {
      const v = Math.max(2, Math.min(24, parseInt(plotSizeInput.value || '6', 10)));
      mk.size = v;
    }
    if (plotColorInput) mk.color = plotColorInput.value || '#ffd166';
    if (plotShowCoordsInput) mk.showCoords = !!plotShowCoordsInput.checked;
    if (plotOpacityInput) {
      const p = Math.max(0, Math.min(100, parseInt(plotOpacityInput.value || '100', 10)));
      mk.alphaPct = p;
    }
  };
  if (plotNameInput) plotNameInput.addEventListener('input', updateSelectedMarker);
  if (plotSizeInput) plotSizeInput.addEventListener('input', updateSelectedMarker);
  if (plotColorInput) plotColorInput.addEventListener('input', updateSelectedMarker);
  if (plotShowCoordsInput) plotShowCoordsInput.addEventListener('change', updateSelectedMarker);
  if (plotOpacityInput) plotOpacityInput.addEventListener('input', updateSelectedMarker);
  if (plotDeleteBtn) plotDeleteBtn.addEventListener('click', () => {
    if (!selectedMarkerId) return;
    markers = markers.filter(m => m.id !== selectedMarkerId);
    selectedMarkerId = null;
    setEditorDisabled(true);
  });

  // ---- Two-point line editor logic ----
  let draggingLine2Edit = false; let line2EditOffsetX = 0; let line2EditOffsetY = 0;
  let selectingLine2 = false; let selectedLine2Id = null;
  const setLine2EditorDisabled = (disabled) => {
    if (line2NameInput) line2NameInput.disabled = disabled;
    if (line2OpacityInput) line2OpacityInput.disabled = disabled;
    if (line2ColorInput) line2ColorInput.disabled = disabled;
    if (line2DeleteBtn) line2DeleteBtn.disabled = disabled;
    if (line2ShowDotsInput) line2ShowDotsInput.disabled = disabled;
    if (line2EditTool) line2EditTool.style.opacity = String(disabled ? 0.98 : 1);
  };
  setLine2EditorDisabled(true);
  if (line2EditHeader && line2EditTool) {
    const startDrag = (cx, cy) => {
      if (!line2EditTool.classList.contains('tool-floating')) {
        const rect = line2EditTool.getBoundingClientRect();
        document.body.appendChild(line2EditTool);
        line2EditTool.classList.add('tool-floating');
        line2EditTool.style.left = rect.left + 'px';
        line2EditTool.style.top = rect.top + 'px';
      }
      const r = line2EditTool.getBoundingClientRect();
      draggingLine2Edit = true; line2EditOffsetX = cx - r.left; line2EditOffsetY = cy - r.top;
    };
    line2EditHeader.addEventListener('mousedown', (e) => { startDrag(e.clientX, e.clientY); e.preventDefault(); e.stopPropagation(); });
    window.addEventListener('mousemove', (e) => {
      if (!draggingLine2Edit) return;
      const x = Math.max(0, Math.min(window.innerWidth - line2EditTool.offsetWidth, e.clientX - line2EditOffsetX));
      const y = Math.max((toolbarEl ? toolbarEl.offsetHeight + 4 : 0), Math.min(window.innerHeight - line2EditTool.offsetHeight, e.clientY - line2EditOffsetY));
      line2EditTool.style.left = x + 'px'; line2EditTool.style.top = y + 'px';
    });
    window.addEventListener('mouseup', () => { draggingLine2Edit = false; });
    if (dockLine2EditPanel) dockLine2EditPanel.addEventListener('click', () => {
      const editingToolsView = document.getElementById('editingToolsView');
      if (editingToolsView) editingToolsView.appendChild(line2EditTool);
      line2EditTool.classList.remove('tool-floating');
      line2EditTool.style.left = ''; line2EditTool.style.top = '';
    });
  }
  if (line2SelectBtn) line2SelectBtn.addEventListener('click', () => { selectingLine2 = true; setLine2EditorDisabled(true); line2SelectBtn.textContent = 'Click a line…'; });
  const updateSelectedLine2 = () => {
    if (!selectedLine2Id) return;
    const ln = twoPointLines.find(l => l.id === selectedLine2Id);
    if (!ln) return;
    if (line2NameInput) ln.name = String(line2NameInput.value || '').slice(0, 40);
    if (line2ColorInput) ln.color = line2ColorInput.value || '#66d9ef';
    if (line2OpacityInput) ln.alphaPct = Math.max(0, Math.min(100, parseInt(line2OpacityInput.value || '100', 10)));
    if (line2ShowDotsInput) ln.showDots = !!line2ShowDotsInput.checked;
  };
  if (line2NameInput) line2NameInput.addEventListener('input', updateSelectedLine2);
  if (line2OpacityInput) line2OpacityInput.addEventListener('input', updateSelectedLine2);
  if (line2ColorInput) line2ColorInput.addEventListener('input', updateSelectedLine2);
  if (line2ShowDotsInput) line2ShowDotsInput.addEventListener('change', updateSelectedLine2);
  if (line2DeleteBtn) line2DeleteBtn.addEventListener('click', () => {
    if (!selectedLine2Id) return;
    twoPointLines = twoPointLines.filter(l => l.id !== selectedLine2Id);
    selectedLine2Id = null; setLine2EditorDisabled(true);
  });

  // ---- Three-point parabola editor logic ----
  let draggingParaEdit = false; let paraEditOffsetX = 0; let paraEditOffsetY = 0;
  let selectingParabola = false; let selectedParabolaId = null;
  const setParaEditorDisabled = (disabled) => {
    if (paraNameInput) paraNameInput.disabled = disabled;
    if (paraOpacityInput) paraOpacityInput.disabled = disabled;
    if (paraColorInput) paraColorInput.disabled = disabled;
    if (paraShowDotsInput) paraShowDotsInput.disabled = disabled;
    if (paraDeleteBtn) paraDeleteBtn.disabled = disabled;
    if (paraEditTool) paraEditTool.style.opacity = String(disabled ? 0.98 : 1);
  };
  setParaEditorDisabled(true);
  if (paraEditHeader && paraEditTool) {
    const startDragPara = (cx, cy) => {
      if (!paraEditTool.classList.contains('tool-floating')) {
        const rect = paraEditTool.getBoundingClientRect();
        document.body.appendChild(paraEditTool);
        paraEditTool.classList.add('tool-floating');
        paraEditTool.style.left = rect.left + 'px';
        paraEditTool.style.top = rect.top + 'px';
      }
      const r = paraEditTool.getBoundingClientRect();
      draggingParaEdit = true; paraEditOffsetX = cx - r.left; paraEditOffsetY = cy - r.top;
    };
    paraEditHeader.addEventListener('mousedown', (e)=>{ startDragPara(e.clientX, e.clientY); e.preventDefault(); e.stopPropagation(); });
    window.addEventListener('mousemove', (e)=>{ if (!draggingParaEdit) return; const x = Math.max(0, Math.min(window.innerWidth - paraEditTool.offsetWidth, e.clientX - paraEditOffsetX)); const y = Math.max((toolbarEl ? toolbarEl.offsetHeight + 4 : 0), Math.min(window.innerHeight - paraEditTool.offsetHeight, e.clientY - paraEditOffsetY)); paraEditTool.style.left = x + 'px'; paraEditTool.style.top = y + 'px'; });
    window.addEventListener('mouseup', ()=>{ draggingParaEdit = false; });
    if (dockParaEditPanel) dockParaEditPanel.addEventListener('click', ()=>{ const view = document.getElementById('editingToolsView'); if (view) view.appendChild(paraEditTool); paraEditTool.classList.remove('tool-floating'); paraEditTool.style.left=''; paraEditTool.style.top=''; });
  }
  if (paraSelectBtn) paraSelectBtn.addEventListener('click', ()=>{ selectingParabola = true; setParaEditorDisabled(true); paraSelectBtn.textContent = 'Click a parabola…'; });

  const updateSelectedParabola = () => {
    if (!selectedParabolaId) return;
    const pb = parabolas.find(p => p.id === selectedParabolaId);
    if (!pb) return;
    if (paraNameInput) pb.name = String(paraNameInput.value || '').slice(0, 40);
    if (paraColorInput) pb.color = paraColorInput.value || '#e67e22';
    if (paraOpacityInput) pb.alphaPct = Math.max(0, Math.min(100, parseInt(paraOpacityInput.value || '100', 10)));
    if (paraShowDotsInput) pb.showDots = !!paraShowDotsInput.checked;
    if (paraEqBody) paraEqBody.textContent = formatParabolaEquation(pb.a, pb.b, pb.c);
  };
  if (paraNameInput) paraNameInput.addEventListener('input', updateSelectedParabola);
  if (paraOpacityInput) paraOpacityInput.addEventListener('input', updateSelectedParabola);
  if (paraColorInput) paraColorInput.addEventListener('input', updateSelectedParabola);
  if (paraShowDotsInput) paraShowDotsInput.addEventListener('change', updateSelectedParabola);
  if (paraDeleteBtn) paraDeleteBtn.addEventListener('click', ()=>{ if (!selectedParabolaId) return; parabolas = parabolas.filter(p => p.id !== selectedParabolaId); selectedParabolaId = null; setParaEditorDisabled(true); });

  // ---- Curved line editor elements ----
  const curvedEditTool = document.getElementById('curvedEditTool');
  const curvedEditHeader = document.getElementById('curvedEditHeader');
  const dockCurvedEditPanel = document.getElementById('dockCurvedEditPanel');
  const curvedSelectBtn = document.getElementById('curvedSelectBtn');
  const curvedNameInput = document.getElementById('curvedNameInput');
  const curvedOpacityInput = document.getElementById('curvedOpacityInput');
  const curvedColorInput = document.getElementById('curvedColorInput');
  const curvedShowDotsInput = document.getElementById('curvedShowDotsInput');
  const curvedEditStraightInput = document.getElementById('curvedEditStraightInput');
  const curvedDeleteBtn = document.getElementById('curvedDeleteBtn');

  let draggingCurvedEdit = false; let curvedEditOffsetX = 0; let curvedEditOffsetY = 0;
  let selectingCurved = false; let selectedCurvedId = null;

  const setCurvedEditorDisabled = (disabled) => {
    if (curvedNameInput) curvedNameInput.disabled = disabled;
    if (curvedOpacityInput) curvedOpacityInput.disabled = disabled;
    if (curvedColorInput) curvedColorInput.disabled = disabled;
    if (curvedShowDotsInput) curvedShowDotsInput.disabled = disabled;
    if (curvedEditStraightInput) curvedEditStraightInput.disabled = disabled;
    if (curvedDeleteBtn) curvedDeleteBtn.disabled = disabled;
    if (curvedEditTool) curvedEditTool.style.opacity = String(disabled ? 0.98 : 1);
  };
  setCurvedEditorDisabled(true);

  if (curvedEditHeader && curvedEditTool) {
    const startDragCurved = (cx, cy) => {
      if (!curvedEditTool.classList.contains('tool-floating')) {
        const rect = curvedEditTool.getBoundingClientRect();
        document.body.appendChild(curvedEditTool);
        curvedEditTool.classList.add('tool-floating');
        curvedEditTool.style.left = rect.left + 'px';
        curvedEditTool.style.top = rect.top + 'px';
      }
      const r = curvedEditTool.getBoundingClientRect();
      draggingCurvedEdit = true; curvedEditOffsetX = cx - r.left; curvedEditOffsetY = cy - r.top;
    };
    curvedEditHeader.addEventListener('mousedown', (e)=>{ startDragCurved(e.clientX, e.clientY); e.preventDefault(); e.stopPropagation(); });
    window.addEventListener('mousemove', (e)=>{
      if (!draggingCurvedEdit) return;
      const x = Math.max(0, Math.min(window.innerWidth - curvedEditTool.offsetWidth, e.clientX - curvedEditOffsetX));
      const y = Math.max((toolbarEl ? toolbarEl.offsetHeight + 4 : 0), Math.min(window.innerHeight - curvedEditTool.offsetHeight, e.clientY - curvedEditOffsetY));
      curvedEditTool.style.left = x + 'px'; curvedEditTool.style.top = y + 'px';
    });
    window.addEventListener('mouseup', ()=>{ draggingCurvedEdit = false; });
    if (dockCurvedEditPanel) dockCurvedEditPanel.addEventListener('click', ()=>{ const view = document.getElementById('editingToolsView'); if (view) view.appendChild(curvedEditTool); curvedEditTool.classList.remove('tool-floating'); curvedEditTool.style.left=''; curvedEditTool.style.top=''; });
  }

  if (curvedSelectBtn) curvedSelectBtn.addEventListener('click', ()=>{ selectingCurved = true; setCurvedEditorDisabled(true); curvedSelectBtn.textContent = 'Click a curved line…'; });

  // integrate with selection in mousePressed
  const origMousePressed2 = window.mousePressed;
  window.mousePressed = function() {
    if (selectingCurved) {
      const hit = findNearestOnCurved(mouseX, mouseY);
      if (hit && hit.curveRef) {
        const cl = hit.curveRef;
        selectedCurvedId = cl.id;
        setCurvedEditorDisabled(false);
        if (curvedNameInput) curvedNameInput.value = cl.name || '';
        if (curvedColorInput) curvedColorInput.value = cl.color || '#a16ee8';
        if (curvedOpacityInput) curvedOpacityInput.value = String(Number.isFinite(cl.alphaPct) ? cl.alphaPct : 100);
        if (curvedShowDotsInput) curvedShowDotsInput.checked = (cl.showDots !== false);
        if (curvedEditStraightInput) curvedEditStraightInput.checked = !!cl.straight;
        if (curvedSelectBtn) curvedSelectBtn.textContent = 'Select curved';
        selectingCurved = false;
        return;
      }
      return; // stay in selection mode on miss
    }
    if (typeof origMousePressed2 === 'function') return origMousePressed2();
  };

  const updateSelectedCurved = () => {
    if (!selectedCurvedId) return;
    const cl = curvedLines.find(c => c.id === selectedCurvedId);
    if (!cl) return;
    if (curvedNameInput) cl.name = String(curvedNameInput.value || '').slice(0, 40);
    if (curvedColorInput) cl.color = curvedColorInput.value || '#a16ee8';
    if (curvedOpacityInput) cl.alphaPct = Math.max(0, Math.min(100, parseInt(curvedOpacityInput.value || '100', 10)));
    if (curvedShowDotsInput) cl.showDots = !!curvedShowDotsInput.checked;
    if (curvedEditStraightInput) cl.straight = !!curvedEditStraightInput.checked;
  };
  if (curvedNameInput) curvedNameInput.addEventListener('input', updateSelectedCurved);
  if (curvedOpacityInput) curvedOpacityInput.addEventListener('input', updateSelectedCurved);
  if (curvedColorInput) curvedColorInput.addEventListener('input', updateSelectedCurved);
  if (curvedShowDotsInput) curvedShowDotsInput.addEventListener('change', updateSelectedCurved);
  if (curvedEditStraightInput) curvedEditStraightInput.addEventListener('change', updateSelectedCurved);
  if (curvedDeleteBtn) curvedDeleteBtn.addEventListener('click', () => {
    if (!selectedCurvedId) return;
    curvedLines = curvedLines.filter(c => c.id !== selectedCurvedId);
    selectedCurvedId = null; setCurvedEditorDisabled(true);
  });

  // Chips removed; panel can be dragged out by grabbing its header (implemented above)

  // Note: Tools do not auto-move when opening/closing toolbox. Drag them in/out explicitly.

  // Initialize theme from saved preference and wire up selector
  const savedTheme = localStorage.getItem('themeKey') || 'dark-plus';
  themeSelect.value = savedTheme;
  applyTheme(savedTheme);
  themeSelect.addEventListener('change', () => {
    applyTheme(themeSelect.value);
  });

  // Removed legacy quadratic toolbar. Quadratic options will be provided per-line in the Lines UI.

  // No initial equation parsing (primary equation removed)
  // Wire custom label popover
  setupLabelPopover();
}

function windowResized() {
  updateCanvasHolderSize();
  resizeCanvas(canvasParent.clientWidth, canvasParent.clientHeight);
}

function draw() {
  // Background color based on theme
  background(themeColors.canvasBg);
  drawGridAndAxes();
  drawExtraCurves();
  drawCurvedLines();
  drawTwoPointLines();
  drawParabolas();

  // Hover prioritization: markers first (snap), then lines (extra + two-point)
  // When dragging any handle, suppress hover snapping visuals
  snappedCursor = null;
  const isDraggingAny = !!(draggingMarkerId || (draggingTwoPoint && draggingTwoPoint.lineId) || (draggingCurved && draggingCurved.id !== null) || draggingParabolaId || (draggingParabolaRoot && draggingParabolaRoot.id));
  const hoverMarker = !isDraggingAny ? findNearestMarker(mouseX, mouseY) : null;
  if (!isDraggingAny && hoverMarker) {
    cursor('pointer');
    drawHoverTip({
      sx: hoverMarker.sx,
      sy: hoverMarker.sy,
      xWorld: hoverMarker.x,
      yWorld: hoverMarker.y,
      rgb: hoverMarker.rgb
    });
    snappedCursor = { sx: hoverMarker.sx, sy: hoverMarker.sy };
  } else if (!isDraggingAny) {
    // Snap to two-point endpoints first for better UX
    const endpoint = findNearestTwoPointEndpoint(mouseX, mouseY);
    if (endpoint) {
      cursor('pointer');
      drawHoverTip({ sx: endpoint.sx, sy: endpoint.sy, xWorld: endpoint.x, yWorld: endpoint.y, rgb: endpoint.rgb });
      snappedCursor = { sx: endpoint.sx, sy: endpoint.sy };
    } else {
      // Snap to curved control points, then parabola handles, then curves
      const nearCurvePt = findNearestCurvedPoint(mouseX, mouseY);
      if (nearCurvePt) {
        cursor('pointer');
        drawHoverTip({ sx: nearCurvePt.sx, sy: nearCurvePt.sy, xWorld: nearCurvePt.x, yWorld: nearCurvePt.y, rgb: nearCurvePt.rgb });
        snappedCursor = { sx: nearCurvePt.sx, sy: nearCurvePt.sy };
      } else {
        const nearV = findNearestParabolaVertex(mouseX, mouseY);
        const nearR = findNearestParabolaRoot(mouseX, mouseY);
        const nearCurve = findNearestOnCurved(mouseX, mouseY) || findNearestOnParabolas(mouseX, mouseY);
      if (nearV && (!nearR || Math.hypot(mouseX - nearV.sx, mouseY - nearV.sy) <= Math.hypot(mouseX - nearR.sx, mouseY - nearR.sy))) {
        cursor('pointer');
        drawHoverTip({ sx: nearV.sx, sy: nearV.sy, xWorld: screenToWorldX(nearV.sx), yWorld: screenToWorldY(nearV.sy), rgb: hexToRgb('#e67e22') });
        snappedCursor = { sx: nearV.sx, sy: nearV.sy };
      } else if (nearR) {
        cursor('pointer');
        drawHoverTip({ sx: nearR.sx, sy: nearR.sy, xWorld: screenToWorldX(nearR.sx), yWorld: screenToWorldY(nearR.sy), rgb: hexToRgb('#e67e22') });
        snappedCursor = { sx: nearR.sx, sy: nearR.sy };
      } else if (nearCurve) {
        cursor('crosshair');
        drawHoverTip({ sx: nearCurve.sx, sy: nearCurve.sy, xWorld: nearCurve.xWorld, yWorld: nearCurve.yWorld, rgb: hexToRgb(nearCurve.pbRef?.color || nearCurve.curveRef?.color || '#e67e22') });
        snappedCursor = { sx: nearCurve.sx, sy: nearCurve.sy };
        } else {
          const hover = findNearestOnExtraLines(mouseX, mouseY);
          if (hover) {
            cursor('crosshair');
            drawHoverTip(hover);
          } else {
            cursor('default');
          }
        }
      }
    }
  }

  drawMarkers(hoverMarker ? hoverMarker.id : null);
  drawHUD();
  // If in add-dot mode for a curved line, show crosshair to indicate placement
  if ((pendingAddCurved && pendingAddCurved.id) || (pendingPlace4 && pendingPlace4.id)) {
    cursor('crosshair');
    // Preview dot at snapped placement location
    const target = pendingAddCurved?.id ? curvedLines.find(c => c.id === pendingAddCurved.id)
                 : (pendingPlace4?.id ? curvedLines.find(c => c.id === pendingPlace4.id) : null);
    if (target) {
      const rgb = hexToRgb(target.color || '#a16ee8');
      const wx = snapStep > 0 ? Math.round(screenToWorldX(mouseX) / snapStep) * snapStep : screenToWorldX(mouseX);
      const wy = snapStep > 0 ? Math.round(screenToWorldY(mouseY) / snapStep) * snapStep : screenToWorldY(mouseY);
      const sx = worldToScreenX(wx);
      const sy = worldToScreenY(wy);
      push();
      fill(themeColors.canvasBg);
      stroke(rgb.r, rgb.g, rgb.b, 255);
      strokeWeight(2);
      circle(sx, sy, 10);
      pop();
    }
  }
  // Render snapped cursor if available
  if (snappedCursor) {
    push();
    noFill();
    stroke(themeColors.axis);
    strokeWeight(1);
    circle(snappedCursor.sx, snappedCursor.sy, 12);
    pop();
  }
  // If dragging a curved control point, show a dot at the cursor to indicate "holding"
  if (draggingCurved && draggingCurved.id !== null) {
    const cl = curvedLines.find(c => c.id === draggingCurved.id);
    if (cl) {
      const rgb = hexToRgb(cl.color || '#a16ee8');
      const wx = snapStep > 0 ? Math.round(screenToWorldX(mouseX) / snapStep) * snapStep : screenToWorldX(mouseX);
      const wy = snapStep > 0 ? Math.round(screenToWorldY(mouseY) / snapStep) * snapStep : screenToWorldY(mouseY);
      const sx = worldToScreenX(wx);
      const sy = worldToScreenY(wy);
      cursor('grabbing');
      push();
      fill(themeColors.canvasBg);
      stroke(rgb.r, rgb.g, rgb.b, 255);
      strokeWeight(3);
      circle(sx, sy, 12);
      pop();
    }
  }
}

function drawGridAndAxes() {
  const unitStep = 1; // fixed 1 unit grid
  const gridMajorEvery = 5; // major every N lines
  const minorColor = color(themeColors.gridMinor);
  const majorColor = color(themeColors.gridMajor);

  // Grid lines (minor)
  stroke(minorColor);
  strokeWeight(1);

  const leftX = screenToWorldX(0);
  const rightX = screenToWorldX(width);
  const topY = screenToWorldY(0);
  const bottomY = screenToWorldY(height);

  // Vertical minor lines
  const startX = Math.floor(leftX / unitStep) * unitStep;
  const endX = Math.ceil(rightX / unitStep) * unitStep;
  for (let x = startX; x <= endX + 1e-12; x += unitStep) {
    const sx = worldToScreenX(x);
    const isMajor = isNearlyInteger(x / (unitStep * gridMajorEvery));
    if (isMajor) continue;
    line(sx, 0, sx, height);
  }
  // Horizontal minor lines
  const startY = Math.floor(bottomY / unitStep) * unitStep;
  const endY = Math.ceil(topY / unitStep) * unitStep;
  for (let y = startY; y <= endY + 1e-12; y += unitStep) {
    const sy = worldToScreenY(y);
    const isMajor = isNearlyInteger(y / (unitStep * gridMajorEvery));
    if (isMajor) continue;
    line(0, sy, width, sy);
  }

  // Major grid lines
  stroke(majorColor);
  for (let x = startX; x <= endX + 1e-12; x += unitStep) {
    const isMajor = isNearlyInteger(x / (unitStep * gridMajorEvery));
    if (!isMajor) continue;
    const sx = worldToScreenX(x);
    line(sx, 0, sx, height);
  }
  for (let y = startY; y <= endY + 1e-12; y += unitStep) {
    const isMajor = isNearlyInteger(y / (unitStep * gridMajorEvery));
    if (!isMajor) continue;
    const sy = worldToScreenY(y);
    line(0, sy, width, sy);
  }

  // Axes
  stroke(themeColors.axis);
  strokeWeight(2);
  // y-axis (x=0)
  const yAxisX = worldToScreenX(0);
  line(yAxisX, 0, yAxisX, height);
  // x-axis (y=0)
  const xAxisY = worldToScreenY(0);
  line(0, xAxisY, width, xAxisY);

  // Axis labels
  noStroke();
  fill(themeColors.muted);
  textSize(12);
  // Measure text height
  const tH = textAscent() + textDescent();
  // X label near the horizontal axis (bottom-left anchored)
  textAlign(LEFT, BOTTOM);
  const xLabelX = 4;
  const xLabelY = xAxisY - 6;
  const xText = axisLabels.x || 'x';
  text(xText, xLabelX, xLabelY);
  axisLabelRects.x = { x: xLabelX - 3, y: xLabelY - (tH + 4) + 2, w: textWidth(xText) + 6, h: tH + 4 };
  // Y label near the vertical axis (top-left anchored)
  textAlign(LEFT, TOP);
  const yLabelX = yAxisX + 6;
  const yLabelY = 4;
  const yText = axisLabels.y || 'y';
  text(yText, yLabelX, yLabelY);
  axisLabelRects.y = { x: yLabelX - 3, y: yLabelY - 2, w: textWidth(yText) + 6, h: tH + 4 };
}

function drawEquation() {
  if (currentEquation.type === 'none') return;
  if (currentEquation.error) return;

  stroke(themeColors.plot);
  strokeWeight(2);
  noFill();

  if (currentEquation.type === 'vertical') {
    const sx = worldToScreenX(currentEquation.xConst);
    line(sx, 0, sx, height);
    return;
  }

  // Plot function by sampling
  const stepPx = 2; // pixel step for sampling
  let moveToNext = true;
  let prevScreenX = 0;
  let prevScreenY = 0;
  const yLimit = 1e6; // guard for extreme values

  for (let px = 0; px <= width; px += stepPx) {
    const xWorld = screenToWorldX(px);
    let yWorld = currentEquation.fn(xWorld);
    if (!isFinite(yWorld) || Math.abs(yWorld) > yLimit) {
      moveToNext = true;
      continue;
    }
    const sx = px;
    const sy = worldToScreenY(yWorld);
    if (moveToNext) {
      prevScreenX = sx;
      prevScreenY = sy;
      moveToNext = false;
      continue;
    }
    line(prevScreenX, prevScreenY, sx, sy);
    prevScreenX = sx;
    prevScreenY = sy;
  }
}

function drawExtraCurves() {
  if (extraLines.length === 0) return;
  for (const lineDef of extraLines) {
    const rgb = hexToRgb(lineDef.color || '#ff8800');
    const alpha = Number.isFinite(lineDef.alpha) ? lineDef.alpha : 255;
    const baseWeight = 2;
    const fn = getExtraLineFunction(lineDef);
    // Draw crisp line
    stroke(rgb.r, rgb.g, rgb.b, alpha);
    strokeWeight(baseWeight);
    drawFunctionLine(fn);

    // Optional line label near the middle
    const midX = width / 2;
    const midXWorld = screenToWorldX(midX);
    const midYWorld = fn(midXWorld);
    if (isFinite(midYWorld) && lineDef.label && lineDef.label.trim() !== '') {
      const sx = worldToScreenX(midXWorld);
      const sy = worldToScreenY(midYWorld);
      noStroke();
      fill(themeColors.hudText);
      textAlign(LEFT, BOTTOM);
      textSize(12);
      text(lineDef.label, sx + 6, sy - 6);
    }
  }
}

function drawMarkers(highlightId = null) {
  if (!markers.length) return;
  textSize(12);
  for (const m of markers) {
    const ln = m.lineId ? extraLines.find(e => e.id === m.lineId) : null;
    const rgb = m.color ? hexToRgb(m.color) : (ln ? hexToRgb(ln.color || '#ff8800') : { r: 255, g: 255, b: 255 });
    const sx = worldToScreenX(m.x);
    const sy = worldToScreenY(m.y);
    // Marker point
    const alpha = Number.isFinite(m.alphaPct) ? Math.round(255 * (m.alphaPct / 100)) : 255;
    stroke(rgb.r, rgb.g, rgb.b, alpha);
    const baseSize = Number.isFinite(m.size) ? m.size : 6;
    strokeWeight(m.id === highlightId ? 3 : 2);
    fill(themeColors.canvasBg);
    circle(sx, sy, (m.id === highlightId ? baseSize + 2 : baseSize));
    // Label
    noStroke();
    fill(themeColors.hudText);
    textAlign(LEFT, BOTTOM);
    const showCoords = m.showCoords === true;
    const coord = showCoords ? ` (${m.x.toFixed(2)}, ${m.y.toFixed(2)})` : '';
    const labelText = (m.label || '') + coord;
    if (labelText.trim() !== '') text(labelText, sx + 8, sy - 6);
  }
}

function drawTwoPointLines() {
  if (!twoPointLines.length) return;
  for (const ln of twoPointLines) {
    const rgb = hexToRgb(ln.color || '#66d9ef');
    const alpha = Number.isFinite(ln.alphaPct) ? Math.round(255 * (ln.alphaPct / 100)) : (Number.isFinite(ln.alpha) ? ln.alpha : 255);
    // Draw infinite line through p1 and p2
    const x1w = ln.p1.x; const y1w = ln.p1.y; const x2w = ln.p2.x; const y2w = ln.p2.y;
    if (!(x1w === x2w && y1w === y2w)) {
      stroke(rgb.r, rgb.g, rgb.b, alpha);
      strokeWeight(2);
      if (Math.abs(x2w - x1w) < 1e-9) {
        const sx = worldToScreenX(x1w);
        line(sx, 0, sx, height);
      } else {
        const m = (y2w - y1w) / (x2w - x1w);
        const leftX = screenToWorldX(0);
        const rightX = screenToWorldX(width);
        const yLeft = m * (leftX - x1w) + y1w;
        const yRight = m * (rightX - x1w) + y1w;
        const sx1 = worldToScreenX(leftX);
        const sy1 = worldToScreenY(yLeft);
        const sx2 = worldToScreenX(rightX);
        const sy2 = worldToScreenY(yRight);
        line(sx1, sy1, sx2, sy2);
      }
    }
    // Endpoints as draggable handles (optional)
    const drawDotsForThis = (typeof ln.showDots === 'boolean') ? ln.showDots : !twoPointDotsHidden;
    if (drawDotsForThis) {
      fill(themeColors.canvasBg);
      stroke(rgb.r, rgb.g, rgb.b, alpha);
      strokeWeight(2);
      const x1 = worldToScreenX(ln.p1.x);
      const y1 = worldToScreenY(ln.p1.y);
      const x2 = worldToScreenX(ln.p2.x);
      const y2 = worldToScreenY(ln.p2.y);
      circle(x1, y1, 8);
      circle(x2, y2, 8);
    }
    if (ln.name && ln.name.trim() !== '') {
      noStroke();
      fill(themeColors.hudText);
      textSize(12);
      textAlign(LEFT, BOTTOM);
      text(ln.name, x2 + 8, y2 - 6);
    }
  }
}

// ---- Curved lines (Catmull–Rom through control points) ----
function drawCurvedLines() {
  if (!curvedLines.length) return;
  for (const cl of curvedLines) {
    const rgb = hexToRgb(cl.color || '#a16ee8');
    const alpha = Number.isFinite(cl.alphaPct)
      ? Math.round(255 * (cl.alphaPct / 100))
      : (Number.isFinite(cl.alpha) ? cl.alpha : 255);
    stroke(rgb.r, rgb.g, rgb.b, alpha);
    strokeWeight(2);
    noFill();
    const pts = cl.points || [];
    if (pts.length === 1) {
      const sx = worldToScreenX(pts[0].x);
      const sy = worldToScreenY(pts[0].y);
      point(sx, sy);
    } else if (pts.length >= 2) {
      if (cl.straight) {
        // Draw straight polyline between control points
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          line(worldToScreenX(p1.x), worldToScreenY(p1.y), worldToScreenX(p2.x), worldToScreenY(p2.y));
        }
      } else {
        // Sample Catmull–Rom between points for smooth curve
        const screenSeg = (t, p0, p1, p2, p3) => {
          const t2 = t * t;
          const t3 = t2 * t;
          const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2*p0.x - 5*p1.x + 4*p2.x - p3.x) * t2 + (-p0.x + 3*p1.x - 3*p2.x + p3.x) * t3);
          const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2*p0.y - 5*p1.y + 4*p2.y - p3.y) * t2 + (-p0.y + 3*p1.y - 3*p2.y + p3.y) * t3);
          return { sx: worldToScreenX(x), sy: worldToScreenY(y) };
        };
        let prev = null;
        const n = pts.length;
        const step = 0.05;
        for (let i = 0; i < n - 1; i++) {
          const p0 = pts[Math.max(0, i - 1)];
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const p3 = pts[Math.min(n - 1, i + 2)];
          for (let t = 0; t <= 1 + 1e-9; t += step) {
            const cur = screenSeg(t, p0, p1, p2, p3);
            if (prev) line(prev.sx, prev.sy, cur.sx, cur.sy);
            prev = cur;
          }
        }
      }
    }
    const drawDotsForCurve = (typeof cl.showDots === 'boolean') ? cl.showDots : !curvedDotsHidden;
    if (drawDotsForCurve) {
      fill(themeColors.canvasBg);
      stroke(rgb.r, rgb.g, rgb.b, alpha);
      strokeWeight(2);
      for (let i = 0; i < (cl.points || []).length; i++) {
        const p = cl.points[i];
        circle(worldToScreenX(p.x), worldToScreenY(p.y), 8);
      }
    }
    if (cl.name && cl.name.trim() !== '') {
      noStroke();
      fill(themeColors.hudText);
      textSize(12);
      textAlign(LEFT, BOTTOM);
      const last = cl.points[cl.points.length - 1];
      const lx = worldToScreenX(last.x);
      const ly = worldToScreenY(last.y);
      text(cl.name, lx + 8, ly - 6);
    }
  }
}

function computeQuadraticThroughPoints(p1, p2, p3) {
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;
  const denom = (x1 - x2) * (x1 - x3) * (x2 - x3);
  if (Math.abs(denom) < 1e-12) return null;
  const a = (x3*(y2 - y1) + x2*(y1 - y3) + x1*(y3 - y2)) / denom;
  const b = (x3*x3*(y1 - y2) + x2*x2*(y3 - y1) + x1*x1*(y2 - y3)) / denom;
  const c = (x2*x3*(x2 - x3)*y1 + x3*x1*(x3 - x1)*y2 + x1*x2*(x1 - x2)*y3) / denom;
  return { a, b, c };
}

// Build quadratic coefficients from roots r1 and r2 and a vertical scale k (a)
function computeQuadraticFromRoots(r1, r2, k) {
  const a = Number(k);
  const b = -a * (r1 + r2);
  const c = a * r1 * r2;
  return { a, b, c };
}

function formatParabolaEquation(a, b, c) {
  const fmt = (v) => {
    if (Math.abs(v) < 1e-12) return '0';
    const rounded = Math.round(v * 1000) / 1000;
    return String(rounded);
  };
  const aStr = fmt(a);
  const bStr = fmt(b);
  const cStr = fmt(c);
  const bSigned = (b >= 0 ? ` + ${bStr}` : ` - ${Math.abs(bStr)}`);
  const cSigned = (c >= 0 ? ` + ${cStr}` : ` - ${Math.abs(cStr)}`);
  return `y = ${aStr}x² + ${bStr}x + ${cStr}`.replace('+ -','- ').replace('  ',' ');
}

function round3(v) { return Math.round(v * 1000) / 1000; }
function signed(v) { return v >= 0 ? v.toString() : v.toString(); }

function drawParabolas() {
  if (!parabolas.length) return;
  for (const pb of parabolas) {
    const rgb = hexToRgb(pb.color || '#e67e22');
    const alpha = Number.isFinite(pb.alphaPct)
      ? Math.round(255 * (pb.alphaPct / 100))
      : (Number.isFinite(pb.alpha) ? pb.alpha : 255);
    stroke(rgb.r, rgb.g, rgb.b, alpha);
    strokeWeight(2);
    noFill();
    const stepPx = 2;
    let moveToNext = true;
    let prevX = 0, prevY = 0;
    for (let px = 0; px <= width; px += stepPx) {
      const xw = screenToWorldX(px);
      const yw = pb.a * xw * xw + pb.b * xw + pb.c;
      const sy = worldToScreenY(yw);
      if (moveToNext) {
        prevX = px; prevY = sy; moveToNext = false; continue;
      }
      line(prevX, prevY, px, sy);
      prevX = px; prevY = sy;
    }
    const drawDotsForPara = (typeof pb.showDots === 'boolean') ? pb.showDots : !parabolaDotsHidden;
    if (drawDotsForPara) {
      fill(themeColors.canvasBg);
      stroke(rgb.r, rgb.g, rgb.b, alpha);
      strokeWeight(2);
      if (pb.p1) circle(worldToScreenX(pb.p1.x), worldToScreenY(0), 8);
      if (pb.p2) circle(worldToScreenX(pb.p2.x), worldToScreenY(0), 8);
      if (pb.p3) {
        const vx = worldToScreenX(pb.p3.x);
        const vy = worldToScreenY(pb.p3.y);
        circle(vx, vy, 10);
        // small handle indicator line upwards
        line(vx, vy - 10, vx, vy - 18);
      }
    }
    if (pb.name && pb.name.trim() !== '') {
      noStroke();
      fill(themeColors.hudText);
      textSize(12);
      textAlign(LEFT, BOTTOM);
      const lx = pb.p3 ? worldToScreenX(pb.p3.x) : worldToScreenX((pb.p1.x + pb.p2.x) / 2);
      const ly = pb.p3 ? worldToScreenY(pb.p3.y) : worldToScreenY(0);
      text(pb.name, lx + 8, ly - 6);
    }
  }
}

// Draw a function y = f(x) by sampling across the canvas width
function drawFunctionLine(fn) {
  noFill();
  const stepPx = 2;
  let moveToNext = true;
  let prevScreenX = 0;
  let prevScreenY = 0;
  const yLimit = 1e6;
  for (let px = 0; px <= width; px += stepPx) {
    const xWorld = screenToWorldX(px);
    const yWorld = fn(xWorld);
    if (!isFinite(yWorld) || Math.abs(yWorld) > yLimit) {
      moveToNext = true;
      continue;
    }
    const sx = px;
    const sy = worldToScreenY(yWorld);
    if (moveToNext) {
      prevScreenX = sx;
      prevScreenY = sy;
      moveToNext = false;
      continue;
    }
    line(prevScreenX, prevScreenY, sx, sy);
    prevScreenX = sx;
    prevScreenY = sy;
  }
}

// Find nearest point on any extra line to the given mouse position (in screen coords)
function findNearestOnExtraLines(mouseScreenX, mouseScreenY) {
  if (isDragging) return null;
  const hasExtra = Array.isArray(extraLines) && extraLines.length > 0;
  const hasTwoPoint = Array.isArray(twoPointLines) && twoPointLines.length > 0;
  if (!hasExtra && !hasTwoPoint) return null;

  const thresholdPx = 10; // hover distance in pixels
  let best = null;
  let bestDist = Infinity;

  for (const lineDef of (extraLines || [])) {
    const fn = getExtraLineFunction(lineDef);
    const rgb = hexToRgb(lineDef.color || '#ff8800');
    const stepPx = 2;
    const yLimit = 1e6;
    let havePrev = false;
    let prevX = 0;
    let prevY = 0;
    for (let px = 0; px <= width; px += stepPx) {
      const xWorld = screenToWorldX(px);
      const yWorld = fn(xWorld);
      if (!isFinite(yWorld) || Math.abs(yWorld) > yLimit) {
        havePrev = false;
        continue;
      }
      const sx = px;
      const sy = worldToScreenY(yWorld);
      if (havePrev) {
      const proj = distancePointToSegment(mouseScreenX, mouseScreenY, prevX, prevY, sx, sy);
        if (proj.dist < bestDist) {
          bestDist = proj.dist;
          best = {
            sx: proj.x,
            sy: proj.y,
            xWorld: screenToWorldX(proj.x),
            yWorld: screenToWorldY(proj.y),
          rgb,
            lineRef: lineDef
          };
        }
      }
      prevX = sx;
      prevY = sy;
      havePrev = true;
    }
  }

  // Also consider two-point lines (infinite across canvas)
  for (const ln of twoPointLines) {
    const rgb = hexToRgb(ln.color || '#66d9ef');
    const stepPx = 2;
    if (Math.abs(ln.p2.x - ln.p1.x) < 1e-9) {
      // Vertical line: x = const, sample along y
      const sx = worldToScreenX(ln.p1.x);
      let havePrev = false; let prevX = sx; let prevY = 0;
      for (let py = 0; py <= height; py += stepPx) {
        const sy = py;
        if (havePrev) {
          const proj = distancePointToSegment(mouseScreenX, mouseScreenY, prevX, prevY, sx, sy);
          if (proj.dist < bestDist) {
            bestDist = proj.dist;
            best = {
              sx: proj.x,
              sy: proj.y,
              xWorld: screenToWorldX(proj.x),
              yWorld: screenToWorldY(proj.y),
              rgb,
              lineRef: ln,
              lineType: 'line2',
              colorHex: ln.color || '#66d9ef'
            };
          }
        }
        prevX = sx; prevY = sy; havePrev = true;
      }
    } else {
      const m = (ln.p2.y - ln.p1.y) / (ln.p2.x - ln.p1.x);
      const b = ln.p1.y - m * ln.p1.x;
      let havePrev = false; let prevX = 0; let prevY = 0;
      for (let px = 0; px <= width; px += stepPx) {
        const xWorld = screenToWorldX(px);
        const yWorld = m * xWorld + b;
        const sx = px;
        const sy = worldToScreenY(yWorld);
        if (havePrev) {
          const proj = distancePointToSegment(mouseScreenX, mouseScreenY, prevX, prevY, sx, sy);
          if (proj.dist < bestDist) {
            bestDist = proj.dist;
            best = {
              sx: proj.x,
              sy: proj.y,
              xWorld: screenToWorldX(proj.x),
              yWorld: screenToWorldY(proj.y),
              rgb,
              lineRef: ln,
              lineType: 'line2',
              colorHex: ln.color || '#66d9ef'
            };
          }
        }
        prevX = sx; prevY = sy; havePrev = true;
      }
    }
  }

  if (best && bestDist <= thresholdPx) return best;
  return null;
}

// Find nearest point on any curved line to the given mouse position (in screen coords)
function findNearestOnCurved(mouseScreenX, mouseScreenY) {
  if (isDragging) return null;
  if (!Array.isArray(curvedLines) || curvedLines.length === 0) return null;
  const thresholdPx = 10;
  let best = null;
  let bestPixDist = Infinity;
  for (const cl of curvedLines) {
    const pts = cl.points || [];
    if (pts.length < 2) continue;
    const rgb = hexToRgb(cl.color || '#a16ee8');
    if (cl.straight) {
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const proj = distancePointToSegment(
          screenToWorldX(mouseScreenX),
          screenToWorldY(mouseScreenY),
          p1.x, p1.y, p2.x, p2.y
        );
        const projSx = worldToScreenX(proj.x);
        const projSy = worldToScreenY(proj.y);
        const dPix = Math.hypot(mouseScreenX - projSx, mouseScreenY - projSy);
        if (dPix < bestPixDist) {
          bestPixDist = dPix;
          best = { sx: projSx, sy: projSy, xWorld: proj.x, yWorld: proj.y, rgb, curveRef: cl };
        }
      }
    } else {
      const n = pts.length;
      const step = 0.05;
      let prev = null;
      const segPoint = (t, p0, p1, p2, p3) => {
        const t2 = t * t;
        const t3 = t2 * t;
        const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2*p0.x - 5*p1.x + 4*p2.x - p3.x) * t2 + (-p0.x + 3*p1.x - 3*p2.x + p3.x) * t3);
        const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2*p0.y - 5*p1.y + 4*p2.y - p3.y) * t2 + (-p0.y + 3*p1.y - 3*p2.y + p3.y) * t3);
        return { x, y };
      };
      for (let i = 0; i < n - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(n - 1, i + 2)];
        for (let t = 0; t <= 1 + 1e-9; t += step) {
          const cur = segPoint(t, p0, p1, p2, p3);
          if (prev) {
            const proj = distancePointToSegment(screenToWorldX(mouseScreenX), screenToWorldY(mouseScreenY), prev.x, prev.y, cur.x, cur.y);
            const projSx = worldToScreenX(proj.x);
            const projSy = worldToScreenY(proj.y);
            const dPix = Math.hypot(mouseScreenX - projSx, mouseScreenY - projSy);
            if (dPix < bestPixDist) {
              bestPixDist = dPix;
              best = { sx: projSx, sy: projSy, xWorld: proj.x, yWorld: proj.y, rgb, curveRef: cl };
            }
          }
          prev = cur;
        }
        prev = null;
      }
    }
  }
  if (!best || bestPixDist > thresholdPx) return null;
  return best;
}

// Find nearest point on any parabola to the given mouse position (in screen coords)
function findNearestOnParabolas(mouseScreenX, mouseScreenY) {
  if (isDragging) return null;
  if (!Array.isArray(parabolas) || parabolas.length === 0) return null;

  const thresholdPx = 10;
  const mxWorld = screenToWorldX(mouseScreenX);
  const myWorld = screenToWorldY(mouseScreenY);
  let best = null;
  let bestPixDist = Infinity;

  for (const pb of parabolas) {
    // sample segments in world x using screen px as step to stay dense visually
    const stepPx = 4;
    for (let px = 0; px <= width - stepPx; px += stepPx) {
      const x1w = screenToWorldX(px);
      const y1w = pb.a * x1w * x1w + pb.b * x1w + pb.c;
      const x2w = screenToWorldX(px + stepPx);
      const y2w = pb.a * x2w * x2w + pb.b * x2w + pb.c;
      const proj = distancePointToSegment(mxWorld, myWorld, x1w, y1w, x2w, y2w);
      const projSx = worldToScreenX(proj.x);
      const projSy = worldToScreenY(proj.y);
      const dPix = Math.hypot(mouseScreenX - projSx, mouseScreenY - projSy);
      if (dPix < bestPixDist) {
        bestPixDist = dPix;
        best = { sx: projSx, sy: projSy, xWorld: proj.x, yWorld: proj.y, pbRef: pb };
      }
    }
  }
  if (!best || bestPixDist > thresholdPx) return null;
  return best;
}

// Find nearest marker to the cursor for snapping
function findNearestMarker(mouseScreenX, mouseScreenY) {
  if (isDragging || markers.length === 0) return null;
  const thresholdPx = 12;
  let best = null;
  let bestDist = Infinity;
  for (const m of markers) {
    const sx = worldToScreenX(m.x);
    const sy = worldToScreenY(m.y);
    const d = Math.hypot(mouseScreenX - sx, mouseScreenY - sy);
    if (d < bestDist) {
      bestDist = d;
      const ln = m.lineId ? extraLines.find(e => e.id === m.lineId) : null;
      best = {
        id: m.id,
        x: m.x,
        y: m.y,
        sx,
        sy,
        rgb: m.color ? hexToRgb(m.color) : (ln ? hexToRgb(ln.color || '#ff8800') : { r: 255, g: 255, b: 255 })
      };
    }
  }
  if (best && bestDist <= thresholdPx) return best;
  return null;
}

function findNearestTwoPointEndpoint(mouseScreenX, mouseScreenY) {
  if (!twoPointLines.length) return null;
  const thresholdPx = 10;
  let best = null;
  let bestDist = Infinity;
  for (const ln of twoPointLines) {
    const endpoints = [
      { key: 'p1', x: ln.p1.x, y: ln.p1.y, sx: worldToScreenX(ln.p1.x), sy: worldToScreenY(ln.p1.y) },
      { key: 'p2', x: ln.p2.x, y: ln.p2.y, sx: worldToScreenX(ln.p2.x), sy: worldToScreenY(ln.p2.y) }
    ];
    for (const ep of endpoints) {
      const d = Math.hypot(mouseScreenX - ep.sx, mouseScreenY - ep.sy);
      if (d < bestDist) {
        bestDist = d;
        best = { lineId: ln.id, pointKey: ep.key, sx: ep.sx, sy: ep.sy, x: ep.x, y: ep.y, rgb: hexToRgb(ln.color || '#66d9ef') };
      }
    }
  }
  return bestDist <= thresholdPx ? best : null;
}

function findNearestCurvedPoint(mouseScreenX, mouseScreenY) {
  if (!curvedLines.length) return null;
  const thresholdPx = 10;
  let best = null;
  let bestDist = Infinity;
  for (const cl of curvedLines) {
    const pts = cl.points || [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const sx = worldToScreenX(p.x);
      const sy = worldToScreenY(p.y);
      const d = Math.hypot(mouseScreenX - sx, mouseScreenY - sy);
      if (d < bestDist) {
        bestDist = d;
        best = { id: cl.id, index: i, sx, sy, x: p.x, y: p.y, rgb: hexToRgb(cl.color || '#a16ee8') };
      }
    }
  }
  return bestDist <= thresholdPx ? best : null;
}

function findNearestParabolaVertex(mouseScreenX, mouseScreenY) {
  if (!parabolas.length) return null;
  const thresholdPx = 10;
  let best = null;
  let bestDist = Infinity;
  for (const pb of parabolas) {
    if (!pb.p3) continue;
    const sx = worldToScreenX(pb.p3.x);
    const sy = worldToScreenY(pb.p3.y);
    const d = Math.hypot(mouseScreenX - sx, mouseScreenY - sy);
    if (d < bestDist) {
      bestDist = d;
      best = { id: pb.id, sx, sy };
    }
  }
  return bestDist <= thresholdPx ? best : null;
}

function findNearestParabolaRoot(mouseScreenX, mouseScreenY) {
  if (!parabolas.length) return null;
  const thresholdPx = 10;
  let best = null;
  let bestDist = Infinity;
  for (const pb of parabolas) {
    const points = [
      { which: 'p1', x: pb.p1?.x, y: 0 },
      { which: 'p2', x: pb.p2?.x, y: 0 }
    ];
    for (const pt of points) {
      if (typeof pt.x !== 'number') continue;
      const sx = worldToScreenX(pt.x);
      const sy = worldToScreenY(0);
      const d = Math.hypot(mouseScreenX - sx, mouseScreenY - sy);
      if (d < bestDist) {
        bestDist = d;
        best = { id: pb.id, which: pt.which, sx, sy };
      }
    }
  }
  return bestDist <= thresholdPx ? best : null;
}

function renderLine2List(container) {
  if (!container) return;
  container.innerHTML = '';
  twoPointLines.forEach((ln) => {
    const row = document.createElement('div');
    row.className = 'line2-row';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Name';
    nameInput.value = ln.name || '';
    nameInput.addEventListener('input', () => {
      ln.name = nameInput.value.slice(0, 40);
    });
    const delBtn = document.createElement('button');
    delBtn.className = 'del-btn';
    delBtn.textContent = '🗑';
    delBtn.addEventListener('click', () => {
      twoPointLines = twoPointLines.filter(x => x.id !== ln.id);
      renderLine2List(container);
    });
    row.appendChild(nameInput);
    row.appendChild(delBtn);
    container.appendChild(row);
  });
}

function renderParabolaList(container) {
  if (!container) return;
  container.innerHTML = '';
  parabolas.forEach((pb) => {
    const row = document.createElement('div');
    row.className = 'line2-row';
    // Inline name box next to the shape entry
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'name';
    nameInput.value = pb.name || '';
    nameInput.addEventListener('input', () => {
      pb.name = nameInput.value.slice(0, 40);
    });
    const delBtn = document.createElement('button');
    delBtn.className = 'del-btn';
    delBtn.textContent = '🗑';
    delBtn.addEventListener('click', () => {
      parabolas = parabolas.filter(x => x.id !== pb.id);
      renderParabolaList(container);
    });
    row.appendChild(nameInput);
    row.appendChild(delBtn);
    container.appendChild(row);
  });
}

function renderCurvedList(container) {
  if (!container) return;
  container.innerHTML = '';
  curvedLines.forEach((cl) => {
    const row = document.createElement('div');
    row.className = 'line2-row';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Name';
    nameInput.value = cl.name || '';
    nameInput.addEventListener('input', () => {
      cl.name = nameInput.value.slice(0, 40);
    });
    const addBtn = document.createElement('button');
    addBtn.className = 'tool-btn';
    addBtn.textContent = 'Add dot';
    addBtn.title = 'Click on canvas to add a dot to this curve';
    addBtn.addEventListener('click', () => {
      pendingAddCurved = { id: cl.id };
    });
    const delBtn = document.createElement('button');
    delBtn.className = 'del-btn';
    delBtn.textContent = '🗑';
    delBtn.addEventListener('click', () => {
      curvedLines = curvedLines.filter(x => x.id !== cl.id);
      renderCurvedList(container);
    });
    row.appendChild(nameInput);
    row.appendChild(addBtn);
    row.appendChild(delBtn);
    container.appendChild(row);
  });
}

function renderPointList(container) {
  if (!container) return;
  container.innerHTML = '';
  markers.forEach((m) => {
    const row = document.createElement('div');
    row.className = 'line2-row';
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.placeholder = 'label';
    labelInput.value = m.label || '';
    labelInput.addEventListener('input', () => {
      m.label = labelInput.value.slice(0, 60);
    });
    const delBtn = document.createElement('button');
    delBtn.className = 'del-btn';
    delBtn.textContent = '🗑';
    delBtn.addEventListener('click', () => {
      markers = markers.filter(x => x.id !== m.id);
      renderPointList(container);
    });
    row.appendChild(labelInput);
    row.appendChild(delBtn);
    container.appendChild(row);
  });
}

// Draw a small marker and tooltip with coordinates at the hover point
function drawHoverTip(hit) {
  push();
  // Point marker
  const rgb = hit.rgb || hexToRgb('#ffffff');
  stroke(rgb.r, rgb.g, rgb.b, 255);
  strokeWeight(2);
  fill(themeColors.canvasBg);
  circle(hit.sx, hit.sy, 6);

  // Tooltip label
  const label = `(${hit.xWorld.toFixed(2)}, ${hit.yWorld.toFixed(2)})`;
  textSize(12);
  const paddingX = 6;
  const paddingY = 4;
  const tw = textWidth(label);
  const boxW = tw + paddingX * 2;
  const boxH = 18;
  let bx = hit.sx + 10;
  let by = hit.sy - boxH - 10;
  if (bx + boxW > width) bx = hit.sx - boxW - 10;
  if (by < 0) by = hit.sy + 10;

  // leader line
  stroke(themeColors.muted);
  strokeWeight(1);
  line(hit.sx, hit.sy, bx + boxW / 2, by + boxH);

  noStroke();
  fill(color(themeColors.hudBg));
  rect(bx, by, boxW, boxH, 6);
  fill(themeColors.hudText);
  textAlign(LEFT, CENTER);
  text(label, bx + paddingX, by + boxH / 2);
  pop();
}

// Distance from point to segment, returns projected point and distance
function distancePointToSegment(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;
  const len2 = vx * vx + vy * vy;
  let t = 0;
  if (len2 > 0) {
    t = (wx * vx + wy * vy) / len2;
    t = Math.max(0, Math.min(1, t));
  }
  const projX = x1 + t * vx;
  const projY = y1 + t * vy;
  const dx = px - projX;
  const dy = py - projY;
  const distVal = Math.hypot(dx, dy);
  return { x: projX, y: projY, dist: distVal, t };
}

function drawHUD() {
  // Mouse world coords
  const xWorld = screenToWorldX(mouseX);
  const yWorld = screenToWorldY(mouseY);
  const label = `x=${xWorld.toFixed(2)}, y=${yWorld.toFixed(2)}`;
  noStroke();
  fill(color(themeColors.hudBg));
  rect(10, height - 30, textWidth(label) + 14, 22, 6);
  fill(themeColors.hudText);
  textAlign(LEFT, CENTER);
  textSize(12);
  text(label, 17, height - 19);
}

// ----- Custom label popover for marker creation -----
let labelPopoverEl = null;
let labelInputEl = null;
let labelOkBtnEl = null;
let labelCancelBtnEl = null;
let pendingLabelPoint = null; // { xWorld, yWorld }
// Opacity feature removed

function setupLabelPopover() {
	labelPopoverEl = document.getElementById('labelPopover');
	labelInputEl = document.getElementById('labelInput');
	labelOkBtnEl = document.getElementById('labelOkBtn');
	labelCancelBtnEl = document.getElementById('labelCancelBtn');
	if (!labelPopoverEl || !labelInputEl || !labelOkBtnEl || !labelCancelBtnEl) return;
	const submit = () => {
		if (!pendingLabelPoint) { hideLabelPopover(); return; }
		const text = String(labelInputEl.value || '').slice(0, 60);
		const id = Date.now() + '-' + Math.random().toString(36).slice(2,7);
		markers.push({ id, lineId: null, x: pendingLabelPoint.xWorld, y: pendingLabelPoint.yWorld, label: text });
		hideLabelPopover();
	};
	const cancel = () => { hideLabelPopover(); };
	labelOkBtnEl.addEventListener('click', submit);
	labelCancelBtnEl.addEventListener('click', cancel);
	labelInputEl.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') submit();
		if (e.key === 'Escape') cancel();
	});
}

function showLabelPopover(screenX, screenY, xWorld, yWorld, preset = '') {
	if (!labelPopoverEl) return;
	pendingLabelPoint = { xWorld, yWorld };
	labelInputEl.value = preset;
	labelPopoverEl.style.display = 'flex';
	const rect = labelPopoverEl.getBoundingClientRect();
	const left = Math.min(Math.max(8, screenX + 12), window.innerWidth - rect.width - 8);
	const top = Math.min(Math.max(8, screenY + 12), window.innerHeight - rect.height - 8);
	labelPopoverEl.style.left = left + 'px';
	labelPopoverEl.style.top = top + 'px';
	setTimeout(() => labelInputEl.focus(), 0);
}

function hideLabelPopover() {
	if (!labelPopoverEl) return;
	labelPopoverEl.style.display = 'none';
	pendingLabelPoint = null;
}

// Mouse interactions for panning
function mousePressed() {
  // If clicking inside UI (panel or toolbar), ignore canvas interactions
  if (uiPointerDown || isPointerInUi(window.event)) {
    return; // do NOT return false here; it prevents default and blocks input focus
  }
  // Detect clicks on axis labels to edit before starting drag
  const mx = mouseX;
  const my = mouseY;
  if (pointInRect(mx, my, axisLabelRects.x)) {
    const next = prompt('Rename x-axis label:', axisLabels.x || 'x');
    if (next !== null) axisLabels.x = String(next).slice(0, 20);
    return;
  }
  if (pointInRect(mx, my, axisLabelRects.y)) {
    const next = prompt('Rename y-axis label:', axisLabels.y || 'y');
    if (next !== null) axisLabels.y = String(next).slice(0, 20);
    return;
  }

  // If placing the initial N dots for a new curve
  if (pendingPlace4 && pendingPlace4.id && pendingPlace4.needed > 0) {
    const cl = curvedLines.find(c => c.id === pendingPlace4.id);
    if (cl) {
      const wx = snapStep > 0 ? Math.round(screenToWorldX(mx) / snapStep) * snapStep : screenToWorldX(mx);
      const wy = snapStep > 0 ? Math.round(screenToWorldY(my) / snapStep) * snapStep : screenToWorldY(my);
      cl.points.push({ x: wx, y: wy });
      pendingPlace4.needed -= 1;
      if (pendingPlace4.needed <= 0) pendingPlace4 = null;
    }
    return;
  }

  // If pending add for a curved line, append a new point at click location (takes precedence)
  if (pendingAddCurved && pendingAddCurved.id) {
    const cl = curvedLines.find(c => c.id === pendingAddCurved.id);
    if (cl) {
      const wx = Math.round(screenToWorldX(mx));
      const wy = Math.round(screenToWorldY(my));
      cl.points.push({ x: wx, y: wy });
    }
    pendingAddCurved = null;
    return;
  }

  // Try to start dragging a marker first
  const nearMarker = findNearestMarker(mx, my);
  if (nearMarker) {
    draggingMarkerId = nearMarker.id;
    return;
  }

  // Start dragging a two-point line endpoint if near
  const nearEndpoint = findNearestTwoPointEndpoint(mx, my);
  if (nearEndpoint) {
    draggingTwoPoint = { lineId: nearEndpoint.lineId, pointKey: nearEndpoint.pointKey };
    return;
  }

  // Start dragging a curved point if near
  const nearCurvePt = findNearestCurvedPoint(mx, my);
  if (nearCurvePt) {
    draggingCurved = { id: nearCurvePt.id, pointIndex: nearCurvePt.index };
    return;
  }

  // Start dragging a parabola vertex if near
  const nearVertex = findNearestParabolaVertex(mx, my);
  if (nearVertex) {
    draggingParabolaId = nearVertex.id;
    return;
  }

  // Start dragging a parabola root if near (x-axis only)
  const nearRoot = findNearestParabolaRoot(mx, my);
  if (nearRoot) {
    draggingParabolaRoot = { id: nearRoot.id, which: nearRoot.which };
    return;
  }

  // Click near a line/curve/parabola to set its label or add marker using custom popover
  let hit = findNearestOnExtraLines(mx, my);
  if (!hit) hit = findNearestOnCurved(mx, my);
  if (!hit) hit = findNearestOnParabolas(mx, my);
  if (hit) {
    // If we're in parabola selection mode, select instead of opening label popover
    if (selectingParabola && hit.pbRef) {
      const pb = hit.pbRef;
      selectedParabolaId = pb.id;
      setParaEditorDisabled(false);
      if (paraNameInput) paraNameInput.value = pb.name || '';
      if (paraColorInput) paraColorInput.value = pb.color || '#e67e22';
      if (paraOpacityInput) paraOpacityInput.value = String(Number.isFinite(pb.alphaPct) ? pb.alphaPct : 100);
      if (paraShowDotsInput) paraShowDotsInput.checked = !parabolaDotsHidden;
      if (paraSelectBtn) paraSelectBtn.textContent = 'Select parabola';
      selectingParabola = false;
      return;
    }
    // Always ask for confirmation/name via popover (no auto-placement)
    showLabelPopover(hit.sx, hit.sy, hit.xWorld, hit.yWorld, '');
    return;
  }

  isDragging = true;
  lastMouseX = mouseX;
  lastMouseY = mouseY;
}

function mouseDragged() {
  if (isDraggingPanel) return; // do not pan while moving panel
  if (uiPointerDown || isPointerInUi(window.event)) return;
  // If we started a curved-line pending marker, cancel it when dragging begins
  if (pendingCurvedMarker) {
    const moved = Math.hypot(mouseX - mousePressStartX, mouseY - mousePressStartY) > 4;
    if (moved) {
      pendingCurvedMarker = null;
      if (!isDragging) { isDragging = true; lastMouseX = mouseX; lastMouseY = mouseY; }
    }
  }
  // Dragging a marker
  if (draggingMarkerId) {
    const marker = markers.find(m => m.id === draggingMarkerId);
    if (!marker) return;
    // Convert current mouse to world coords and snap to configured grid step
    const wx = screenToWorldX(mouseX);
    const wy = screenToWorldY(mouseY);
    marker.x = snapStep > 0 ? Math.round(wx / snapStep) * snapStep : wx;
    marker.y = snapStep > 0 ? Math.round(wy / snapStep) * snapStep : wy;
    return;
  }
  // Dragging a two-point endpoint
  if (draggingTwoPoint && draggingTwoPoint.lineId) {
    const ln = twoPointLines.find(l => l.id === draggingTwoPoint.lineId);
    if (ln) {
      const wx = screenToWorldX(mouseX);
      const wy = screenToWorldY(mouseY);
      const snapX = snapStep > 0 ? Math.round(wx / snapStep) * snapStep : wx;
      const snapY = snapStep > 0 ? Math.round(wy / snapStep) * snapStep : wy;
      if (draggingTwoPoint.pointKey === 'p1') { ln.p1.x = snapX; ln.p1.y = snapY; }
      if (draggingTwoPoint.pointKey === 'p2') { ln.p2.x = snapX; ln.p2.y = snapY; }
      showOrUpdateLineEq(ln);
    }
    return;
  }
  // Dragging a curved control point
  if (draggingCurved && draggingCurved.id !== null) {
    const cl = curvedLines.find(c => c.id === draggingCurved.id);
    if (cl && cl.points && cl.points[draggingCurved.pointIndex]) {
      const wx = snapStep > 0 ? Math.round(screenToWorldX(mouseX) / snapStep) * snapStep : screenToWorldX(mouseX);
      const wy = snapStep > 0 ? Math.round(screenToWorldY(mouseY) / snapStep) * snapStep : screenToWorldY(mouseY);
      cl.points[draggingCurved.pointIndex].x = wx;
      cl.points[draggingCurved.pointIndex].y = wy;
    }
    return;
  }
  // Dragging a parabola vertex up/down (x fixed at midpoint between roots)
  if (draggingParabolaId) {
    const pb = parabolas.find(p => p.id === draggingParabolaId);
    if (pb) {
      const vx = pb.p3.x; // fixed
      const wy = snapStep > 0 ? Math.round(screenToWorldY(mouseY) / snapStep) * snapStep : screenToWorldY(mouseY);
      const r1 = pb.p1.x;
      const r2 = pb.p2.x;
      const denom = (vx - r1) * (vx - r2);
      const a = Math.abs(denom) > 1e-12 ? (wy / denom) : pb.a;
      const coeffs = computeQuadraticFromRoots(r1, r2, a);
      pb.a = coeffs.a; pb.b = coeffs.b; pb.c = coeffs.c;
      pb.p3 = { x: vx, y: wy };
      const vyInput = document.getElementById('paraVY');
      if (vyInput) vyInput.value = String(wy);
      if (paraEqBody) paraEqBody.textContent = formatParabolaEquation(pb.a, pb.b, pb.c);
    }
    return;
  }
  // Dragging a parabola root along x-axis only
  if (draggingParabolaRoot && draggingParabolaRoot.id && draggingParabolaRoot.which) {
    const pb = parabolas.find(p => p.id === draggingParabolaRoot.id);
    if (pb) {
      const wx = snapStep > 0 ? Math.round(screenToWorldX(mouseX) / snapStep) * snapStep : screenToWorldX(mouseX);
      const r1 = draggingParabolaRoot.which === 'p1' ? wx : pb.p1.x;
      const r2 = draggingParabolaRoot.which === 'p2' ? wx : pb.p2.x;
      // Update points
      if (draggingParabolaRoot.which === 'p1') pb.p1.x = wx;
      if (draggingParabolaRoot.which === 'p2') pb.p2.x = wx;
      // Vertex x is midpoint; keep current vertex y; recompute a to maintain vertex y
      const vx = (r1 + r2) / 2;
      const vy = pb.p3 ? pb.p3.y : 0;
      const denom = (vx - r1) * (vx - r2);
      const a = Math.abs(denom) > 1e-12 ? (vy / denom) : pb.a;
      const coeffs = computeQuadraticFromRoots(r1, r2, a);
      pb.a = coeffs.a; pb.b = coeffs.b; pb.c = coeffs.c;
      pb.p3 = { x: vx, y: vy };
      if (paraEqBody) paraEqBody.textContent = formatParabolaEquation(pb.a, pb.b, pb.c);
    }
    return;
  }
  // Panning
  if (!isDragging) return;
  const dx = mouseX - lastMouseX;
  const dy = mouseY - lastMouseY;
  originX += dx;
  originY += dy;
  lastMouseX = mouseX;
  lastMouseY = mouseY;
}

function mouseReleased() {
  isDragging = false;
  draggingMarkerId = null;
  isDraggingPanel = false;
  draggingTwoPoint = { lineId: null, pointKey: null };
  draggingCurved = { id: null, pointIndex: -1 };
  draggingParabolaId = null;
  draggingParabolaRoot = { id: null, which: null };
  // If we have a pending curved marker and didn't drag, place it now
  if (pendingCurvedMarker) {
    const id = Date.now() + '-' + Math.random().toString(36).slice(2,7);
    markers.push({ id, lineId: null, x: pendingCurvedMarker.xWorld, y: pendingCurvedMarker.yWorld, label: '', color: pendingCurvedMarker.color, size: 6 });
    pendingCurvedMarker = null;
  }
}

// Smooth zoom with mouse wheel centered at cursor
function mouseWheel(event) {
  if (isPointerInUi(event)) return false; // keep page scroll prevented if on canvas, but ignore UI
  const zoomIntensity = 1.08; // per wheel notch
  const mouseScreenX = mouseX;
  const mouseScreenY = mouseY;
  const wheel = event.delta; // positive is down (zoom out)

  // Convert wheel delta to scale factor
  const scale = wheel > 0 ? 1 / zoomIntensity : zoomIntensity;
  const newPPU = clamp(pixelsPerUnit * scale, 10, 120);
  setZoom(newPPU, mouseScreenX, mouseScreenY);

  // Prevent page scroll
  return false;
}

// Touch support: drag and pinch-to-zoom
function touchStarted() {
  if (touches.length === 1) {
    if (uiPointerDown || isTouchInUi()) {
      return false;
    }
    // Tap to rename axis labels
    const tx = touches[0].x;
    const ty = touches[0].y;
    if (pointInRect(tx, ty, axisLabelRects.x)) {
      const next = prompt('Rename x-axis label:', axisLabels.x || 'x');
      if (next !== null) axisLabels.x = String(next).slice(0, 20);
      return false;
    } else if (pointInRect(tx, ty, axisLabelRects.y)) {
      const next = prompt('Rename y-axis label:', axisLabels.y || 'y');
      if (next !== null) axisLabels.y = String(next).slice(0, 20);
      return false;
    }
    // Check if touching an existing marker for drag
    const nearMarker = findNearestMarker(tx, ty);
    if (nearMarker) {
      draggingMarkerId = nearMarker.id;
      isDragging = true;
      lastTouchX = tx;
      lastTouchY = ty;
      return false;
    }
    // Tap near a line or parabola to add a marker via popover
    let hit = findNearestOnExtraLines(tx, ty);
    if (!hit) hit = findNearestOnParabolas(tx, ty);
    if (hit) {
      showLabelPopover(hit.sx, hit.sy, hit.xWorld, hit.yWorld, '');
      return false;
    }
    isDragging = true;
    lastTouchX = touches[0].x;
    lastTouchY = touches[0].y;
  } else if (touches.length >= 2) {
    isDragging = false;
    lastPinchDistance = dist(touches[0].x, touches[0].y, touches[1].x, touches[1].y);
  }
  return false;
}

function touchMoved() {
  if (isDraggingPanel) return false;
  if (touches.length === 1 && isDragging) {
    if (draggingMarkerId) {
      const marker = markers.find(m => m.id === draggingMarkerId);
      if (marker) {
        const wx = screenToWorldX(touches[0].x);
        const wy = screenToWorldY(touches[0].y);
        marker.x = Math.round(wx);
        marker.y = Math.round(wy);
      }
    } else {
      const dx = touches[0].x - lastTouchX;
      const dy = touches[0].y - lastTouchY;
      originX += dx;
      originY += dy;
      lastTouchX = touches[0].x;
      lastTouchY = touches[0].y;
    }
  } else if (touches.length >= 2) {
    const newDistance = dist(touches[0].x, touches[0].y, touches[1].x, touches[1].y);
    if (lastPinchDistance !== null && lastPinchDistance > 0) {
      const scale = newDistance / lastPinchDistance;
      const midX = (touches[0].x + touches[1].x) / 2;
      const midY = (touches[0].y + touches[1].y) / 2;
      const newPPU = clamp(pixelsPerUnit * scale, 10, 120);
      setZoom(newPPU, midX, midY);
    }
    lastPinchDistance = newDistance;
  }
  return false;
}

function touchEnded() {
  if (touches.length === 0) {
    isDragging = false;
    lastPinchDistance = null;
    draggingMarkerId = null;
  }
  return false;
}

function setZoom(newPixelsPerUnit, centerScreenX, centerScreenY) {
  if (isPointerInUi(window.event)) return; // don't zoom when pointer is over UI
  // Keep the world coordinate under the cursor fixed while zooming
  const worldXBefore = screenToWorldX(centerScreenX);
  const worldYBefore = screenToWorldY(centerScreenY);
  pixelsPerUnit = newPixelsPerUnit;
  zoomSlider.value = clamp(Math.round(pixelsPerUnit), 10, 120);
  const newScreenX = worldToScreenX(worldXBefore);
  const newScreenY = worldToScreenY(worldYBefore);
  originX += centerScreenX - newScreenX;
  originY += centerScreenY - newScreenY;
}

function updateCanvasHolderSize() {
  if (!canvasParent) return;
  const toolbarHeight = toolbarEl ? toolbarEl.offsetHeight : 0;
  const targetHeight = Math.max(0, window.innerHeight - toolbarHeight);
  canvasParent.style.height = targetHeight + 'px';
}

function getCssVar(varName) {
  return getComputedStyle(document.body).getPropertyValue(varName).trim();
}

function pointInRect(px, py, rect) {
  if (!rect) return false;
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

function isPointerInUi(evt) {
  const e = evt || window.event;
  let target = e && e.target ? e.target : null;
  // If target is canvas or missing, resolve by elementFromPoint using client coords
  if (!target || String(target.tagName).toLowerCase() === 'canvas') {
    let clientX = e && typeof e.clientX === 'number' ? e.clientX : null;
    let clientY = e && typeof e.clientY === 'number' ? e.clientY : null;
    if ((clientX == null || clientY == null) && typeof mouseX === 'number' && typeof mouseY === 'number') {
      const canvasEl = document.querySelector('canvas');
      if (canvasEl) {
        const rect = canvasEl.getBoundingClientRect();
        clientX = rect.left + mouseX;
        clientY = rect.top + mouseY;
      }
    }
    if (clientX != null && clientY != null) {
      target = document.elementFromPoint(clientX, clientY);
    }
  }
  if (!target) return false;
  while (target) {
    if (
      target === leftPanelEl ||
      target === toolbarEl ||
      target === toolboxBtnEl ||
      target === toolboxDrawerEl ||
      target === labelPopoverEl ||
      target.id === 'colorPicker' ||
      target.id === 'sidePanel' ||
      (target.classList && (target.classList.contains('left-panel') || target.classList.contains('toolbox-btn') || target.classList.contains('toolbox-drawer') || target.classList.contains('toolbox-content') || target.classList.contains('tool-chip') || target.classList.contains('tool-card')))
    ) {
      return true;
    }
    target = target.parentElement;
  }
  return false;
}

function isTouchInUi() {
  // Basic hit test: if the first touch point is inside the left panel rect
  if (!leftPanelEl || !touches || touches.length === 0) return false;
  const rect = leftPanelEl.getBoundingClientRect();
  const t = touches[0];
  return t.clientX >= rect.left && t.clientX <= rect.right && t.clientY >= rect.top && t.clientY <= rect.bottom;
}

function applyTheme(themeKey) {
  // Map friendly keys to body classes we define in CSS
  const map = {
    'dark-plus': 'vscode-dark-plus',
    'light-plus': 'vscode-light-plus',
    'quiet-light': 'quiet-light',
    'solarized-light': 'solarized-light',
    'abyss': 'abyss',
    'kimbie-dark': 'kimbie-dark',
    'monokai': 'monokai',
    'monokai-dimmed': 'monokai-dimmed',
    'red': 'red',
    'solarized-dark': 'solarized-dark',
    'tomorrow-night-blue': 'tomorrow-night-blue',
    'high-contrast': 'high-contrast',
    'one-dark-pro': 'one-dark-pro',
    'dracula-official': 'dracula-official',
    'ayu-light': 'ayu-light',
    'ayu-mirage': 'ayu-mirage',
    'ayu-dark': 'ayu-dark',
    'material-darker': 'material-darker',
    'material-lighter': 'material-lighter',
    'material-palenight': 'material-palenight',
    'material-ocean': 'material-ocean',
    'material-deep-ocean': 'material-deep-ocean',
    'nord': 'nord',
    'winter-is-coming': 'winter-is-coming',
    'snazzy-light': 'snazzy-light',
    'bluloco-light': 'bluloco-light',
    'palenight': 'palenight',
    'tokyo-night-dark': 'tokyo-night-dark',
    'tokyo-night-light': 'tokyo-night-light',
    'tokyo-night-storm': 'tokyo-night-storm',
    'shades-of-purple': 'shades-of-purple',
    'gruvbox-dark': 'gruvbox-dark',
    'gruvbox-light': 'gruvbox-light',
    'catppuccin-latte': 'catppuccin-latte',
    'catppuccin-frappe': 'catppuccin-frappe',
    'catppuccin-macchiato': 'catppuccin-macchiato',
    'catppuccin-mocha': 'catppuccin-mocha',
    'atom-one-dark': 'atom-one-dark',
    'atom-one-light': 'atom-one-light',
    'slack': 'slack',
    'hackr-io': 'hackr-io',
    'linear': 'linear'
  };
  const mapped = map[themeKey] || themeKey;
  const themeClass = `theme-${mapped}`;
  // Remove any existing theme-* class to avoid stale overrides
  Array.from(document.body.classList).forEach((cls) => {
    if (cls && cls.indexOf('theme-') === 0) document.body.classList.remove(cls);
  });
  document.body.classList.add(themeClass);
  currentThemeKey = themeKey;
  localStorage.setItem('themeKey', themeKey);
  // Pull colors from CSS variables so CSS is the single source of truth
  themeColors = {
    canvasBg: getCssVar('--canvas-bg') || '#1e1e1e',
    gridMinor: getCssVar('--grid-minor') || 'rgba(255,255,255,0.10)',
    gridMajor: getCssVar('--grid-major') || 'rgba(255,255,255,0.25)',
    axis: getCssVar('--axis') || '#569cd6',
    plot: getCssVar('--plot') || '#ce9178',
    hudBg: getCssVar('--hud-bg') || 'rgba(0,0,0,0.70)',
    hudText: getCssVar('--hud-text') || '#e6e6e6',
    muted: getCssVar('--muted') || '#b8c0dc'
  };
}

function renderLinesUI(container) {
  container.innerHTML = '';
  extraLines.forEach((ln) => {
    const wrap = document.createElement('span');
    wrap.style.display = 'inline-flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '6px';
    wrap.style.marginRight = '8px';

    const typeSelect = document.createElement('select');
    const optLin = new Option('Linear', 'linear');
    const optQuad = new Option('Quadratic', 'quadratic');
    typeSelect.appendChild(optLin);
    typeSelect.appendChild(optQuad);
    typeSelect.value = ln.kind || 'linear';
    typeSelect.addEventListener('change', () => {
      ln.kind = typeSelect.value;
      renderLinesUI(container);
    });

    // Linear inputs
    const mInput = document.createElement('input');
    mInput.type = 'number';
    mInput.step = 'any';
    mInput.placeholder = 'm';
    mInput.style.width = '80px';
    mInput.value = String(ln.slope);
    mInput.addEventListener('input', () => {
      ln.slope = parseFloat(mInput.value || '0');
    });

    const bInput = document.createElement('input');
    bInput.type = 'number';
    bInput.step = 'any';
    bInput.placeholder = 'b';
    bInput.style.width = '80px';
    bInput.value = String(ln.intercept);
    bInput.addEventListener('input', () => {
      ln.intercept = parseFloat(bInput.value || '0');
    });

    // Quadratic mode selector for coefficients/factored/roots
    const quadModeSel = document.createElement('select');
    quadModeSel.appendChild(new Option('Coefficients (a,b,c)', 'coeff'));
    quadModeSel.appendChild(new Option('Factored (x+a)(x+b)', 'factored'));
    quadModeSel.appendChild(new Option('Roots (r1, r2)', 'roots'));
    quadModeSel.value = ln.quadMode || 'coeff';
    quadModeSel.addEventListener('change', () => {
      ln.quadMode = quadModeSel.value;
      renderLinesUI(container);
    });

    // Quadratic inputs (coefficients)
    const a2Input = document.createElement('input');
    a2Input.type = 'number';
    a2Input.step = 'any';
    a2Input.placeholder = 'a';
    a2Input.style.width = '80px';
    a2Input.value = String(ln.a ?? 1);
    a2Input.addEventListener('input', () => {
      ln.a = parseFloat(a2Input.value || '0');
    });

    const b2Input = document.createElement('input');
    b2Input.type = 'number';
    b2Input.step = 'any';
    b2Input.placeholder = 'b';
    b2Input.style.width = '80px';
    b2Input.value = String(ln.b ?? 0);
    b2Input.addEventListener('input', () => {
      ln.b = parseFloat(b2Input.value || '0');
    });

    const c2Input = document.createElement('input');
    c2Input.type = 'number';
    c2Input.step = 'any';
    c2Input.placeholder = 'c';
    c2Input.style.width = '80px';
    c2Input.value = String(ln.c ?? 0);
    c2Input.addEventListener('input', () => {
      ln.c = parseFloat(c2Input.value || '0');
    });

    // Quadratic inputs (factored)
    const faInputL = document.createElement('input');
    faInputL.type = 'text';
    faInputL.placeholder = '(x+3)';
    faInputL.style.width = '110px';
    faInputL.value = ln.fa || '';
    faInputL.addEventListener('input', () => {
      ln.fa = faInputL.value;
      syncQuadraticFromFactored(ln);
    });

    const fbInputL = document.createElement('input');
    fbInputL.type = 'text';
    fbInputL.placeholder = '(x+8)';
    fbInputL.style.width = '110px';
    fbInputL.value = ln.fb || '';
    fbInputL.addEventListener('input', () => {
      ln.fb = fbInputL.value;
      syncQuadraticFromFactored(ln);
    });

    // Quadratic inputs (roots)
    const r1InputL = document.createElement('input');
    r1InputL.type = 'number';
    r1InputL.step = 'any';
    r1InputL.placeholder = 'r1';
    r1InputL.style.width = '80px';
    r1InputL.value = String(ln.r1 ?? 0);
    r1InputL.addEventListener('input', () => {
      ln.r1 = parseFloat(r1InputL.value || '0');
      syncQuadraticFromRoots(ln);
    });

    const r2InputL = document.createElement('input');
    r2InputL.type = 'number';
    r2InputL.step = 'any';
    r2InputL.placeholder = 'r2';
    r2InputL.style.width = '80px';
    r2InputL.value = String(ln.r2 ?? 0);
    r2InputL.addEventListener('input', () => {
      ln.r2 = parseFloat(r2InputL.value || '0');
      syncQuadraticFromRoots(ln);
    });

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove line';
    removeBtn.addEventListener('click', () => {
      extraLines = extraLines.filter(e => e.id !== ln.id);
      renderLinesUI(container);
    });

    // Color input
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = ln.color || '#ff8800';
    colorInput.title = 'Line color';
    colorInput.addEventListener('input', () => {
      ln.color = colorInput.value;
    });

    if (ln.kind === 'linear') {
      wrap.appendChild(typeSelect);
      wrap.appendChild(document.createTextNode(' y='));
      wrap.appendChild(mInput);
      wrap.appendChild(document.createTextNode('x+'));
      wrap.appendChild(bInput);
      wrap.appendChild(colorInput);
      wrap.appendChild(removeBtn);
    } else {
      wrap.appendChild(typeSelect);
      if ((ln.quadMode || 'coeff') === 'coeff') {
        wrap.appendChild(quadModeSel);
        wrap.appendChild(document.createTextNode(' y='));
        wrap.appendChild(a2Input);
        wrap.appendChild(document.createTextNode('x^2+'));
        wrap.appendChild(b2Input);
        wrap.appendChild(document.createTextNode('x+'));
        wrap.appendChild(c2Input);
      } else if (ln.quadMode === 'factored') {
        wrap.appendChild(quadModeSel);
        wrap.appendChild(document.createTextNode(' y='));
        wrap.appendChild(faInputL);
        wrap.appendChild(fbInputL);
      } else {
        wrap.appendChild(quadModeSel);
        wrap.appendChild(document.createTextNode(' y='));
        wrap.appendChild(r1InputL);
        wrap.appendChild(r2InputL);
      }
      wrap.appendChild(colorInput);
      wrap.appendChild(removeBtn);
    }
    container.appendChild(wrap);
  });
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function hexToRgb(hex) {
  const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#ffffff');
  if (!res) return { r: 255, g: 255, b: 255 };
  return {
    r: parseInt(res[1], 16),
    g: parseInt(res[2], 16),
    b: parseInt(res[3], 16)
  };
}

function componentToHex(c) {
  const s = c.toString(16);
  return s.length === 1 ? '0' + s : s;
}

function rgbToHex(r, g, b) {
  return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function getExtraLineFunction(def) {
  if (def.kind === 'quadratic') {
    // Coefficients are the source of truth; other forms sync into a,b,c
    const a = Number(def.a) || 0;
    const b = Number(def.b) || 0;
    const c = Number(def.c) || 0;
    return (x) => a * x * x + b * x + c;
  }
  // default linear
  const m = Number(def.slope) || 0;
  const b = Number(def.intercept) || 0;
  return (x) => m * x + b;
}

function syncQuadraticFromRoots(def) {
  const r1 = Number(def.r1) || 0;
  const r2 = Number(def.r2) || 0;
  def.a = 1;
  def.b = -(r1 + r2);
  def.c = r1 * r2;
}

function parseRootFromFactorString(s) {
  // Accept forms like (x+3) or (x-2). Return root r such that (x - r).
  const str = (s || '').trim();
  const m = str.match(/^\(x([+-])\s*([0-9]*\.?[0-9]+)\)$/i);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  const val = parseFloat(m[2]);
  // (x + a) => root -a; (x - a) => root +a
  return sign === -1 ? val : -val;
}

function syncQuadraticFromFactored(def) {
  const r1 = parseRootFromFactorString(def.fa || '(x+0)');
  const r2 = parseRootFromFactorString(def.fb || '(x+0)');
  def.a = 1;
  def.b = -(r1 + r2);
  def.c = r1 * r2;
}

function isNearlyInteger(value, epsilon = 1e-9) {
  return Math.abs(value - Math.round(value)) < epsilon;
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// Coordinate transforms
function worldToScreenX(x) {
  return originX + x * pixelsPerUnit;
}
function worldToScreenY(y) {
  return originY - y * pixelsPerUnit;
}
function screenToWorldX(sx) {
  return (sx - originX) / pixelsPerUnit;
}
function screenToWorldY(sy) {
  return (originY - sy) / pixelsPerUnit;
}

// Parsing
function parseAndSetEquation(inputStr) {
  const parsed = parseEquation(inputStr);
  currentEquation = parsed;
}

function parseEquation(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return { type: 'none', fn: () => 0, xConst: null, raw: '', error: 'Enter an equation' };
  }
  let s = rawInput.trim().toLowerCase();
  // Normalize unicode math symbols
  s = s.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
  // Remove whitespace
  s = s.replace(/\s+/g, '');

  // Accept f(x)=..., y=..., or just expression
  let left = '';
  let right = s;
  if (s.includes('=')) {
    const parts = s.split('=');
    left = parts[0];
    right = parts.slice(1).join('=');
  }

  if (left === 'x') {
    // Vertical line x = constant
    const value = Number(right);
    if (!isFinite(value)) {
      return { type: 'none', fn: () => 0, xConst: null, raw: rawInput, error: 'x must equal a number' };
    }
    return { type: 'vertical', fn: () => 0, xConst: value, raw: rawInput, error: '' };
  }

  // If y=... or f(x)=..., we only care about RHS
  let expr = right;
  if (!s.includes('=')) {
    expr = s; // assume y = expr
  }

  // Replace caret with JS power operator
  expr = expr.replace(/\^/g, '**');

  // Determine variable letter used (allow any single letter a-z). If none, default to x.
  const letterMatches = expr.match(/[a-z]/g) || [];
  const uniqueLetters = Array.from(new Set(letterMatches));
  if (uniqueLetters.length > 1) {
    return { type: 'none', fn: () => 0, xConst: null, raw: rawInput, error: 'Use only one variable letter' };
  }
  const variableName = uniqueLetters.length === 1 ? uniqueLetters[0] : 'x';

  // Insert explicit multiplication where commonly omitted for the chosen variable: 2v, )v, v(, 2(, )(
  const reNumVar = new RegExp('(\\d)(' + variableName + ')', 'gi');
  const reParenVar = new RegExp('(\\))(' + variableName + '|\\d)', 'gi');
  const reVarParen = new RegExp('(' + variableName + '|\\d)(\\()', 'gi');
  const reCloseOpen = /\)(\s*)\(/g; // ...)(... -> ...)*(...
  expr = expr.replace(reNumVar, '$1*$2');
  expr = expr.replace(reParenVar, '$1*$2');
  expr = expr.replace(reVarParen, '$1*$2');
  expr = expr.replace(reCloseOpen, ')*(');

  // Security: allow only numbers, letters, operators + - * / **, parentheses, and periods
  const safePattern = /^[0-9a-z+\-*/().\s*]+$/i;
  if (!safePattern.test(expr)) {
    return { type: 'none', fn: () => 0, xConst: null, raw: rawInput, error: 'Unsupported characters. Use numbers, letters, + - * / ^ and ()' };
  }

  // Normalize variable to 'x' for evaluation
  if (variableName !== 'x') {
    const reVarAll = new RegExp('\\b' + variableName + '\\b', 'g');
    expr = expr.replace(reVarAll, 'x');
  }

  // Try building a function
  let fn;
  try {
    // eslint-disable-next-line no-new-func
    fn = new Function('x', `return (${expr});`);
    // quick test
    const test = fn(0);
    if (!isFinite(test)) {
      // Function may be valid but returns Infinity at 0; still ok, just continue
    }
  } catch (e) {
    return { type: 'none', fn: () => 0, xConst: null, raw: rawInput, error: 'Could not parse equation' };
  }

  return { type: 'function', fn, xConst: null, raw: rawInput, error: '' };
}
