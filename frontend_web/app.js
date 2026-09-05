import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { CONFIG } from '/config.js';

const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);

let profile = null;
let settings = { ...CONFIG.DEFAULTS };
let selectedBarber = null;
let selectedSlot = null;

const routes = CONFIG.ROUTES;

function normalize(path) {
  if (!path) return '/';
  const p = path.split('?')[0].replace(/\/+$/, '');
  return p || '/';
}

function navigate(path, replace = false) {
  const target = normalize(path);
  if (replace) history.replaceState({}, '', target);
  else history.pushState({}, '', target);
  renderRoute();
}

function routeButtonBind() {
  document.querySelectorAll('[data-route]').forEach(el => {
    el.onclick = e => {
      e.preventDefault();
      navigate(el.dataset.route);
    };
  });
}

function setActiveNav(path) {
  document.querySelectorAll('[data-nav]').forEach(el => {
    const base = el.dataset.nav;
    const active = base === '/'
      ? path === '/'
      : path === base || path.startsWith(base + '/');
    el.classList.toggle('active', active);
  });
}

function showOnly(id) {
  document.querySelectorAll('.route-view').forEach(el => el.classList.add('hidden'));
  $(id).classList.remove('hidden');
}

function notice(el, text, ok = false) {
  el.innerHTML = text ? `<div class="notice ${ok ? 'ok' : 'err'}">${escapeHtml(text)}</div>` : '';
}

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function hhmm(v) { return String(v || '').slice(0, 5); }
function initials(name) {
  return String(name || 'B').trim().split(/\s+/).slice(0,2).map(x => x[0]).join('').toUpperCase();
}
function todayIso() {
  const d = new Date(), off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0,10);
}

async function loadSettings() {
  try {
    const { data, error } = await sb
      .from('configuracion_sistema')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (!error && data) settings = { ...settings, ...data };
  } catch (_) {
    // Fallback silencioso a CONFIG.DEFAULTS.
  }
  applySettings();
}

function applySettings() {
  document.documentElement.style.setProperty('--primary', settings.color_primario || CONFIG.DEFAULTS.color_primario);
  document.documentElement.style.setProperty('--accent', settings.color_acento || CONFIG.DEFAULTS.color_acento);

  const setText = (id, value) => { if ($(id) && value) $(id).textContent = value; };
  const setImg = (id, value) => { if ($(id) && value) $(id).src = value; };

  document.title = settings.nombre_negocio || 'Blessed Barber Studio';
  setText('brandKicker', String(settings.nombre_negocio || '').toUpperCase());
  setText('heroSubtitle', settings.hero_subtitulo);
  setText('homeCta', settings.home_cta);
  setText('asideBusinessName', String(settings.nombre_negocio || '').toUpperCase());
  setText('asideHours', settings.horario);
  setText('asideAddress', settings.direccion || settings.telefono || 'Configura dirección y contacto desde el panel.');
  setText('footerBusinessName', settings.nombre_negocio);
  setText('footerDetails', [settings.direccion, settings.telefono, settings.horario].filter(Boolean).join(' · ') || 'Sistema profesional de reservas.');

  const heroTitle = $('heroTitle');
  if (heroTitle && settings.hero_titulo) {
    const words = settings.hero_titulo.split(',');
    heroTitle.innerHTML = words.length > 1
      ? `${escapeHtml(words[0])},<br><em>${escapeHtml(words.slice(1).join(',').trim())}</em>`
      : escapeHtml(settings.hero_titulo);
  }

  ['navLogo','bookingLogo','loginLogo','footerLogo'].forEach(id => setImg(id, settings.logo_url));
  ['heroBanner','bookingBanner','loginBanner'].forEach(id => setImg(id, settings.banner_principal_url));
  setImg('secondaryBanner', settings.banner_secundario_url);
}

async function loadCurrentProfile() {
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    profile = null;
    updateAuthNav();
    return null;
  }

  const { data: p } = await sb
    .from('usuarios')
    .select('id,nombre,rol,telefono,activo')
    .eq('id', data.session.user.id)
    .maybeSingle();

  profile = p?.activo ? p : null;
  updateAuthNav();
  return profile;
}

function updateAuthNav() {
  $('navLogin').classList.toggle('hidden', !!profile);
  $('navPanel').classList.toggle('hidden', !profile);
}

