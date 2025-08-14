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
    if (toolboxDrawerEl) toolboxDrawerEl.style.display = 'block';
  }
  const l2 = document.getElementById('line2Tool');
  if (l2 && toolboxEmbeddedAreaEl) {
    const toolboxContent = document.querySelector('.toolbox-content');
    (toolboxContent || toolboxEmbeddedAreaEl).appendChild(l2);
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
      twoPointLines.push({ id, p1: { x: p1.x, y: p1.y }, p2: { x: p2.x, y: p2.y }, color, name: '' });
      renderLine2List(line2List);
    });
  }
  if (line2SpawnBtn) {
    line2SpawnBtn.addEventListener('click', () => {
      const centerX = screenToWorldX(width / 2);
      const centerY = screenToWorldY(height / 2);
      const color = (line2Color && line2Color.value) ? line2Color.value : '#66d9ef';
      const id = Date.now() + '-' + Math.random().toString(36).slice(2,7);
      // Spawn near center in world coords
      twoPointLines.push({ id, p1: { x: centerX - 2, y: centerY - 1 }, p2: { x: centerX + 2, y: centerY + 1 }, color, name: '' });
      renderLine2List(line2List);
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
        if (toolboxDrawerEl) toolboxDrawerEl.style.display = 'block';
      });
    }
  }

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
        if (toolboxDrawerEl) toolboxDrawerEl.style.display = 'block';
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
        if (toolboxDrawerEl) toolboxDrawerEl.style.display = 'block';
      } else {
        leftPanelEl.style.display = 'none';
        if (toolboxDrawerEl) toolboxDrawerEl.style.display = 'block';
      }
    });
  }

  // Toolbox toggle
  if (toolboxBtnEl && toolboxDrawerEl) {
    const toggle = () => {
      const isOpen = toolboxDrawerEl.style.display !== 'none';
      toolboxDrawerEl.style.display = isOpen ? 'none' : 'block';
    };
    toolboxBtnEl.addEventListener('click', toggle);
    if (toolboxCloseEl) toolboxCloseEl.addEventListener('click', toggle);
  }

  // Chips removed; panel can be dragged out by grabbing its header (implemented above)

  // Note: Tools do not auto-move when opening/closing toolbox. Drag them in/out explicitly.

  // Initialize theme from saved preference and wire up selector
  const savedTheme = localStorage.getItem('themeKey') || 'vscode-dark-plus';
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
  drawTwoPointLines();
  drawParabolas();

  // Hover prioritization: markers first (snap), then lines (extra + two-point)
  snappedCursor = null;
  const hoverMarker = findNearestMarker(mouseX, mouseY);
  if (hoverMarker) {
    cursor('pointer');
    drawHoverTip({
      sx: hoverMarker.sx,
      sy: hoverMarker.sy,
      xWorld: hoverMarker.x,
      yWorld: hoverMarker.y,
      rgb: hoverMarker.rgb
    });
    snappedCursor = { sx: hoverMarker.sx, sy: hoverMarker.sy };
  } else {
    // Snap to two-point endpoints first for better UX
    const endpoint = findNearestTwoPointEndpoint(mouseX, mouseY);
    if (endpoint) {
      cursor('pointer');
      drawHoverTip({ sx: endpoint.sx, sy: endpoint.sy, xWorld: endpoint.x, yWorld: endpoint.y, rgb: endpoint.rgb });
      snappedCursor = { sx: endpoint.sx, sy: endpoint.sy };
    } else {
      // Snap to parabola handles (vertex and roots) or the curve itself
      const nearV = findNearestParabolaVertex(mouseX, mouseY);
      const nearR = findNearestParabolaRoot(mouseX, mouseY);
      const nearCurve = findNearestOnParabolas(mouseX, mouseY);
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
        drawHoverTip({ sx: nearCurve.sx, sy: nearCurve.sy, xWorld: nearCurve.xWorld, yWorld: nearCurve.yWorld, rgb: hexToRgb(nearCurve.pbRef?.color || '#e67e22') });
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

  drawMarkers(hoverMarker ? hoverMarker.id : null);
  drawHUD();
  // Render snapped cursor if available
  if (snappedCursor) {
    push();
    noFill();
    stroke(themeColors.axis);
    strokeWeight(1);
    circle(snappedCursor.sx, snappedCursor.sy, 12);
    pop();
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
    const baseWeight = 2;
    const fn = getExtraLineFunction(lineDef);
    // Draw crisp line
    stroke(rgb.r, rgb.g, rgb.b, 255);
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
    stroke(rgb.r, rgb.g, rgb.b, 255);
    const baseSize = Number.isFinite(m.size) ? m.size : 6;
    strokeWeight(m.id === highlightId ? 3 : 2);
    fill(themeColors.canvasBg);
    circle(sx, sy, (m.id === highlightId ? baseSize + 2 : baseSize));
    // Label
    noStroke();
    fill(themeColors.hudText);
    textAlign(LEFT, BOTTOM);
    const coord = `(${m.x.toFixed(2)}, ${m.y.toFixed(2)})`;
    const label = m.label ? `${m.label} ${coord}` : coord;
    text(label, sx + 8, sy - 6);
  }
}

function drawTwoPointLines() {
  if (!twoPointLines.length) return;
  for (const ln of twoPointLines) {
    const rgb = hexToRgb(ln.color || '#66d9ef');
    // Draw infinite line through p1 and p2
    const x1w = ln.p1.x; const y1w = ln.p1.y; const x2w = ln.p2.x; const y2w = ln.p2.y;
    if (!(x1w === x2w && y1w === y2w)) {
      stroke(rgb.r, rgb.g, rgb.b, 255);
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
    if (!twoPointDotsHidden) {
      fill(themeColors.canvasBg);
      stroke(rgb.r, rgb.g, rgb.b, 255);
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

function drawParabolas() {
  if (!parabolas.length) return;
  for (const pb of parabolas) {
    const rgb = hexToRgb(pb.color || '#e67e22');
    stroke(rgb.r, rgb.g, rgb.b, 255);
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
    if (!parabolaDotsHidden) {
      fill(themeColors.canvasBg);
      stroke(rgb.r, rgb.g, rgb.b, 255);
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
  stroke(hit.rgb.r, hit.rgb.g, hit.rgb.b, 255);
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
  if (isPointerInUi(window.event)) {
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

  // Click near a line to set its label or add marker using custom popover
  let hit = findNearestOnExtraLines(mx, my);
  if (!hit) hit = findNearestOnParabolas(mx, my);
  if (hit) {
    showLabelPopover(hit.sx, hit.sy, hit.xWorld, hit.yWorld, '');
    return;
  }

  isDragging = true;
  lastMouseX = mouseX;
  lastMouseY = mouseY;
}

function mouseDragged() {
  if (isDraggingPanel) return; // do not pan while moving panel
  // Dragging a marker
  if (draggingMarkerId) {
    const marker = markers.find(m => m.id === draggingMarkerId);
    if (!marker) return;
    // Convert current mouse to world coords and snap to grid step 1
    const wx = screenToWorldX(mouseX);
    const wy = screenToWorldY(mouseY);
    marker.x = Math.round(wx);
    marker.y = Math.round(wy);
    return;
  }
  // Dragging a two-point endpoint
  if (draggingTwoPoint && draggingTwoPoint.lineId) {
    const ln = twoPointLines.find(l => l.id === draggingTwoPoint.lineId);
    if (ln) {
      const wx = screenToWorldX(mouseX);
      const wy = screenToWorldY(mouseY);
      const snapX = Math.round(wx);
      const snapY = Math.round(wy);
      if (draggingTwoPoint.pointKey === 'p1') { ln.p1.x = snapX; ln.p1.y = snapY; }
      if (draggingTwoPoint.pointKey === 'p2') { ln.p2.x = snapX; ln.p2.y = snapY; }
    }
    return;
  }
  // Dragging a parabola vertex up/down (x fixed at midpoint between roots)
  if (draggingParabolaId) {
    const pb = parabolas.find(p => p.id === draggingParabolaId);
    if (pb) {
      const vx = pb.p3.x; // fixed
      const wy = Math.round(screenToWorldY(mouseY));
      const r1 = pb.p1.x;
      const r2 = pb.p2.x;
      const denom = (vx - r1) * (vx - r2);
      const a = Math.abs(denom) > 1e-12 ? (wy / denom) : pb.a;
      const coeffs = computeQuadraticFromRoots(r1, r2, a);
      pb.a = coeffs.a; pb.b = coeffs.b; pb.c = coeffs.c;
      pb.p3 = { x: vx, y: wy };
      const vyInput = document.getElementById('paraVY');
      if (vyInput) vyInput.value = String(wy);
    }
    return;
  }
  // Dragging a parabola root along x-axis only
  if (draggingParabolaRoot && draggingParabolaRoot.id && draggingParabolaRoot.which) {
    const pb = parabolas.find(p => p.id === draggingParabolaRoot.id);
    if (pb) {
      const wx = Math.round(screenToWorldX(mouseX));
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
  draggingParabolaId = null;
  draggingParabolaRoot = { id: null, which: null };
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
    if (isTouchInUi()) {
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
  if (!e) return false;
  let target = e.target;
  while (target) {
    if (
      target === leftPanelEl ||
      target === toolbarEl ||
      target === toolboxBtnEl ||
      target === toolboxDrawerEl ||
      target === labelPopoverEl ||
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
  const themeClass = `theme-${themeKey}`;
  const allThemeClasses = [
    'theme-vscode-dark-plus',
    'theme-vscode-light-plus',
    'theme-monokai',
    'theme-solarized-dark',
    'theme-solarized-light',
    'light'
  ];
  allThemeClasses.forEach(cls => document.body.classList.remove(cls));
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
