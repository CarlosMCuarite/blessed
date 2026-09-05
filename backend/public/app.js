import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { CONFIG } from '/config.js';

const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const routes = CONFIG.ROUTES;

let profile = null;
let settings = { ...CONFIG.DEFAULTS };
let services = [];
let barbers = [];
let gallery = [];
let selectedService = null;
let selectedBarber = null;
let selectedSlot = null;
let currentReserveStep = 1;

const esc = value => String(value ?? '')
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'",'&#039;');

const hhmm = value => String(value ?? '').slice(0,5);
const money = value => `S/ ${Number(value || 0).toFixed(2)}`;
const initials = value => String(value || 'B').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
const todayIso = () => {
  const d = new Date(), off = d.getTimezoneOffset();
  return new Date(d.getTime() - off*60000).toISOString().slice(0,10);
};
const normalize = p => {
  const clean = String(p || '/').split('?')[0].replace(/\/+$/,'');
  return clean || '/';
};

function toast(message, type='info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  $('toastRoot').appendChild(el);
  setTimeout(()=>el.remove(), 3200);
}

function notice(el, text, ok=false) {
  el.innerHTML = text ? `<div class="notice ${ok?'ok':'err'}">${esc(text)}</div>` : '';
}

function navigate(path, replace=false) {
  const target = normalize(path);
  if (replace) history.replaceState({},'',target);
  else history.pushState({},'',target);
  renderRoute();
}

function bindRoutes() {
  document.querySelectorAll('[data-route]').forEach(el => {
    el.onclick = e => {
      e.preventDefault();
      navigate(el.dataset.route);
    };
  });
}

function setPublicNav(path) {
  document.querySelectorAll('[data-nav]').forEach(el => {
    const base = el.dataset.nav;
    const active = base === '/' ? path === '/' : path === base || path.startsWith(base + '/');
    el.classList.toggle('active', active);
  });
}

function showView(id) {
  document.querySelectorAll('.route-view').forEach(el=>el.classList.add('hidden'));
  $(id).classList.remove('hidden');
  window.scrollTo({top:0,behavior:'smooth'});
}

function isPanel(path) { return path === routes.panel || path.startsWith('/panel/'); }

async function loadSettings() {
  try {
    const {data,error} = await sb.from('configuracion_sistema').select('*').eq('id',1).maybeSingle();
    if (!error && data) settings = {...settings,...data};
  } catch (_) {}
  applySettings();
}

function applySettings() {
  document.documentElement.style.setProperty('--primary', settings.color_primario || CONFIG.DEFAULTS.color_primario);
  document.documentElement.style.setProperty('--accent', settings.color_acento || CONFIG.DEFAULTS.color_acento);
  document.title = settings.nombre_negocio || 'Blessed Barber Studio';

  const txt = (id,val) => { if($(id) && val !== undefined && val !== null) $(id).textContent=val; };
  const img = (id,val) => { if($(id) && val) $(id).src=val; };

  txt('homeBrand',String(settings.nombre_negocio||'').toUpperCase());
  txt('heroSubtitle',settings.hero_subtitulo);
  txt('homeCta',settings.home_cta);
  txt('businessSlogan',settings.slogan);
  txt('catalogTitle',settings.catalogo_titulo);
  txt('catalogSubtitle',settings.catalogo_subtitulo);
  txt('loginTitle',settings.login_titulo);
  txt('loginSubtitle',settings.login_subtitulo);
  txt('loginVisualSlogan',settings.slogan);
  txt('bookingBusinessName',String(settings.nombre_negocio||'').toUpperCase());
  txt('bookingHours',settings.horario);
  txt('bookingAddress',settings.direccion || settings.telefono || 'Configura dirección y contacto desde el panel.');
  txt('footerName',settings.nombre_negocio);
  txt('footerText',[settings.direccion,settings.telefono,settings.horario].filter(Boolean).join(' · ') || 'Sistema profesional de reservas.');

  if ($('heroTitle') && settings.hero_titulo) {
    const parts = settings.hero_titulo.split(',');
    $('heroTitle').innerHTML = parts.length>1
      ? `${esc(parts[0])},<br><em>${esc(parts.slice(1).join(',').trim())}</em>`
      : esc(settings.hero_titulo);
  }

  ['navLogo','bookingLogo','loginLogo','loginOverlayLogo','sidebarLogo','footerLogo'].forEach(id=>img(id,settings.logo_url));
  ['heroBanner','bookingBanner','loginBanner'].forEach(id=>img(id,settings.banner_principal_url));
  img('homeSecondaryBanner',settings.banner_secundario_url);
}

async function loadProfile() {
  const {data} = await sb.auth.getSession();
  if (!data.session) { profile=null; updateAuthUI(); return null; }

  const {data:p} = await sb.from('usuarios')
    .select('id,nombre,rol,telefono,especialidad,bio,foto_url,activo')
    .eq('id',data.session.user.id).maybeSingle();

  profile = p?.activo ? p : null;
  updateAuthUI();
  return profile;
}

function updateAuthUI() {
  $('navLogin').classList.toggle('hidden',!!profile);
  $('navPanel').classList.toggle('hidden',!profile);
  $('publicNav').classList.toggle('hidden', isPanel(normalize(location.pathname)));
  $('publicFooter').classList.toggle('hidden', isPanel(normalize(location.pathname)));
}

