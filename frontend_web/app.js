// Supabase se sirve localmente desde node_modules a través de Express.
// Esto evita que Helmet/CSP dependa de ejecutar módulos externos.
if (!window.supabase?.createClient) {
  document.body.innerHTML = '<div style="font-family:system-ui;padding:40px"><h2>No se pudo cargar Supabase</h2><p>Verifica /vendor/supabase/supabase.js en Render.</p></div>';
  throw new Error('Supabase browser SDK no disponible');
}
const { createClient } = window.supabase;
const CONFIG = window.__BLESSED_CONFIG__;
const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const routes = CONFIG.ROUTES;

let profile = null;
let settings = {...CONFIG.DEFAULTS};
let services = [];
let barbers = [];
let gallery = [];
let reservationsCache = [];
let selectedService = null;
let selectedBarber = null;
let selectedSlot = null;
let reserveStep = 1;
let calendarDate = new Date();
let dashboardChart = null;

const esc = v => String(v ?? '')
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'",'&#039;');

const initials = n => n ? n.trim().split(/\s+/).map(p=>p[0]).join('').slice(0,2).toUpperCase() : '?';
const money = v => `S/ ${Number(v||0).toFixed(2)}`;
const hhmm = v => String(v||'').slice(0,5);
const today = () => {
  const d=new Date(),o=d.getTimezoneOffset();
  return new Date(d.getTime()-o*60000).toISOString().slice(0,10);
};
const fmtDate = iso => {
  if(!iso)return '—';
  const [y,m,d]=String(iso).slice(0,10).split('-');
  return `${d}/${m}/${y}`;
};
const normalize = p => {
  const clean=String(p||'/').split('?')[0].replace(/\/+$/,'');
  return clean||'/';
};

function toast(msg,type='info'){
  const colors={success:'bg-green-600',error:'bg-red-600',warning:'bg-amber-500',info:'bg-gray-800'};
  const el=document.createElement('div');
  el.className=`toast ${colors[type]||colors.info} text-white text-sm px-4 py-2.5 rounded-xl shadow-lg pointer-events-auto transition`;
  el.textContent=msg;
  $('toastContainer').appendChild(el);
  setTimeout(()=>el.classList.add('opacity-0'),2500);
  setTimeout(()=>el.remove(),2900);
}

function notice(el,text,ok=false){
  if(!el)return;
  el.innerHTML=text?`<div class="mt-3 p-3 rounded-lg text-xs ${ok?'bg-green-50 border border-green-200 text-green-700':'bg-red-50 border border-red-200 text-red-700'}">${esc(text)}</div>`:'';
}

function navigate(path,replace=false){
  const p=normalize(path);
  if(replace)history.replaceState({},'',p);else history.pushState({},'',p);
  renderRoute();
}

function bindRouteButtons(){
  document.querySelectorAll('[data-route]').forEach(btn=>{
    btn.onclick=e=>{e.preventDefault();navigate(btn.dataset.route)};
  });
}

function setPublicNav(path){
  document.querySelectorAll('[data-public-nav]').forEach(btn=>{
    const target=btn.dataset.publicNav;
    btn.classList.toggle('active',target==='/'?path==='/':path===target);
  });
}

function showPublicPage(id){
  $('publicShell').classList.remove('hidden');
  $('appShell').classList.add('hidden');
  document.querySelectorAll('.public-page').forEach(p=>p.classList.add('hidden'));
  $(id).classList.remove('hidden');
  window.scrollTo({top:0,behavior:'smooth'});
}

function showApp(){
  $('publicShell').classList.add('hidden');
  $('appShell').classList.remove('hidden');
  $('appShell').style.display='flex';
}

async function loadSettings(){
  try{
    const {data,error}=await sb.from('configuracion_sistema').select('*').eq('id',1).maybeSingle();
    if(!error&&data)settings={...settings,...data};
  }catch(_){}
  applySettings();
}

function applySettings(){
  document.documentElement.style.setProperty('--color-primary',settings.color_primario||CONFIG.DEFAULTS.color_primario);
  document.documentElement.style.setProperty('--color-primary-dark',darken(settings.color_primario||CONFIG.DEFAULTS.color_primario));
  document.documentElement.style.setProperty('--color-accent',settings.color_acento||CONFIG.DEFAULTS.color_acento);
  document.documentElement.style.setProperty('--bp-color1',settings.barber_pole_color1||CONFIG.DEFAULTS.barber_pole_color1);
  document.documentElement.style.setProperty('--bp-color2',settings.barber_pole_color2||CONFIG.DEFAULTS.barber_pole_color2);
  document.documentElement.style.setProperty('--bp-color3',settings.barber_pole_color3||CONFIG.DEFAULTS.barber_pole_color3);
  document.documentElement.style.setProperty('--bp-speed',`${settings.barber_pole_speed||'1.35'}s`);
  document.documentElement.style.setProperty('--bg-grad1',settings.bg_grad_color1||CONFIG.DEFAULTS.bg_grad_color1);
  document.documentElement.style.setProperty('--bg-grad2',settings.bg_grad_color2||CONFIG.DEFAULTS.bg_grad_color2);
  document.documentElement.style.setProperty('--bg-grad3',settings.bg_grad_color3||CONFIG.DEFAULTS.bg_grad_color3);
  document.documentElement.style.setProperty('--bg-speed',`${settings.bg_anim_speed||'16'}s`);

  document.title=settings.nombre_negocio||'Blessed Barber Studio';

  const text=(id,v)=>{if($(id)&&v!==undefined&&v!==null)$(id).textContent=v};
  const img=(id,v)=>{if($(id)&&v)$(id).src=v};

  text('homeBusinessLabel',String(settings.nombre_negocio||'').toUpperCase());
  text('homeHeroText',settings.hero_subtitulo);
  text('catalogTitle',settings.catalogo_titulo);
  text('catalogSubtitle',settings.catalogo_subtitulo);
  text('reserveHeroName',String(settings.portal_nombre||settings.nombre_negocio||'Blessed').toUpperCase());
  text('reserveHeroTagline',settings.portal_tagline);
  text('reserveCity',`📍 ${settings.ciudad||'Perú'}`);
  text('loginBrandName',settings.nombre_negocio);
  text('loginBrandSlogan',settings.slogan);
  text('loginTitle',settings.login_titulo);
  text('loginSubtitle',settings.login_subtitulo);
  text('footerName',settings.nombre_negocio);
  text('footerInfo',[settings.direccion,settings.telefono,settings.horario].filter(Boolean).join(' · ')||'Sistema profesional de reservas.');
  text('sbName',settings.nombre_sistema||settings.nombre_negocio||'Blessed');

  if($('homeHeroTitle')&&settings.hero_titulo){
    const parts=settings.hero_titulo.split(',');
    $('homeHeroTitle').innerHTML=parts.length>1
      ? `${esc(parts[0])},<br><span class="text-gold">${esc(parts.slice(1).join(',').trim())}.</span>`
      : esc(settings.hero_titulo);
  }

  ['publicNavLogo','homeHeroBanner','loginBrandLogo','loginMobileLogo','sbLogo','footerLogo','reserveHeroLogo'].forEach(id=>{
    if(id==='homeHeroBanner')img(id,settings.banner_principal_url);
    else img(id,settings.logo_url);
  });

  document.querySelectorAll('.barber-pole-mini').forEach(x=>x.classList.toggle('hidden',settings.mostrar_barber_pole===false));
}

