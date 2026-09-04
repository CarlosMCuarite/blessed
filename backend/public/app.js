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
  }
};

function updateSummary() {
  const el = $('bookingSummary');
  if (!selectedBarber || !selectedSlot) {
    el.innerHTML = `
      <span class="summary-kicker">Resumen</span>
      <strong>Aún no has seleccionado un horario.</strong>`;
    return;
  }
  el.innerHTML = `
    <span class="summary-kicker">Resumen</span>
    <strong>${selectedBarber.nombre} · ${$('date').value} · ${ui.hhmm(selectedSlot.hora_inicio)}</strong>`;
}

async function loadBarbers() {
  $('barbers').innerHTML = `<div class="empty-line">Cargando profesionales...</div>`;
  const { data, error } = await sb.rpc('listar_barberos_publicos');

  if (error) {
    $('barbers').innerHTML = `<div class="empty-line">No pudimos cargar los barberos.</div>`;
    return;
  }

  $('barbers').innerHTML = '';
  for (const b of data) {
    const card = document.createElement('button');
    card.className = 'barber-card';
    card.type = 'button';
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
    $('barbers').innerHTML = `<div class="empty-line">Todavía no hay barberos activos.</div>`;
  }
}

async function loadSlots() {
  selectedSlot = null;
  updateSummary();

  if (!selectedBarber) {
    $('slots').innerHTML = `<div class="empty-line">Selecciona primero un barbero.</div>`;
    return;
  }

  $('slots').innerHTML = `<div class="empty-line">Consultando horarios...</div>`;
  const { data, error } = await sb.rpc('horarios_disponibles', {
    p_barbero_id: selectedBarber.id,
    p_fecha: $('date').value
  });

  if (error) {
    $('slots').innerHTML = `<div class="empty-line">No pudimos consultar los horarios.</div>`;
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
    $('slots').innerHTML = `<div class="empty-line">No hay horarios libres para esa fecha.</div>`;
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
  $('bookBtn').innerHTML = 'Registrando cita...';

  const { error } = await sb.rpc('crear_reserva_publica', {
    p_barbero_id: selectedBarber.id,
    p_cliente_nombre: name,
    p_cliente_telefono: phone,
    p_fecha: $('date').value,
    p_hora_inicio: selectedSlot.hora_inicio
  });

  $('bookBtn').disabled = false;
  $('bookBtn').innerHTML = `Confirmar reserva <span>→</span>`;

  if (error) {
    return ui.notice($('publicMsg'), error.message);
  }

  ui.notice(
    $('publicMsg'),
    `Reserva confirmada con ${selectedBarber.nombre} a las ${ui.hhmm(selectedSlot.hora_inicio)}.`,
    true
  );

  $('clientName').value = '';
  $('clientPhone').value = '';
  await loadSlots();
};

$('staffBtn').onclick = () => ui.show('loginView');
$('backBtn').onclick = () => ui.show('publicView');
$('goPublicBtn').onclick = () => ui.show('publicView');

$('loginBtn').onclick = async () => {
  ui.notice($('loginMsg'), '');
  $('loginBtn').disabled = true;
  $('loginBtn').textContent = 'Verificando...';

  const { data, error } = await sb.auth.signInWithPassword({
    email: $('email').value.trim(),
    password: $('password').value
  });

  $('loginBtn').disabled = false;
  $('loginBtn').innerHTML = `Entrar al panel <span>→</span>`;

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
  $('staffContent').innerHTML = `<div class="panel-card">Cargando...</div>`;

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
  let q = sb
    .from('reservas')
    .select('*')
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true });

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
        ${rows.map(reservationItem).join('') || '<div class="empty-line">Sin citas programadas.</div>'}
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

      <div class="client-grid" style="margin-top:16px">
        <div class="field">
          <label>Día</label>
          <select id="avDay">${days.map((d, i) => `<option value="${i}">${d}</option>`).join('')}</select>
        </div>
        <div class="field">
          <label>Hora</label>
          <select id="avHour">
            ${Array.from({length:12}, (_,i)=>i+8).map(h=>`<option value="${h}">${String(h).padStart(2,'0')}:00</option>`).join('')}
          </select>
        </div>
      </div>

      <button id="addAv" class="btn btn-primary" style="margin-top:14px">Agregar horario</button>

      <div class="panel-list">
        ${data.map(s => `
          <div class="panel-item">
            <div>
              <strong>${days[s.dia_semana]}</strong>
              <small>${ui.hhmm(s.hora_inicio)} – ${ui.hhmm(s.hora_fin)}</small>
            </div>
            <button class="btn btn-ghost" data-del="${s.id}">Eliminar</button>
          </div>`).join('') || '<div class="empty-line">Todavía no configuraste horarios.</div>'}
      </div>
    </div>`;

  $('addAv').onclick = async () => {
    const h = +$('avHour').value;

    const { error } = await sb.from('disponibilidad').insert({
      barbero_id: profile.id,
      dia_semana: +$('avDay').value,
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
      <div class="kpi"><span>Citas de hoy</span><b>${reservations.filter(r => r.fecha === today).length}</b><small>Agenda actual</small></div>
      <div class="kpi"><span>Reservas</span><b>${reservations.length}</b><small>Registros visibles</small></div>
      <div class="kpi"><span>Barberos activos</span><b>${(barbers || []).filter(b => b.activo).length}</b><small>Equipo disponible</small></div>
    </div>`;
}