async function renderRoute() {
  const path = normalize(location.pathname);
  setPublicNav(path);
  updateAuthUI();

  if (path === routes.home) {
    showView('homeView');
    return;
  }
  if (path === routes.catalogo) {
    showView('catalogView');
    await Promise.all([loadServices(),loadGallery()]);
    renderPublicCatalog();
    return;
  }
  if (path === routes.reservar) {
    showView('bookingView');
    await Promise.all([loadServices(),loadBarbers()]);
    resetBooking(false);
    return;
  }
  if (path === routes.login) {
    if (profile) return navigate(routes.panel,true);
    showView('loginView');
    return;
  }
  if (isPanel(path)) {
    if (!profile) {
      await loadProfile();
      if (!profile) return navigate(routes.login,true);
    }
    showView('panelView');
    updateAuthUI();
    await renderPanel(path);
    return;
  }
  navigate(routes.home,true);
}

async function loadServices(force=false) {
  if (services.length && !force) return services;
  const {data,error}=await sb.rpc('listar_servicios_publicos');
  services = error ? [] : (data||[]);
  return services;
}

async function loadBarbers(force=false) {
  if (barbers.length && !force) return barbers;
  const {data,error}=await sb.rpc('listar_barberos_publicos');
  barbers = error ? [] : (data||[]);
  return barbers;
}

async function loadGallery(force=false) {
  if (gallery.length && !force) return gallery;
  const {data,error}=await sb.from('galeria').select('*').eq('activo',true).order('orden').order('id');
  gallery = error ? [] : (data||[]);
  return gallery;
}

function renderPublicCatalog() {
  $('publicServices').innerHTML = services.length ? services.map(s=>`
    <article class="public-service">
      <div class="public-service-photo">${s.foto_url?`<img src="${esc(s.foto_url)}" alt="${esc(s.nombre)}">`:'✂'}</div>
      <div class="public-service-body">
        <div class="public-service-top"><h3>${esc(s.nombre)}</h3><span class="service-price">${money(s.precio)}</span></div>
        <p>${esc(s.descripcion||'Servicio profesional Blessed.')}</p>
        <div class="service-meta"><span class="tag">${esc(s.categoria||'Barbería')}</span><span class="tag">${Number(s.duracion_min||60)} min</span>${s.destacado?'<span class="tag">Destacado</span>':''}</div>
        <button class="btn dark full" style="margin-top:12px" data-book-service="${s.id}">Reservar este servicio</button>
      </div>
    </article>`).join('') : '<div class="empty-block">Aún no hay servicios configurados.</div>';

  document.querySelectorAll('[data-book-service]').forEach(btn=>btn.onclick=()=>{
    const id=Number(btn.dataset.bookService);
    selectedService=services.find(x=>Number(x.id)===id)||null;
    navigate(routes.reservar);
  });

  $('publicGallery').innerHTML = gallery.length ? gallery.map(g=>`
    <div class="gallery-public-item"><img src="${esc(g.url)}" alt="${esc(g.titulo||'Trabajo Blessed')}">${g.titulo?`<span>${esc(g.titulo)}</span>`:''}</div>
  `).join('') : '<div class="empty-block">La galería está lista para recibir trabajos.</div>';
}

function setReserveStep(step) {
  currentReserveStep=step;
  for(let i=1;i<=4;i++) {
    $(`reserveStep${i}`).classList.toggle('hidden',i!==step);
    $(`prog${i}`).classList.toggle('active',i<=step);
  }
  $('reserveSuccess').classList.add('hidden');
}

function resetBooking(clearSelection=true) {
  if(clearSelection) {
    selectedService=null; selectedBarber=null; selectedSlot=null;
  }
  if(!$('date').value) $('date').value=todayIso();
  $('date').min=todayIso();
  $('clientName').value=''; $('clientPhone').value=''; $('clientNotes').value='';
  notice($('publicMsg'),'');
  renderReserveServices();
  renderReserveBarbers();
  updateSummary();
  setReserveStep(selectedService ? 2 : 1);
}

function renderReserveServices() {
  $('reserveServices').innerHTML = services.length ? services.map(s=>`
    <button class="select-card ${selectedService&&Number(selectedService.id)===Number(s.id)?'active':''}" data-select-service="${s.id}">
      <span class="select-icon">${s.foto_url?`<img src="${esc(s.foto_url)}" alt="">`:'✂'}</span>
      <span class="select-copy"><b>${esc(s.nombre)}</b><small>${money(s.precio)} · ${Number(s.duracion_min||60)} min</small></span>
    </button>`).join('') : '<div class="empty-block">Primero configura al menos un servicio desde Panel → Catálogo.</div>';

  document.querySelectorAll('[data-select-service]').forEach(btn=>btn.onclick=()=>{
    selectedService=services.find(x=>Number(x.id)===Number(btn.dataset.selectService))||null;
    selectedBarber=null;selectedSlot=null;
    renderReserveServices();renderReserveBarbers();updateSummary();setReserveStep(2);
  });
}

function renderReserveBarbers() {
  $('reserveBarbers').innerHTML = barbers.length ? barbers.map(b=>`
    <button class="select-card ${selectedBarber?.id===b.id?'active':''}" data-select-barber="${b.id}">
      <span class="select-icon">${b.foto_url?`<img src="${esc(b.foto_url)}" alt="">`:initials(b.nombre)}</span>
      <span class="select-copy"><b>${esc(b.nombre)}</b><small>${esc(b.especialidad||'Barbero profesional')}</small></span>
    </button>`).join('') : '<div class="empty-block">Aún no hay barberos activos.</div>';

  document.querySelectorAll('[data-select-barber]').forEach(btn=>btn.onclick=async()=>{
    selectedBarber=barbers.find(x=>x.id===btn.dataset.selectBarber)||null;
    selectedSlot=null;
    renderReserveBarbers(); updateSummary(); setReserveStep(3);
    await loadSlots();
  });
}

