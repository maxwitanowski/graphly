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

// Parsed equation
let currentEquation = {
  type: 'function', // 'function' | 'vertical' | 'none'
  fn: (x) => x,
  xConst: null,
  raw: 'y=2x+3',
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
let canvasParent;

function setup() {
  canvasParent = document.getElementById('canvas-holder');
  const c = createCanvas(canvasParent.clientWidth, canvasParent.clientHeight);
  c.parent(canvasParent);

  // Initial origin at canvas center
  originX = width / 2;
  originY = height / 2;

  // Hook up UI
  equationInput = document.getElementById('equationInput');
  plotButton = document.getElementById('plotBtn');
  zoomSlider = document.getElementById('zoomSlider');
  resetButton = document.getElementById('resetBtn');
  themeSelect = document.getElementById('themeSelect');
  parabolaBtn = document.getElementById('parabolaBtn');
  aInput = document.getElementById('aInput');
  bInput = document.getElementById('bInput');
  cInput = document.getElementById('cInput');

  equationInput.value = 'y=2x+3';
  zoomSlider.value = pixelsPerUnit;

  plotButton.addEventListener('click', () => {
    parseAndSetEquation(equationInput.value);
  });
  equationInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') parseAndSetEquation(equationInput.value);
  });
  zoomSlider.addEventListener('input', () => {
    pixelsPerUnit = clamp(parseFloat(zoomSlider.value), 10, 120);
  });
  resetButton.addEventListener('click', () => {
    pixelsPerUnit = 40;
    zoomSlider.value = pixelsPerUnit;
    originX = width / 2;
    originY = height / 2;
  });

  themeSelect.addEventListener('change', () => {
    if (themeSelect.value === 'light') {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
  });

  parabolaBtn.addEventListener('click', () => {
    const a = parseFloat(aInput.value || '0');
    const b = parseFloat(bInput.value || '0');
    const c = parseFloat(cInput.value || '0');
    const eq = `y=${a}x^2+${b}x+${c}`;
    equationInput.value = eq;
    parseAndSetEquation(eq);
  });

  parseAndSetEquation(equationInput.value);
}

function windowResized() {
  resizeCanvas(canvasParent.clientWidth, canvasParent.clientHeight);
}

function draw() {
  // Background color based on theme
  const isLight = document.body.classList.contains('light');
  background(isLight ? '#ffffff' : '#0b0e19');
  drawGridAndAxes();
  drawEquation();
  drawHUD();
}

function drawGridAndAxes() {
  const unitStep = 1; // fixed 1 unit grid
  const gridMajorEvery = 5; // major every N lines
  const isLight = document.body.classList.contains('light');
  const minorColor = isLight ? color(0, 0, 0, 15) : color(255, 255, 255, 15);
  const majorColor = isLight ? color(0, 0, 0, 50) : color(255, 255, 255, 40);

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
  stroke(isLight ? '#2c4ddb' : '#7aa2ff');
  strokeWeight(2);
  // y-axis (x=0)
  const yAxisX = worldToScreenX(0);
  line(yAxisX, 0, yAxisX, height);
  // x-axis (y=0)
  const xAxisY = worldToScreenY(0);
  line(0, xAxisY, width, xAxisY);

  // Axis labels
  noStroke();
  fill(isLight ? '#2b2f42' : '#b8c0dc');
  textSize(12);
  textAlign(LEFT, TOP);
  text('x', yAxisX + 6, 4);
  textAlign(LEFT, BOTTOM);
  text('y', 4, xAxisY - 6);
}

function drawEquation() {
  if (currentEquation.type === 'none') return;
  if (currentEquation.error) return;

  const isLightTheme = document.body.classList.contains('light');
  stroke(isLightTheme ? '#e67e22' : '#ffb86b');
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

function drawHUD() {
  // Mouse world coords
  const xWorld = screenToWorldX(mouseX);
  const yWorld = screenToWorldY(mouseY);
  const label = `x=${xWorld.toFixed(2)}, y=${yWorld.toFixed(2)}  |  ${currentEquation.error ? 'Error: ' + currentEquation.error : currentEquation.raw}`;
  noStroke();
  const isLight = document.body.classList.contains('light');
  if (isLight) {
    fill(255, 255, 255, 220);
  } else {
    fill(0, 0, 0, 180);
  }
  rect(10, height - 30, textWidth(label) + 14, 22, 6);
  fill(isLight ? '#0b0e19' : '#e6e6e6');
  textAlign(LEFT, CENTER);
  textSize(12);
  text(label, 17, height - 19);
}

// Mouse interactions for panning
function mousePressed() {
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

  // Insert explicit multiplication where commonly omitted: 2x, )x, x(, 2(, )(
  expr = expr.replace(/(\d)(x)/gi, '$1*$2');
  expr = expr.replace(/(\))(x|\d)/gi, '$1*$2');
  expr = expr.replace(/(x|\d)(\()/gi, '$1*$2');

  // Security: allow only numbers, x, operators + - * / **, parentheses, and periods
  const safePattern = /^[0-9x+\-*/().\s*]+$/i;
  if (!safePattern.test(expr)) {
    return { type: 'none', fn: () => 0, xConst: null, raw: rawInput, error: 'Unsupported characters. Use numbers, x, + - * / ^ and ()' };
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