async function renderReservations() {
  const rows = await getReservations();

  $('staffContent').innerHTML = `
    <div class="panel-card">
      <h3>Todas las reservas</h3>
      <div class="panel-list">
        ${rows.map(reservationItem).join('') || '<div class="empty-line">No hay reservas todavía.</div>'}
      </div>
    </div>`;
}

async function renderBarbersAdmin() {
  const { data, error } = await sb
    .from('usuarios')
    .select('*')
    .eq('rol', 'barbero')
    .order('nombre');

  if (error) throw error;

  $('staffContent').innerHTML = `
    <div class="panel-card">
      <div class="staff-header" style="margin:0">
        <div><h3>Barberos</h3></div>
        <button id="newBarber" class="btn btn-primary">Nuevo barbero</button>
      </div>
      <div class="panel-list">
        ${data.map(u => `
          <div class="panel-item">
            <div>
              <strong>${u.nombre}</strong>
              <small>${u.telefono || 'Sin teléfono'}</small>
            </div>
            <span class="pill">${u.activo ? 'activo' : 'inactivo'}</span>
          </div>`).join('') || '<div class="empty-line">Sin barberos.</div>'}
      </div>
    </div>`;

  $('newBarber').onclick = () => userDialog('barbero');
}

async function renderUsers() {
  const { data, error } = await sb.from('usuarios').select('*').order('rol').order('nombre');
  if (error) throw error;

  $('staffContent').innerHTML = `
    <div class="panel-card">
      <div class="staff-header" style="margin:0">
        <div><h3>Usuarios del sistema</h3></div>
        <button id="newAdmin" class="btn btn-primary">Nuevo admin</button>
      </div>

      <div class="panel-list">
        ${data.filter(u => u.rol !== 'super_admin').map(u => `
          <div class="panel-item">
            <div>
              <strong>${u.nombre}</strong>
              <small>${u.rol} · ${u.telefono || 'Sin teléfono'}</small>
            </div>
            <span class="pill">${u.activo ? 'activo' : 'inactivo'}</span>
          </div>`).join('') || '<div class="empty-line">Sin usuarios adicionales.</div>'}
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
  const { data, error } = await sb
    .from('usuarios')
    .select('*')
    .in('rol', ['admin', 'barbero'])
    .order('nombre');

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
          </div>`).join('') || '<div class="empty-line">Sin usuarios para administrar.</div>'}
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
