const els = {
  fileInput: document.getElementById('fileInput'),
  textInput: document.getElementById('textInput'),

  captionHeight: document.getElementById('captionHeight'),
  captionHeightVal: document.getElementById('captionHeightVal'),

  fontSize: document.getElementById('fontSize'),
  fontSizeVal: document.getElementById('fontSizeVal'),

  fontColor: document.getElementById('fontColor'),
  fontColorVal: document.getElementById('fontColorVal'),

  bgColor: document.getElementById('bgColor'),
  bgColorVal: document.getElementById('bgColorVal'),

  bgAlpha: document.getElementById('bgAlpha'),
  bgAlphaVal: document.getElementById('bgAlphaVal'),

  lineGap: document.getElementById('lineGap'),
  lineGapVal: document.getElementById('lineGapVal'),

  downloadBtn: document.getElementById('downloadBtn'),
  resetBtn: document.getElementById('resetBtn'),
  status: document.getElementById('status'),

  canvas: document.getElementById('canvas'),
  emptyState: document.getElementById('emptyState'),
  meta: document.getElementById('meta')
};

const ctx = els.canvas.getContext('2d');

const state = {
  image: null,
  imageName: 'captioned.png'
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16)
  };
}

function updateValueLabels() {
  els.captionHeightVal.textContent = els.captionHeight.value;
  els.fontSizeVal.textContent = els.fontSize.value;
  els.fontColorVal.textContent = els.fontColor.value.toLowerCase();
  els.bgColorVal.textContent = els.bgColor.value.toLowerCase();
  els.bgAlphaVal.textContent = els.bgAlpha.value;
  els.lineGapVal.textContent = els.lineGap.value;
}

function getLines() {
  return els.textInput.value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function setStatus(msg) {
  els.status.textContent = msg || '';
}

function setMeta(msg) {
  els.meta.textContent = msg || '';
}

function fitCanvasToImage(img) {
  els.canvas.width = img.naturalWidth;
  els.canvas.height = img.naturalHeight;
}

function render() {
  updateValueLabels();

  if (!state.image) {
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    els.emptyState.style.display = 'flex';
    els.downloadBtn.disabled = true;
    setMeta('');
    return;
  }

  els.emptyState.style.display = 'none';

  const img = state.image;
  fitCanvasToImage(img);

  const w = els.canvas.width;
  const h = els.canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const captionHeightPct = Number(els.captionHeight.value) / 100;
  const captionH = Math.round(h * captionHeightPct);

  const lines = getLines();
  const hasCaption = captionH > 0 && lines.length > 0;

  if (captionH > 0) {
    const { r, g, b } = hexToRgb(els.bgColor.value);
    const a = clamp(Number(els.bgAlpha.value) / 100, 0, 1);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
    ctx.fillRect(0, h - captionH, w, captionH);
  }

  if (hasCaption) {
    const fontSize = Number(els.fontSize.value);
    const lineGap = Number(els.lineGap.value);

    ctx.font = `${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
    ctx.fillStyle = els.fontColor.value;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 如果行数过多导致溢出，按比例缩小字号
    const maxTextH = captionH - Math.max(8, Math.round(fontSize * 0.2));
    const wantedH = lines.length * fontSize + Math.max(0, lines.length - 1) * lineGap;

    let scale = 1;
    if (wantedH > 0 && maxTextH > 0 && wantedH > maxTextH) {
      scale = maxTextH / wantedH;
    }
    const finalFontSize = Math.max(10, Math.floor(fontSize * scale));
    const finalLineGap = Math.max(0, Math.floor(lineGap * scale));

    ctx.font = `${finalFontSize}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;

    const totalH = lines.length * finalFontSize + Math.max(0, lines.length - 1) * finalLineGap;
    const startY = (h - captionH) + captionH / 2 - totalH / 2 + finalFontSize / 2;

    const paddingX = Math.round(w * 0.06);
    const maxWidth = w - paddingX * 2;

    // 简单做一次按宽度缩放（不做自动换行，保持“按行添加”语义）
    for (let i = 0; i < lines.length; i++) {
      const y = startY + i * (finalFontSize + finalLineGap);
      const t = lines[i];

      const m = ctx.measureText(t);
      if (m.width > maxWidth) {
        const xScale = maxWidth / m.width;
        ctx.save();
        ctx.translate(w / 2, y);
        ctx.scale(xScale, 1);
        ctx.fillText(t, 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(t, w / 2, y);
      }
    }

    if (scale < 1) {
      setStatus('提示：字幕行数较多，已自动缩小字号以适配字幕区域。');
    } else {
      setStatus('');
    }
  } else {
    setStatus('');
  }

  els.downloadBtn.disabled = false;
  setMeta(`${w}×${h}  |  字幕高度：${Math.round(captionH)}px`);
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败'));
    };
    img.src = url;
  });
}

function downloadCanvas() {
  if (!state.image) return;

  const a = document.createElement('a');
  a.download = state.imageName;
  a.href = els.canvas.toDataURL('image/png');
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function resetAll() {
  els.fileInput.value = '';
  els.textInput.value = '';

  els.captionHeight.value = '18';
  els.fontSize.value = '36';
  els.fontColor.value = '#ffffff';
  els.bgColor.value = '#000000';
  els.bgAlpha.value = '55';
  els.lineGap.value = '8';

  state.image = null;
  state.imageName = 'captioned.png';

  setStatus('');
  render();
}

els.fileInput.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  try {
    setStatus('正在加载图片...');
    const img = await loadImageFromFile(file);
    state.image = img;

    const safeName = file.name.replace(/\.[^/.]+$/, '');
    state.imageName = `${safeName}-caption.png`;

    setStatus('');
    render();
  } catch (err) {
    state.image = null;
    setStatus(err && err.message ? err.message : '图片加载失败');
    render();
  }
});

['input', 'change'].forEach((evt) => {
  els.textInput.addEventListener(evt, render);
  els.captionHeight.addEventListener(evt, render);
  els.fontSize.addEventListener(evt, render);
  els.fontColor.addEventListener(evt, render);
  els.bgColor.addEventListener(evt, render);
  els.bgAlpha.addEventListener(evt, render);
  els.lineGap.addEventListener(evt, render);
});

els.downloadBtn.addEventListener('click', downloadCanvas);
els.resetBtn.addEventListener('click', resetAll);

// 初始渲染
updateValueLabels();
resetAll();