function darken(hex){
  try{
    const h=String(hex).replace('#','');
    const r=Math.max(0,parseInt(h.substring(0,2),16)-35);
    const g=Math.max(0,parseInt(h.substring(2,4),16)-35);
    const b=Math.max(0,parseInt(h.substring(4,6),16)-35);
    return `#${[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('')}`;
  }catch(_){return '#80612E'}
}

async function loadProfile(){
  const {data}=await sb.auth.getSession();
  if(!data.session){profile=null;updateAuthButtons();return null}
  const {data:p}=await sb.from('usuarios')
    .select('id,nombre,rol,telefono,especialidad,bio,foto_url,activo')
    .eq('id',data.session.user.id).maybeSingle();
  profile=p?.activo?p:null;
  updateAuthButtons();
  return profile;
}

function updateAuthButtons(){
  $('publicLoginBtn').classList.toggle('hidden',!!profile);
  $('publicPanelBtn').classList.toggle('hidden',!profile);
}

async function renderRoute(){
  const path=normalize(location.pathname);
  setPublicNav(path);
  updateAuthButtons();

  if(path===routes.home){showPublicPage('homePage');return}
  if(path===routes.catalogo){
    showPublicPage('catalogPage');
    await Promise.all([loadServices(),loadGallery()]);
    renderPublicCatalog();
    return;
  }
  if(path===routes.reservar){
    showPublicPage('bookingPage');
    await Promise.all([loadServices(),loadBarbers()]);
    resetReservationFlow(false);
    return;
  }
  if(path===routes.login){
    if(profile)return navigate(routes.panel,true);
    showPublicPage('loginPage');return;
  }

  if(path===routes.panel||path.startsWith('/panel/')){
    if(!profile){
      await loadProfile();
      if(!profile)return navigate(routes.login,true);
    }
    showApp();
    await renderAdminRoute(path);
    return;
  }

  navigate(routes.home,true);
}

async function loadServices(force=false){
  if(services.length&&!force)return services;
  const {data,error}=await sb.rpc('listar_servicios_publicos');
  services=error?[]:(data||[]);
  return services;
}
async function loadBarbers(force=false){
  if(barbers.length&&!force)return barbers;
  const {data,error}=await sb.rpc('listar_barberos_publicos');
  barbers=error?[]:(data||[]);
  return barbers;
}
async function loadGallery(force=false){
  if(gallery.length&&!force)return gallery;
  const {data,error}=await sb.from('galeria').select('*').eq('activo',true).order('orden').order('id');
  gallery=error?[]:(data||[]);
  return gallery;
}