async function loadSlots() {
  if(!selectedBarber) return;
  $('slots').innerHTML='<div class="empty">Consultando horarios...</div>';
  const {data,error}=await sb.rpc('horarios_disponibles',{p_barbero_id:selectedBarber.id,p_fecha:$('date').value});
  if(error){$('slots').innerHTML='<div class="empty">No se pudieron consultar los horarios.</div>';return;}
  $('slots').innerHTML=(data||[]).map(s=>`<button class="slot" data-slot="${esc(s.hora_inicio)}">${hhmm(s.hora_inicio)}</button>`).join('') || '<div class="empty">No hay horarios libres para esa fecha.</div>';
  document.querySelectorAll('[data-slot]').forEach(btn=>btn.onclick=()=>{
    selectedSlot=(data||[]).find(x=>String(x.hora_inicio)===btn.dataset.slot)||null;
    document.querySelectorAll('[data-slot]').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
    $('continueToClient').disabled=false;
    updateSummary();
  });
}

$('date').addEventListener('change',async()=>{selectedSlot=null;$('continueToClient').disabled=true;updateSummary();await loadSlots();});
$('continueToClient').onclick=()=>{if(selectedSlot)setReserveStep(4);};
document.querySelectorAll('[data-back-step]').forEach(btn=>btn.onclick=()=>setReserveStep(Number(btn.dataset.backStep)));
$('newBookingBtn').onclick=()=>resetBooking(true);

function updateSummary() {
  const rows=[
    ['Servicio',selectedService?.nombre||'—'],
    ['Barbero',selectedBarber?.nombre||'—'],
    ['Fecha',$('date')?.value||'—'],
    ['Hora',selectedSlot?hhmm(selectedSlot.hora_inicio):'—'],
    ['Precio',selectedService?money(selectedService.precio):'—']
  ];
  $('bookingSummary').innerHTML=rows.map(([a,b])=>`<div class="summary-row"><span>${a}</span><b>${esc(b)}</b></div>`).join('');
}

$('bookBtn').onclick=async()=>{
  notice($('publicMsg'),'');
  const nombre=$('clientName').value.trim();
  const telefono=$('clientPhone').value.trim();
  const notas=$('clientNotes').value.trim();
  if(!selectedService)return notice($('publicMsg'),'Selecciona un servicio.');
  if(!selectedBarber)return notice($('publicMsg'),'Selecciona un barbero.');
  if(!selectedSlot)return notice($('publicMsg'),'Selecciona una hora.');
  if(nombre.length<2)return notice($('publicMsg'),'Ingresa tu nombre.');
  if(telefono.replace(/\D/g,'').length<6)return notice($('publicMsg'),'Ingresa un teléfono válido.');

  $('bookBtn').disabled=true;$('bookBtn').textContent='REGISTRANDO...';
  const {error}=await sb.rpc('crear_reserva_publica_v2',{
    p_servicio_id:Number(selectedService.id),
    p_barbero_id:selectedBarber.id,
    p_cliente_nombre:nombre,
    p_cliente_telefono:telefono,
    p_fecha:$('date').value,
    p_hora_inicio:selectedSlot.hora_inicio,
    p_notas:notas||null
  });
  $('bookBtn').disabled=false;$('bookBtn').textContent='CONFIRMAR RESERVA';
  if(error)return notice($('publicMsg'),error.message);

  $('successSummary').innerHTML=$('bookingSummary').innerHTML;
  for(let i=1;i<=4;i++)$(`reserveStep${i}`).classList.add('hidden');
  $('reserveSuccess').classList.remove('hidden');
  document.querySelectorAll('.progress-bars i').forEach(x=>x.classList.add('active'));
};

$('togglePassword').onclick=()=>{
  const input=$('password');
  const visible=input.type==='text';
  input.type=visible?'password':'text';
  $('togglePassword').textContent=visible?'Ver':'Ocultar';
};

$('loginBtn').onclick=async()=>{
  notice($('loginMsg'),'');
  const email=$('email').value.trim(),password=$('password').value;
  if(!email||!password)return notice($('loginMsg'),'Completa correo y contraseña.');
  $('loginBtn').disabled=true;$('loginBtn').textContent='VERIFICANDO...';
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  $('loginBtn').disabled=false;$('loginBtn').textContent='INGRESAR AL SISTEMA';
  if(error)return notice($('loginMsg'),error.message);

  const {data:p,error:pe}=await sb.from('usuarios')
    .select('id,nombre,rol,telefono,especialidad,bio,foto_url,activo')
    .eq('id',data.user.id).single();
  if(pe||!p?.activo){await sb.auth.signOut();return notice($('loginMsg'),'Usuario sin perfil activo.');}
  profile=p;updateAuthUI();navigate(routes.panel,true);
};

async function logout(){
  await sb.auth.signOut();profile=null;updateAuthUI();navigate(routes.home);
}
$('sidebarLogout').onclick=logout;