async function renderRoute() {
  const path = normalize(location.pathname);
  setActiveNav(path);

  if (path === routes.home) {
    showOnly('homeView');
    return;
  }

  if (path === routes.reservar) {
    showOnly('bookingView');
    await loadBarbers();
    await loadPublicGallery();
    return;
  }

  if (path === routes.login) {
    if (profile) return navigate(routes.panel, true);
    showOnly('loginView');
    return;
  }

  if (path === routes.panel || path.startsWith('/panel/')) {
    if (!profile) {
      await loadCurrentProfile();
      if (!profile) return navigate(routes.login, true);
    }
    showOnly('panelView');
    renderPanelRoute(path);
    return;
  }

  navigate(routes.home, true);
}

function updateBookingSummary() {
  if (!selectedBarber || !selectedSlot) {
    $('bookingSummary').innerHTML = '<small>RESUMEN DE CITA</small><strong>Selecciona barbero y horario.</strong>';
    return;
  }
  $('bookingSummary').innerHTML = `
    <small>RESUMEN DE CITA</small>
    <strong>${escapeHtml(selectedBarber.nombre)} · ${escapeHtml($('date').value)} · ${hhmm(selectedSlot.hora_inicio)}</strong>`;
}

async function loadBarbers() {
  $('date').min = todayIso();
  if (!$('date').value) $('date').value = todayIso();

  $('barbers').innerHTML = '<div class="empty">Cargando profesionales...</div>';
  const { data, error } = await sb.rpc('listar_barberos_publicos');

  if (error) {
    $('barbers').innerHTML = '<div class="empty">No se pudieron cargar los barberos.</div>';
    return;
  }

  $('barbers').innerHTML = '';
  for (const barber of data) {
    const btn = document.createElement('button');
    btn.className = 'barber-card';
    btn.type = 'button';
    btn.innerHTML = `<span class="avatar">${initials(barber.nombre)}</span><span><strong>${escapeHtml(barber.nombre)}</strong><small>Disponible para reservas</small></span>`;
    btn.onclick = async () => {
      selectedBarber = barber;
      selectedSlot = null;
      [...$('barbers').children].forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      updateBookingSummary();
      await loadSlots();
    };
    $('barbers').appendChild(btn);
  }

  if (!data.length) $('barbers').innerHTML = '<div class="empty">No hay barberos activos todavía.</div>';
}

async function loadPublicGallery() {
  const grid = $('publicGallery');
  if (!grid) return;
  grid.innerHTML = '<div class="empty">Cargando catálogo...</div>';

  const { data, error } = await sb
    .from('galeria')
    .select('url,titulo')
    .eq('activo', true)
    .order('orden', { ascending: true })
    .order('id', { ascending: true });

  if (error || !data?.length) {
    const section = $('gallerySection');
    if (section) section.classList.add('hidden');
    return;
  }

  $('gallerySection')?.classList.remove('hidden');
  grid.innerHTML = data.map(item => `
    <figure class="gallery-item">
      <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.titulo || 'Trabajo Blessed Barber Studio')}" loading="lazy">
      ${item.titulo ? `<figcaption class="gallery-caption">${escapeHtml(item.titulo)}</figcaption>` : ''}
    </figure>`).join('');
}

async function loadSlots() {
  selectedSlot = null;
  updateBookingSummary();

  if (!selectedBarber) {
    $('slots').innerHTML = '<div class="empty">Selecciona primero un barbero.</div>';
    return;
  }

  $('slots').innerHTML = '<div class="empty">Consultando horarios...</div>';
  const { data, error } = await sb.rpc('horarios_disponibles', {
    p_barbero_id: selectedBarber.id,
    p_fecha: $('date').value
  });

  if (error) {
    $('slots').innerHTML = '<div class="empty">No se pudieron consultar los horarios.</div>';
    return;
  }

  $('slots').innerHTML = '';
  for (const slot of data) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot';
    btn.textContent = `${hhmm(slot.hora_inicio)} – ${hhmm(slot.hora_fin)}`;
    btn.onclick = () => {
      selectedSlot = slot;
      [...$('slots').children].forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      updateBookingSummary();
    };
    $('slots').appendChild(btn);
  }

  if (!data.length) $('slots').innerHTML = '<div class="empty">No hay horarios libres para esta fecha.</div>';
}

$('date').addEventListener('change', loadSlots);