function renderPublicCatalog(){
  $('publicServices').innerHTML=services.length?services.map(s=>`
    <article class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div class="h-44 bg-gray-900 flex items-center justify-center text-gold text-5xl font-serif overflow-hidden">
        ${s.foto_url?`<img src="${esc(s.foto_url)}" class="w-full h-full object-cover" alt="${esc(s.nombre)}">`:'✂'}
      </div>
      <div class="p-4">
        <div class="flex items-start gap-3">
          <div class="flex-1"><h3 class="font-semibold text-sm text-gray-900">${esc(s.nombre)}</h3><p class="text-xs text-gray-400 mt-1">${esc(s.categoria||'Barbería')}</p></div>
          <div class="font-bold text-sm text-gold-dark">${money(s.precio)}</div>
        </div>
        <p class="text-xs text-gray-500 leading-5 mt-3 min-h-[40px]">${esc(s.descripcion||'Servicio profesional Blessed.')}</p>
        <div class="flex gap-2 mt-3"><span class="badge badge-amber">${Number(s.duracion_min||60)} min</span>${s.destacado?'<span class="badge badge-purple">Destacado</span>':''}</div>
        <button data-book-service="${s.id}" class="w-full mt-4 bg-gray-900 text-white py-2.5 rounded-xl text-xs font-semibold">Reservar este servicio</button>
      </div>
    </article>`).join(''):'<div class="col-span-full text-center py-12 text-sm text-gray-400">Aún no hay servicios configurados.</div>';

  document.querySelectorAll('[data-book-service]').forEach(btn=>{
    btn.onclick=()=>{
      selectedService=services.find(x=>Number(x.id)===Number(btn.dataset.bookService))||null;
      navigate(routes.reservar);
    };
  });

  $('publicGallery').innerHTML=gallery.length?gallery.map(g=>`
    <div class="aspect-square rounded-2xl overflow-hidden bg-gray-900 relative group">
      <img src="${esc(g.url)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" alt="${esc(g.titulo||'Trabajo Blessed')}">
      ${g.titulo?`<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10 text-white text-xs">${esc(g.titulo)}</div>`:''}
    </div>`).join(''):'<div class="col-span-full text-center py-12 text-sm text-gray-400">La galería está lista para recibir trabajos.</div>';
}

/* ---------- RESERVA ---------- */
function setReserveStep(step){
  reserveStep=step;
  for(let i=1;i<=4;i++){
    $(`reserveStep${i}`).classList.toggle('hidden',i!==step);
    $(`reserveBar${i}`).classList.toggle('active',i<=step);
  }
  $('reserveSuccess').classList.add('hidden');
  $('reserveStepText').textContent=`Paso ${step} de 4 · ${['Elige un servicio','Elige tu barbero','Elige fecha y hora','Completa tus datos'][step-1]}`;
}

function resetReservationFlow(clear=true){
  if(clear){selectedService=null;selectedBarber=null;selectedSlot=null}
  $('reserveDate').min=today();
  $('reserveDate').value=today();
  $('clientName').value='';$('clientPhone').value='';$('clientNotes').value='';
  $('reserveContinue').disabled=true;
  notice($('publicMsg'),'');
  renderReserveServices();
  renderReserveBarbers();
  updateBookingSummary();
  setReserveStep(selectedService?2:1);
}

function renderReserveServices(){
  $('reserveServices').innerHTML=services.length?services.map(s=>`
    <button data-select-service="${s.id}" class="step-card ${selectedService&&Number(selectedService.id)===Number(s.id)?'selected':''} border border-gray-100 rounded-xl p-3 text-left bg-white">
      <div class="flex gap-3 items-center">
        <div class="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center overflow-hidden flex-shrink-0">
          ${s.foto_url?`<img src="${esc(s.foto_url)}" class="w-full h-full object-cover" alt="">`:'✂'}
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-semibold text-sm text-gray-900 truncate">${esc(s.nombre)}</div>
          <div class="text-xs text-gray-400 mt-1">${money(s.precio)} · ${Number(s.duracion_min||60)} min</div>
        </div>
      </div>
    </button>`).join(''):'<p class="text-sm text-gray-400 py-5 text-center col-span-full">Configura al menos un servicio desde Panel → Catálogo.</p>';

  document.querySelectorAll('[data-select-service]').forEach(btn=>btn.onclick=()=>{
    selectedService=services.find(x=>Number(x.id)===Number(btn.dataset.selectService))||null;
    selectedBarber=null;selectedSlot=null;
    renderReserveServices();renderReserveBarbers();updateBookingSummary();setReserveStep(2);
  });
}

function renderReserveBarbers(){
  $('reserveBarbers').innerHTML=barbers.length?barbers.map(b=>`
    <button data-select-barber="${b.id}" class="step-card ${selectedBarber?.id===b.id?'selected':''} border border-gray-100 rounded-xl p-3 text-left bg-white">
      <div class="flex gap-3 items-center">
        <div class="w-11 h-11 rounded-full av-ring flex items-center justify-center overflow-hidden text-white text-xs font-bold flex-shrink-0">
          ${b.foto_url?`<img src="${esc(b.foto_url)}" class="w-full h-full object-cover" alt="">`:initials(b.nombre)}
        </div>
        <div class="min-w-0">
          <div class="font-semibold text-sm text-gray-900 truncate">${esc(b.nombre)}</div>
          <div class="text-xs text-gray-400 mt-1 truncate">${esc(b.especialidad||'Barbero profesional')}</div>
        </div>
      </div>
    </button>`).join(''):'<p class="text-sm text-gray-400 py-5 text-center col-span-full">Aún no hay barberos activos.</p>';

  document.querySelectorAll('[data-select-barber]').forEach(btn=>btn.onclick=async()=>{
    selectedBarber=barbers.find(x=>x.id===btn.dataset.selectBarber)||null;
    selectedSlot=null;
    renderReserveBarbers();updateBookingSummary();setReserveStep(3);await loadSlots();
  });
}

async function loadSlots(){
  if(!selectedBarber)return;
  $('reserveSlots').innerHTML='<div class="col-span-full text-xs text-gray-400 py-4 text-center">Consultando horarios...</div>';
  const {data,error}=await sb.rpc('horarios_disponibles',{p_barbero_id:selectedBarber.id,p_fecha:$('reserveDate').value});
  if(error){$('reserveSlots').innerHTML='<div class="col-span-full text-xs text-red-500 py-4 text-center">No se pudieron consultar los horarios.</div>';return}
  const rows=data||[];
  $('reserveSlots').innerHTML=rows.length?rows.map(s=>`<button class="tslot border border-gray-200 rounded-lg py-2.5 text-xs bg-white" data-slot="${esc(s.hora_inicio)}">${hhmm(s.hora_inicio)}</button>`).join(''):'<div class="col-span-full text-xs text-gray-400 py-5 text-center">No hay horarios libres para esa fecha.</div>';
  document.querySelectorAll('[data-slot]').forEach(btn=>btn.onclick=()=>{
    selectedSlot=rows.find(s=>String(s.hora_inicio)===btn.dataset.slot)||null;
    document.querySelectorAll('[data-slot]').forEach(x=>x.classList.remove('selected'));
    btn.classList.add('selected');$('reserveContinue').disabled=false;updateBookingSummary();
  });
}

$('reserveDate').addEventListener('change',async()=>{selectedSlot=null;$('reserveContinue').disabled=true;updateBookingSummary();await loadSlots()});
$('reserveContinue').onclick=()=>{if(selectedSlot)setReserveStep(4)};
document.querySelectorAll('[data-back-reserve]').forEach(btn=>btn.onclick=()=>setReserveStep(Number(btn.dataset.backReserve)));
$('newBookingBtn').onclick=()=>resetReservationFlow(true);

function updateBookingSummary(){
  const rows=[
    ['Servicio',selectedService?.nombre||'—'],
    ['Barbero',selectedBarber?.nombre||'—'],
    ['Fecha',$('reserveDate')?.value?fmtDate($('reserveDate').value):'—'],
    ['Hora',selectedSlot?hhmm(selectedSlot.hora_inicio):'—'],
    ['Precio',selectedService?money(selectedService.precio):'—']
  ];
  $('bookingSummary').innerHTML=rows.map(([a,b])=>`<div class="flex justify-between gap-3 text-xs py-1.5 border-b border-gray-100 last:border-0"><span class="text-gray-400">${a}</span><strong class="text-gray-800 text-right">${esc(b)}</strong></div>`).join('');
}

$('bookBtn').onclick=async()=>{
  notice($('publicMsg'),'');
  const nombre=$('clientName').value.trim(),telefono=$('clientPhone').value.trim(),notas=$('clientNotes').value.trim();
  if(!selectedService)return notice($('publicMsg'),'Selecciona un servicio.');
  if(!selectedBarber)return notice($('publicMsg'),'Selecciona un barbero.');
  if(!selectedSlot)return notice($('publicMsg'),'Selecciona un horario.');
  if(nombre.length<2)return notice($('publicMsg'),'Ingresa tu nombre.');
  if(telefono.replace(/\D/g,'').length<6)return notice($('publicMsg'),'Ingresa un teléfono válido.');

  $('bookBtn').disabled=true;$('bookBtn').textContent='Registrando...';
  const {error}=await sb.rpc('crear_reserva_publica_v2',{
    p_servicio_id:Number(selectedService.id),
    p_barbero_id:selectedBarber.id,
    p_cliente_nombre:nombre,
    p_cliente_telefono:telefono,
    p_fecha:$('reserveDate').value,
    p_hora_inicio:selectedSlot.hora_inicio,
    p_notas:notas||null
  });
  $('bookBtn').disabled=false;$('bookBtn').textContent='Confirmar reserva';

  if(error)return notice($('publicMsg'),error.message);
  $('successSummary').innerHTML=$('bookingSummary').innerHTML;
  for(let i=1;i<=4;i++)$(`reserveStep${i}`).classList.add('hidden');
  $('reserveSuccess').classList.remove('hidden');
  for(let i=1;i<=4;i++)$(`reserveBar${i}`).classList.add('active');
};

/* ---------- LOGIN ---------- */
$('togglePassword').onclick=()=>{
  const p=$('loginPassword');
  const show=p.type==='password';
  p.type=show?'text':'password';
  $('togglePassword').textContent=show?'OCULTAR':'VER';
};

$('loginBtn').onclick=async()=>{
  notice($('loginMsg'),'');
  const email=$('loginEmail').value.trim().toLowerCase(),password=$('loginPassword').value;
  if(!email||!password)return notice($('loginMsg'),'Completa todos los campos.');

  $('loginBtn').disabled=true;$('loginBtn').textContent='Verificando...';
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  $('loginBtn').disabled=false;$('loginBtn').textContent='Ingresar al sistema';
  if(error)return notice($('loginMsg'),error.message);

  const {data:p,error:pe}=await sb.from('usuarios')
    .select('id,nombre,rol,telefono,especialidad,bio,foto_url,activo')
    .eq('id',data.user.id).single();

  if(pe||!p?.activo){await sb.auth.signOut();return notice($('loginMsg'),'Usuario sin perfil activo.')}
  profile=p;updateAuthButtons();navigate(routes.panel,true);
};

$('logoutBtn').onclick=async()=>{await sb.auth.signOut();profile=null;updateAuthButtons();navigate(routes.home)};

/* ---------- BACKEND API ---------- */
async function api(path,options={}){
  const session=(await sb.auth.getSession()).data.session;
  const res=await fetch(`${CONFIG.BACKEND_URL}${path}`,{
    ...options,
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${session?.access_token||''}`,...(options.headers||{})}
  });
  const body=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(body.error||'Error del servidor');
  return body;
}

/* ---------- ADMIN SHELL ---------- */
const ROLE_LABELS={super_admin:'Super Admin',admin:'Administrador',barbero:'Barbero'};

const menuByRole={
  super_admin:[
    ['PRINCIPAL',[
      ['dashboard','📊','Dashboard',routes.panel],
      ['reservas','📋','Reservas',routes.reservas],
      ['calendario','📅','Calendario',routes.calendario]
    ]],
    ['GESTIÓN',[
      ['barberos','✂️','Barberos',routes.barberos],
      ['catalogo','💈','Catálogo',routes.catalogoAdmin],
      ['galeria','📸','Galería',routes.galeria]
    ]],
    ['SISTEMA',[
      ['usuarios','👥','Usuarios',routes.usuarios],
      ['seguridad','🔐','Seguridad',routes.seguridad],
      ['config','⚙️','Configuración',routes.configuracion]
    ]]
  ],
  admin:[
    ['PRINCIPAL',[
      ['dashboard','📊','Dashboard',routes.panel],
      ['reservas','📋','Reservas',routes.reservas],
      ['calendario','📅','Calendario',routes.calendario]
    ]],
    ['GESTIÓN',[
      ['barberos','✂️','Barberos',routes.barberos],
      ['catalogo','💈','Catálogo',routes.catalogoAdmin],
      ['galeria','📸','Galería',routes.galeria]
    ]]
  ],
  barbero:[
    ['MI TRABAJO',[
      ['dashboard','📊','Dashboard',routes.panel],
      ['agenda','📅','Mi Agenda',routes.agenda],
      ['horarios','🕐','Mis Horarios',routes.horarios]
    ]]
  ]
};

