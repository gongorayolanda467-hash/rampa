// Genera las ilustraciones (SVG), el ícono y la imagen para compartir en redes (PNG) dentro de public/img.
// Uso: npm run build:img
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'public', 'img');
fs.mkdirSync(OUT, { recursive: true });

const G = 262, P = 200, H = 34;

const patterns = id => `
  <pattern id="${id}-brick" width="20" height="10" patternUnits="userSpaceOnUse"><rect width="20" height="10" fill="#9A4B33"/><path d="M0 0H20M0 5H20M0 10H20M5 0V5M15 5V10" stroke="#D9C8B4" stroke-width="1"/></pattern>
  <pattern id="${id}-brick2" width="20" height="10" patternUnits="userSpaceOnUse"><rect width="20" height="10" fill="#A65A3E"/><path d="M0 0H20M0 5H20M0 10H20M5 0V5M15 5V10" stroke="#E2D3C0" stroke-width="1"/></pattern>
  <pattern id="${id}-stone" width="30" height="14" patternUnits="userSpaceOnUse"><rect width="30" height="14" fill="#BDB6A8"/><path d="M0 0H30M0 7H30M10 0V7M25 7V14" stroke="#9C958A" stroke-width="1"/></pattern>
  <pattern id="${id}-wall" width="30" height="16" patternUnits="userSpaceOnUse"><rect width="30" height="16" fill="#8E8A7E"/><path d="M0 0H30M0 8H30M12 0V8M27 8V16" stroke="#6F6B61" stroke-width="1"/></pattern>
  <pattern id="${id}-clap" width="10" height="9" patternUnits="userSpaceOnUse"><rect width="10" height="9" fill="__CLAP__"/><path d="M0 8.5H10" stroke="#7E9DB2" stroke-width="1"/></pattern>
  <pattern id="${id}-modern" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#5F6670"/><path d="M9.5 0V10" stroke="#4D535B" stroke-width="1"/></pattern>
  <pattern id="${id}-lattice" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#4E544A"/><path d="M0 0L10 10M10 0L0 10" stroke="#F4F2EC" stroke-width="2.2"/></pattern>
  <pattern id="${id}-skirt" width="16" height="10" patternUnits="userSpaceOnUse"><rect width="16" height="10" fill="#4B3B2E"/><path d="M15.5 0V10" stroke="#382C22" stroke-width="1"/></pattern>
  <pattern id="${id}-cedar" width="10" height="7" patternUnits="userSpaceOnUse"><rect width="10" height="7" fill="#B07A4C"/><path d="M0 6.5H10" stroke="#8A5C36" stroke-width="1"/></pattern>
  <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9DCE8"/><stop offset="1" stop-color="#EEF2EF"/></linearGradient>`;

const surfY = (x, rs) => (x <= rs ? G : x >= 240 ? P : G - (x - rs) * (G - P) / (240 - rs));

function house(id, t) {
  const wall = { brick: `url(#${id}-brick)`, clap: `url(#${id}-clap)`, stone: `url(#${id}-stone)`, modern: `url(#${id}-modern)` }[t];
  let s = '';
  if (t === 'modern') {
    s += `<rect x="300" y="44" width="180" height="${G - 44}" fill="${wall}"/><rect x="294" y="36" width="192" height="12" fill="#2F343A"/>`;
  } else {
    const roof = t === 'clap' ? '#5B6670' : t === 'stone' ? '#3E4A52' : '#4A3A33';
    s += `<rect x="300" y="60" width="180" height="${G - 60}" fill="${wall}"/><polygon points="288,62 390,14 492,62" fill="${roof}"/>`;
    if (t === 'stone') s += `<rect x="300" y="60" width="180" height="8" fill="#D8D2C4"/>`;
  }
  const trim = t === 'modern' ? '#2F343A' : '#F2EEE6';
  const door = { brick: '#2E4A3C', clap: '#7A2E2E', stone: '#1F2D3A', modern: '#B8763E' }[t];
  s += `<rect x="318" y="114" width="40" height="86" fill="${trim}"/><rect x="322" y="118" width="32" height="82" fill="${door}"/>
    <circle cx="348" cy="160" r="2" fill="#D9B45A"/>
    <rect x="392" y="96" width="62" height="66" fill="${trim}"/><rect x="397" y="101" width="52" height="56" fill="#F3E3B0"/>
    <path d="M423 101V157M397 129H449" stroke="${trim}" stroke-width="3"/>`;
  if (t !== 'modern') s += `<path d="M318 112H358" stroke="${trim}" stroke-width="4"/>`;
  return s;
}