$('bookBtn').onclick = async () => {
  notice($('publicMsg'), '');
  const name = $('clientName').value.trim();
  const phone = $('clientPhone').value.trim();

  if (!selectedBarber) return notice($('publicMsg'), 'Selecciona un barbero.');
  if (!selectedSlot) return notice($('publicMsg'), 'Selecciona un horario.');
  if (name.length < 2) return notice($('publicMsg'), 'Ingresa tu nombre.');
  if (phone.replace(/\D/g,'').length < 6) return notice($('publicMsg'), 'Ingresa un teléfono válido.');

  $('bookBtn').disabled = true;
  $('bookBtn').textContent = 'REGISTRANDO...';

  const { error } = await sb.rpc('crear_reserva_publica', {
    p_barbero_id: selectedBarber.id,
    p_cliente_nombre: name,
    p_cliente_telefono: phone,
    p_fecha: $('date').value,
    p_hora_inicio: selectedSlot.hora_inicio
  });

  $('bookBtn').disabled = false;
  $('bookBtn').textContent = 'CONFIRMAR RESERVA';

  if (error) return notice($('publicMsg'), error.message);

  notice($('publicMsg'), `Reserva confirmada con ${selectedBarber.nombre} a las ${hhmm(selectedSlot.hora_inicio)}.`, true);
  $('clientName').value = '';
  $('clientPhone').value = '';
  await loadSlots();
};

$('loginBtn').onclick = async () => {
  notice($('loginMsg'), '');
  $('loginBtn').disabled = true;
  $('loginBtn').textContent = 'VERIFICANDO...';

  const { data, error } = await sb.auth.signInWithPassword({
    email: $('email').value.trim(),
    password: $('password').value
  });

  $('loginBtn').disabled = false;
  $('loginBtn').textContent = 'INGRESAR AL SISTEMA';

  if (error) return notice($('loginMsg'), error.message);

  const { data: p, error: profileError } = await sb
    .from('usuarios')
    .select('id,nombre,rol,telefono,activo')
    .eq('id', data.user.id)
    .single();

  if (profileError || !p?.activo) {
    await sb.auth.signOut();
    return notice($('loginMsg'), 'Usuario sin perfil activo.');
  }

  profile = p;
  updateAuthNav();
  navigate(routes.panel, true);
};

$('logoutBtn').onclick = async () => {
  await sb.auth.signOut();
  profile = null;
  updateAuthNav();
  navigate(routes.home);
};

async function api(path, options = {}) {
  const session = (await sb.auth.getSession()).data.session;
  const res = await fetch(`${CONFIG.BACKEND_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`,
      ...(options.headers || {})
    }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Error del servidor');
  return body;
}

const roleMenus = {
  barbero: [
    ['Mi agenda', routes.agenda],
    ['Disponibilidad', routes.horarios]
  ],
  admin: [
    ['Resumen', routes.panel],
    ['Reservas', routes.reservas],
    ['Barberos', routes.barberos],
    ['Galería', routes.galeria]
  ],
  super_admin: [
    ['Resumen', routes.panel],
    ['Usuarios', routes.usuarios],
    ['Seguridad', routes.seguridad],
    ['Configuración', routes.configuracion],
    ['Galería', routes.galeria]
  ]
};

function renderSidebar(path) {
  const menu = roleMenus[profile.rol] || [];
  $('panelSidebar').innerHTML = menu.map(([label, href]) => {
    const active = normalize(href) === normalize(path);
    return `<button class="side-link ${active ? 'active' : ''}" data-side-route="${href}">${label}</button>`;
  }).join('');

  document.querySelectorAll('[data-side-route]').forEach(btn => {
    btn.onclick = () => navigate(btn.dataset.sideRoute);
  });
}

async function renderPanelRoute(path) {
  $('welcome').textContent = `Hola, ${profile.nombre}`;
  $('roleText').textContent = profile.rol.replace('_',' ');
  renderSidebar(path);

  const allowed = new Set((roleMenus[profile.rol] || []).map(x => normalize(x[1])));
  if (path !== routes.panel && !allowed.has(path)) return navigate(routes.panel, true);

  try {
    if (path === routes.panel) return renderDashboard();
    if (path === routes.agenda) return renderAgenda();
    if (path === routes.horarios) return renderAvailability();
    if (path === routes.reservas) return renderReservations();
    if (path === routes.barberos) return renderBarbers();
    if (path === routes.usuarios) return renderUsers();
    if (path === routes.seguridad) return renderSecurity();
    if (path === routes.configuracion) return renderConfiguration();
    if (path === routes.galeria) return renderGallery();
  } catch (e) {
    $('staffContent').innerHTML = `<div class="notice err">${escapeHtml(e.message)}</div>`;
  }
}

