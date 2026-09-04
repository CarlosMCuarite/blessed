import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { CONFIG } from './config.js';

const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);

let selectedBarber = null;
let selectedSlot = null;
let profile = null;

const ui = {
  show(view) {
    ['publicView', 'loginView', 'staffView'].forEach(id => $(id).classList.add('hidden'));
    $(view).classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  notice(el, text, ok = false) {
    el.innerHTML = text ? `<div class="notice ${ok ? 'ok' : 'err'}">${text}</div>` : '';
  },
  hhmm(v) {
    return String(v || '').slice(0, 5);
  },
  todayIso() {
    const d = new Date();
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
  },
  initials(name) {
    return String(name || 'B').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  },
  scrollToBooking() {
    $('bookingArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

function updateSummary() {
  const el = $('bookingSummary');
  if (!selectedBarber || !selectedSlot) {
    el.innerHTML = `
      <span>Resumen</span>
      <strong>Aún no seleccionaste un horario.</strong>`;
    return;
  }
  el.innerHTML = `
    <span>Resumen</span>
    <strong>${selectedBarber.nombre} · ${$('date').value} · ${ui.hhmm(selectedSlot.hora_inicio)}</strong>`;
}

async function loadBarbers() {
  $('barbers').innerHTML = '<div class="empty-state">Cargando profesionales...</div>';
  const { data, error } = await sb.rpc('listar_barberos_publicos');

  if (error) {
    $('barbers').innerHTML = '<div class="empty-state">No pudimos cargar los barberos.</div>';
    return;
  }

  $('barbers').innerHTML = '';

  for (const b of data) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'barber-card';
    card.innerHTML = `
      <span class="avatar">${ui.initials(b.nombre)}</span>
      <span>
        <strong>${b.nombre}</strong>
        <small>Barbero disponible</small>
      </span>`;

    card.onclick = async () => {
      selectedBarber = b;
      selectedSlot = null;
      [...$('barbers').children].forEach(x => x.classList.remove('active'));
      card.classList.add('active');
      updateSummary();
      await loadSlots();
    };

    $('barbers').appendChild(card);
  }

  if (!data.length) {
    $('barbers').innerHTML = '<div class="empty-state">Todavía no hay barberos activos.</div>';
  }
}

async function loadSlots() {
  selectedSlot = null;
  updateSummary();

  if (!selectedBarber) {
    $('slots').innerHTML = '<div class="empty-state">Selecciona primero un barbero.</div>';
    return;
  }

  $('slots').innerHTML = '<div class="empty-state">Consultando horarios...</div>';

  const { data, error } = await sb.rpc('horarios_disponibles', {
    p_barbero_id: selectedBarber.id,
    p_fecha: $('date').value
  });

  if (error) {
    $('slots').innerHTML = '<div class="empty-state">No pudimos consultar los horarios.</div>';
    return;
  }

  $('slots').innerHTML = '';

  for (const slot of data) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot';
    btn.textContent = `${ui.hhmm(slot.hora_inicio)} – ${ui.hhmm(slot.hora_fin)}`;

    btn.onclick = () => {
      selectedSlot = slot;
      [...$('slots').children].forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      updateSummary();
    };

    $('slots').appendChild(btn);
  }

  if (!data.length) {
    $('slots').innerHTML = '<div class="empty-state">No hay horarios libres para esa fecha.</div>';
  }
}

$('date').min = ui.todayIso();
$('date').value = ui.todayIso();
$('date').addEventListener('change', loadSlots);

$('bookBtn').onclick = async () => {
  ui.notice($('publicMsg'), '');

  const name = $('clientName').value.trim();
  const phone = $('clientPhone').value.trim();

  if (!selectedBarber) return ui.notice($('publicMsg'), 'Selecciona un barbero.');
  if (!selectedSlot) return ui.notice($('publicMsg'), 'Selecciona un horario.');
  if (name.length < 2) return ui.notice($('publicMsg'), 'Ingresa tu nombre completo.');
  if (phone.replace(/\D/g, '').length < 6) return ui.notice($('publicMsg'), 'Ingresa un teléfono válido.');

  $('bookBtn').disabled = true;
  $('bookBtn').textContent = 'Registrando...';

  const { error } = await sb.rpc('crear_reserva_publica', {
    p_barbero_id: selectedBarber.id,
    p_cliente_nombre: name,
    p_cliente_telefono: phone,
    p_fecha: $('date').value,
    p_hora_inicio: selectedSlot.hora_inicio
  });

  $('bookBtn').disabled = false;
  $('bookBtn').textContent = 'Confirmar reserva';

  if (error) return ui.notice($('publicMsg'), error.message);

  ui.notice($('publicMsg'),
    `Reserva confirmada con ${selectedBarber.nombre} a las ${ui.hhmm(selectedSlot.hora_inicio)}.`,
    true
  );

  $('clientName').value = '';
  $('clientPhone').value = '';
  await loadSlots();
};

function openLogin() { ui.show('loginView'); }
function openHome() { ui.show('publicView'); }

$('staffBtn').onclick = openLogin;
$('heroLoginBtn').onclick = openLogin;
$('directLoginBtn').onclick = openLogin;
$('backBtn').onclick = openHome;
$('goPublicBtn').onclick = openHome;
$('goHomeBtn').onclick = openHome;
$('goBookingBtn').onclick = () => { ui.show('publicView'); setTimeout(()=>ui.scrollToBooking(), 50); };
$('heroBookingBtn').onclick = () => { ui.show('publicView'); setTimeout(()=>ui.scrollToBooking(), 50); };

$('loginBtn').onclick = async () => {
  ui.notice($('loginMsg'), '');
  $('loginBtn').disabled = true;
  $('loginBtn').textContent = 'Verificando...';

  const { data, error } = await sb.auth.signInWithPassword({
    email: $('email').value.trim(),
    password: $('password').value
  });

  $('loginBtn').disabled = false;
  $('loginBtn').textContent = 'Ingresar al panel';

  if (error) return ui.notice($('loginMsg'), error.message);

  const { data: p, error: pe } = await sb
    .from('usuarios')
    .select('id,nombre,rol,telefono,activo')
    .eq('id', data.user.id)
    .single();

  if (pe || !p?.activo) {
    await sb.auth.signOut();
    return ui.notice($('loginMsg'), 'Este usuario no tiene un perfil activo.');
  }

  profile = p;
  openStaff();
};

$('logoutBtn').onclick = async () => {
  await sb.auth.signOut();
  profile = null;
  ui.show('publicView');
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

function openStaff() {
  $('welcome').textContent = `Hola, ${profile.nombre}`;
  $('roleText').textContent = profile.rol.replace('_', ' ');
  ui.show('staffView');
  renderTabs();
}

function renderTabs() {
  const role = profile.rol;
  const tabs = role === 'barbero'
    ? [['agenda', 'Mi agenda'], ['horarios', 'Disponibilidad']]
    : role === 'admin'
      ? [['resumen', 'Resumen'], ['reservas', 'Reservas'], ['barberos', 'Barberos']]
      : [['usuarios', 'Usuarios'], ['seguridad', 'Seguridad']];

  $('staffTabs').innerHTML = '';

  tabs.forEach(([id, label], i) => {
    const b = document.createElement('button');
    b.className = `tab${i === 0 ? ' active' : ''}`;
    b.textContent = label;
    b.onclick = () => {
      [...$('staffTabs').children].forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      renderSection(id);
    };
    $('staffTabs').appendChild(b);
  });

  renderSection(tabs[0][0]);
}

async function renderSection(id) {
  $('staffContent').innerHTML = '<div class="panel-card">Cargando...</div>';
  try {
    if (id === 'agenda') return renderBarberAgenda();
    if (id === 'horarios') return renderAvailability();
    if (id === 'resumen') return renderAdminSummary();
    if (id === 'reservas') return renderReservations();
    if (id === 'barberos') return renderBarbersAdmin();
    if (id === 'usuarios') return renderUsers();
    if (id === 'seguridad') return renderSecurity();
  } catch (e) {
    $('staffContent').innerHTML = `<div class="notice err">${e.message}</div>`;
  }
}

async function getReservations() {
  let q = sb.from('reservas').select('*').order('fecha', { ascending: true }).order('hora_inicio', { ascending: true });
  if (profile.rol === 'barbero') q = q.eq('barbero_id', profile.id);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

function reservationItem(r) {
  return `
    <div class="panel-item">
      <div>
        <strong>${r.cliente_nombre}</strong>
        <small>${r.fecha} · ${ui.hhmm(r.hora_inicio)} · ${r.cliente_telefono}</small>
      </div>
      <span class="pill">${r.estado}</span>
    </div>`;
}

async function renderBarberAgenda() {
  const rows = await getReservations();
  $('staffContent').innerHTML = `
    <div class="panel-card">
      <h3>Próximas citas</h3>
      <div class="panel-list">
        ${rows.map(reservationItem).join('') || '<div class="empty-state">Sin citas programadas.</div>'}
      </div>
    </div>`;
}

async function renderAvailability() {
  const { data, error } = await sb
    .from('disponibilidad')
    .select('*')
    .eq('barbero_id', profile.id)
    .order('dia_semana')
    .order('hora_inicio');

  if (error) throw error;

  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  $('staffContent').innerHTML = `
    <div class="panel-card">
      <h3>Disponibilidad semanal</h3>

      <div class="form-grid" style="margin-top:16px">
        <div class="field">
          <label>Día</label>
          <input id="avDayText" value="0 = Dom, 1 = Lun, 2 = Mar, 3 = Mié, 4 = Jue, 5 = Vie, 6 = Sáb" disabled>
        </div>
        <div class="field">
          <label>Hora</label>
          <input id="avHourText" value="Selecciona en los controles inferiores" disabled>
        </div>
      </div>

      <div class="form-grid" style="margin-top:12px">
        <div class="field">
          <label>Día</label>
          <input id="avDay" type="number" min="0" max="6" value="1">
        </div>
        <div class="field">
          <label>Hora de inicio (08 a 19)</label>
          <input id="avHour" type="number" min="8" max="19" value="9">
        </div>
      </div>

      <button id="addAv" class="btn btn-dark" style="margin-top:14px">Agregar horario</button>

      <div class="panel-list">
        ${data.map(s => `
          <div class="panel-item">
            <div>
              <strong>${days[s.dia_semana]}</strong>
              <small>${ui.hhmm(s.hora_inicio)} – ${ui.hhmm(s.hora_fin)}</small>
            </div>
            <button class="btn btn-ghost" data-del="${s.id}">Eliminar</button>
          </div>`).join('') || '<div class="empty-state">Todavía no configuraste horarios.</div>'}
      </div>
    </div>`;

  $('addAv').onclick = async () => {
    const h = +$('avHour').value;
    const d = +$('avDay').value;
    const { error } = await sb.from('disponibilidad').insert({
      barbero_id: profile.id,
      dia_semana: d,
      hora_inicio: `${String(h).padStart(2, '0')}:00:00`,
      hora_fin: `${String(h + 1).padStart(2, '0')}:00:00`
    });
    if (error) return alert(error.message);
    renderAvailability();
  };

  document.querySelectorAll('[data-del]').forEach(b => {
    b.onclick = async () => {
      await sb.from('disponibilidad').delete().eq('id', +b.dataset.del);
      renderAvailability();
    };
  });
}

async function renderAdminSummary() {
  const reservations = await getReservations();
  const { data: barbers } = await sb.from('usuarios').select('*').eq('rol', 'barbero');
  const today = ui.todayIso();

  $('staffContent').innerHTML = `
    <div class="kpis">
      <div class="kpi"><span>Citas de hoy</span><b>${reservations.filter(r => r.fecha === today).length}</b><small>Agenda del día</small></div>
      <div class="kpi"><span>Reservas</span><b>${reservations.length}</b><small>Total visible</small></div>
      <div class="kpi"><span>Barberos activos</span><b>${(barbers || []).filter(b => b.activo).length}</b><small>Equipo disponible</small></div>
    </div>`;
}

async function renderReservations() {
  const rows = await getReservations();
  $('staffContent').innerHTML = `
    <div class="panel-card">
      <h3>Todas las reservas</h3>
      <div class="panel-list">
        ${rows.map(reservationItem).join('') || '<div class="empty-state">No hay reservas todavía.</div>'}
      </div>
    </div>`;
}

async function renderBarbersAdmin() {
  const { data, error } = await sb.from('usuarios').select('*').eq('rol', 'barbero').order('nombre');
  if (error) throw error;

  $('staffContent').innerHTML = `
    <div class="panel-card">
      <div class="staff-header" style="margin-bottom:0">
        <div><h2 style="font-size:30px">Barberos</h2></div>
        <button id="newBarber" class="btn btn-dark">Nuevo barbero</button>
      </div>
      <div class="panel-list">
        ${data.map(u => `
          <div class="panel-item">
            <div>
              <strong>${u.nombre}</strong>
              <small>${u.telefono || 'Sin teléfono'}</small>
            </div>
            <span class="pill">${u.activo ? 'activo' : 'inactivo'}</span>
          </div>`).join('') || '<div class="empty-state">Sin barberos.</div>'}
      </div>
    </div>`;

  $('newBarber').onclick = () => userDialog('barbero');
}

async function renderUsers() {
  const { data, error } = await sb.from('usuarios').select('*').order('rol').order('nombre');
  if (error) throw error;

  $('staffContent').innerHTML = `
    <div class="panel-card">
      <div class="staff-header" style="margin-bottom:0">
        <div><h2 style="font-size:30px">Usuarios del sistema</h2></div>
        <button id="newAdmin" class="btn btn-dark">Nuevo admin</button>
      </div>
      <div class="panel-list">
        ${data.filter(u => u.rol !== 'super_admin').map(u => `
          <div class="panel-item">
            <div>
              <strong>${u.nombre}</strong>
              <small>${u.rol} · ${u.telefono || 'Sin teléfono'}</small>
            </div>
            <span class="pill">${u.activo ? 'activo' : 'inactivo'}</span>
          </div>`).join('') || '<div class="empty-state">Sin usuarios adicionales.</div>'}
      </div>
    </div>`;

  $('newAdmin').onclick = () => userDialog('admin');
}

async function userDialog(role) {
  const name = prompt(`Nombre del ${role}:`);
  if (!name) return;
  const email = prompt('Correo:');
  if (!email) return;
  const password = prompt('Contraseña inicial (mínimo 8 caracteres):');
  if (!password) return;
  const phone = role === 'barbero' ? prompt('Teléfono:') : '';

  try {
    await api('/api/users', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        nombre: name,
        telefono: phone || null,
        rol: role
      })
    });
    alert('Usuario creado correctamente.');
    renderSection(role === 'barbero' ? 'barberos' : 'usuarios');
  } catch (e) {
    alert(e.message);
  }
}

async function renderSecurity() {
  const { data, error } = await sb.from('usuarios').select('*').in('rol', ['admin', 'barbero']).order('nombre');
  if (error) throw error;

  $('staffContent').innerHTML = `
    <div class="panel-card">
      <h3>Seguridad y accesos</h3>
      <div class="panel-list">
        ${data.map(u => `
          <div class="panel-item">
            <div>
              <strong>${u.nombre}</strong>
              <small>${u.rol}</small>
            </div>
            <button class="btn btn-ghost" data-reset="${u.id}">Cambiar contraseña</button>
          </div>`).join('') || '<div class="empty-state">Sin usuarios para administrar.</div>'}
      </div>
    </div>`;

  document.querySelectorAll('[data-reset]').forEach(b => {
    b.onclick = async () => {
      const pw = prompt('Nueva contraseña (mínimo 8 caracteres):');
      if (!pw) return;
      try {
        await api(`/api/users/${b.dataset.reset}/reset-password`, {
          method: 'POST',
          body: JSON.stringify({ newPassword: pw })
        });
        alert('Contraseña actualizada.');
      } catch (e) {
        alert(e.message);
      }
    };
  });
}

(async () => {
  await loadBarbers();
  updateSummary();

  const { data } = await sb.auth.getSession();
  if (data.session) {
    const { data: p } = await sb
      .from('usuarios')
      .select('id,nombre,rol,telefono,activo')
      .eq('id', data.session.user.id)
      .maybeSingle();

    if (p?.activo) {
      profile = p;
      openStaff();
    }
  }
})();
