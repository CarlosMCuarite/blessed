import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet());
app.use(cors({ origin: false }));
app.use(express.json({ limit: '256kb' }));

const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  FIREBASE_SERVICE_ACCOUNT_JSON,
  WEBHOOK_SECRET,
  PORT = 10000,
} = process.env;

for (const [name, value] of Object.entries({
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  FIREBASE_SERVICE_ACCOUNT_JSON,
  WEBHOOK_SECRET,
})) {
  if (!value) throw new Error(`Falta variable de entorno: ${name}`);
}

if (WEBHOOK_SECRET.length < 24) {
  throw new Error('WEBHOOK_SECRET debe tener al menos 24 caracteres');
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

initializeApp({
  credential: cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON)),
});

const messaging = getMessaging();

function safeSecret(value) {
  if (typeof value !== 'string') return false;
  const expected = Buffer.from(WEBHOOK_SECRET);
  const received = Buffer.from(value);
  return expected.length === received.length &&
    crypto.timingSafeEqual(expected, received);
}

function bearer(req) {
  const auth = req.headers.authorization ?? '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

async function profileFromRequest(req) {
  const token = bearer(req);
  if (!token) return null;

  const { data: auth, error: authError } =
    await supabase.auth.getUser(token);

  if (authError || !auth.user) return null;

  const { data: profile, error } = await supabase
    .from('usuarios')
    .select('id,nombre,rol,activo')
    .eq('id', auth.user.id)
    .single();

  if (error || !profile?.activo) return null;
  return profile;
}

function requireRoles(...roles) {
  return async (req, res, next) => {
    try {
      const profile = await profileFromRequest(req);
      if (!profile || !roles.includes(profile.rol)) {
        return res.status(403).json({ error: 'No autorizado' });
      }
      req.profile = profile;
      next();
    } catch (error) {
      console.error('auth middleware', error);
      res.status(500).json({ error: 'Error interno de autenticación' });
    }
  };
}

const newUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  nombre: z.string().trim().min(2).max(100),
  telefono: z.string().trim().min(6).max(30).nullable().optional(),
  rol: z.enum(['admin', 'barbero']).default('barbero'),
});

const editUserSchema = z.object({
  nombre: z.string().trim().min(2).max(100).optional(),
  telefono: z.string().trim().min(6).max(30).nullable().optional(),
  activo: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, 'Sin cambios');

const passwordSchema = z.object({
  newPassword: z.string().min(8).max(128),
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'barberia-profesional-api',
    version: '2.0.0',
  });
});

app.post('/webhooks/reserva', async (req, res) => {
  try {
    if (!safeSecret(req.headers['x-webhook-secret'])) {
      return res.status(401).json({ error: 'Webhook no autorizado' });
    }

    const payload = req.body;
    if (payload?.type !== 'INSERT' || payload?.table !== 'reservas') {
      return res.json({ ignored: true });
    }

    const reserva = payload.record;
    if (!reserva?.id || !reserva?.barbero_id) {
      return res.status(400).json({ error: 'Payload inválido' });
    }

    const { data: barber, error: barberError } = await supabase
      .from('usuarios')
      .select('id,nombre,activo')
      .eq('id', reserva.barbero_id)
      .eq('rol', 'barbero')
      .single();

    if (barberError || !barber?.activo) {
      return res.status(404).json({ error: 'Barbero no disponible' });
    }

    const { data: devices, error: deviceError } = await supabase
      .from('dispositivos_usuario')
      .select('id,token')
      .eq('usuario_id', reserva.barbero_id)
      .eq('activo', true);

    if (deviceError) throw deviceError;

    const tokens = (devices ?? []).map((d) => d.token).filter(Boolean);
    if (tokens.length === 0) {
      return res.json({ ok: true, sent: 0, warning: 'Sin dispositivos FCM' });
    }

    const date = String(reserva.fecha);
    const time = String(reserva.hora_inicio).slice(0, 5);

    const result = await messaging.sendEachForMulticast({
      tokens: tokens.slice(0, 500),
      notification: {
        title: 'Nueva reserva',
        body: `${reserva.cliente_nombre} · ${date} · ${time}`,
      },
      data: {
        reserva_id: String(reserva.id),
        barbero_id: String(reserva.barbero_id),
        fecha: date,
        hora: time,
        cliente_nombre: String(reserva.cliente_nombre),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'reservas',
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: { sound: 'default' },
        },
      },
    });

    const invalidTokenIds = [];
    result.responses.forEach((response, i) => {
      if (response.success) return;
      const code = response.error?.code ?? '';
      if (
        code.includes('registration-token-not-registered') ||
        code.includes('invalid-registration-token')
      ) {
        invalidTokenIds.push(devices[i].id);
      }
    });

    if (invalidTokenIds.length) {
      await supabase
        .from('dispositivos_usuario')
        .update({ activo: false })
        .in('id', invalidTokenIds);
    }

    res.json({
      ok: true,
      sent: result.successCount,
      failed: result.failureCount,
    });
  } catch (error) {
    console.error('webhook reserva', error);
    res.status(500).json({ error: 'No se pudo procesar la notificación' });
  }
});