async function getReservations(all = false) {
  let q = sb.from('reservas').select('*').order('fecha',{ascending:true}).order('hora_inicio',{ascending:true});
  if (!all && profile.rol === 'barbero') q = q.eq('barbero_id', profile.id);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

function reservationRow(r) {
  return `<div class="panel-item">
    <div><strong>${escapeHtml(r.cliente_nombre)}</strong><small>${escapeHtml(r.fecha)} · ${hhmm(r.hora_inicio)} · ${escapeHtml(r.cliente_telefono)}</small></div>
    <span class="pill">${escapeHtml(r.estado)}</span>
  </div>`;
}

async function renderDashboard() {
  if (profile.rol === 'barbero') return renderAgenda();

  const rows = await getReservations(true);
  const { data: barbers } = await sb.from('usuarios').select('id,activo').eq('rol','barbero');
  const today = todayIso();

  $('staffContent').innerHTML = `<div class="kpis">
    <div class="kpi"><span>CITAS DE HOY</span><b>${rows.filter(r=>r.fecha===today).length}</b><small>Agenda actual</small></div>
    <div class="kpi"><span>RESERVAS</span><b>${rows.length}</b><small>Total de registros</small></div>
    <div class="kpi"><span>BARBEROS ACTIVOS</span><b>${(barbers||[]).filter(x=>x.activo).length}</b><small>Equipo disponible</small></div>
  </div>`;
}

async function renderAgenda() {
  const rows = await getReservations();
  $('staffContent').innerHTML = `<div class="panel-card"><h2>Mi agenda</h2><div class="panel-list">${rows.map(reservationRow).join('') || '<div class="empty">Sin citas próximas.</div>'}</div></div>`;
}

async function renderReservations() {
  const rows = await getReservations(true);
  $('staffContent').innerHTML = `<div class="panel-card"><h2>Todas las reservas</h2><div class="panel-list">${rows.map(reservationRow).join('') || '<div class="empty">No hay reservas.</div>'}</div></div>`;
}

async function renderAvailability() {
  const { data, error } = await sb.from('disponibilidad').select('*').eq('barbero_id',profile.id).order('dia_semana').order('hora_inicio');
  if (error) throw error;
  const days=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

  $('staffContent').innerHTML = `<div class="panel-card">
    <h2>Disponibilidad semanal</h2>
    <div class="input-grid" style="margin-top:16px">
      <label class="field"><b>Día (0 Dom - 6 Sáb)</b><input id="avDay" type="number" min="0" max="6" value="1"></label>
      <label class="field"><b>Hora (08 - 19)</b><input id="avHour" type="number" min="8" max="19" value="9"></label>
    </div>
    <button class="button dark" id="addAvailability" style="margin-top:12px">Agregar horario</button>
    <div class="panel-list">${data.map(s=>`<div class="panel-item"><div><strong>${days[s.dia_semana]}</strong><small>${hhmm(s.hora_inicio)} – ${hhmm(s.hora_fin)}</small></div><button class="button ghost" data-delete-slot="${s.id}">Eliminar</button></div>`).join('') || '<div class="empty">Sin horarios configurados.</div>'}</div>
  </div>`;

  $('addAvailability').onclick=async()=>{
    const d=+$('avDay').value,h=+$('avHour').value;
    const {error}=await sb.from('disponibilidad').insert({barbero_id:profile.id,dia_semana:d,hora_inicio:`${String(h).padStart(2,'0')}:00:00`,hora_fin:`${String(h+1).padStart(2,'0')}:00:00`});
    if(error)return alert(error.message);
    renderAvailability();
  };

  document.querySelectorAll('[data-delete-slot]').forEach(btn=>btn.onclick=async()=>{
    await sb.from('disponibilidad').delete().eq('id',+btn.dataset.deleteSlot);
    renderAvailability();
  });
}

async function renderBarbers() {
  const {data,error}=await sb.from('usuarios').select('*').eq('rol','barbero').order('nombre');
  if(error)throw error;
  $('staffContent').innerHTML=`<div class="panel-card">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><h2>Barberos</h2><button class="button dark" id="newBarber">Nuevo barbero</button></div>
    <div class="panel-list">${data.map(u=>`<div class="panel-item"><div><strong>${escapeHtml(u.nombre)}</strong><small>${escapeHtml(u.telefono||'Sin teléfono')}</small></div><span class="pill">${u.activo?'activo':'inactivo'}</span></div>`).join('') || '<div class="empty">No hay barberos.</div>'}</div>
  </div>`;
  $('newBarber').onclick=()=>createUserPrompt('barbero');
}

async function renderUsers() {
  const {data,error}=await sb.from('usuarios').select('*').order('rol').order('nombre');
  if(error)throw error;
  $('staffContent').innerHTML=`<div class="panel-card">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><h2>Usuarios</h2><button class="button dark" id="newAdmin">Nuevo admin</button></div>
    <div class="panel-list">${data.filter(u=>u.rol!=='super_admin').map(u=>`<div class="panel-item"><div><strong>${escapeHtml(u.nombre)}</strong><small>${escapeHtml(u.rol)} · ${escapeHtml(u.telefono||'')}</small></div><span class="pill">${u.activo?'activo':'inactivo'}</span></div>`).join('') || '<div class="empty">Sin usuarios adicionales.</div>'}</div>
  </div>`;
  $('newAdmin').onclick=()=>createUserPrompt('admin');
}

async function createUserPrompt(role) {
  const nombre=prompt(`Nombre del ${role}:`); if(!nombre)return;
  const email=prompt('Correo:'); if(!email)return;
  const password=prompt('Contraseña inicial (mínimo 8):'); if(!password)return;
  const telefono=role==='barbero'?prompt('Teléfono:'):'';
  try{
    await api('/api/users',{method:'POST',body:JSON.stringify({email,password,nombre,telefono:telefono||null,rol:role})});
    alert('Usuario creado.');
    navigate(role==='barbero'?routes.barberos:routes.usuarios);
  }catch(e){alert(e.message)}
}

async function renderSecurity() {
  const {data,error}=await sb.from('usuarios').select('*').in('rol',['admin','barbero']).order('nombre');
  if(error)throw error;
  $('staffContent').innerHTML=`<div class="panel-card"><h2>Seguridad</h2><div class="panel-list">${data.map(u=>`<div class="panel-item"><div><strong>${escapeHtml(u.nombre)}</strong><small>${escapeHtml(u.rol)}</small></div><button class="button ghost" data-reset-user="${u.id}">Cambiar contraseña</button></div>`).join('') || '<div class="empty">Sin usuarios.</div>'}</div></div>`;
  document.querySelectorAll('[data-reset-user]').forEach(btn=>btn.onclick=async()=>{
    const pw=prompt('Nueva contraseña (mínimo 8):'); if(!pw)return;
    try{await api(`/api/users/${btn.dataset.resetUser}/reset-password`,{method:'POST',body:JSON.stringify({newPassword:pw})});alert('Contraseña actualizada.')}catch(e){alert(e.message)}
  });
}

async function renderConfiguration() {
  const fields = [
    ['nombre_negocio','Nombre del negocio'],
    ['subtitulo','Subtítulo'],
    ['telefono','Teléfono'],
    ['whatsapp','WhatsApp'],
    ['direccion','Dirección'],
    ['horario','Horario'],
    ['hero_titulo','Título del Home'],
    ['hero_subtitulo','Texto del Home'],
    ['home_cta','Texto del botón de reserva'],
    ['logo_url','URL / ruta del logo'],
    ['banner_principal_url','URL / ruta del banner principal'],
    ['banner_secundario_url','URL / ruta del banner secundario'],
    ['color_primario','Color principal'],
    ['color_acento','Color dorado/acento']
  ];

  $('staffContent').innerHTML=`<div class="panel-card">
    <h2>Configuración del sistema</h2>
    <p style="color:var(--muted)">Estos datos se aplican al Home, Reservar, Login y pie de página.</p>
    <div class="config-grid">
      ${fields.map(([key,label])=>`<label class="field"><b>${label}</b><input id="cfg_${key}" value="${escapeHtml(settings[key] ?? '')}"></label>`).join('')}
    </div>
    <div class="config-actions"><button class="button dark" id="saveConfig">Guardar configuración</button><button class="button ghost" id="resetConfig">Recargar</button></div>
    <div id="configMsg"></div>
  </div>`;

  $('saveConfig').onclick=async()=>{
    const patch={};
    for(const [key] of fields)patch[key]=$(`cfg_${key}`).value.trim();
    const {data,error}=await sb.from('configuracion_sistema').update(patch).eq('id',1).select().single();
    if(error)return notice($('configMsg'),error.message);
    settings={...settings,...data};
    applySettings();
    notice($('configMsg'),'Configuración guardada correctamente.',true);
  };

  $('resetConfig').onclick=async()=>{await loadSettings();renderConfiguration();};
}

async function renderGallery() {
  $('staffContent').innerHTML = `<div class="panel-card">
    <h2>Catálogo de imágenes</h2>
    <p style="color:var(--muted)">Las fotos activas se muestran públicamente en la página de Reservar.</p>

    <form id="galleryUploadForm" class="gallery-upload">
      <div class="input-grid">
        <label class="field"><b>Título (opcional)</b><input id="galleryTitulo" placeholder="Ej. Corte clásico"></label>
        <label class="field"><b>Orden</b><input id="galleryOrden" type="number" value="0"></label>
      </div>
      <label class="field"><b>Foto</b><input id="galleryFile" type="file" accept="image/png,image/jpeg,image/webp" required></label>
      <button class="button dark" id="galleryUploadBtn" type="submit">Subir foto</button>
      <div id="galleryUploadMsg"></div>
    </form>

    <div id="galleryAdminGrid" class="gallery-admin-grid"></div>
  </div>`;

  await refreshGalleryAdminGrid();

  $('galleryUploadForm').onsubmit = async (e) => {
    e.preventDefault();
    const file = $('galleryFile').files[0];
    if (!file) return notice($('galleryUploadMsg'), 'Selecciona una imagen.');

    $('galleryUploadBtn').disabled = true;
    $('galleryUploadBtn').textContent = 'SUBIENDO...';
    notice($('galleryUploadMsg'), '');

    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await sb.storage.from('galeria').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data: pub } = sb.storage.from('galeria').getPublicUrl(path);

      const { error: insertError } = await sb.from('galeria').insert({
        url: pub.publicUrl,
        titulo: $('galleryTitulo').value.trim() || null,
        orden: Number($('galleryOrden').value) || 0,
        creado_por: profile.id,
      });
      if (insertError) throw insertError;

      notice($('galleryUploadMsg'), 'Foto agregada al catálogo.', true);
      $('galleryUploadForm').reset();
      $('galleryOrden').value = 0;
      await refreshGalleryAdminGrid();
    } catch (error) {
      notice($('galleryUploadMsg'), error.message || 'No se pudo subir la foto.');
    } finally {
      $('galleryUploadBtn').disabled = false;
      $('galleryUploadBtn').textContent = 'Subir foto';
    }
  };
}

