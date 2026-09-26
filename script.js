/* Ramnik — Minecraft-themed portfolio
   Generates the pixel textures + terrain, and drives the animations. */
(function () {
  'use strict';

  var root = document.documentElement;
  var body = document.body;
  var TIME = body.dataset.time || 'day';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- helpers ---------- */

  // small seeded PRNG so the world looks the same on every visit
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }

  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h || w;
    return c;
  }

  /* ---------- 16x16 block textures ---------- */

  var PAL = {
    grass:   ['#5b8a31', '#6aa03b', '#77b045', '#4f7a2b', '#66993a'],
    dirt:    ['#866043', '#79553a', '#966c4a', '#6f4d34', '#8c6647'],
    stone:   ['#7f7f7f', '#747474', '#8a8a8a', '#6b6b6b', '#838383'],
    deep:    ['#4d4d52', '#45454a', '#55555b', '#3c3c41', '#505055'],
    bark:    ['#6b5130', '#5a4428', '#7a5e39', '#4f3b22'],
    leaves:  ['#3f7f1f', '#4a8f24', '#356b1a', '#2f6116', '#56a02c'],
    planks:  ['#a2824e', '#9c7c4a', '#ad8c57', '#94744a'],
    bedrock: ['#1e1e1e', '#3a3a3a', '#555555', '#2a2a2a', '#6a6a6a'],
    button:  ['#707070', '#6a6a6a', '#767676', '#666666']
  };

  var ORES = [
    { c: ['#1f1f1f', '#333333'], w: 5 },            // coal
    { c: ['#d8af93', '#b08466'], w: 3 },            // iron
    { c: ['#ff1e1e', '#b00000', '#ff6b6b'], w: 3 }, // redstone
    { c: ['#fcee4b', '#d9a52a'], w: 1.5 },          // gold
    { c: ['#5decf5', '#a1fbe8', '#1aaaa7'], w: 1 }, // diamond
    { c: ['#17dd62', '#0e9a44'], w: 0.5 }           // emerald
  ];

  function noiseFill(ctx, x0, y0, w, h, colors, r) {
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        ctx.fillStyle = pick(r, colors);
        ctx.fillRect(x0 + x, y0 + y, 1, 1);
      }
    }
  }

  function tex(kind, seed) {
    var r = rng(seed);
    var c = canvas(16);
    var ctx = c.getContext('2d');
    var x, y;

    switch (kind) {
      case 'grass':
        noiseFill(ctx, 0, 0, 16, 16, PAL.dirt, r);
        for (x = 0; x < 16; x++) {
          var d = 3 + Math.floor(r() * 3);
          for (y = 0; y < d; y++) {
            ctx.fillStyle = y === 0 ? pick(r, ['#7cbf4b', '#86c957', '#77b045']) : pick(r, PAL.grass);
            ctx.fillRect(x, y, 1, 1);
          }
        }
        break;
      case 'log':
        for (x = 0; x < 16; x++) {
          var col = PAL.bark[x % 4 === 0 ? 3 : Math.floor(r() * 3)];
          for (y = 0; y < 16; y++) {
            ctx.fillStyle = r() < 0.2 ? pick(r, PAL.bark) : col;
            ctx.fillRect(x, y, 1, 1);
          }
        }
        break;
      case 'leaves':
        for (y = 0; y < 16; y++) {
          for (x = 0; x < 16; x++) {
            if (r() < 0.09) continue;
            ctx.fillStyle = pick(r, PAL.leaves);
            ctx.fillRect(x, y, 1, 1);
          }
        }
        break;
      case 'planks':
        noiseFill(ctx, 0, 0, 16, 16, PAL.planks, r);
        ctx.fillStyle = '#6e5433';
        for (y = 3; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
        for (y = 0; y < 4; y++) ctx.fillRect(Math.floor(r() * 14) + 1, y * 4, 1, 3);
        break;
      default:
        noiseFill(ctx, 0, 0, 16, 16, PAL[kind], r);
    }
    return c;
  }

  // a big tiling underground texture: 8x8 blocks with ore veins
  function undergroundTile(base, seed, oreChance) {
    var r = rng(seed);
    var c = canvas(128);
    var ctx = c.getContext('2d');
    noiseFill(ctx, 0, 0, 128, 128, PAL[base], r);
    var total = ORES.reduce(function (s, o) { return s + o.w; }, 0);
    for (var by = 0; by < 8; by++) {
      for (var bx = 0; bx < 8; bx++) {
        if (r() > oreChance) continue;
        var roll = r() * total, ore = ORES[0];
        for (var i = 0; i < ORES.length; i++) {
          roll -= ORES[i].w;
          if (roll <= 0) { ore = ORES[i]; break; }
        }
        var blobs = 3 + Math.floor(r() * 3);
        for (var b = 0; b < blobs; b++) {
          var ox = bx * 16 + 2 + Math.floor(r() * 11);
          var oy = by * 16 + 2 + Math.floor(r() * 11);
          ctx.fillStyle = ore.c[0];
          ctx.fillRect(ox, oy, 2, 2);
          ctx.fillStyle = pick(r, ore.c);
          ctx.fillRect(ox + 1, oy, 1, 1);
        }
      }
    }
    return c;
  }

  var T = {};
  ['grass', 'dirt', 'stone', 'log', 'leaves'].forEach(function (k) {
    T[k] = [0, 1, 2, 3].map(function (i) { return tex(k, 100 + i * 17 + k.length); });
  });

  function setTex(name, c) {
    root.style.setProperty('--tex-' + name, 'url(' + c.toDataURL() + ')');
  }

  setTex('stone', tex('stone', 7));
  setTex('dirt', tex('dirt', 9));
  setTex('planks', tex('planks', 11));
  setTex('bedrock', tex('bedrock', 13));
  setTex('button', tex('button', 15));
  setTex('under', TIME === 'night'
    ? undergroundTile('deep', 21, 0.3)
    : undergroundTile('stone', 23, 0.16));

  /* ---------- loading screen (first visit per session) ---------- */

  if (root.classList.contains('first-load')) {
    var loader = document.createElement('div');
    loader.className = 'loader';
    loader.innerHTML =
      '<p>Loading world</p>' +
      '<div class="loader-bar"><span></span></div>' +
      '<p class="loader-sub">Building terrain</p>';
    body.appendChild(loader);
    root.classList.remove('first-load');

    var steps = ['Building terrain', 'Placing ores', 'Planting trees', 'Spawning Ramnik'];
    var sub = loader.querySelector('.loader-sub');
    steps.forEach(function (s, i) {
      setTimeout(function () { sub.textContent = s; }, i * 280);
    });
    setTimeout(function () {
      loader.classList.add('done');
      setTimeout(function () { loader.remove(); }, 500);
    }, 1250);
    try { sessionStorage.setItem('world-loaded', '1'); } catch (e) {}
  }

  /* ---------- terrain ---------- */

  var TINT = {
    day: null,
    dusk: 'rgba(80, 30, 70, 0.38)',
    night: 'rgba(6, 10, 34, 0.62)'
  };

  var HILL_COLOR = {
    day: '#9cc6e6',
    dusk: '#7c3f6e',
    night: '#0f1733'
  };

  function sizeCanvas(c) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = c.clientWidth, h = c.clientHeight;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    var ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    return { ctx: ctx, w: w, h: h };
  }

  function heights(cols, seed, base, amp) {
    var r = rng(seed);
    var p1 = r() * 6, p2 = r() * 6;
    var out = [];
    for (var i = 0; i < cols; i++) {
      var v = base + amp * Math.sin(i * 0.33 + p1) + amp * 0.7 * Math.sin(i * 0.12 + p2);
      out.push(Math.max(1, Math.round(v)));
    }
    return out;
  }

  function treeAllowed(x, w) {
    var zone = body.dataset.trees;
    if (zone === 'edges') return x < w * 0.16 || x > w * 0.84;
    if (zone === 'right') return w < 640 ? x > w * 0.8 : x > w * 0.6;
    return true;
  }

  function drawHills(c) {
    var s = sizeCanvas(c);
    var B = s.w < 640 ? 24 : 32;
    var cols = Math.ceil(s.w / B) + 1;
    var hs = heights(cols, 5, 6, 1.8);
    var ctx = s.ctx;
    ctx.clearRect(0, 0, s.w, s.h);
    ctx.fillStyle = HILL_COLOR[TIME];
    for (var i = 0; i < cols; i++) {
      var top = s.h - hs[i] * B;
      ctx.fillRect(i * B, top, B, s.h - top);
    }
    // a lighter band to fake distance fog
    var g = ctx.createLinearGradient(0, s.h - 8 * B, 0, s.h);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, TIME === 'night' ? 'rgba(40,60,120,0.25)' : 'rgba(255,255,255,0.22)');
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s.w, s.h);
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawTerrain(c) {
    var s = sizeCanvas(c);
    var B = s.w < 640 ? 24 : 32;
    var cols = Math.ceil(s.w / B) + 1;
    var rows = Math.ceil(s.h / B);
    var hs = heights(cols, 42, 3.2, 1.1);
    var r = rng(99);
    var ctx = s.ctx;
    ctx.clearRect(0, 0, s.w, s.h);

    function block(set, col, row) {
      var t = set[(col * 7 + row * 13) % set.length];
      ctx.drawImage(t, col * B, s.h - (row + 1) * B, B, B);
    }

    for (var i = 0; i < cols; i++) {
      var h = hs[i];
      for (var row = 0; row < h; row++) {
        var fromTop = h - 1 - row;
        var set = fromTop === 0 ? T.grass : fromTop < 3 ? T.dirt : T.stone;
        block(set, i, row);
      }
    }

    // trees
    var lastTree = -10;
    for (i = 2; i < cols - 2; i++) {
      if (i - lastTree < 6 || r() > 0.35 || !treeAllowed(i * B, s.w)) continue;
      var g = hs[i];
      var trunk = 3 + (r() < 0.5 ? 1 : 0);
      if (g + trunk + 2 > rows) continue;
      lastTree = i;
      for (var k = 0; k < trunk; k++) block(T.log, i, g + k);
      var top = g + trunk;
      for (var dx = -2; dx <= 2; dx++) {
        for (var dy = -2; dy <= -1; dy++) {
          if (dx === 0 && dy >= -2 && dy < 0) continue; // trunk goes through
          if (Math.abs(dx) === 2 && dy === -2 && r() < 0.5) continue;
          block(T.leaves, i + dx, top + dy);
        }
      }
      for (dx = -1; dx <= 1; dx++) block(T.leaves, i + dx, top);
      block(T.leaves, i, top + 1);
    }

    // time-of-day lighting
    if (TINT[TIME]) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = TINT[TIME];
      ctx.fillRect(0, 0, s.w, s.h);
      if (TIME === 'dusk') {
        // warm rim light from the setting sun
        var g2 = ctx.createRadialGradient(s.w * 0.62, s.h * 0.2, 10, s.w * 0.62, s.h * 0.2, s.w * 0.5);
        g2.addColorStop(0, 'rgba(255,140,60,0.35)');
        g2.addColorStop(1, 'rgba(255,140,60,0)');
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, s.w, s.h);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  var hillsEl = document.querySelector('.hills');
  var terrainEl = document.querySelector('.terrain');

  function drawWorld() {
    if (hillsEl) drawHills(hillsEl);
    if (terrainEl) drawTerrain(terrainEl);
  }

  drawWorld();
  var lastW = window.innerWidth, resizeTimer;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return; // ignore mobile URL-bar height changes
    lastW = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawWorld, 120);
  });

  /* ---------- clouds ---------- */

  var cloudsEl = document.querySelector('.clouds');
  if (cloudsEl) {
    var cr = rng(3);
    var n = TIME === 'night' ? 4 : 7;
    for (var ci = 0; ci < n; ci++) {
      var cl = document.createElement('div');
      cl.className = 'cloud';
      var cw = 90 + Math.floor(cr() * 7) * 24;
      cl.style.width = cw + 'px';
      cl.style.top = (24 + cr() * 150) + 'px';
      var dur = 70 + cr() * 80;
      cl.style.animationDuration = dur + 's';
      cl.style.animationDelay = (-cr() * dur) + 's';
      // blocky bumps on top
      var bumps = 1 + Math.floor(cr() * 3);
      for (var bi = 0; bi < bumps; bi++) {
        var bump = document.createElement('i');
        var bw = 24 + Math.floor(cr() * 3) * 16;
        bump.style.width = bw + 'px';
        bump.style.height = '14px';
        bump.style.top = '-14px';
        bump.style.left = Math.floor(cr() * (cw - bw)) + 'px';
        cl.appendChild(bump);
      }
      cloudsEl.appendChild(cl);
    }
  }

  /* ---------- stars, shooting stars, fireflies ---------- */

  var starsEl = document.querySelector('.stars');
  if (starsEl) {
    var sr = rng(8);
    var count = TIME === 'night' ? 110 : 35;
    for (var si = 0; si < count; si++) {
      var st = document.createElement('span');
      st.className = 'star' + (sr() < 0.12 ? ' big' : '');
      st.style.left = (sr() * 100) + '%';
      st.style.top = (sr() * (TIME === 'night' ? 70 : 100)) + '%';
      st.style.animationDuration = (1.5 + sr() * 3) + 's';
      st.style.animationDelay = (-sr() * 4) + 's';
      starsEl.appendChild(st);
    }

    if (TIME === 'night' && !reduceMotion) {
      (function shoot() {
        var ss = document.createElement('span');
        ss.className = 'shooting-star';
        ss.style.left = (Math.random() * 60) + '%';
        ss.style.top = (20 + Math.random() * 30) + '%';
        starsEl.appendChild(ss);
        setTimeout(function () { ss.remove(); }, 1200);
        setTimeout(shoot, 4000 + Math.random() * 6000);
      })();
    }
  }

  var fliesEl = document.querySelector('.fireflies');
  if (fliesEl) {
    var fr = rng(12);
    for (var fi = 0; fi < 18; fi++) {
      var ff = document.createElement('span');
      ff.className = 'firefly';
      ff.style.left = (fr() * 100) + '%';
      ff.style.bottom = (60 + fr() * 180) + 'px';
      ff.style.animationDuration = (5 + fr() * 6) + 's, ' + (1.2 + fr() * 2) + 's';
      ff.style.animationDelay = (-fr() * 6) + 's, ' + (-fr() * 2) + 's';
      fliesEl.appendChild(ff);
    }
  }

  /* ---------- parallax ---------- */

  var sunEl = document.querySelector('.celestial');
  var ticking = false;
  function parallax() {
    var y = window.scrollY;
    if (hillsEl) hillsEl.style.transform = 'translateY(' + y * 0.18 + 'px)';
    if (cloudsEl) cloudsEl.style.transform = 'translateY(' + y * 0.3 + 'px)';
    if (sunEl) sunEl.style.translate = '0 ' + y * 0.4 + 'px';
    ticking = false;
  }
  if (!reduceMotion) {
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(parallax); }
    }, { passive: true });
  }

  /* ---------- title letters drop in like sand ---------- */

  document.querySelectorAll('h1.title').forEach(function (h1) {
    var text = h1.textContent;
    h1.setAttribute('aria-label', text);
    h1.textContent = '';
    // group letters by word so long titles only wrap between words
    var i = 0;
    text.split(' ').forEach(function (word, w) {
      if (w > 0) h1.appendChild(document.createTextNode(' '));
      var wordEl = document.createElement('span');
      wordEl.className = 'word';
      wordEl.setAttribute('aria-hidden', 'true');
      Array.prototype.forEach.call(word, function (ch) {
        var span = document.createElement('span');
        span.className = 'ch';
        span.style.setProperty('--i', i++);
        span.textContent = ch;
        wordEl.appendChild(span);
      });
      h1.appendChild(wordEl);
    });
  });

  /* ---------- splash text ---------- */

  var splash = document.querySelector('.splash');
  if (splash) {
    var splashes = [
      'Ohm my god!', 'Now with more MOSFETs!', 'Powered by ESP32!',
      'No snoozing allowed!', 'Redstone certified!', 'Also try VHDL!',
      '100% pixel perfect!', 'Resistance is futile!', 'Hire me for co-op!',
      'Current-ly building!', 'Made with solder!', 'Low impedance!'
    ];
    var si2 = Math.floor(Math.random() * splashes.length);
    splash.textContent = splashes[si2];
    splash.addEventListener('click', function () {
      si2 = (si2 + 1 + Math.floor(Math.random() * (splashes.length - 1))) % splashes.length;
      splash.textContent = splashes[si2];
    });
  }

  /* ---------- pixel item icons ---------- */

  var ICONS = {
    book: {
      p: { b: '#3b2210', r: '#8b3a2a', R: '#a8503a', y: '#e2b33c', w: '#f1e6c8' },
      m: ['.bbbbbb.', 'bRrrrrrb', 'brryyrrb', 'brrrrrrb', 'brrrrrrb', 'brrrrrrb', 'bwwwwwwb', '.bbbbbb.']
    },
    redstone: {
      p: { r: '#ff2a2a', d: '#8a0000', l: '#ff8a8a' },
      m: ['........', '..r..d..', '.rld.rr.', '..drrr..', '.r.rld..', '.dr..rr.', '..rd..d.', '........']
    },
    pickaxe: {
      p: { d: '#4fe3d6', D: '#1d9e94', l: '#b6fff8', s: '#7a5a2f', S: '#4a3418' },
      m: ['.ldddD..', 'd....DD.', '.....sDD', '....s..D', '...s....', '..S.....', '.S......', 'S.......']
    },
    compass: {
      p: { G: '#5a5a5a', g: '#8a8a8a', w: '#d8d8d8', r: '#e02020' },
      m: ['..GGGG..', '.GgwwgG.', 'GgwwwrwG', 'GwwwrwwG', 'GwwrwwwG', 'GwrwwwgG', '.GgwwgG.', '..GGGG..']
    },
    clock: {
      p: { Y: '#9a7a18', y: '#f0cf4a', b: '#3a8ae0', g: '#3a8a2a', k: '#222' },
      m: ['..YYYY..', '.YybbyY.', 'YybbkbyY', 'YbbbkbbY', 'YgggggbY', 'YygggggY', '.YyggyY.', '..YYYY..']
    },
    chip: {
      p: { s: '#d0d0d0', k: '#1f1f1f', g: '#3fbf5f', K: '#3a3a3a' },
      m: ['.s.s.s..', 'skkkkkks', '.kKKKKk.', 'skKggKks', '.kKggKk.', 'skKKKKks', '.kkkkkk.', '.s.s.s..']
    },
    torch: {
      p: { r: '#ff7a5a', R: '#d00000', s: '#6b4a22', S: '#4a3016' },
      m: ['...rr...', '..rRRr..', '...RR...', '...sS...', '...sS...', '...sS...', '...sS...', '...sS...']
    },
    minecart: {
      p: { g: '#8d8d8d', G: '#5a5a5a', k: '#2a2a2a', l: '#b5b5b5' },
      m: ['........', 'g......g', 'glllllgg', 'gG....Gg', 'gGGGGGGg', '.gggggg.', '.kk..kk.', '.kk..kk.']
    }
  };

  document.querySelectorAll('.px-icon[data-icon]').forEach(function (el) {
    var icon = ICONS[el.dataset.icon];
    if (!icon) return;
    var rects = '';
    icon.m.forEach(function (row, y) {
      Array.prototype.forEach.call(row, function (ch, x) {
        if (icon.p[ch]) rects += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + icon.p[ch] + '"/>';
      });
    });
    el.innerHTML = '<svg viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">' + rects + '</svg>';
  });

  /* ---------- scroll reveal ---------- */

  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- block-break particles on click ---------- */

  var PARTICLES = {
    day: ['#5b8a31', '#77b045', '#866043', '#6f4d34'],
    dusk: ['#ff9a4a', '#ffcf6a', '#a2824e', '#e0702a'],
    night: ['#5decf5', '#a1fbe8', '#ff2a2a', '#e6ff7a']
  };

  if (!reduceMotion && Element.prototype.animate) {
    document.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      var colors = PARTICLES[TIME];
      for (var i = 0; i < 9; i++) {
        var p = document.createElement('span');
        p.className = 'particle';
        p.style.left = e.clientX - 3 + 'px';
        p.style.top = e.clientY - 3 + 'px';
        p.style.background = colors[i % colors.length];
        body.appendChild(p);
        var dx = (Math.random() - 0.5) * 120;
        var up = 30 + Math.random() * 50;
        var anim = p.animate([
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: 'translate(' + dx * 0.5 + 'px,' + -up + 'px) scale(1)', opacity: 1, offset: 0.35 },
          { transform: 'translate(' + dx + 'px,' + (up * 1.2) + 'px) scale(0.5)', opacity: 0 }
        ], { duration: 600 + Math.random() * 300, easing: 'cubic-bezier(.3,.6,.6,1)' });
        anim.onfinish = p.remove.bind(p);
      }
    });
  }

  /* ---------- lightbox ---------- */

  var lightbox = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightbox-img');
  if (lightbox && lightboxImg) {
    document.querySelectorAll('.zoomable').forEach(function (img) {
      img.addEventListener('click', function () {
        lightboxImg.src = img.src;
        lightboxImg.alt = img.alt;
        lightbox.classList.add('active');
      });
    });
    lightbox.addEventListener('click', function () {
      lightbox.classList.remove('active');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') lightbox.classList.remove('active');
    });
  }

  /* ---------- fade to black between pages ---------- */

  if (!reduceMotion) {
    document.querySelectorAll('a[href$=".html"]:not([target]), a[href="./"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        body.classList.add('leaving');
        setTimeout(function () { window.location.href = a.href; }, 260);
      });
    });
    window.addEventListener('pageshow', function () { body.classList.remove('leaving'); });
  }
})();
