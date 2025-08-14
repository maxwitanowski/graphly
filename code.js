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

function setup() {
  canvasParent = document.getElementById('canvas-holder');
  toolbarEl = document.getElementById('toolbar');
  updateCanvasHolderSize();
  const c = createCanvas(canvasParent.clientWidth, canvasParent.clientHeight);
  c.parent(canvasParent);

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

  // Initialize theme from saved preference and wire up selector
  const savedTheme = localStorage.getItem('themeKey') || 'vscode-dark-plus';
  themeSelect.value = savedTheme;
  applyTheme(savedTheme);
  themeSelect.addEventListener('change', () => {
    applyTheme(themeSelect.value);
  });

  // Removed legacy quadratic toolbar. Quadratic options will be provided per-line in the Lines UI.

  // No initial equation parsing (primary equation removed)
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
  const hover = findNearestOnExtraLines(mouseX, mouseY);
  if (hover) {
    drawHoverTip(hover);
  }
  drawHUD();
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
  if (!extraLines || extraLines.length === 0) return null;

  const thresholdPx = 10; // hover distance in pixels
  let best = null;
  let bestDist = Infinity;

  for (const lineDef of extraLines) {
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

  if (best && bestDist <= thresholdPx) return best;
  return null;
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

// Mouse interactions for panning
function mousePressed() {
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

  // Click near a line to set its label
  const hit = findNearestOnExtraLines(mx, my);
  if (hit && hit.lineRef) {
    const next = prompt('Name this line:', hit.lineRef.label || '');
    if (next !== null) hit.lineRef.label = String(next).slice(0, 40);
    return;
  }

  isDragging = true;
  lastMouseX = mouseX;
  lastMouseY = mouseY;
}

function mouseDragged() {
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
}

// Smooth zoom with mouse wheel centered at cursor
function mouseWheel(event) {
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
  if (touches.length === 1 && isDragging) {
    const dx = touches[0].x - lastTouchX;
    const dy = touches[0].y - lastTouchY;
    originX += dx;
    originY += dy;
    lastTouchX = touches[0].x;
    lastTouchY = touches[0].y;
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
  }
  return false;
}

function setZoom(newPixelsPerUnit, centerScreenX, centerScreenY) {
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
