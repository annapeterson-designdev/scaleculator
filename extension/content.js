(() => {
  if (document.getElementById('scaleculator-fab')) return; // already injected

  // ─── Unit tables ────────────────────────────────────────────────────────────
  const VOLUME_TO_ML = { tsp:4.929, tbsp:14.787, 'fl oz':29.574, cup:236.588, pint:473.176, quart:946.353, gallon:3785.41, ml:1, L:1000 };
  const WEIGHT_TO_G  = { oz:28.3495, lb:453.592, g:1, kg:1000 };
  const VOLUME_UNITS = Object.keys(VOLUME_TO_ML);
  const WEIGHT_UNITS = Object.keys(WEIGHT_TO_G);
  const COUNT_UNITS  = ['piece','pinch','dash','clove','slice','can','pkg','bunch','handful','to taste',''];

  function unitType(u) {
    if (VOLUME_UNITS.includes(u)) return 'volume';
    if (WEIGHT_UNITS.includes(u)) return 'weight';
    return 'count';
  }

  function normalize(amount, unit) {
    const type = unitType(unit);
    if (type === 'volume') {
      const ml = amount * VOLUME_TO_ML[unit];
      if (ml >= VOLUME_TO_ML.gallon * 0.9)  return { amount: ml / VOLUME_TO_ML.gallon,  unit: 'gallon' };
      if (ml >= VOLUME_TO_ML.quart  * 0.9)  return { amount: ml / VOLUME_TO_ML.quart,   unit: 'quart'  };
      if (ml >= VOLUME_TO_ML.cup    * 0.9)  return { amount: ml / VOLUME_TO_ML.cup,     unit: 'cup'    };
      if (ml >= VOLUME_TO_ML.tbsp   * 0.9)  return { amount: ml / VOLUME_TO_ML.tbsp,    unit: 'tbsp'   };
      if (ml >= VOLUME_TO_ML.tsp    * 0.5)  return { amount: ml / VOLUME_TO_ML.tsp,     unit: 'tsp'    };
      return { amount: ml, unit: 'ml' };
    }
    if (type === 'weight') {
      const g = amount * WEIGHT_TO_G[unit];
      if (g >= WEIGHT_TO_G.kg * 0.9) return { amount: g / WEIGHT_TO_G.kg, unit: 'kg' };
      if (g >= WEIGHT_TO_G.lb * 0.5) return { amount: g / WEIGHT_TO_G.lb, unit: 'lb' };
      if (g >= WEIGHT_TO_G.oz * 0.5) return { amount: g / WEIGHT_TO_G.oz, unit: 'oz' };
      return { amount: g, unit: 'g' };
    }
    return { amount, unit };
  }

  function scaleQty(amount, unit, factor) {
    if (unitType(unit) === 'count') return { amount: amount * factor, unit };
    return normalize(amount * factor, unit);
  }

  function fmtNum(n) {
    if (!n || n === 0) return '0';
    const fracs = [[1/8,'⅛'],[1/4,'¼'],[1/3,'⅓'],[1/2,'½'],[2/3,'⅔'],[3/4,'¾']];
    const whole = Math.floor(n), rem = n - whole;
    for (const [val, sym] of fracs) {
      if (Math.abs(rem - val) < 0.04) return whole > 0 ? `${whole} ${sym}` : sym;
    }
    if (n < 10) return parseFloat(n.toFixed(2)).toString();
    return parseFloat(n.toFixed(1)).toString();
  }

  // ─── State ──────────────────────────────────────────────────────────────────
  let ingredients = [];
  let scaleFactor = 1;
  let genId = () => Math.random().toString(36).slice(2);

  function loadSaved() {
    try { return JSON.parse(localStorage.getItem('scaleculator_recipes') || '[]'); }
    catch { return []; }
  }
  function persistSaved(r) { localStorage.setItem('scaleculator_recipes', JSON.stringify(r)); }

  // ─── Recipe page detection ───────────────────────────────────────────────────
  function isRecipePage() {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const d = JSON.parse(s.textContent);
        const items = Array.isArray(d) ? d : [d['@graph'] ? d['@graph'] : d].flat();
        if (items.some(i => (i['@type'] || '').toString().toLowerCase().includes('recipe'))) return true;
      } catch {}
    }
    if (document.querySelector('[itemtype*="schema.org/Recipe"]')) return true;
    const selectors = [
      '.wprm-recipe-ingredient', '.tasty-recipes-ingredient', '.mv-create-ingredient',
      '.recipe-ingredient', '[class*="ingredient"]', '[id*="ingredient"]',
    ];
    for (const s of selectors) {
      if (document.querySelector(s)) return true;
    }
    return false;
  }

  // ─── Parse structured data ───────────────────────────────────────────────────
  function parseRecipeFromPage() {
    let recipeData = null;
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const d = JSON.parse(s.textContent);
        const items = Array.isArray(d) ? d : [d['@graph'] ? d['@graph'] : d].flat();
        recipeData = items.find(i => (i['@type'] || '').toString().toLowerCase().includes('recipe'));
        if (recipeData) break;
      } catch {}
    }
    if (!recipeData) return null;
    const name = recipeData.name || document.title || '';
    const servings = parseServings(recipeData.recipeYield);
    const rawIngredients = recipeData.recipeIngredient || [];
    const parsed = rawIngredients.map(parseIngredientString).filter(Boolean);
    return { name, servings, ingredients: parsed };
  }

  function parseServings(yield_) {
    if (!yield_) return 4;
    const s = Array.isArray(yield_) ? yield_[0] : yield_;
    const n = parseFloat(String(s));
    return isNaN(n) ? 4 : n;
  }

  function parseIngredientString(str) {
    str = str.trim()
      .replace(/½/g,'1/2').replace(/¼/g,'1/4').replace(/¾/g,'3/4')
      .replace(/⅓/g,'1/3').replace(/⅔/g,'2/3').replace(/⅛/g,'1/8');

    const unitPattern = [...VOLUME_UNITS, ...WEIGHT_UNITS, ...COUNT_UNITS.filter(Boolean)]
      .map(u => u.replace(/\s/g,'\\s')).join('|');
    const re = new RegExp(`^([\\d\\s\\/\\.]+)?\\s*(${unitPattern}s?)?\\.?\\s*(.+)?$`, 'i');
    const m = str.match(re);
    if (!m) return { id: genId(), qty: '', unit: '', name: str };

    let qty = '';
    if (m[1]) {
      const raw = m[1].trim();
      if (raw.includes('/')) {
        let val = 0;
        for (const p of raw.split(/\s+/)) {
          if (p.includes('/')) { const [a,b] = p.split('/'); val += parseFloat(a)/parseFloat(b); }
          else val += parseFloat(p) || 0;
        }
        qty = isNaN(val) ? '' : String(val);
      } else {
        qty = isNaN(parseFloat(raw)) ? '' : String(parseFloat(raw));
      }
    }

    let unit = (m[2] || '').toLowerCase().replace(/s$/, '');
    if (![...VOLUME_UNITS, ...WEIGHT_UNITS, ...COUNT_UNITS].includes(unit)) unit = '';
    const name = (m[3] || str).trim();
    return { id: genId(), qty, unit: unit || '', name };
  }

  // ─── DOM helpers ─────────────────────────────────────────────────────────────
  function unitOptgroup(selected) {
    const opts = (units) => units.map(u =>
      `<option value="${u}" ${u===selected?'selected':''}>${u||'—'}</option>`
    ).join('');
    return `<optgroup label="Volume">${opts(VOLUME_UNITS)}</optgroup>
            <optgroup label="Weight">${opts(WEIGHT_UNITS)}</optgroup>
            <optgroup label="Other">${opts(COUNT_UNITS)}</optgroup>`;
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  function renderIngredients() {
    const list = document.getElementById('sc-ing-list');
    if (!list) return;
    if (ingredients.length === 0) {
      list.innerHTML = `<div class="sc-empty">No ingredients — click + Add</div>`;
      return;
    }
    list.innerHTML = ingredients.map(ing => `
      <div class="sc-ing-row" id="sc-row-${ing.id}">
        <input type="number" placeholder="Qty" min="0" step="any"
          value="${escHtml(ing.qty)}"
          oninput="window._sc.updateIng('${ing.id}','qty',this.value)" />
        <select onchange="window._sc.updateIng('${ing.id}','unit',this.value)">
          ${unitOptgroup(ing.unit)}
        </select>
        <input type="text" placeholder="Ingredient…"
          value="${escHtml(ing.name)}"
          oninput="window._sc.updateIng('${ing.id}','name',this.value)" />
        <span class="sc-preview" id="sc-prev-${ing.id}"></span>
        <button class="sc-rm" onclick="window._sc.removeIng('${ing.id}')">×</button>
      </div>
    `).join('');
    renderPreviews();
  }

  function renderPreviews() {
    for (const ing of ingredients) {
      const el = document.getElementById(`sc-prev-${ing.id}`);
      if (!el) continue;
      const qty = parseFloat(ing.qty);
      if (!ing.qty || isNaN(qty) || scaleFactor === 1) { el.textContent = ''; continue; }
      const { amount, unit } = scaleQty(qty, ing.unit, scaleFactor);
      el.textContent = `→ ${fmtNum(amount)} ${unit}`;
    }
  }

  function setScale(factor) {
    scaleFactor = factor;
    // Update active button
    document.querySelectorAll('.sc-scale-btn').forEach(btn => {
      btn.classList.toggle('active', parseFloat(btn.dataset.factor) === factor);
    });
    renderPreviews();
  }

  function updateScale() { setScale(scaleFactor); }

  // ─── API exposed to inline handlers ─────────────────────────────────────────
  window._sc = {
    currentId: null,
    updateScale,
    setScale,
    invertScale() { setScale(scaleFactor !== 0 ? parseFloat((1 / scaleFactor).toFixed(4)) : 1); },
    updateIng(id, field, value) {
      const ing = ingredients.find(i => i.id === id);
      if (ing) ing[field] = value;
      renderPreviews();
    },
    removeIng(id) {
      ingredients = ingredients.filter(i => i.id !== id);
      renderIngredients();
    },
  };

  // ─── Build panel HTML ────────────────────────────────────────────────────────
  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'scaleculator-panel';
    panel.innerHTML = `
      <div id="sc-header">
        <div id="sc-header-left"><span>🧮</span> Scaleculator</div>
        <button id="sc-close">×</button>
      </div>
      <div id="sc-sticky-title">
        <input type="text" id="sc-recipe-name" placeholder="Recipe name…" />
      </div>
      <div id="sc-body">
        <div id="sc-import-banner" style="display:none">
          <span>📋 Recipe detected on this page</span>
          <button id="sc-import-btn">Import ingredients</button>
        </div>
        <div id="sc-scale-row">
          <div id="sc-scale-btns">
            <button class="sc-scale-btn" data-factor="0.25" onclick="window._sc.setScale(0.25)">¼x</button>
            <button class="sc-scale-btn" data-factor="0.5"  onclick="window._sc.setScale(0.5)">½x</button>
            <button class="sc-scale-btn active" data-factor="1"    onclick="window._sc.setScale(1)">1x</button>
            <button class="sc-scale-btn" data-factor="2"    onclick="window._sc.setScale(2)">2x</button>
            <button class="sc-scale-btn" data-factor="3"    onclick="window._sc.setScale(3)">3x</button>
            <button class="sc-scale-btn" data-factor="4"    onclick="window._sc.setScale(4)">4x</button>
            <button class="sc-scale-btn sc-scale-inv" data-factor="-1" onclick="window._sc.invertScale()" title="Invert scale">1/x</button>
          </div>
        </div>
        <div id="sc-ingredients-header">
          <span>Ingredients</span>
          <button id="sc-add-btn">+ Add</button>
        </div>
        <div id="sc-ing-list"></div>
      </div>
      <div id="sc-footer">
        <button class="sc-btn sc-btn-primary" id="sc-save-btn">💾 Save</button>
        <button class="sc-btn sc-btn-secondary" id="sc-copy-btn">📋 Copy scaled</button>
        <button class="sc-btn sc-btn-secondary" id="sc-new-btn">+ New</button>
      </div>
    `;
    return panel;
  }

  // ─── Toast ───────────────────────────────────────────────────────────────────
  let toastTimer;
  function toast(msg) {
    let el = document.getElementById('sc-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sc-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // ─── Save / copy ─────────────────────────────────────────────────────────────
  function saveRecipe() {
    const name = (document.getElementById('sc-recipe-name')?.value || document.title || 'Recipe').trim();
    const id = window._sc.currentId || (window._sc.currentId = genId());
    const recipe = { id, name, ingredients: ingredients.map(i=>({...i})), savedAt: new Date().toISOString() };
    const saved = loadSaved();
    const idx = saved.findIndex(r => r.id === id);
    if (idx >= 0) saved[idx] = recipe; else saved.unshift(recipe);
    persistSaved(saved);
    toast('Recipe saved!');
  }

  function copyScaled() {
    const name = document.getElementById('sc-recipe-name')?.value || document.title || 'Recipe';
    const scaleLabel = scaleFactor === 1 ? '' : ` (×${fmtNum(scaleFactor)})`;
    let lines = [`${name}${scaleLabel}\n`];
    for (const ing of ingredients) {
      if (!ing.name && !ing.qty) continue;
      const qty = parseFloat(ing.qty);
      if (!isNaN(qty) && qty > 0) {
        const { amount, unit } = scaleQty(qty, ing.unit, scaleFactor);
        lines.push(`• ${fmtNum(amount)} ${unit} ${ing.name}`.trim());
      } else {
        lines.push(`• ${ing.name}`);
      }
    }
    navigator.clipboard.writeText(lines.join('\n')).then(() => toast('Copied!'));
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    const fab = document.createElement('button');
    fab.id = 'scaleculator-fab';
    fab.title = 'Scaleculator';
    fab.textContent = '🧮';
    document.body.appendChild(fab);

    const panel = buildPanel();
    document.body.appendChild(panel);

    const toastEl = document.createElement('div');
    toastEl.id = 'sc-toast';
    document.body.appendChild(toastEl);

    ingredients = [
      { id: genId(), qty: '', unit: 'cup', name: '' },
      { id: genId(), qty: '', unit: 'cup', name: '' },
    ];
    window._sc.currentId = null;
    renderIngredients();

    // Check for recipe on this page
    const pageRecipe = parseRecipeFromPage();
    if (pageRecipe) {
      const banner = document.getElementById('sc-import-banner');
      if (banner) banner.style.display = 'flex';
      // Pre-fill recipe name from page
      const nameEl = document.getElementById('sc-recipe-name');
      if (nameEl && pageRecipe.name) nameEl.value = pageRecipe.name;

      document.getElementById('sc-import-btn')?.addEventListener('click', () => {
        ingredients = pageRecipe.ingredients;
        window._sc.currentId = null;
        setScale(1);
        renderIngredients();
        if (banner) banner.style.display = 'none';
        toast(`Imported ${ingredients.length} ingredients`);
      });
    }

    // ─── Drag to move ──────────────────────────────────────────────────────────
    let dragging = false, dragOffX = 0, dragOffY = 0;

    document.getElementById('sc-header').addEventListener('mousedown', e => {
      if (e.target.id === 'sc-close') return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      // Switch from bottom/right anchoring to top/left so we can freely position
      panel.style.bottom = 'auto';
      panel.style.right  = 'auto';
      panel.style.top    = rect.top + 'px';
      panel.style.left   = rect.left + 'px';
      dragOffX = e.clientX - rect.left;
      dragOffY = e.clientY - rect.top;
      document.getElementById('sc-header').classList.add('dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const x = Math.max(0, Math.min(e.clientX - dragOffX, window.innerWidth  - panel.offsetWidth));
      const y = Math.max(0, Math.min(e.clientY - dragOffY, window.innerHeight - panel.offsetHeight));
      panel.style.left = x + 'px';
      panel.style.top  = y + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      document.getElementById('sc-header')?.classList.remove('dragging');
    });

    fab.addEventListener('click', () => {
      const isOpen = panel.classList.toggle('open');
      fab.classList.toggle('panel-open', isOpen);
      // Reset position to default bottom-right when re-opening from FAB
      if (isOpen && panel.style.top === '') {
        panel.style.bottom = '88px';
        panel.style.right  = '28px';
      }
    });

    document.getElementById('sc-close')?.addEventListener('click', () => {
      panel.classList.remove('open');
      fab.classList.remove('panel-open');
    });

    document.getElementById('sc-add-btn')?.addEventListener('click', () => {
      ingredients.push({ id: genId(), qty: '', unit: 'cup', name: '' });
      renderIngredients();
    });

    document.getElementById('sc-save-btn')?.addEventListener('click', saveRecipe);
    document.getElementById('sc-copy-btn')?.addEventListener('click', copyScaled);
    document.getElementById('sc-new-btn')?.addEventListener('click', () => {
      ingredients = [{ id: genId(), qty: '', unit: 'cup', name: '' }];
      window._sc.currentId = null;
      setScale(1);
      renderIngredients();
      const nameEl = document.getElementById('sc-recipe-name');
      if (nameEl) nameEl.value = '';
    });

    if (isRecipePage()) {
      setTimeout(() => {
        panel.classList.add('open');
        fab.classList.add('panel-open');
      }, 800);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