app.post(
  '/api/users',
  requireRoles('admin', 'super_admin'),
  async (req, res) => {
    try {
      const parsed = newUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message ?? 'Datos inválidos',
        });
      }

      const input = parsed.data;
      const allowedRoles = req.profile.rol === 'super_admin'
        ? ['admin', 'barbero']
        : ['barbero'];

      if (!allowedRoles.includes(input.rol)) {
        return res.status(403).json({ error: 'No puedes crear ese rol' });
      }

      const { data: created, error: authError } =
        await supabase.auth.admin.createUser({
          email: input.email,
          password: input.password,
          email_confirm: true,
        });

      if (authError) {
        return res.status(400).json({ error: authError.message });
      }

      const { error: profileError } = await supabase
        .from('usuarios')
        .insert({
          id: created.user.id,
          nombre: input.nombre,
          telefono: input.telefono ?? null,
          rol: input.rol,
          activo: true,
        });

      if (profileError) {
        await supabase.auth.admin.deleteUser(created.user.id);
        return res.status(400).json({ error: profileError.message });
      }

      res.status(201).json({
        id: created.user.id,
        email: input.email,
        nombre: input.nombre,
        rol: input.rol,
      });
    } catch (error) {
      console.error('create user', error);
      res.status(500).json({ error: 'No se pudo crear el usuario' });
    }
  },
);

app.patch(
  '/api/users/:id',
  requireRoles('admin', 'super_admin'),
  async (req, res) => {
    try {
      const parsed = editUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message ?? 'Datos inválidos',
        });
      }

      const { data: target, error } = await supabase
        .from('usuarios')
        .select('id,rol')
        .eq('id', req.params.id)
        .single();

      if (error) return res.status(404).json({ error: 'Usuario no encontrado' });

      if (req.profile.rol === 'admin' && target.rol !== 'barbero') {
        return res.status(403).json({ error: 'Admin solo puede editar barberos' });
      }

      const { data, error: updateError } = await supabase
        .from('usuarios')
        .update(parsed.data)
        .eq('id', req.params.id)
        .select('id,nombre,rol,telefono,activo')
        .single();

      if (updateError) {
        return res.status(400).json({ error: updateError.message });
      }

      res.json(data);
    } catch (error) {
      console.error('edit user', error);
      res.status(500).json({ error: 'No se pudo editar el usuario' });
    }
  },
);

app.post(
  '/api/users/:id/reset-password',
  requireRoles('super_admin'),
  async (req, res) => {
    try {
      const parsed = passwordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message ?? 'Contraseña inválida',
        });
      }

      const { data: target, error } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', req.params.id)
        .single();

      if (error) return res.status(404).json({ error: 'Usuario no encontrado' });
      if (!['admin', 'barbero'].includes(target.rol)) {
        return res.status(403).json({ error: 'Operación no permitida' });
      }

      const { error: updateError } =
        await supabase.auth.admin.updateUserById(
          req.params.id,
          { password: parsed.data.newPassword },
        );

      if (updateError) {
        return res.status(400).json({ error: updateError.message });
      }

      res.json({ ok: true });
    } catch (error) {
      console.error('reset password', error);
      res.status(500).json({ error: 'No se pudo actualizar la contraseña' });
    }
  },
);

app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Barbería API v2 escuchando en ${PORT}`);
});