async function api(path,options={}) {
  const session=(await sb.auth.getSession()).data.session;
  const response=await fetch(`${CONFIG.BACKEND_URL}${path}`,{
    ...options,
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${session?.access_token||''}`,...(options.headers||{})}
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||'Error del servidor');
  return body;
}

const menus={
  super_admin:[
    ['GENERAL',[['dashboard','Dashboard',routes.panel],['reservas','Reservas',routes.reservas]]],
    ['GESTIÓN',[['barberos','Barberos',routes.barberos],['catalogo','Catálogo',routes.catalogoAdmin],['galeria','Galería',routes.galeria]]],
    ['SISTEMA',[['usuarios','Usuarios',routes.usuarios],['seguridad','Seguridad',routes.seguridad],['config','Configuración',routes.configuracion]]]
  ],
  admin:[
    ['GENERAL',[['dashboard','Dashboard',routes.panel],['reservas','Reservas',routes.reservas]]],
    ['GESTIÓN',[['barberos','Barberos',routes.barberos],['catalogo','Catálogo',routes.catalogoAdmin],['galeria','Galería',routes.galeria]]]
  ],
  barbero:[
    ['MI TRABAJO',[['dashboard','Hoy',routes.panel],['agenda','Mi agenda',routes.agenda],['horarios','Mis horarios',routes.horarios]]]
  ]
};

const icons={dashboard:'▦',reservas:'▤',barberos:'✂',catalogo:'◇',galeria:'▧',usuarios:'◉',seguridad:'◆',config:'⚙',agenda:'▥',horarios:'◷'};
const titles={
  [routes.panel]:['Dashboard','Vista general del sistema'],
  [routes.agenda]:['Mi agenda','Tus próximas citas'],
  [routes.reservas]:['Reservas','Gestión de citas'],
  [routes.barberos]:['Barberos','Equipo profesional'],
  [routes.catalogoAdmin]:['Catálogo','Servicios de la barbería'],
  [routes.galeria]:['Galería','Trabajos y referencias'],
  [routes.horarios]:['Mis horarios','Disponibilidad semanal'],
  [routes.usuarios]:['Usuarios','Administradores y barberos'],
  [routes.seguridad]:['Seguridad','Restablecimiento de contraseñas'],
  [routes.configuracion]:['Configuración','Identidad, portal y datos del negocio']
};

function buildSidebar(path){
  const groups=menus[profile.rol]||[];
  $('sidebarNav').innerHTML=groups.map(([label,items])=>`
    <div class="nav-section-label">${label}</div>
    ${items.map(([icon,labelText,href])=>`<button class="side-item ${normalize(href)===path?'active':''}" data-side="${href}"><span class="side-item-icon">${icons[icon]||'•'}</span><span>${labelText}</span></button>`).join('')}
  `).join('');
  document.querySelectorAll('[data-side]').forEach(btn=>btn.onclick=()=>navigate(btn.dataset.side));
  $('sidebarName').textContent=settings.nombre_negocio||'Blessed';
  $('sidebarRole').textContent=profile.rol.replace('_',' ');
  $('sidebarUserName').textContent=profile.nombre;
  $('sidebarUserRole').textContent=profile.rol.replace('_',' ');
  $('sidebarAvatar').textContent=initials(profile.nombre);
}

function allowedPanelRoutes(){
  return new Set((menus[profile.rol]||[]).flatMap(x=>x[1].map(y=>normalize(y[2]))));
}

function setTopAction(label,handler){
  if(!label){$('topActionBtn').classList.add('hidden');$('topActionBtn').onclick=null;return;}
  $('topActionBtn').classList.remove('hidden');$('topActionBtn').textContent=label;$('topActionBtn').onclick=handler;
}

async function renderPanel(path){
  if(path!==routes.panel && !allowedPanelRoutes().has(path)) return navigate(routes.panel,true);
  buildSidebar(path);
  const [title,subtitle]=titles[path]||titles[routes.panel];
  $('pageTitle').textContent=title;$('pageSubtitle').textContent=subtitle;
  setTopAction(null,null);

  try{
    if(path===routes.panel)return renderDashboard();
    if(path===routes.agenda)return renderAgenda();
    if(path===routes.reservas)return renderReservations();
    if(path===routes.barberos)return renderBarbersAdmin();
    if(path===routes.catalogoAdmin)return renderServicesAdmin();
    if(path===routes.galeria)return renderGalleryAdmin();
    if(path===routes.horarios)return renderAvailability();
    if(path===routes.usuarios)return renderUsers();
    if(path===routes.seguridad)return renderSecurity();
    if(path===routes.configuracion)return renderConfiguration();
  }catch(e){
    $('staffContent').innerHTML=`<div class="notice err">${esc(e.message)}</div>`;
  }
}

async function getReservations(){
  let q=sb.from('reservas').select('*, servicios(nombre,precio), usuarios!reservas_barbero_id_fkey(nombre)').order('fecha',{ascending:true}).order('hora_inicio',{ascending:true});
  if(profile.rol==='barbero')q=q.eq('barbero_id',profile.id);
  const {data,error}=await q;
  if(error)throw error;
  return data||[];
}

function reservationLabel(r){
  const service=r.servicios?.nombre||'Sin servicio';
  const barber=r.usuarios?.nombre||'Barbero';
  return {service,barber};
}

async function renderDashboard(){
  const rows=await getReservations();
  const today=todayIso();
  const todayRows=rows.filter(r=>r.fecha===today);
  const {data:barberRows}=profile.rol==='barbero'?{data:[profile]}:await sb.from('usuarios').select('id,activo').eq('rol','barbero');
  $('staffContent').innerHTML=`
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-icon">▣</div><div class="stat-copy"><span>Citas hoy</span><b>${todayRows.length}</b></div></div>
      <div class="stat-card"><div class="stat-icon">▤</div><div class="stat-copy"><span>Próximas</span><b>${rows.filter(r=>r.fecha>=today&&r.estado==='reservada').length}</b></div></div>
      <div class="stat-card"><div class="stat-icon">✂</div><div class="stat-copy"><span>Barberos activos</span><b>${(barberRows||[]).filter(x=>x.activo!==false).length}</b></div></div>
    </div>
    <div class="panel-grid">
      <div class="panel-card">
        <div class="panel-card-title"><div><h3>${profile.rol==='barbero'?'Mis citas de hoy':'Reservas de hoy'}</h3><p>Agenda actual</p></div></div>
        <div class="data-list">${todayRows.slice(0,8).map(r=>{const l=reservationLabel(r);return `<div class="data-row"><div><strong>${esc(r.cliente_nombre)} · ${hhmm(r.hora_inicio)}</strong><small>${esc(l.service)} · ${esc(l.barber)}</small></div><span class="status-pill">${esc(r.estado)}</span></div>`}).join('')||'<div class="empty-block">No hay citas para hoy.</div>'}</div>
      </div>
      <div class="panel-card">
        <div class="panel-card-title"><div><h3>Accesos rápidos</h3><p>Solo módulos de la barbería</p></div></div>
        <div class="data-list">
          <button class="data-row" data-quick="${profile.rol==='barbero'?routes.agenda:routes.reservas}"><div><strong>Ver reservas</strong><small>Agenda y clientes</small></div><b>→</b></button>
          ${profile.rol!=='barbero'?`<button class="data-row" data-quick="${routes.barberos}"><div><strong>Equipo</strong><small>Barberos y perfiles</small></div><b>→</b></button><button class="data-row" data-quick="${routes.catalogoAdmin}"><div><strong>Catálogo</strong><small>Servicios publicados</small></div><b>→</b></button>`:`<button class="data-row" data-quick="${routes.horarios}"><div><strong>Mis horarios</strong><small>Disponibilidad semanal</small></div><b>→</b></button>`}
        </div>
      </div>
    </div>`;
  document.querySelectorAll('[data-quick]').forEach(btn=>btn.onclick=()=>navigate(btn.dataset.quick));
}

async function renderAgenda(){
  const rows=await getReservations();
  $('staffContent').innerHTML=`<div class="panel-card"><div class="panel-card-title"><div><h3>Mi agenda</h3><p>Próximas citas</p></div></div><div class="data-list">${rows.filter(r=>r.fecha>=todayIso()).map(r=>{const l=reservationLabel(r);return `<div class="data-row"><div><strong>${esc(r.cliente_nombre)} · ${esc(r.fecha)} · ${hhmm(r.hora_inicio)}</strong><small>${esc(l.service)} · ${esc(r.cliente_telefono)}</small></div>${r.estado==='reservada'?`<button class="icon-btn primary" data-attend="${r.id}">Atendida</button>`:`<span class="status-pill">${esc(r.estado)}</span>`}</div>`}).join('')||'<div class="empty-block">No tienes próximas citas.</div>'}</div></div>`;
  bindAttendButtons();
}

async function renderReservations(){
  const rows=await getReservations();
  setTopAction(null,null);
  $('staffContent').innerHTML=`
    <div class="toolbar">
      <input id="resSearch" class="search" placeholder="Buscar cliente, teléfono o servicio...">
      <select id="resStatus"><option value="">Todos los estados</option><option value="reservada">Reservada</option><option value="atendida">Atendida</option></select>
      <input id="resDate" type="date">
    </div>
    <div id="reservationTable"></div>`;
  const apply=()=>{
    const q=$('resSearch').value.toLowerCase().trim(),status=$('resStatus').value,date=$('resDate').value;
    const filtered=rows.filter(r=>{
      const l=reservationLabel(r);
      const hay=`${r.cliente_nombre} ${r.cliente_telefono} ${l.service} ${l.barber}`.toLowerCase();
      return (!q||hay.includes(q))&&(!status||r.estado===status)&&(!date||r.fecha===date);
    });
    $('reservationTable').innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr><th>Fecha</th><th>Hora</th><th>Cliente</th><th>Servicio</th><th>Barbero</th><th>Estado</th><th></th></tr></thead><tbody>${filtered.map(r=>{const l=reservationLabel(r);return `<tr><td>${esc(r.fecha)}</td><td><b>${hhmm(r.hora_inicio)}</b></td><td><b>${esc(r.cliente_nombre)}</b><small style="display:block;color:#8b837a">${esc(r.cliente_telefono)}</small></td><td>${esc(l.service)}</td><td>${esc(l.barber)}</td><td><span class="status-pill">${esc(r.estado)}</span></td><td>${r.estado==='reservada'?`<button class="icon-btn primary" data-attend="${r.id}">Atendida</button>`:''}</td></tr>`}).join('')||'<tr><td colspan="7"><div class="empty-block">No hay reservas con esos filtros.</div></td></tr>'}</tbody></table></div>`;
    bindAttendButtons();
  };
  ['resSearch','resStatus','resDate'].forEach(id=>$(id).addEventListener('input',apply));apply();
}

function bindAttendButtons(){
  document.querySelectorAll('[data-attend]').forEach(btn=>btn.onclick=async()=>{
    try{
      await sb.rpc('marcar_reserva_atendida',{p_reserva_id:btn.dataset.attend});
      toast('Reserva marcada como atendida','success');
      renderRoute();
    }catch(e){toast(e.message,'error')}
  });
}

function modalHtml(title,body,saveLabel='Guardar'){
  return `<div class="modal-overlay" id="activeModal"><div class="modal"><div class="modal-header"><h3>${title}</h3><button class="modal-close" data-close-modal>×</button></div><div class="modal-body">${body}</div><div class="modal-footer"><button class="btn ghost compact" data-close-modal>Cancelar</button><button class="btn dark compact" id="modalSave">${saveLabel}</button></div></div></div>`;
}
function closeModal(){$('modalRoot').innerHTML='';}
function bindModalClose(){document.querySelectorAll('[data-close-modal]').forEach(x=>x.onclick=closeModal);}

async function renderBarbersAdmin(){
  const {data,error}=await sb.from('usuarios').select('id,nombre,rol,telefono,especialidad,bio,foto_url,activo').eq('rol','barbero').order('nombre');
  if(error)throw error;
  setTopAction('+ Nuevo barbero',()=>openBarberModal());
  $('staffContent').innerHTML=`<div class="admin-barber-grid">${(data||[]).map(b=>`
    <article class="admin-card">
      <div class="admin-card-photo">${b.foto_url?`<img src="${esc(b.foto_url)}" alt="">`:initials(b.nombre)}</div>
      <div class="admin-card-body"><h4>${esc(b.nombre)}</h4><p>${esc(b.especialidad||'Barbero profesional')}<br>${esc(b.bio||'')}</p>
      <div class="admin-card-footer"><span class="status-pill">${b.activo?'activo':'inactivo'}</span><div class="actions"><button class="icon-btn" data-edit-barber="${b.id}">Editar</button></div></div></div>
    </article>`).join('')||'<div class="empty-block">No hay barberos.</div>'}</div>`;
  document.querySelectorAll('[data-edit-barber]').forEach(btn=>{
    const row=(data||[]).find(x=>x.id===btn.dataset.editBarber);btn.onclick=()=>openBarberModal(row);
  });
}

function openBarberModal(row=null){
  const isEdit=!!row;
  const body=`
    ${!isEdit?`<label class="field"><b>Correo</b><input id="barberEmail" type="email"></label><label class="field" style="margin-top:9px"><b>Contraseña inicial</b><input id="barberPassword" type="password"></label>`:''}
    <div class="form-grid" style="margin-top:9px"><label class="field"><b>Nombre</b><input id="barberName" value="${esc(row?.nombre||'')}"></label><label class="field"><b>Teléfono</b><input id="barberPhone" value="${esc(row?.telefono||'')}"></label></div>
    <label class="field" style="margin-top:9px"><b>Especialidad</b><input id="barberSpecialty" value="${esc(row?.especialidad||'')}" placeholder="Fade, barba, cortes clásicos..."></label>
    <label class="field" style="margin-top:9px"><b>Foto URL</b><input id="barberPhoto" value="${esc(row?.foto_url||'')}"></label>
    <label class="field" style="margin-top:9px"><b>Biografía</b><textarea id="barberBio" rows="3">${esc(row?.bio||'')}</textarea></label>
    ${isEdit?`<label style="display:flex;gap:8px;align-items:center;margin-top:12px;font-size:12px"><input id="barberActive" type="checkbox" ${row.activo?'checked':''}> Barbero activo</label>`:''}`;
  $('modalRoot').innerHTML=modalHtml(isEdit?'Editar barbero':'Nuevo barbero',body,isEdit?'Guardar cambios':'Crear barbero');bindModalClose();
  $('modalSave').onclick=async()=>{
    try{
      const payload={nombre:$('barberName').value.trim(),telefono:$('barberPhone').value.trim()||null,especialidad:$('barberSpecialty').value.trim()||null,foto_url:$('barberPhoto').value.trim()||null,bio:$('barberBio').value.trim()||null};
      if(isEdit){
        payload.activo=$('barberActive').checked;
        await api(`/api/users/${row.id}`,{method:'PATCH',body:JSON.stringify(payload)});
      }else{
        await api('/api/users',{method:'POST',body:JSON.stringify({...payload,email:$('barberEmail').value.trim(),password:$('barberPassword').value,rol:'barbero'})});
      }
      closeModal();barbers=[];toast(isEdit?'Barbero actualizado':'Barbero creado','success');renderBarbersAdmin();
    }catch(e){toast(e.message,'error')}
  };
}

async function renderServicesAdmin(){
  const {data,error}=await sb.from('servicios').select('*').order('destacado',{ascending:false}).order('orden').order('nombre');
  if(error)throw error;
  setTopAction('+ Nuevo servicio',()=>openServiceModal());
  $('staffContent').innerHTML=`<div class="admin-service-grid">${(data||[]).map(s=>`
    <article class="admin-card">
      <div class="admin-card-photo">${s.foto_url?`<img src="${esc(s.foto_url)}" alt="">`:'✂'}</div>
      <div class="admin-card-body"><h4>${esc(s.nombre)}</h4><p>${esc(s.descripcion||'')}<br><b>${money(s.precio)}</b> · ${Number(s.duracion_min||60)} min</p>
      <div class="admin-card-footer"><span class="status-pill">${s.activo?'activo':'inactivo'}</span><div class="actions"><button class="icon-btn" data-edit-service="${s.id}">Editar</button></div></div></div>
    </article>`).join('')||'<div class="empty-block">No hay servicios. Agrega el primero para habilitar reservas.</div>'}</div>`;
  document.querySelectorAll('[data-edit-service]').forEach(btn=>{
    const row=(data||[]).find(x=>Number(x.id)===Number(btn.dataset.editService));btn.onclick=()=>openServiceModal(row);
  });
}

function openServiceModal(row=null){
  const body=`
    <div class="form-grid"><label class="field"><b>Nombre</b><input id="svcName" value="${esc(row?.nombre||'')}"></label><label class="field"><b>Categoría</b><input id="svcCategory" value="${esc(row?.categoria||'Barbería')}"></label></div>
    <label class="field" style="margin-top:9px"><b>Descripción</b><textarea id="svcDescription" rows="3">${esc(row?.descripcion||'')}</textarea></label>
    <div class="form-grid" style="margin-top:9px"><label class="field"><b>Precio</b><input id="svcPrice" type="number" step="0.01" min="0" value="${row?.precio??0}"></label><label class="field"><b>Duración (min)</b><input id="svcDuration" type="number" min="15" max="240" step="15" value="${row?.duracion_min??60}"></label></div>
    <label class="field" style="margin-top:9px"><b>Foto URL</b><input id="svcPhoto" value="${esc(row?.foto_url||'')}"></label>
    <div style="display:flex;gap:18px;margin-top:12px;font-size:12px"><label><input id="svcFeatured" type="checkbox" ${row?.destacado?'checked':''}> Destacado</label><label><input id="svcActive" type="checkbox" ${row?.activo!==false?'checked':''}> Activo</label></div>`;
  $('modalRoot').innerHTML=modalHtml(row?'Editar servicio':'Nuevo servicio',body);bindModalClose();
  $('modalSave').onclick=async()=>{
    const payload={nombre:$('svcName').value.trim(),categoria:$('svcCategory').value.trim()||'Barbería',descripcion:$('svcDescription').value.trim()||null,precio:Number($('svcPrice').value||0),duracion_min:Number($('svcDuration').value||60),foto_url:$('svcPhoto').value.trim()||null,destacado:$('svcFeatured').checked,activo:$('svcActive').checked};
    try{
      if(row)await sb.from('servicios').update(payload).eq('id',row.id).throwOnError();
      else await sb.from('servicios').insert(payload).throwOnError();
      closeModal();services=[];toast('Servicio guardado','success');renderServicesAdmin();
    }catch(e){toast(e.message,'error')}
  };
}

async function renderAvailability(){
  const {data,error}=await sb.from('disponibilidad').select('*').eq('barbero_id',profile.id).order('dia_semana').order('hora_inicio');
  if(error)throw error;
  const days=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  setTopAction('+ Horario',()=>openAvailabilityModal());
  $('staffContent').innerHTML=`<div class="panel-card"><div class="panel-card-title"><div><h3>Disponibilidad semanal</h3><p>Bloques de una hora</p></div></div><div class="data-list">${(data||[]).map(s=>`<div class="data-row"><div><strong>${days[s.dia_semana]}</strong><small>${hhmm(s.hora_inicio)} – ${hhmm(s.hora_fin)}</small></div><button class="icon-btn danger" data-delete-slot="${s.id}">Eliminar</button></div>`).join('')||'<div class="empty-block">No tienes horarios configurados.</div>'}</div></div>`;
  document.querySelectorAll('[data-delete-slot]').forEach(btn=>btn.onclick=async()=>{await sb.from('disponibilidad').delete().eq('id',Number(btn.dataset.deleteSlot));toast('Horario eliminado','success');renderAvailability();});
}
function openAvailabilityModal(){
  const days=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  $('modalRoot').innerHTML=modalHtml('Agregar horario',`<label class="field"><b>Día</b><select id="slotDay">${days.map((d,i)=>`<option value="${i}" ${i===1?'selected':''}>${d}</option>`).join('')}</select></label><label class="field" style="margin-top:9px"><b>Hora de inicio</b><select id="slotHour">${Array.from({length:12},(_,i)=>i+8).map(h=>`<option value="${h}">${String(h).padStart(2,'0')}:00</option>`).join('')}</select></label>`);bindModalClose();
  $('modalSave').onclick=async()=>{const d=Number($('slotDay').value),h=Number($('slotHour').value);try{await sb.from('disponibilidad').insert({barbero_id:profile.id,dia_semana:d,hora_inicio:`${String(h).padStart(2,'0')}:00:00`,hora_fin:`${String(h+1).padStart(2,'0')}:00:00`}).throwOnError();closeModal();toast('Horario agregado','success');renderAvailability();}catch(e){toast(e.message,'error')}};
}

async function renderUsers(){
  const {data,error}=await sb.from('usuarios').select('id,nombre,rol,telefono,activo').order('rol').order('nombre');
  if(error)throw error;
  setTopAction('+ Nuevo admin',()=>openAdminModal());
  $('staffContent').innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr><th>Nombre</th><th>Rol</th><th>Teléfono</th><th>Estado</th></tr></thead><tbody>${(data||[]).map(u=>`<tr><td><b>${esc(u.nombre)}</b></td><td>${esc(u.rol)}</td><td>${esc(u.telefono||'—')}</td><td><span class="status-pill">${u.activo?'activo':'inactivo'}</span></td></tr>`).join('')}</tbody></table></div>`;
}
function openAdminModal(){
  $('modalRoot').innerHTML=modalHtml('Nuevo administrador',`<label class="field"><b>Nombre</b><input id="adminName"></label><label class="field" style="margin-top:9px"><b>Correo</b><input id="adminEmail" type="email"></label><label class="field" style="margin-top:9px"><b>Contraseña inicial</b><input id="adminPassword" type="password"></label>`);bindModalClose();
  $('modalSave').onclick=async()=>{try{await api('/api/users',{method:'POST',body:JSON.stringify({nombre:$('adminName').value.trim(),email:$('adminEmail').value.trim(),password:$('adminPassword').value,rol:'admin'})});closeModal();toast('Administrador creado','success');renderUsers();}catch(e){toast(e.message,'error')}};
}

async function renderSecurity(){
  const {data,error}=await sb.from('usuarios').select('id,nombre,rol').in('rol',['admin','barbero']).order('nombre');
  if(error)throw error;
  setTopAction(null,null);
  $('staffContent').innerHTML=`<div class="panel-card"><div class="panel-card-title"><div><h3>Restablecer contraseñas</h3><p>Solo el Super Admin puede realizar esta acción</p></div></div><div class="data-list">${(data||[]).map(u=>`<div class="data-row"><div><strong>${esc(u.nombre)}</strong><small>${esc(u.rol)}</small></div><button class="icon-btn" data-reset="${u.id}">Cambiar contraseña</button></div>`).join('')}</div></div>`;
  document.querySelectorAll('[data-reset]').forEach(btn=>btn.onclick=()=>openResetPassword(btn.dataset.reset,(data||[]).find(x=>x.id===btn.dataset.reset)?.nombre));
}
function openResetPassword(id,name){
  $('modalRoot').innerHTML=modalHtml(`Nueva contraseña · ${esc(name||'Usuario')}`,`<label class="field"><b>Nueva contraseña</b><input id="resetPassword" type="password" placeholder="Mínimo 8 caracteres"></label>`,'Actualizar');bindModalClose();
  $('modalSave').onclick=async()=>{try{await api(`/api/users/${id}/reset-password`,{method:'POST',body:JSON.stringify({newPassword:$('resetPassword').value})});closeModal();toast('Contraseña actualizada','success');}catch(e){toast(e.message,'error')}};
}

async function renderConfiguration(){
  setTopAction(null,null);
  const fields={
    negocio:[['nombre_negocio','Nombre del negocio'],['subtitulo','Subtítulo'],['slogan','Slogan'],['direccion','Dirección'],['telefono','Teléfono'],['whatsapp','WhatsApp'],['horario','Horario']],
    portal:[['hero_titulo','Título principal'],['hero_subtitulo','Texto principal'],['home_cta','Botón reserva'],['catalogo_titulo','Título catálogo'],['catalogo_subtitulo','Texto catálogo'],['login_titulo','Título login'],['login_subtitulo','Texto login']],
    redes:[['instagram_url','Instagram URL'],['facebook_url','Facebook URL'],['tiktok_url','TikTok URL'],['maps_url','Google Maps URL']],
    apariencia:[['logo_url','Logo URL / ruta'],['banner_principal_url','Banner principal'],['banner_secundario_url','Banner secundario'],['color_primario','Color principal'],['color_acento','Color acento']]
  };
  const block=(title,list)=>`<div class="config-block"><h3>${title}</h3><div class="config-grid">${list.map(([key,label])=>`<label class="field ${['hero_subtitulo','catalogo_subtitulo'].includes(key)?'full-span':''}"><b>${label}</b><input id="cfg_${key}" value="${esc(settings[key]||'')}"></label>`).join('')}</div></div>`;
  $('staffContent').innerHTML=`<div class="config-sections">${block('Información del negocio',fields.negocio)}${block('Portal público y login',fields.portal)}${block('Redes y ubicación',fields.redes)}${block('Apariencia',fields.apariencia)}</div><div style="margin-top:12px"><button class="btn dark" id="saveSettings">Guardar configuración</button></div><div id="settingsMsg"></div>`;
  $('saveSettings').onclick=async()=>{
    const patch={};Object.values(fields).flat().forEach(([key])=>patch[key]=$(`cfg_${key}`).value.trim());
    const {data,error}=await sb.from('configuracion_sistema').update(patch).eq('id',1).select().single();
    if(error)return notice($('settingsMsg'),error.message);
    settings={...settings,...data};applySettings();notice($('settingsMsg'),'Configuración guardada.',true);toast('Configuración actualizada','success');
  };
}

async function renderGalleryAdmin(){
  const {data,error}=await sb.from('galeria').select('*').order('orden').order('id');
  if(error)throw error;
  setTopAction('+ Subir imagen',()=>openGalleryModal());
  $('staffContent').innerHTML=`<div class="admin-gallery-grid">${(data||[]).map(g=>`<article class="admin-card"><div class="admin-card-photo"><img src="${esc(g.url)}" alt=""></div><div class="admin-card-body"><h4>${esc(g.titulo||'Sin título')}</h4><div class="admin-card-footer"><span class="status-pill">${g.activo?'visible':'oculta'}</span><div class="actions"><button class="icon-btn" data-gallery-toggle="${g.id}:${g.activo?'0':'1'}">${g.activo?'Ocultar':'Mostrar'}</button><button class="icon-btn danger" data-gallery-delete="${g.id}">Eliminar</button></div></div></div></article>`).join('')||'<div class="empty-block">No hay imágenes.</div>'}</div>`;
  document.querySelectorAll('[data-gallery-toggle]').forEach(btn=>btn.onclick=async()=>{const [id,v]=btn.dataset.galleryToggle.split(':');await sb.from('galeria').update({activo:v==='1'}).eq('id',Number(id));gallery=[];renderGalleryAdmin();});
  document.querySelectorAll('[data-gallery-delete]').forEach(btn=>btn.onclick=async()=>{if(!confirm('¿Eliminar esta imagen del catálogo visual?'))return;await sb.from('galeria').delete().eq('id',Number(btn.dataset.galleryDelete));gallery=[];renderGalleryAdmin();});
}
function openGalleryModal(){
  $('modalRoot').innerHTML=modalHtml('Subir imagen a galería',`<label class="field"><b>Título</b><input id="galleryTitle" placeholder="Ej. Fade clásico"></label><label class="field" style="margin-top:9px"><b>Imagen</b><input id="galleryFile" type="file" accept="image/*"></label>`,'Subir');bindModalClose();
  $('modalSave').onclick=async()=>{
    const file=$('galleryFile').files[0];if(!file)return toast('Selecciona una imagen','error');
    const ext=file.name.split('.').pop()?.toLowerCase()||'jpg';
    const path=`${Date.now()}-${crypto.randomUUID()}.${ext}`;
    try{
      const {error:upErr}=await sb.storage.from('galeria').upload(path,file,{cacheControl:'3600',upsert:false});if(upErr)throw upErr;
      const {data:pub}=sb.storage.from('galeria').getPublicUrl(path);
      const {error:insErr}=await sb.from('galeria').insert({url:pub.publicUrl,titulo:$('galleryTitle').value.trim()||null,creado_por:profile.id});if(insErr)throw insErr;
      closeModal();gallery=[];toast('Imagen subida','success');renderGalleryAdmin();
    }catch(e){toast(e.message,'error')}
  };
}

$('mobileSidebarBtn').onclick=()=>{$('sidebar').classList.add('open');$('sidebarOverlay').classList.remove('hidden');};
$('sidebarOverlay').onclick=()=>{$('sidebar').classList.remove('open');$('sidebarOverlay').classList.add('hidden');};

window.addEventListener('popstate',renderRoute);
bindRoutes();

(async()=>{
  await loadSettings();
  await loadProfile();
  await renderRoute();
})();
