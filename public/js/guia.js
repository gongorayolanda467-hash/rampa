// Calculadora, carta modelo e ilustraciones de la guía. Solo inserta texto fijo y números calculados.
document.addEventListener('DOMContentLoaded', () => {

(function(){
  const $ = id => document.getElementById(id);
  const ftin = inches => {
    const ft = Math.floor(inches/12), i = Math.round(inches - ft*12);
    return i === 12 ? (ft+1)+"' 0\"" : ft+"' "+i+'"';
  };
  const m = inches => (inches*0.0254).toFixed(2)+' m';
  const widths = {manual:36, power:44, walker:36, senior:36, vision:36};

  function calc(){
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const R = clamp(parseFloat($('rise').value)||0, 0, 120);
    const s = [12,16,20].includes(parseInt($('slope').value,10)) ? parseInt($('slope').value,10) : 12;
    const space = clamp(parseFloat($('space').value)||0, 0, 200)*12;
    const user = widths[$('user').value] ? $('user').value : 'manual';
    const L = R*s;
    const n = Math.max(1, Math.ceil(R/30));
    const seg = L/n;
    const landings = n+1;
    const total = L + landings*60;
    const rails = R > 6;
    const width = widths[user];

    $('results').innerHTML = [
      ['Largo de rampa', ftin(L), m(L)],
      ['Tramos', n, 'de '+ftin(seg)+' c/u'],
      ['Descansos', landings, '60" de largo c/u'],
      ['Largo total en línea recta', ftin(total), m(total)],
      ['Ancho libre sugerido', width+'"', m(width)]
    ].map(r => '<div class="res"><span class="k">'+r[0]+'</span><span class="v">'+r[1]+'</span><span class="s">'+r[2]+'</span></div>').join('');

    const pills = [];
    pills.push(rails ? '<span class="pill req">Pasamanos en ambos lados: obligatorio</span>' : '<span class="pill ok">Pasamanos: opcional (≤ 6")</span>');
    pills.push('<span class="pill req">Protección de borde: obligatoria</span>');
    if(n>1) pills.push('<span class="pill req">'+(n-1)+' descanso(s) intermedio(s)</span>');
    if(s===12 && (user==='manual'||user==='senior')) pills.push('<span class="pill info">Para este usuario se recomienda 1:16</span>');
    if(user==='power') pills.push('<span class="pill info">Descansos de giro de 60"×72" o más</span>');
    if(user==='vision') pills.push('<span class="pill info">Franjas de contraste e iluminación</span>');
    if(user==='walker') pills.push('<span class="pill info">Pasamanos aunque sea corta</span>');
    $('pills').innerHTML = pills.join('');

    let rec;
    if(R<=0){ rec = 'Escriba la elevación de la entrada.'; }
    else if(R<=6){ rec = 'Modelo recomendado: <strong>D — rampa corta de umbral</strong>.'; }
    else if(R>60){ rec = 'Con '+R+'" de elevación la rampa mide '+ftin(total)+' en total. Considere el <strong>modelo C con varios retornos</strong> o un <strong>elevador de plataforma vertical</strong>.'; }
    else if(space<=0){ rec = 'Escriba el espacio recto disponible para saber si la rampa cabe sin giros. Con un solo tramo suele bastar el <strong>modelo A</strong>; con más tramos, el <strong>B</strong> o el <strong>C</strong>.'; }
    else if(total<=space){ rec = 'Cabe en línea recta. Modelo recomendado: <strong>A — rampa recta</strong>'+(n>1?' con descanso intermedio':'')+'.'; }
    else {
      const uLen = seg + 120;
      rec = 'No cabe en línea recta ('+ftin(total)+' necesarios, '+ftin(space)+' disponibles). '+
        (n>=2 || uLen<=space ? 'Modelo recomendado: <strong>C — rampa en U</strong> (ocupa unos '+ftin(uLen)+' de largo) o <strong>B — en L</strong>.' : 'Modelo recomendado: <strong>B — en L</strong> o <strong>E — modular</strong> configurada con giros.')+
        ' Si alquila con vale, el <strong>modelo E</strong> es removible.';
    }
    $('rec').innerHTML = rec;
    draw(R,n,seg);
  }

  function draw(R,n,seg){
    const svg = $('profileSvg');
    if(R<=0){ svg.innerHTML=''; return; }
    const pieces = [{t:'land',len:60,rise:0}];
    for(let i=0;i<n;i++){ pieces.push({t:'ramp',len:seg,rise:R/n}); pieces.push({t:'land',len:60,rise:0}); }
    const totalLen = pieces.reduce((a,p)=>a+p.len,0);
    const W=900, H=200, pad=30, base=160;
    const sx = (W-2*pad)/totalLen;
    const sy = Math.min(sx*3, 110/Math.max(R,1)); // altura exagerada para que se vea
    let x=pad, y=0, out='';
    out += '<line class="ground" x1="'+pad+'" y1="'+base+'" x2="'+(W-pad)+'" y2="'+base+'"/>';
    pieces.forEach(p=>{
      const x2 = x + p.len*sx, y2 = y + p.rise;
      const a = base - y*sy, b = base - y2*sy;
      out += '<polygon class="'+p.t+'" points="'+x.toFixed(1)+','+base+' '+x.toFixed(1)+','+a.toFixed(1)+' '+x2.toFixed(1)+','+b.toFixed(1)+' '+x2.toFixed(1)+','+base+'"/>';
      const label = p.t==='land' ? '5\'' : ftin(p.len);
      out += '<text x="'+((x+x2)/2).toFixed(1)+'" y="'+(base+22)+'" text-anchor="middle" font-size="12">'+label+'</text>';
      x=x2; y=y2;
    });
    out += '<rect class="house" x="'+(W-pad)+'" y="'+(base - R*sy - 40).toFixed(1)+'" width="'+pad+'" height="'+(R*sy+40).toFixed(1)+'"/>';
    out += '<text x="'+pad+'" y="18" font-size="12">Perfil lateral · altura exagerada para mejor lectura · sube '+R+'"</text>';
    svg.innerHTML = out;
  }

  ['rise','slope','space','user'].forEach(id => $(id).addEventListener('input', calc));
  document.querySelectorAll('.cost').forEach(el => {
    const faded = el.querySelector('span') ? el.querySelector('span').textContent.length : 0;
    const n = (el.textContent.match(/\$/g) || []).length - faded;
    const note = document.createElement('small');
    note.className = 'muted';
    note.textContent = ' · nivel ' + n + ' de 4';
    el.appendChild(note);
  });
  calc();

  $('copyBtn').addEventListener('click', () => {
    const text = $('letter').innerText;
    const done = msg => { $('copyMsg').textContent = msg; };
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(()=>done('Carta copiada.'), ()=>{ selectLetter(); done('Texto seleccionado. Use Ctrl+C para copiar.'); });
    } else { selectLetter(); done('Texto seleccionado. Use Ctrl+C para copiar.'); }
  });
  function selectLetter(){ const r=document.createRange(); r.selectNodeContents($('letter')); const s=getSelection(); s.removeAllRanges(); s.addRange(r); }
})();


/* Ilustraciones de fachada con rampa: vista frontal, colores propios de cada material */
(function(){
  const G = 262, P = 200, H = 34;

  const patterns = id => `
    <pattern id="${id}-brick" width="20" height="10" patternUnits="userSpaceOnUse">
      <rect width="20" height="10" fill="#9A4B33"/><path d="M0 0H20M0 5H20M0 10H20M5 0V5M15 5V10" stroke="#D9C8B4" stroke-width="1"/></pattern>
    <pattern id="${id}-brick2" width="20" height="10" patternUnits="userSpaceOnUse">
      <rect width="20" height="10" fill="#A65A3E"/><path d="M0 0H20M0 5H20M0 10H20M5 0V5M15 5V10" stroke="#E2D3C0" stroke-width="1"/></pattern>
    <pattern id="${id}-stone" width="30" height="14" patternUnits="userSpaceOnUse">
      <rect width="30" height="14" fill="#BDB6A8"/><path d="M0 0H30M0 7H30M10 0V7M25 7V14" stroke="#9C958A" stroke-width="1"/></pattern>
    <pattern id="${id}-wall" width="30" height="16" patternUnits="userSpaceOnUse">
      <rect width="30" height="16" fill="#8E8A7E"/><path d="M0 0H30M0 8H30M12 0V8M27 8V16" stroke="#6F6B61" stroke-width="1"/></pattern>
    <pattern id="${id}-clap" width="10" height="9" patternUnits="userSpaceOnUse">
      <rect width="10" height="9" fill="#9DBBCF"/><path d="M0 8.5H10" stroke="#7E9DB2" stroke-width="1"/></pattern>
    <pattern id="${id}-modern" width="10" height="10" patternUnits="userSpaceOnUse">
      <rect width="10" height="10" fill="#5F6670"/><path d="M9.5 0V10" stroke="#4D535B" stroke-width="1"/></pattern>
    <pattern id="${id}-lattice" width="10" height="10" patternUnits="userSpaceOnUse">
      <rect width="10" height="10" fill="#4E544A"/><path d="M0 0L10 10M10 0L0 10" stroke="#F4F2EC" stroke-width="2.2"/></pattern>
    <pattern id="${id}-skirt" width="16" height="10" patternUnits="userSpaceOnUse">
      <rect width="16" height="10" fill="#4B3B2E"/><path d="M15.5 0V10" stroke="#382C22" stroke-width="1"/></pattern>
    <pattern id="${id}-cedar" width="10" height="7" patternUnits="userSpaceOnUse">
      <rect width="10" height="7" fill="#B07A4C"/><path d="M0 6.5H10" stroke="#8A5C36" stroke-width="1"/></pattern>
    <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9DCE8"/><stop offset="1" stop-color="#EEF2EF"/></linearGradient>`;

  const surfY = (x, rs) => x <= rs ? G : x >= 240 ? P : G - (x - rs) * (G - P) / (240 - rs);

  function house(id, t){
    const wall = {brick:`url(#${id}-brick)`, clap:`url(#${id}-clap)`, stone:`url(#${id}-stone)`, modern:`url(#${id}-modern)`}[t];
    let s = '';
    if(t === 'modern'){
      s += `<rect x="300" y="44" width="180" height="${G-44}" fill="${wall}"/><rect x="294" y="36" width="192" height="12" fill="#2F343A"/>`;
    } else {
      const roof = t==='clap' ? '#5B6670' : t==='stone' ? '#3E4A52' : '#4A3A33';
      s += `<rect x="300" y="60" width="180" height="${G-60}" fill="${wall}"/><polygon points="288,62 390,14 492,62" fill="${roof}"/>`;
      if(t==='stone') s += `<rect x="300" y="60" width="180" height="8" fill="#D8D2C4"/>`;
    }
    const trim = t==='modern' ? '#2F343A' : '#F2EEE6';
    const door = {brick:'#2E4A3C', clap:'#7A2E2E', stone:'#1F2D3A', modern:'#B8763E'}[t];
    s += `<rect x="318" y="114" width="40" height="86" fill="${trim}"/><rect x="322" y="118" width="32" height="82" fill="${door}"/>
          <circle cx="348" cy="160" r="2" fill="#D9B45A"/>
          <rect x="392" y="96" width="62" height="66" fill="${trim}"/><rect x="397" y="101" width="52" height="56" fill="#F3E3B0"/>
          <path d="M423 101V157M397 129H449" stroke="${trim}" stroke-width="3"/>`;
    if(t!=='modern') s += `<path d="M318 112H358" stroke="${trim}" stroke-width="4"/>`;
    return s;
  }

  function shrub(x, y, r, c){
    return `<circle cx="${x-r*.6}" cy="${y-r*.5}" r="${r*.75}" fill="${c}"/><circle cx="${x+r*.6}" cy="${y-r*.5}" r="${r*.75}" fill="${c}"/><circle cx="${x}" cy="${y-r}" r="${r}" fill="${c}"/>`;
  }
  function flowers(x, y, c){ return [0,1,2].map(i=>`<circle cx="${x+i*5-5}" cy="${y-(i%2)*4}" r="2.2" fill="${c}"/>`).join(''); }

  function rail(type, rs){
    const top = x => surfY(x, rs) - H;
    const path = `M${rs-12} ${G-H} H${rs} L240 ${P-H} H300`;
    let s = '';
    const xs = []; for(let x = rs; x <= 300; x += (type==='iron'?11:type==='white'?10:type==='bronze'?16:0) || 1000) xs.push(x);
    if(type==='iron' || type==='white' || type==='bronze'){
      const c = type==='white' ? '#FFFFFF' : type==='iron' ? '#1D1D1D' : '#3E3026';
      const w = type==='white' ? 3 : 1.6;
      xs.forEach(x => { s += `<line x1="${x}" y1="${surfY(x,rs)}" x2="${x}" y2="${top(x)}" stroke="${c}" stroke-width="${w}"/>`; });
      [rs, (rs+240)/2, 240, 300].forEach(x => { s += `<rect x="${x-3}" y="${top(x)-4}" width="6" height="${H+4}" fill="${c}" ${type==='white'?'stroke="#C9C7C0" stroke-width=".8"':''}/>`; });
      s += `<path d="${path}" stroke="${c}" stroke-width="${type==='white'?5:3.5}" fill="none" stroke-linecap="round"/>`;
      if(type==='white') s += `<path d="${path}" stroke="#C9C7C0" stroke-width=".8" fill="none" transform="translate(0,-2.5)"/>`;
      if(type==='iron') [rs+33, rs+99, 270].forEach(x=>{ s += `<circle cx="${x}" cy="${(surfY(x,rs)+top(x))/2}" r="5" fill="none" stroke="#1D1D1D" stroke-width="1.4"/>`; });
    }
    if(type==='glass'){
      const segs = [[rs, (rs+240)/2], [(rs+240)/2, 240], [240, 300]];
      segs.forEach(([a,b]) => {
        s += `<polygon points="${a+2},${surfY(a,rs)-3} ${b-2},${surfY(b,rs)-3} ${b-2},${top(b)+4} ${a+2},${top(a)+4}" fill="#BFE0EC" fill-opacity=".55" stroke="#8FB3C2" stroke-width="1"/>`;
      });
      s += `<path d="${path}" stroke="#C7CDD2" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
      s += `<path d="M${rs} ${G-H+4} L240 ${P-H+4} H300" stroke="#FFE7A3" stroke-width="2" fill="none" opacity=".9"/>`;
    }
    if(type==='cable'){
      [rs, rs+50, rs+100, rs+150, 240, 300].forEach(x => { s += `<rect x="${x-3}" y="${top(x)-3}" width="6" height="${H+3}" fill="#7E5230"/>`; });
      [8, 16, 24].forEach(d => { s += `<path d="M${rs} ${G-d} L240 ${P-d} H300" stroke="#5C6166" stroke-width="1" fill="none"/>`; });
      s += `<path d="${path}" stroke="#7E5230" stroke-width="4.5" fill="none"/>`;
    }
    return s;
  }

  const scenes = {
    jardin: id => {
      const rs = 8;
      let s = house(id, 'brick');
      s += `<polygon points="${rs},${G} 240,${P} 300,${P} 300,${G}" fill="#6F8D58"/>`;
      s += `<polygon points="${rs+30},${G} 240,${P+8} 300,${P+8} 300,${G}" fill="url(#${id}-wall)"/>`;
      s += `<path d="M${rs} ${G} L240 ${P} H300" stroke="#B79C83" stroke-width="7" fill="none"/>`;
      s += `<path d="M${rs} ${G-3.5} L240 ${P-3.5} H300" stroke="#9C8068" stroke-width="1" stroke-dasharray="6 3" fill="none"/>`;
      [[70,G-6,10,'#4F7A45'],[130,G-10,12,'#5E8A4E'],[190,G-14,11,'#4F7A45'],[270,G-12,14,'#466E3E']].forEach(a => s += shrub(...a));
      s += flowers(100, G-10, '#E7A3B5') + flowers(160, G-16, '#F2D16B') + flowers(225, G-18, '#E7A3B5');
      [60, 160, 250].forEach(x => { const y = surfY(x, rs); s += `<rect x="${x-2}" y="${y-18}" width="4" height="14" fill="#2B2B2B"/><circle cx="${x}" cy="${y-19}" r="4" fill="#FFE7A3"/>`; });
      s += `<text x="12" y="24" font-size="12" font-weight="600" fill="#2A3640">Pendiente 1:20 · sin pasamanos</text>`;
      return s;
    },
    ladrillo: id => {
      const rs = 40;
      let s = house(id, 'brick');
      s += `<polygon points="${rs},${G} 240,${P} 300,${P} 300,${G}" fill="url(#${id}-brick2)"/>`;
      s += `<path d="M${rs-2} ${G+1} L240 ${P-1} H302" stroke="#E3DCCB" stroke-width="6" fill="none"/>`;
      s += rail('iron', rs);
      s += shrub(60, G, 9, '#4F7A45') + shrub(285, G, 12, '#466E3E');
      return s;
    },
    moderno: id => {
      const rs = 40;
      let s = house(id, 'modern');
      s += `<polygon points="${rs},${G} 240,${P} 300,${P} 300,${G}" fill="#B9B7B1"/>`;
      s += `<path d="M120 ${G} V${surfY(120,rs)} M200 ${G} V${surfY(200,rs)}" stroke="#A3A19B" stroke-width="1"/>`;
      s += `<path d="M${rs} ${G} L240 ${P} H300" stroke="#D3D1CB" stroke-width="5" fill="none"/>`;
      s += rail('glass', rs);
      s += `<rect x="20" y="${G-30}" width="16" height="30" fill="#3E4A3F"/>` + shrub(28, G-28, 7, '#6B8F5E');
      return s;
    },
    porche: id => {
      const rs = 40;
      let s = house(id, 'clap');
      s += `<polygon points="${rs},${G} 240,${P} 300,${P} 300,${G}" fill="url(#${id}-lattice)"/>`;
      s += `<path d="M${rs} ${G} L240 ${P} H302" stroke="#8A6B52" stroke-width="6" fill="none"/>`;
      s += `<path d="M${rs} ${G-1} H300" stroke="#F4F2EC" stroke-width="4"/>`;
      s += rail('white', rs);
      [[70,90],[140,160],[210,230]].forEach(([a,b]) => { s += `<rect x="${a}" y="${G-16}" width="${b-a}" height="16" fill="#F4F2EC" stroke="#C9C7C0" stroke-width=".8"/>` + shrub((a+b)/2, G-14, 8, '#5E8A4E') + flowers((a+b)/2, G-24, '#C9506A'); });
      return s;
    },
    aluminio: id => {
      const rs = 40;
      let s = house(id, 'stone');
      s += `<polygon points="${rs},${G} 240,${P} 300,${P} 300,${G}" fill="url(#${id}-skirt)"/>`;
      s += `<path d="M${rs} ${G} L240 ${P} H300" stroke="#6E5C4A" stroke-width="5" fill="none"/>`;
      s += rail('bronze', rs);
      [[90,G,11,'#3F6B3A'],[150,G,13,'#4F7A45'],[215,G,12,'#3F6B3A'],[275,G,13,'#4F7A45']].forEach(a => s += shrub(...a));
      return s;
    },
    cedro: id => {
      const rs = 40;
      let s = house(id, 'clap').replace(/#9DBBCF/g,'#E9E4D8');
      s += `<polygon points="${rs},${G} 240,${P} 300,${P} 300,${G}" fill="url(#${id}-cedar)"/>`;
      s += `<path d="M${rs} ${G} L240 ${P} H300" stroke="#8A5C36" stroke-width="5" fill="none"/>`;
      s += `<rect x="244" y="110" width="6" height="${P-110}" fill="#8A5C36"/><rect x="292" y="110" width="6" height="${P-110}" fill="#8A5C36"/>`;
      s += `<rect x="230" y="104" width="76" height="7" fill="#7A4F2E"/>` + [236,250,264,278,292].map(x=>`<rect x="${x}" y="98" width="4" height="6" fill="#7A4F2E"/>`).join('');
      s += `<path d="M247 112 C 240 130, 256 140, 246 160" stroke="#5E8A4E" stroke-width="3" fill="none"/>` + flowers(248, 128, '#B86BC4') + flowers(250, 150, '#B86BC4');
      s += rail('cable', rs);
      s += shrub(70, G, 9, '#5E8A4E');
      return s;
    }
  };

  document.querySelectorAll('[data-scene]').forEach((el, i) => {
    const key = el.dataset.scene, id = 'sc' + i;
    el.innerHTML = `<svg viewBox="0 0 480 300" role="img" aria-label="Ilustración: ${el.parentElement.querySelector('h3').textContent}">
      <defs>${patterns(id)}</defs>
      <rect width="480" height="300" fill="url(#${id}-sky)"/>
      <ellipse cx="120" cy="${G}" rx="150" ry="60" fill="#C5D4C0"/>
      ${scenes[key](id)}
      <rect x="0" y="${G}" width="480" height="${300-G}" fill="#7E9A6A"/>
      <rect x="0" y="${G+14}" width="480" height="${300-G-14}" fill="#CBC7BE"/>
      <path d="M0 ${G+14}H480" stroke="#B3AFA6"/>
    </svg>`;
  });
})();

});