const pageMeta={
  [routes.panel]:['Dashboard','Vista general del negocio'],
  [routes.reservas]:['Reservas','Gestión de citas'],
  [routes.calendario]:['Calendario','Vista mensual de reservas'],
  [routes.barberos]:['Barberos','Equipo profesional'],
  [routes.catalogoAdmin]:['Catálogo','Servicios publicados'],
  [routes.galeria]:['Galería','Trabajos de Blessed'],
  [routes.agenda]:['Mi Agenda','Próximas citas'],
  [routes.horarios]:['Mis Horarios','Configura tu disponibilidad'],
  [routes.usuarios]:['Usuarios','Administradores y barberos'],
  [routes.seguridad]:['Seguridad','Restablecimiento de contraseñas'],
  [routes.configuracion]:['Configuración','Negocio, portal y apariencia']
};

function allowedRoutes(){
  return new Set((menuByRole[profile.rol]||[]).flatMap(g=>g[1].map(i=>normalize(i[3]))));
}

function buildSidebar(path){
  $('sidebarNav').innerHTML=(menuByRole[profile.rol]||[]).map(([group,items])=>`
    <div class="text-[9px] uppercase tracking-widest text-gray-600 font-semibold px-3 pt-4 pb-1">${group}</div>
    ${items.map(([id,icon,label,href])=>`
      <button data-side-route="${href}" class="nav-item ${normalize(href)===path?'active':''} w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition">
        <span class="text-base leading-none">${icon}</span>
        <span class="font-medium">${label}</span>
      </button>`).join('')}
  `).join('');

  document.querySelectorAll('[data-side-route]').forEach(btn=>btn.onclick=()=>{
    closeSidebar();navigate(btn.dataset.sideRoute);
  });

  $('sbName').textContent=settings.nombre_sistema||'Blessed';
  $('sbRole').textContent=ROLE_LABELS[profile.rol]||profile.rol;
  $('sbUserName').textContent=profile.nombre;
  $('sbUserRole').textContent=ROLE_LABELS[profile.rol]||profile.rol;
  $('sbAvatar').textContent=initials(profile.nombre);
}

function closeSidebar(){
  $('sidebar').classList.remove('open');
  $('sidebarOverlay').classList.add('hidden');
}
$('mobileSidebarBtn').onclick=()=>{
  $('sidebar').classList.toggle('open');
  $('sidebarOverlay').classList.toggle('hidden');
};
$('sidebarOverlay').onclick=closeSidebar;

function setPageMeta(path){
  const [title,subtitle]=pageMeta[path]||pageMeta[routes.panel];
  $('pageTitle').textContent=title;
  $('pageSubtitle').textContent=subtitle;
}

function showAdminPage(id){
  document.querySelectorAll('.admin-page').forEach(p=>p.classList.add('hidden'));
  $(id).classList.remove('hidden');
}

function setTopAction(label,fn){
  if(!label){$('topActionBtn').classList.add('hidden');$('topActionBtn').onclick=null;return}
  $('topActionBtn').classList.remove('hidden');
  $('topActionTxt').textContent=label;
  $('topActionBtn').onclick=fn;
}

async function renderAdminRoute(path){
  if(path!==routes.panel&&!allowedRoutes().has(path))return navigate(routes.panel,true);
  buildSidebar(path);setPageMeta(path);setTopAction(null,null);

  if(path===routes.panel){showAdminPage('dashboardPage');return renderDashboard()}
  if(path===routes.reservas){showAdminPage('reservationsPage');return renderReservations()}
  if(path===routes.calendario){showAdminPage('calendarPage');return renderCalendar()}
  if(path===routes.barberos){showAdminPage('barbersPage');return renderBarbersAdmin()}
  if(path===routes.catalogoAdmin){showAdminPage('servicesPage');return renderServicesAdmin()}
  if(path===routes.galeria){showAdminPage('galleryPage');return renderGalleryAdmin()}
  if(path===routes.agenda){showAdminPage('agendaPage');return renderAgenda()}
  if(path===routes.horarios){showAdminPage('schedulePage');return renderSchedule()}
  if(path===routes.usuarios){showAdminPage('usersPage');return renderUsers()}
  if(path===routes.seguridad){showAdminPage('securityPage');return renderSecurity()}
  if(path===routes.configuracion){showAdminPage('configPage');return renderConfig()}
}

async function getReservations(force=true){
  if(!force&&reservationsCache.length)return reservationsCache;
  let q=sb.from('reservas')
    .select('*, servicios(nombre,precio), usuarios!reservas_barbero_id_fkey(nombre)')
    .order('fecha',{ascending:true}).order('hora_inicio',{ascending:true});
  if(profile.rol==='barbero')q=q.eq('barbero_id',profile.id);
  const {data,error}=await q;
  if(error)throw error;
  reservationsCache=data||[];
  return reservationsCache;
}

function labelsForReservation(r){
  return {service:r.servicios?.nombre||'Sin servicio',barber:r.usuarios?.nombre||profile?.nombre||'Barbero'};
}

/* DASHBOARD idéntico en estructura, sin finanzas */
async function renderDashboard(){
  const rows=await getReservations();
  const t=today();
  const todayRows=rows.filter(r=>r.fecha===t);
  const upcoming=rows.filter(r=>r.fecha>=t&&r.estado==='reservada');
  const pending=rows.filter(r=>r.estado==='reservada').length;
  const {data:barberRows}=profile.rol==='barbero'?{data:[profile]}:await sb.from('usuarios').select('id,activo').eq('rol','barbero');

  const cards=[
    {icon:'📅',label:'Citas hoy',val:todayRows.length,color:'blue'},
    {icon:'⏳',label:'Reservas activas',val:pending,color:'amber'},
    {icon:'🗓️',label:'Próximas',val:upcoming.length,color:'green'},
    {icon:'✂️',label:'Barberos activos',val:(barberRows||[]).filter(x=>x.activo!==false).length,color:'purple'}
  ];
  const colorMap={blue:'bg-blue-50 text-blue-600',amber:'bg-amber-50 text-amber-600',green:'bg-green-50 text-green-600',purple:'bg-purple-50 text-purple-600'};

  $('statsGrid').innerHTML=cards.map(c=>`
    <div class="stat-card bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-9 h-9 rounded-xl ${colorMap[c.color]} flex items-center justify-center text-lg">${c.icon}</div>
        <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">${c.label}</span>
      </div>
      <div class="text-2xl font-bold text-gray-900">${c.val}</div>
    </div>`).join('');

  renderReservationChart(rows);

  $('todayBadge').textContent=todayRows.length;
  $('todayAgenda').innerHTML=todayRows.length?todayRows.map(r=>{
    const l=labelsForReservation(r);
    const cls=r.estado==='atendida'?'border-green-400 bg-green-50':'border-amber-400 bg-amber-50';
    return `<div class="flex items-center gap-3 p-2.5 rounded-xl border-l-4 ${cls}">
      <div class="text-center min-w-12"><div class="font-bold text-sm">${hhmm(r.hora_inicio)}</div></div>
      <div class="flex-1 min-w-0"><div class="text-sm font-semibold truncate">${esc(r.cliente_nombre)}</div><div class="text-xs text-gray-500">${esc(l.service)} · ${esc(l.barber)}</div></div>
      <span class="badge ${r.estado==='atendida'?'badge-green':'badge-amber'}">${esc(r.estado)}</span>
    </div>`;
  }).join(''):'<p class="text-sm text-gray-400 py-5 text-center">Sin citas programadas para hoy</p>';

  const actions=profile.rol==='barbero'
    ? [
      {icon:'📅',label:'Mi Agenda',href:routes.agenda},
      {icon:'🕐',label:'Mis Horarios',href:routes.horarios},
      {icon:'🌐',label:'Portal de Reservas',href:routes.reservar}
    ]
    : [
      {icon:'📋',label:'Ver Reservas',href:routes.reservas},
      {icon:'📅',label:'Ver Calendario',href:routes.calendario},
      {icon:'✂️',label:'Administrar Barberos',href:routes.barberos},
      {icon:'💈',label:'Administrar Catálogo',href:routes.catalogoAdmin}
    ];

  $('quickActions').innerHTML=actions.map(a=>`
    <button data-quick="${a.href}" class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 border border-gray-100 text-sm font-medium transition text-left">
      <span class="text-lg">${a.icon}</span>${a.label}<span class="ml-auto text-gray-300">›</span>
    </button>`).join('');
  document.querySelectorAll('[data-quick]').forEach(btn=>btn.onclick=()=>navigate(btn.dataset.quick));
}

