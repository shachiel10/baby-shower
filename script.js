/* ============ CONFIGURACIÓN ============ */
// Pega aquí la URL de tu Web App de Google Apps Script (termina en /exec) nuevo
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzZCH8U14MRa4vER-owVHN8S0RnAE5VszrfFZvlFjPZG6uCdWfhUOHxI1kFX86Nrnlj/exec';
// 22 nov 2026, 15:00 hrs, hora de Aguascalientes (UTC-6)
const EVENT_DATE = new Date('2026-11-22T15:00:00-06:00');

const $ = (id) => document.getElementById(id);

/* ============ MÚSICA DE FONDO ============ */
// Si existe audio/musica.mp3 lo reproduce; si no, toca una nana (Brahms) sintetizada.
const music = (() => {
  const audio = $('bgm'), btn = $('musicBtn');
  let on = false, useSynth = false, ctx = null, timer = null;
  const N = { D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33 };
  // [nota, tiempos] en compás de 3/4 (nana de Brahms, dominio público)
  const song = [['E4',.5],['E4',.5],['G4',2],['E4',.5],['E4',.5],['G4',2],['E4',.5],['G4',.5],['C5',1],['B4',1],['A4',1],
    ['A4',.5],['G4',.5],['D4',.5],['E4',.5],['F4',2],['D4',.5],['D4',.5],['E4',.5],['F4',.5],['D4',1],['F4',.5],['B4',.5],['A4',1],['G4',1],['C5',3],[null,2]];
  const beat = 0.8;
  function note(f, t, d) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(.16, t + .01);
    g.gain.exponentialRampToValueAtTime(.0008, t + Math.max(d, .9));
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + Math.max(d, .9) + .05);
  }
  function loop(i = 0) {
    if (!on || !useSynth) return;
    const [n, b] = song[i % song.length];
    if (n) note(N[n], ctx.currentTime + .02, b * beat);
    timer = setTimeout(() => loop(i + 1), b * beat * 1000);
  }
  function synthPlay() {
    useSynth = true;
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume(); clearTimeout(timer); loop();
  }
  function play() {
    on = true; btn.setAttribute('aria-pressed', 'true'); btn.setAttribute('aria-label', 'Pausar música');
    if (useSynth) return synthPlay();
    audio.volume = .5;
    audio.play().catch(() => { if (on) synthPlay(); });
  }
  function pause() {
    on = false; btn.setAttribute('aria-pressed', 'false'); btn.setAttribute('aria-label', 'Reproducir música');
    audio.pause(); clearTimeout(timer);
  }
  btn.addEventListener('click', () => (on ? pause() : play()));
  return { start() { btn.hidden = false; play(); } };
})();

/* ============ 1. PORTADA ============ */
$('openBtn').addEventListener('click', () => {
  const cover = $('cover'), card = $('invite');
  cover.classList.add('out');
  card.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('show')));
  document.body.classList.remove('locked');
  window.scrollTo(0, 0);
  music.start();
  setTimeout(() => (cover.hidden = true), 1000);
});

/* ============ 2. CUENTA REGRESIVA ============ */
function tick() {
  let diff = Math.max(0, EVENT_DATE - Date.now());
  const d = Math.floor(diff / 864e5);
  const h = Math.floor(diff / 36e5) % 24;
  const m = Math.floor(diff / 6e4) % 60;
  $('cd-d').textContent = d;
  $('cd-h').textContent = String(h).padStart(2, '0');
  $('cd-m').textContent = String(m).padStart(2, '0');
  $('cd-s').textContent = String(Math.floor(diff / 1e3) % 60).padStart(2, '0');
}
tick();
setInterval(tick, 1000);

/* ============ 3. RSVP ============ */
function makeCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return 'RO-' + s;
}

$('rsvpForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, msg = $('formMsg'), btn = $('sendBtn');
  msg.textContent = '';

  const data = {
    codigo: makeCode(),
    // se quita "|" porque es el separador del texto del QR
    nombre: f.nombre.value.trim().replace(/\|/g, ' '),
    telefono: f.telefono.value.trim(),
    pases: Number(f.pases.value),
    mensaje: f.mensaje.value.trim(),
    enviado: new Date().toISOString()
  };

  if (data.nombre.length < 2) return (msg.textContent = 'Escribe tu nombre o el de tu familia.');
  if (data.telefono.replace(/\D/g, '').length < 10) return (msg.textContent = 'Escribe un teléfono de 10 dígitos.');

  btn.disabled = true;
  btn.textContent = 'Enviando…';

  const demo = APPS_SCRIPT_URL.startsWith('TU_');
  try {
    if (!demo) {
      // text/plain evita el preflight CORS que Apps Script no responde
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(data)
      });
      const out = await res.json();
      if (!out.ok) throw new Error(out.error || 'Error del servidor');
    }
    showPass(data, demo);
    f.hidden = true;
    msg.textContent = '';
  } catch (err) {
    console.error(err);
    msg.textContent = 'No se pudo enviar tu confirmación. Revisa tu conexión e inténtalo de nuevo.';
    btn.disabled = false;
    btn.textContent = 'Confirmar asistencia';
  }
});

/* ============ 4. PASE CON QR ============ */
let lastPass = null;
function showPass(d, demo) {
  lastPass = d;
  $('p-name').textContent = d.nombre;
  $('p-pases').textContent = d.pases + (d.pases === 1 ? ' persona' : ' personas');
  $('p-code').textContent = d.codigo;
  $('demoNote').hidden = !demo;

  const qr = $('qr');
  qr.innerHTML = '';
  new QRCode(qr, {
    text: `BABYSHOWER-RO|${d.codigo}|${d.nombre}|${d.pases}`,
    width: 160, height: 160,
    colorDark: '#4a5a66', colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });

  const wrap = $('passWrap');
  wrap.hidden = false;
  wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

$('printBtn').addEventListener('click', () => window.print());

/* ============ 5. ENVIAR PASE POR CORREO (como imagen) ============ */
$('mailForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('mailMsg'), btn = $('mailBtn');
  const correo = e.target.correo.value.trim();
  msg.style.color = '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) return (msg.textContent = 'Escribe un correo válido.');
  if (APPS_SCRIPT_URL.startsWith('TU_')) return (msg.textContent = 'Modo demostración: configura la URL de Apps Script para enviar correos.');

  btn.disabled = true; btn.textContent = 'Enviando…'; msg.textContent = '';
  try {
    await document.fonts.ready;
    const canvas = await html2canvas($('pass'), { scale: 2, backgroundColor: '#F7EFE2', useCORS: true });
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ accion: 'correo', codigo: lastPass.codigo, correo, imagen: canvas.toDataURL('image/png') })
    });
    const out = await res.json();
    if (!out.ok) throw new Error(out.error || 'Error del servidor');
    msg.style.color = 'var(--dusty)';
    msg.textContent = '¡Listo! Te enviamos el pase a ' + correo + '. Revisa también tu carpeta de spam.';
  } catch (err) {
    console.error(err);
    msg.style.color = '';
    msg.textContent = 'Error: ' + err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Enviar pase por correo';
  }
});