const shrub = (x, y, r, c) => `<circle cx="${x - r * 0.6}" cy="${y - r * 0.5}" r="${r * 0.75}" fill="${c}"/><circle cx="${x + r * 0.6}" cy="${y - r * 0.5}" r="${r * 0.75}" fill="${c}"/><circle cx="${x}" cy="${y - r}" r="${r}" fill="${c}"/>`;
const flowers = (x, y, c) => [0, 1, 2].map(i => `<circle cx="${x + i * 5 - 5}" cy="${y - (i % 2) * 4}" r="2.2" fill="${c}"/>`).join('');

function rail(type, rs) {
  const top = x => surfY(x, rs) - H;
  const path = `M${rs - 12} ${G - H} H${rs} L240 ${P - H} H300`;
  let s = '';
  const step = { iron: 11, white: 10, bronze: 16 }[type];
  if (step) {
    const c = type === 'white' ? '#FFFFFF' : type === 'iron' ? '#1D1D1D' : '#3E3026';
    const w = type === 'white' ? 3 : 1.6;
    for (let x = rs; x <= 300; x += step) s += `<line x1="${x}" y1="${surfY(x, rs)}" x2="${x}" y2="${top(x)}" stroke="${c}" stroke-width="${w}"/>`;
    [rs, (rs + 240) / 2, 240, 300].forEach(x => { s += `<rect x="${x - 3}" y="${top(x) - 4}" width="6" height="${H + 4}" fill="${c}"${type === 'white' ? ' stroke="#C9C7C0" stroke-width=".8"' : ''}/>`; });
    s += `<path d="${path}" stroke="${c}" stroke-width="${type === 'white' ? 5 : 3.5}" fill="none" stroke-linecap="round"/>`;
    if (type === 'white') s += `<path d="${path}" stroke="#C9C7C0" stroke-width=".8" fill="none" transform="translate(0,-2.5)"/>`;
    if (type === 'iron') [rs + 33, rs + 99, 270].forEach(x => { s += `<circle cx="${x}" cy="${(surfY(x, rs) + top(x)) / 2}" r="5" fill="none" stroke="#1D1D1D" stroke-width="1.4"/>`; });
  }
  if (type === 'glass') {
    [[rs, (rs + 240) / 2], [(rs + 240) / 2, 240], [240, 300]].forEach(([a, b]) => {
      s += `<polygon points="${a + 2},${surfY(a, rs) - 3} ${b - 2},${surfY(b, rs) - 3} ${b - 2},${top(b) + 4} ${a + 2},${top(a) + 4}" fill="#BFE0EC" fill-opacity=".55" stroke="#8FB3C2" stroke-width="1"/>`;
    });
    s += `<path d="${path}" stroke="#C7CDD2" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    s += `<path d="M${rs} ${G - H + 4} L240 ${P - H + 4} H300" stroke="#FFE7A3" stroke-width="2" fill="none" opacity=".9"/>`;
  }
  if (type === 'cable') {
    [rs, rs + 50, rs + 100, rs + 150, 240, 300].forEach(x => { s += `<rect x="${x - 3}" y="${top(x) - 3}" width="6" height="${H + 3}" fill="#7E5230"/>`; });
    [8, 16, 24].forEach(d => { s += `<path d="M${rs} ${G - d} L240 ${P - d} H300" stroke="#5C6166" stroke-width="1" fill="none"/>`; });
    s += `<path d="${path}" stroke="#7E5230" stroke-width="4.5" fill="none"/>`;
  }
  return s;
}

const scenes = {
  jardin: id => {
    const rs = 8;
    let s = house(id, 'brick');
    s += `<polygon points="${rs},${G} 240,${P} 300,${P} 300,${G}" fill="#6F8D58"/>`;
    s += `<polygon points="${rs + 30},${G} 240,${P + 8} 300,${P + 8} 300,${G}" fill="url(#${id}-wall)"/>`;
    s += `<path d="M${rs} ${G} L240 ${P} H300" stroke="#B79C83" stroke-width="7" fill="none"/>`;
    s += `<path d="M${rs} ${G - 3.5} L240 ${P - 3.5} H300" stroke="#9C8068" stroke-width="1" stroke-dasharray="6 3" fill="none"/>`;
    [[70, G - 6, 10, '#4F7A45'], [130, G - 10, 12, '#5E8A4E'], [190, G - 14, 11, '#4F7A45'], [270, G - 12, 14, '#466E3E']].forEach(a => { s += shrub(...a); });
    s += flowers(100, G - 10, '#E7A3B5') + flowers(160, G - 16, '#F2D16B') + flowers(225, G - 18, '#E7A3B5');
    [60, 160, 250].forEach(x => { const y = surfY(x, rs); s += `<rect x="${x - 2}" y="${y - 18}" width="4" height="14" fill="#2B2B2B"/><circle cx="${x}" cy="${y - 19}" r="4" fill="#FFE7A3"/>`; });
    return s;
  },
  ladrillo: id => {
    const rs = 40;
    let s = house(id, 'brick');
    s += `<polygon points="${rs},${G} 240,${P} 300,${P} 300,${G}" fill="url(#${id}-brick2)"/>`;
    s += `<path d="M${rs - 2} ${G + 1} L240 ${P - 1} H302" stroke="#E3DCCB" stroke-width="6" fill="none"/>`;
    s += rail('iron', rs) + shrub(60, G, 9, '#4F7A45') + shrub(285, G, 12, '#466E3E');
    return s;
  },
  moderno: id => {
    const rs = 40;
    let s = house(id, 'modern');
    s += `<polygon points="${rs},${G} 240,${P} 300,${P} 300,${G}" fill="#B9B7B1"/>`;
    s += `<path d="M120 ${G} V${surfY(120, rs)} M200 ${G} V${surfY(200, rs)}" stroke="#A3A19B" stroke-width="1"/>`;
    s += `<path d="M${rs} ${G} L240 ${P} H300" stroke="#D3D1CB" stroke-width="5" fill="none"/>`;
    s += rail('glass', rs) + `<rect x="20" y="${G - 30}" width="16" height="30" fill="#3E4A3F"/>` + shrub(28, G - 28, 7, '#6B8F5E');
    return s;
  },
  porche: id => {
    const rs = 40;
    let s = house(id, 'clap');
    s += `<polygon points="${rs},${G} 240,${P} 300,${P} 300,${G}" fill="url(#${id}-lattice)"/>`;
    s += `<path d="M${rs} ${G} L240 ${P} H302" stroke="#8A6B52" stroke-width="6" fill="none"/><path d="M${rs} ${G - 1} H300" stroke="#F4F2EC" stroke-width="4"/>`;
    s += rail('white', rs);
    [[70, 90], [140, 160], [210, 230]].forEach(([a, b]) => {
      s += `<rect x="${a}" y="${G - 16}" width="${b - a}" height="16" fill="#F4F2EC" stroke="#C9C7C0" stroke-width=".8"/>` + shrub((a + b) / 2, G - 14, 8, '#5E8A4E') + flowers((a + b) / 2, G - 24, '#C9506A');
    });
    return s;
  },
  aluminio: id => {
    const rs = 40;
    let s = house(id, 'stone');
    s += `<polygon points="${rs},${G} 240,${P} 300,${P} 300,${G}" fill="url(#${id}-skirt)"/>`;
    s += `<path d="M${rs} ${G} L240 ${P} H300" stroke="#6E5C4A" stroke-width="5" fill="none"/>`;
    s += rail('bronze', rs);
    [[90, G, 11, '#3F6B3A'], [150, G, 13, '#4F7A45'], [215, G, 12, '#3F6B3A'], [275, G, 13, '#4F7A45']].forEach(a => { s += shrub(...a); });
    return s;
  },
  cedro: id => {
    const rs = 40;
    let s = house(id, 'clap');
    s += `<polygon points="${rs},${G} 240,${P} 300,${P} 300,${G}" fill="url(#${id}-cedar)"/>`;
    s += `<path d="M${rs} ${G} L240 ${P} H300" stroke="#8A5C36" stroke-width="5" fill="none"/>`;
    s += `<rect x="244" y="110" width="6" height="${P - 110}" fill="#8A5C36"/><rect x="292" y="110" width="6" height="${P - 110}" fill="#8A5C36"/>`;
    s += `<rect x="230" y="104" width="76" height="7" fill="#7A4F2E"/>` + [236, 250, 264, 278, 292].map(x => `<rect x="${x}" y="98" width="4" height="6" fill="#7A4F2E"/>`).join('');
    s += `<path d="M247 112 C 240 130, 256 140, 246 160" stroke="#5E8A4E" stroke-width="3" fill="none"/>` + flowers(248, 128, '#B86BC4') + flowers(250, 150, '#B86BC4');
    s += rail('cable', rs) + shrub(70, G, 9, '#5E8A4E');
    return s;
  },
};

const titles = {
  jardin: 'Camino de jardín en pendiente suave frente a una casa de ladrillo',
  ladrillo: 'Rampa de ladrillo con barandal negro de herrería',
  moderno: 'Rampa de concreto con barandal de vidrio frente a una casa moderna',
  porche: 'Rampa tipo porche de madera compuesta con barandal blanco y jardineras',
  aluminio: 'Rampa de aluminio color bronce con faldón y arbustos',
  cedro: 'Rampa de cedro con barandal de cable y pérgola',
};

for (const [key, fn] of Object.entries(scenes)) {
  const id = key;
  const clap = key === 'cedro' ? '#E9E4D8' : '#9DBBCF';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 300" role="img" aria-label="${titles[key]}">
<title>${titles[key]}</title>
<defs>${patterns(id).replace('__CLAP__', clap)}</defs>
<rect width="480" height="300" fill="url(#${id}-sky)"/>
<ellipse cx="120" cy="${G}" rx="150" ry="60" fill="#C5D4C0"/>
${fn(id)}
<rect x="0" y="${G}" width="480" height="${300 - G}" fill="#7E9A6A"/>
<rect x="0" y="${G + 14}" width="480" height="${300 - G - 14}" fill="#CBC7BE"/>
<path d="M0 ${G + 14}H480" stroke="#B3AFA6"/>
</svg>
`;
  fs.writeFileSync(path.join(OUT, `${key}.svg`), svg.replace(/\n\s+/g, '\n'));
}

// Ícono: rampa amarilla sobre azul de accesibilidad.
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="#1A5DA6"/>
<path d="M10 48 L42 28 H54 V48 Z" fill="#F2B705"/>
<path d="M8 50 H56" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>
<circle cx="24" cy="20" r="5" fill="#FFFFFF"/>
</svg>
`;
fs.writeFileSync(path.join(OUT, 'favicon.svg'), favicon);

// Imagen para redes (1200x630 PNG) dibujada píxel por píxel, sin dependencias.
function png(width, height, paint) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = paint(x, y);
      const o = y * (width * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = buf => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const NAVY = hex('#0F3D70'), YELLOW = hex('#F2B705'), WHITE = hex('#FFFFFF'), BRICK = hex('#9A4B33'), DOOR = hex('#2E4A3C'), LIGHT = hex('#F3E3B0'), MORTAR = hex('#D9C8B4');
const og = png(1200, 630, (x, y) => {
  // franja amarilla inferior tipo señal táctil
  if (y >= 600) return (x % 60) < 44 ? YELLOW : NAVY;
  // casa
  if (x >= 820 && x <= 1140 && y >= 200 && y < 560) {
    if (x >= 870 && x <= 950 && y >= 330 && y < 470) return DOOR;
    if (x >= 1010 && x <= 1100 && y >= 270 && y < 360) return LIGHT;
    if (y % 24 === 0 || ((Math.floor(y / 24) % 2 ? x + 24 : x) % 48 === 0)) return MORTAR;
    return BRICK;
  }
  // techo
  if (y >= 120 && y < 200 && Math.abs(x - 980) <= (y - 120) * 2.2) return hex('#4A3A33');
  // descanso y rampa
  if (y >= 470 && y < 560 && x >= 700 && x < 820) return YELLOW;
  if (x >= 160 && x < 700 && y < 560 && y >= 560 - (x - 160) * (90 / 540)) return YELLOW;
  // pasamanos
  const railY = 560 - (x - 160) * (90 / 540) - 70;
  if (x >= 150 && x < 700 && Math.abs(y - railY) < 4) return WHITE;
  if (x >= 700 && x < 820 && Math.abs(y - 400) < 4) return WHITE;
  // suelo
  if (y >= 560) return hex('#0B2F57');
  return NAVY;
});
fs.writeFileSync(path.join(OUT, 'og-image.png'), og);

console.log('Imágenes generadas en', OUT);