function renderReservationChart(rows){
  const canvas=$('dashboardChart'); if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const ratio=window.devicePixelRatio||1;
  const rect=canvas.getBoundingClientRect();
  const width=Math.max(320,Math.floor(rect.width||700));
  const height=Math.max(180,Math.floor(rect.height||256));
  canvas.width=width*ratio; canvas.height=height*ratio;
  ctx.setTransform(ratio,0,0,ratio,0,0);
  ctx.clearRect(0,0,width,height);

  const days=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return d.toISOString().slice(0,10)});
  const values=days.map(day=>rows.filter(r=>r.fecha===day).length);
  const max=Math.max(1,...values);
  const pad={l:34,r:14,t:18,b:30};
  const w=width-pad.l-pad.r, h=height-pad.t-pad.b;

  ctx.strokeStyle='#eef2f7';ctx.lineWidth=1;ctx.fillStyle='#94a3b8';ctx.font='10px system-ui';
  for(let i=0;i<=4;i++){
    const y=pad.t+h-(h*i/4);
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(width-pad.r,y);ctx.stroke();
    ctx.fillText(String(Math.round(max*i/4)),4,y+3);
  }

  const primary=settings.color_primario||'#B89454';
  const pts=values.map((v,i)=>({x:pad.l+(w*(i/(values.length-1||1))),y:pad.t+h-(h*v/max)}));
  const grad=ctx.createLinearGradient(0,pad.t,0,pad.t+h);grad.addColorStop(0,hexToRgba(primary,.22));grad.addColorStop(1,hexToRgba(primary,0));
  ctx.beginPath();ctx.moveTo(pts[0].x,pad.t+h);pts.forEach(p=>ctx.lineTo(p.x,p.y));ctx.lineTo(pts[pts.length-1].x,pad.t+h);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
  ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=primary;ctx.lineWidth=2.2;ctx.stroke();
  pts.forEach((p,i)=>{ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fillStyle=primary;ctx.fill();ctx.fillStyle='#94a3b8';ctx.textAlign='center';ctx.fillText(days[i].split('-').slice(1).reverse().join('/'),p.x,height-8)});
  ctx.textAlign='start';
}
function hexToRgba(hex,a){
  const h=String(hex||'#B89454').replace('#','');
  const full=h.length===3?h.split('').map(x=>x+x).join(''):h.padEnd(6,'0');
  const n=parseInt(full,16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}

/* RESERVAS */
async function renderReservations(){
  const rows=await getReservations();
  const draw=()=>{
    const q=$('reservationSearch').value.toLowerCase().trim(),status=$('reservationStatus').value,date=$('reservationDate').value;
    const filtered=rows.filter(r=>{
      const l=labelsForReservation(r);
      const hay=`${r.cliente_nombre} ${r.cliente_telefono} ${l.service} ${l.barber}`.toLowerCase();
      return(!q||hay.includes(q))&&(!status||r.estado===status)&&(!date||r.fecha===date);
    });
    $('reservationsTable').innerHTML=`<div class="overflow-x-auto"><table class="dtable w-full min-w-[800px]">
      <thead><tr><th>Fecha</th><th>Hora</th><th>Cliente</th><th>Servicio</th><th>Barbero</th><th>Estado</th><th></th></tr></thead>
      <tbody>${filtered.map(r=>{const l=labelsForReservation(r);return `<tr>
        <td>${fmtDate(r.fecha)}</td><td><b>${hhmm(r.hora_inicio)}</b></td>
        <td><div class="font-semibold">${esc(r.cliente_nombre)}</div><div class="text-[10px] text-gray-400">${esc(r.cliente_telefono)}</div></td>
        <td>${esc(l.service)}</td><td>${esc(l.barber)}</td>
        <td><span class="badge ${r.estado==='atendida'?'badge-green':'badge-amber'}">${esc(r.estado)}</span></td>
        <td>${r.estado==='reservada'?`<button data-attend="${r.id}" class="icon-btn primary">Atendida</button>`:''}</td>
      </tr>`}).join('')||'<tr><td colspan="7" class="text-center text-gray-400 py-8">Sin resultados</td></tr>'}</tbody>
    </table></div>`;
    bindAttend();
  };
  ['reservationSearch','reservationStatus','reservationDate'].forEach(id=>$(id).oninput=draw);draw();
}

function bindAttend(){
  document.querySelectorAll('[data-attend]').forEach(btn=>btn.onclick=async()=>{
    try{
      await sb.rpc('marcar_reserva_atendida',{p_reserva_id:btn.dataset.attend});
      reservationsCache=[];toast('Reserva marcada como atendida','success');renderAdminRoute(normalize(location.pathname));
    }catch(e){toast(e.message,'error')}
  });
}

/* CALENDARIO */
async function renderCalendar(){
  const rows=await getReservations();
  const y=calendarDate.getFullYear(),m=calendarDate.getMonth();
  $('calendarTitle').textContent=new Intl.DateTimeFormat('es-PE',{month:'long',year:'numeric'}).format(calendarDate);
  const first=new Date(y,m,1),last=new Date(y,m+1,0);
  const start=first.getDay(),days=last.getDate();
  const prevLast=new Date(y,m,0).getDate();
  const cells=[];

  for(let i=start-1;i>=0;i--)cells.push({day:prevLast-i,date:new Date(y,m-1,prevLast-i),other:true});
  for(let d=1;d<=days;d++)cells.push({day:d,date:new Date(y,m,d),other:false});
  let next=1;while(cells.length%7!==0){cells.push({day:next,date:new Date(y,m+1,next),other:true});next++}

  $('calendarGrid').innerHTML=cells.map(c=>{
    const iso=new Date(c.date.getTime()-c.date.getTimezoneOffset()*60000).toISOString().slice(0,10);
    const dayRows=rows.filter(r=>r.fecha===iso);
    return `<div class="cal-cell ${c.other?'other-month':''} ${iso===today()?'today':''}">
      <div class="text-[11px] font-semibold">${c.day}</div>
      <div>${dayRows.slice(0,3).map(r=>`<div class="cal-chip" title="${esc(r.cliente_nombre)}">${hhmm(r.hora_inicio)} ${esc(r.cliente_nombre)}</div>`).join('')}${dayRows.length>3?`<div class="text-[9px] text-gray-400 mt-1">+${dayRows.length-3} más</div>`:''}</div>
    </div>`;
  }).join('');

  $('calendarPrev').onclick=()=>{calendarDate=new Date(y,m-1,1);renderCalendar()};
  $('calendarNext').onclick=()=>{calendarDate=new Date(y,m+1,1);renderCalendar()};
}

/* BARBEROS */
async function renderBarbersAdmin(){
  const {data,error}=await sb.from('usuarios').select('id,nombre,rol,telefono,especialidad,bio,foto_url,activo').eq('rol','barbero').order('nombre');
  if(error)throw error;
  setTopAction('+ Nuevo Barbero',()=>openBarberModal());

  $('barbersAdminGrid').innerHTML=(data||[]).map(b=>`
    <article class="admin-card">
      <div class="admin-card-photo">${b.foto_url?`<img src="${esc(b.foto_url)}" alt="">`:initials(b.nombre)}</div>
      <div class="admin-card-body">
        <div class="flex items-start gap-2"><div class="flex-1"><div class="admin-card-title">${esc(b.nombre)}</div><div class="admin-card-sub">${esc(b.especialidad||'Barbero profesional')}</div></div><span class="badge ${b.activo?'badge-green':'badge-gray'}">${b.activo?'Activo':'Inactivo'}</span></div>
        <div class="admin-card-sub mt-3">${esc(b.bio||'Sin biografía.')}</div>
        <div class="mt-4 flex justify-end"><button data-edit-barber="${b.id}" class="icon-btn">Editar</button></div>
      </div>
    </article>`).join('')||'<div class="text-sm text-gray-400">No hay barberos.</div>';

  document.querySelectorAll('[data-edit-barber]').forEach(btn=>{
    const row=(data||[]).find(x=>x.id===btn.dataset.editBarber);btn.onclick=()=>openBarberModal(row);
  });
}

/* SERVICIOS */
async function renderServicesAdmin(){
  const {data,error}=await sb.from('servicios').select('*').order('destacado',{ascending:false}).order('orden').order('nombre');
  if(error)throw error;
  setTopAction('+ Nuevo Servicio',()=>openServiceModal());

  $('servicesAdminGrid').innerHTML=(data||[]).map(s=>`
    <article class="admin-card">
      <div class="admin-card-photo">${s.foto_url?`<img src="${esc(s.foto_url)}" alt="">`:'✂'}</div>
      <div class="admin-card-body">
        <div class="flex items-start gap-2"><div class="flex-1"><div class="admin-card-title">${esc(s.nombre)}</div><div class="admin-card-sub">${esc(s.categoria||'Barbería')} · ${Number(s.duracion_min||60)} min</div></div><span class="font-bold text-sm text-gold-dark">${money(s.precio)}</span></div>
        <div class="admin-card-sub mt-3">${esc(s.descripcion||'')}</div>
        <div class="mt-4 flex items-center justify-between"><span class="badge ${s.activo?'badge-green':'badge-gray'}">${s.activo?'Activo':'Inactivo'}</span><button data-edit-service="${s.id}" class="icon-btn">Editar</button></div>
      </div>
    </article>`).join('')||'<div class="text-sm text-gray-400">No hay servicios. Crea el primero para habilitar reservas.</div>';

  document.querySelectorAll('[data-edit-service]').forEach(btn=>{
    const row=(data||[]).find(x=>Number(x.id)===Number(btn.dataset.editService));btn.onclick=()=>openServiceModal(row);
  });
}

/* GALERIA */
async function renderGalleryAdmin(){
  const {data,error}=await sb.from('galeria').select('*').order('orden').order('id');
  if(error)throw error;
  setTopAction('+ Añadir Foto',()=>openGalleryModal());

  $('galleryAdminGrid').innerHTML=(data||[]).map(g=>`
    <article class="admin-card">
      <div class="aspect-square bg-gray-900 overflow-hidden"><img src="${esc(g.url)}" class="w-full h-full object-cover" alt=""></div>
      <div class="admin-card-body">
        <div class="admin-card-title">${esc(g.titulo||'Sin título')}</div>
        <div class="mt-3 flex items-center justify-between"><span class="badge ${g.activo?'badge-green':'badge-gray'}">${g.activo?'Visible':'Oculta'}</span>
          <div class="flex gap-1"><button data-toggle-gallery="${g.id}:${g.activo?'0':'1'}" class="icon-btn">${g.activo?'Ocultar':'Mostrar'}</button><button data-delete-gallery="${g.id}" class="icon-btn danger">Eliminar</button></div>
        </div>
      </div>
    </article>`).join('')||'<div class="text-sm text-gray-400">No hay imágenes.</div>';

  document.querySelectorAll('[data-toggle-gallery]').forEach(btn=>btn.onclick=async()=>{
    const [id,v]=btn.dataset.toggleGallery.split(':');await sb.from('galeria').update({activo:v==='1'}).eq('id',Number(id));gallery=[];renderGalleryAdmin();
  });
  document.querySelectorAll('[data-delete-gallery]').forEach(btn=>btn.onclick=async()=>{
    if(!confirm('¿Eliminar esta imagen?'))return;await sb.from('galeria').delete().eq('id',Number(btn.dataset.deleteGallery));gallery=[];renderGalleryAdmin();
  });
}

/* AGENDA BARBERO */
async function renderAgenda(){
  const rows=await getReservations();
  $('agendaList').innerHTML=rows.filter(r=>r.fecha>=today()).map(r=>{
    const l=labelsForReservation(r);
    return `<div class="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
      <div class="w-14 text-center"><div class="font-bold text-sm">${hhmm(r.hora_inicio)}</div><div class="text-[10px] text-gray-400">${fmtDate(r.fecha)}</div></div>
      <div class="flex-1 min-w-0"><div class="text-sm font-semibold">${esc(r.cliente_nombre)}</div><div class="text-xs text-gray-400">${esc(l.service)} · ${esc(r.cliente_telefono)}</div></div>
      ${r.estado==='reservada'?`<button data-attend="${r.id}" class="icon-btn primary">Atendida</button>`:`<span class="badge badge-green">Atendida</span>`}
    </div>`;
  }).join('')||'<div class="text-center py-8 text-sm text-gray-400">No tienes próximas citas.</div>';
  bindAttend();
}

/* HORARIOS */
async function renderSchedule(){
  const {data,error}=await sb.from('disponibilidad').select('*').eq('barbero_id',profile.id).order('dia_semana').order('hora_inicio');
  if(error)throw error;
  setTopAction('+ Agregar Horario',openScheduleModal);
  const days=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

  $('scheduleList').innerHTML=(data||[]).map(s=>`
    <div class="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
      <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">🕐</div>
      <div class="flex-1"><div class="text-sm font-semibold">${days[s.dia_semana]}</div><div class="text-xs text-gray-400">${hhmm(s.hora_inicio)} – ${hhmm(s.hora_fin)}</div></div>
      <button data-delete-schedule="${s.id}" class="icon-btn danger">Eliminar</button>
    </div>`).join('')||'<div class="text-center py-8 text-sm text-gray-400">No tienes horarios configurados.</div>';

  document.querySelectorAll('[data-delete-schedule]').forEach(btn=>btn.onclick=async()=>{
    await sb.from('disponibilidad').delete().eq('id',Number(btn.dataset.deleteSchedule));toast('Horario eliminado','success');renderSchedule();
  });
}

/* USUARIOS */
async function renderUsers(){
  const {data,error}=await sb.from('usuarios').select('id,nombre,rol,telefono,activo').order('rol').order('nombre');
  if(error)throw error;
  setTopAction('+ Nuevo Admin',openAdminModal);
  $('usersTable').innerHTML=`<div class="overflow-x-auto"><table class="dtable w-full min-w-[650px]">
    <thead><tr><th>Nombre</th><th>Rol</th><th>Teléfono</th><th>Estado</th></tr></thead>
    <tbody>${(data||[]).map(u=>`<tr><td><b>${esc(u.nombre)}</b></td><td>${esc(ROLE_LABELS[u.rol]||u.rol)}</td><td>${esc(u.telefono||'—')}</td><td><span class="badge ${u.activo?'badge-green':'badge-gray'}">${u.activo?'Activo':'Inactivo'}</span></td></tr>`).join('')}</tbody>
  </table></div>`;
}

/* SEGURIDAD */
async function renderSecurity(){
  const {data,error}=await sb.from('usuarios').select('id,nombre,rol').in('rol',['admin','barbero']).order('nombre');
  if(error)throw error;
  $('securityList').innerHTML=(data||[]).map(u=>`
    <div class="flex items-center gap-3 p-3 border border-gray-100 rounded-xl">
      <div class="w-9 h-9 rounded-full av-ring text-white flex items-center justify-center text-xs font-bold">${initials(u.nombre)}</div>
      <div class="flex-1"><div class="text-sm font-semibold">${esc(u.nombre)}</div><div class="text-xs text-gray-400">${esc(ROLE_LABELS[u.rol]||u.rol)}</div></div>
      <button data-reset-password="${u.id}" class="icon-btn">Cambiar contraseña</button>
    </div>`).join('');
  document.querySelectorAll('[data-reset-password]').forEach(btn=>btn.onclick=()=>openPasswordModal(btn.dataset.resetPassword));
}

/* CONFIGURACION: apariencia muy cercana al otro proyecto */
async function renderConfig(){
  const c=settings;
  $('configContent').innerHTML=`
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
      <div class="space-y-5">
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 class="font-serif text-base font-semibold mb-4 flex items-center gap-2">🏪 Información del negocio</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${cfgField('nombre_negocio','Nombre del negocio',c.nombre_negocio)}
            ${cfgField('nombre_sistema','Nombre en barra lateral',c.nombre_sistema)}
            ${cfgField('slogan','Slogan',c.slogan)}
            ${cfgField('direccion','Dirección',c.direccion)}
            ${cfgField('telefono','Teléfono',c.telefono)}
            ${cfgField('whatsapp','WhatsApp',c.whatsapp)}
            ${cfgField('ciudad','Ciudad',c.ciudad)}
            ${cfgField('horario','Horario',c.horario)}
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 class="font-serif text-base font-semibold mb-1 flex items-center gap-2">🌐 Portal público</h3>
          <p class="text-xs text-gray-400 mb-4">Home, catálogo, reservas y login.</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${cfgField('portal_nombre','Nombre del portal',c.portal_nombre)}
            ${cfgField('portal_tagline','Tagline reservas',c.portal_tagline)}
            ${cfgField('hero_titulo','Título Home',c.hero_titulo)}
            ${cfgField('hero_subtitulo','Texto Home',c.hero_subtitulo)}
            ${cfgField('catalogo_titulo','Título catálogo',c.catalogo_titulo)}
            ${cfgField('catalogo_subtitulo','Texto catálogo',c.catalogo_subtitulo)}
            ${cfgField('login_titulo','Título login',c.login_titulo)}
            ${cfgField('login_subtitulo','Texto login',c.login_subtitulo)}
          </div>
        </div>
      </div>

      <div class="space-y-5">
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 class="font-serif text-base font-semibold mb-4 flex items-center gap-2">🎨 Estética y marca</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${cfgField('logo_url','URL / ruta del Logo',c.logo_url)}
            ${cfgField('banner_principal_url','Banner principal',c.banner_principal_url)}
            ${cfgField('banner_secundario_url','Banner secundario',c.banner_secundario_url)}
            ${cfgColor('color_primario','Color primario',c.color_primario)}
            ${cfgColor('color_acento','Color de acento',c.color_acento)}
          </div>

          <div class="mt-5 border border-gray-100 rounded-xl p-4">
            <label class="flex items-center gap-3 cursor-pointer">
              <input id="cfg_mostrar_barber_pole" type="checkbox" ${c.mostrar_barber_pole!==false?'checked':''}>
              <div><div class="text-sm font-medium">💈 Mostrar Barber Pole</div><div class="text-xs text-gray-400">Decoración animada en /reservar</div></div>
            </label>
            <div class="grid grid-cols-3 gap-3 mt-4">
              ${cfgColor('barber_pole_color1','Color 1',c.barber_pole_color1)}
              ${cfgColor('barber_pole_color2','Color 2',c.barber_pole_color2)}
              ${cfgColor('barber_pole_color3','Color 3',c.barber_pole_color3)}
            </div>
            <div class="mt-3">${cfgField('barber_pole_speed','Velocidad (seg)',c.barber_pole_speed)}</div>
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 class="font-serif text-base font-semibold mb-4 flex items-center gap-2">📍 Redes y ubicación</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${cfgField('instagram_url','Instagram',c.instagram_url)}
            ${cfgField('facebook_url','Facebook',c.facebook_url)}
            ${cfgField('tiktok_url','TikTok',c.tiktok_url)}
            ${cfgField('maps_url','Google Maps',c.maps_url)}
          </div>
        </div>
      </div>
    </div>
    <button id="saveConfigBtn" class="mt-5 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-dark shadow-md">💾 Guardar configuración</button>
    <div id="configMsg"></div>`;

  $('saveConfigBtn').onclick=saveConfiguration;
}

function cfgField(key,label,value){
  return `<div><label class="config-label">${label}</label><input id="cfg_${key}" class="config-input" value="${esc(value||'')}"></div>`;
}
function cfgColor(key,label,value){
  return `<div><label class="config-label">${label}</label><div class="flex gap-2"><input id="cfg_${key}" type="color" value="${esc(value||'#000000')}" class="w-10 h-9 rounded-lg border border-gray-200"><input id="cfg_${key}_text" value="${esc(value||'#000000')}" class="config-input flex-1"></div></div>`;
}

async function saveConfiguration(){
  const keys=['nombre_negocio','nombre_sistema','slogan','direccion','telefono','whatsapp','ciudad','horario','portal_nombre','portal_tagline','hero_titulo','hero_subtitulo','catalogo_titulo','catalogo_subtitulo','login_titulo','login_subtitulo','logo_url','banner_principal_url','banner_secundario_url','instagram_url','facebook_url','tiktok_url','maps_url','barber_pole_speed'];
  const patch={};
  keys.forEach(k=>patch[k]=$(`cfg_${k}`)?.value.trim()??settings[k]);
  ['color_primario','color_acento','barber_pole_color1','barber_pole_color2','barber_pole_color3'].forEach(k=>patch[k]=$(`cfg_${k}`)?.value||settings[k]);
  patch.mostrar_barber_pole=$('cfg_mostrar_barber_pole').checked;

  const {data,error}=await sb.from('configuracion_sistema').update(patch).eq('id',1).select().single();
  if(error)return notice($('configMsg'),error.message);
  settings={...settings,...data};applySettings();notice($('configMsg'),'Configuración guardada.',true);toast('Configuración actualizada','success');
}

/* ---------- MODALES ---------- */
function openModal(title,body,onSave,saveText='Guardar'){
  $('modalRoot').innerHTML=`
    <div class="modal-overlay fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto animate-pop">
        <div class="p-4 border-b border-gray-100 flex items-center gap-3">
          <h3 class="font-semibold text-sm flex-1">${title}</h3>
          <button data-close-modal class="w-8 h-8 rounded-lg bg-gray-100 text-gray-500">×</button>
        </div>
        <div class="p-4">${body}</div>
        <div class="p-4 border-t border-gray-100 flex gap-2 justify-end">
          <button data-close-modal class="border border-gray-200 px-4 py-2 rounded-lg text-xs font-semibold">Cancelar</button>
          <button id="modalSaveBtn" class="bg-primary text-white px-4 py-2 rounded-lg text-xs font-semibold">${saveText}</button>
        </div>
      </div>
    </div>`;
  document.querySelectorAll('[data-close-modal]').forEach(b=>b.onclick=()=>{$('modalRoot').innerHTML=''});
  $('modalSaveBtn').onclick=onSave;
}
function closeModal(){$('modalRoot').innerHTML=''}

function modalInput(id,label,value='',type='text'){
  return `<div><label class="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">${label}</label><input id="${id}" type="${type}" value="${esc(value)}" class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"></div>`;
}

function openBarberModal(row=null){
  const isEdit=!!row;
  const body=`
    <div class="space-y-3">
      ${!isEdit?modalInput('barberEmail','Correo','', 'email')+modalInput('barberPassword','Contraseña inicial','', 'password'):''}
      <div class="grid sm:grid-cols-2 gap-3">${modalInput('barberName','Nombre',row?.nombre||'')}${modalInput('barberPhone','Teléfono',row?.telefono||'')}</div>
      ${modalInput('barberSpecialty','Especialidad',row?.especialidad||'')}
      ${modalInput('barberPhoto','Foto URL',row?.foto_url||'')}
      <div><label class="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Biografía</label><textarea id="barberBio" rows="3" class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm">${esc(row?.bio||'')}</textarea></div>
      ${isEdit?`<label class="flex items-center gap-2 text-xs"><input id="barberActive" type="checkbox" ${row.activo?'checked':''}> Barbero activo</label>`:''}
    </div>`;

  openModal(isEdit?'Editar barbero':'Nuevo barbero',body,async()=>{
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
  },isEdit?'Guardar cambios':'Crear barbero');
}

function openServiceModal(row=null){
  const body=`
    <div class="space-y-3">
      <div class="grid sm:grid-cols-2 gap-3">${modalInput('svcName','Nombre',row?.nombre||'')}${modalInput('svcCategory','Categoría',row?.categoria||'Barbería')}</div>
      <div><label class="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Descripción</label><textarea id="svcDescription" rows="3" class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm">${esc(row?.descripcion||'')}</textarea></div>
      <div class="grid sm:grid-cols-2 gap-3">${modalInput('svcPrice','Precio',row?.precio??0,'number')}${modalInput('svcDuration','Duración (min)',row?.duracion_min??60,'number')}</div>
      ${modalInput('svcPhoto','Foto URL',row?.foto_url||'')}
      <div class="flex gap-5 text-xs"><label><input id="svcFeatured" type="checkbox" ${row?.destacado?'checked':''}> Destacado</label><label><input id="svcActive" type="checkbox" ${row?.activo!==false?'checked':''}> Activo</label></div>
    </div>`;
  openModal(row?'Editar servicio':'Nuevo servicio',body,async()=>{
    try{
      const payload={nombre:$('svcName').value.trim(),categoria:$('svcCategory').value.trim()||'Barbería',descripcion:$('svcDescription').value.trim()||null,precio:Number($('svcPrice').value||0),duracion_min:Number($('svcDuration').value||60),foto_url:$('svcPhoto').value.trim()||null,destacado:$('svcFeatured').checked,activo:$('svcActive').checked};
      if(row)await sb.from('servicios').update(payload).eq('id',row.id).throwOnError();
      else await sb.from('servicios').insert(payload).throwOnError();
      closeModal();services=[];toast('Servicio guardado','success');renderServicesAdmin();
    }catch(e){toast(e.message,'error')}
  });
}

function openScheduleModal(){
  const days=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const body=`<div class="space-y-3">
    <div><label class="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Día</label><select id="slotDay" class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm">${days.map((d,i)=>`<option value="${i}" ${i===1?'selected':''}>${d}</option>`).join('')}</select></div>
    <div><label class="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Hora</label><select id="slotHour" class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm">${Array.from({length:12},(_,i)=>i+8).map(h=>`<option value="${h}">${String(h).padStart(2,'0')}:00</option>`).join('')}</select></div>
  </div>`;
  openModal('Agregar horario',body,async()=>{
    const d=Number($('slotDay').value),h=Number($('slotHour').value);
    try{
      await sb.from('disponibilidad').insert({barbero_id:profile.id,dia_semana:d,hora_inicio:`${String(h).padStart(2,'0')}:00:00`,hora_fin:`${String(h+1).padStart(2,'0')}:00:00`}).throwOnError();
      closeModal();toast('Horario agregado','success');renderSchedule();
    }catch(e){toast(e.message,'error')}
  });
}

function openAdminModal(){
  const body=`<div class="space-y-3">${modalInput('adminName','Nombre')}${modalInput('adminEmail','Correo','', 'email')}${modalInput('adminPassword','Contraseña inicial','', 'password')}</div>`;
  openModal('Nuevo administrador',body,async()=>{
    try{
      await api('/api/users',{method:'POST',body:JSON.stringify({nombre:$('adminName').value.trim(),email:$('adminEmail').value.trim(),password:$('adminPassword').value,rol:'admin'})});
      closeModal();toast('Administrador creado','success');renderUsers();
    }catch(e){toast(e.message,'error')}
  });
}

function openPasswordModal(id){
  openModal('Cambiar contraseña',modalInput('newPassword','Nueva contraseña','', 'password'),async()=>{
    try{
      await api(`/api/users/${id}/reset-password`,{method:'POST',body:JSON.stringify({newPassword:$('newPassword').value})});
      closeModal();toast('Contraseña actualizada','success');
    }catch(e){toast(e.message,'error')}
  },'Actualizar');
}

function openGalleryModal(){
  const body=`<div class="space-y-3">${modalInput('galleryTitle','Título')}<div><label class="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Imagen</label><input id="galleryFile" type="file" accept="image/*" class="w-full text-xs border border-gray-200 rounded-xl p-2.5"></div></div>`;
  openModal('Añadir foto',body,async()=>{
    const file=$('galleryFile').files[0];if(!file)return toast('Selecciona una imagen','error');
    const ext=file.name.split('.').pop()?.toLowerCase()||'jpg';
    const path=`${Date.now()}-${crypto.randomUUID()}.${ext}`;
    try{
      const {error:up}=await sb.storage.from('galeria').upload(path,file,{cacheControl:'3600'});if(up)throw up;
      const {data:pub}=sb.storage.from('galeria').getPublicUrl(path);
      const {error:ins}=await sb.from('galeria').insert({url:pub.publicUrl,titulo:$('galleryTitle').value.trim()||null,creado_por:profile.id});if(ins)throw ins;
      closeModal();gallery=[];toast('Foto añadida','success');renderGalleryAdmin();
    }catch(e){toast(e.message,'error')}
  },'Subir');
}

/* ROUTER */
window.addEventListener('popstate',renderRoute);
bindRouteButtons();

(async()=>{
  await loadSettings();
  await loadProfile();
  updateBookingSummary();
  await renderRoute();
})();