async function refreshGalleryAdminGrid() {
  const grid = $('galleryAdminGrid');
  const { data, error } = await sb
    .from('galeria')
    .select('*')
    .order('orden', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    grid.innerHTML = `<div class="notice err">${escapeHtml(error.message)}</div>`;
    return;
  }

  grid.innerHTML = (data || []).map(item => `
    <div class="gallery-admin-item">
      <div class="thumb"><img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.titulo || 'Foto del catálogo')}" loading="lazy"></div>
      <div class="meta">
        <strong>${escapeHtml(item.titulo || 'Sin título')}</strong>
        <span class="pill">${item.activo ? 'activa' : 'oculta'}</span>
        <div class="meta-actions">
          <button class="button ghost" data-toggle-gallery="${item.id}" data-active="${item.activo}">${item.activo ? 'Ocultar' : 'Mostrar'}</button>
          <button class="button ghost" data-delete-gallery="${item.id}">Eliminar</button>
        </div>
      </div>
    </div>`).join('') || '<div class="empty">Aún no subes fotos al catálogo.</div>';

  document.querySelectorAll('[data-toggle-gallery]').forEach(btn => btn.onclick = async () => {
    const activo = btn.dataset.active !== 'true';
    await sb.from('galeria').update({ activo }).eq('id', +btn.dataset.toggleGallery);
    refreshGalleryAdminGrid();
  });

  document.querySelectorAll('[data-delete-gallery]').forEach(btn => btn.onclick = async () => {
    if (!confirm('¿Eliminar esta foto del catálogo?')) return;
    await sb.from('galeria').delete().eq('id', +btn.dataset.deleteGallery);
    refreshGalleryAdminGrid();
  });
}

function setupRevealAnimations() {
  const elements = document.querySelectorAll('[data-reveal]');
  if (!elements.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  elements.forEach(el => el.classList.add('reveal-pending'));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

  elements.forEach(el => observer.observe(el));
}

window.addEventListener('popstate', renderRoute);
routeButtonBind();

(async()=>{
  await loadSettings();
  await loadCurrentProfile();
  updateBookingSummary();
  await renderRoute();
  setupRevealAnimations();
})();
