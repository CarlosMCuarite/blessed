import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  // El frontend ya NO ejecuta Tailwind ni Supabase desde CDNs.
  // JavaScript de aplicación y SDK de Supabase se sirven desde este mismo dominio.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      scriptSrcElem: ["'self'"],
      connectSrc: ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: (origin, callback) => {
    const configured = (process.env.FRONTEND_ORIGIN || '')
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
    if (!origin || configured.length === 0 || configured.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origen no permitido por CORS'));
  },
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-webhook-secret'],
}));
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

let messaging = null;
if (FIREBASE_SERVICE_ACCOUNT_JSON?.trim()) {
  try {
    initializeApp({ credential: cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON)) });
    messaging = getMessaging();
    console.log('FCM habilitado.');
  } catch (error) {
    console.error('FCM deshabilitado: credencial Firebase inválida.');
    console.error(error?.message ?? error);
  }
} else {
  console.log('FCM deshabilitado temporalmente. El sistema funciona sin notificaciones.');
}

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

  const { data: auth, error: authError } = await supabase.auth.getUser(token);
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
  especialidad: z.string().trim().max(120).nullable().optional(),
  bio: z.string().trim().max(600).nullable().optional(),
  foto_url: z.string().trim().max(1000).nullable().optional(),
});

const editUserSchema = z.object({
  nombre: z.string().trim().min(2).max(100).optional(),
  telefono: z.string().trim().min(6).max(30).nullable().optional(),
  especialidad: z.string().trim().max(120).nullable().optional(),
  bio: z.string().trim().max(600).nullable().optional(),
  foto_url: z.string().trim().max(1000).nullable().optional(),
  activo: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, 'Sin cambios');

const passwordSchema = z.object({
  newPassword: z.string().min(8).max(128),
});


app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'barberia-profesional-api',
    version: '3.1.0',
    supabase: 'configured',
    notifications: messaging ? 'enabled' : 'disabled',
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

    if (!messaging) {
      return res.json({
        ok: true,
        sent: 0,
        notifications: 'disabled',
        warning: 'Reserva recibida. FCM se habilitará al integrar la app.',
      });
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
      apns: { payload: { aps: { sound: 'default' } } },
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

app.post('/api/users', requireRoles('admin', 'super_admin'), async (req, res) => {
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

    if (authError) return res.status(400).json({ error: authError.message });

    const { error: profileError } = await supabase.from('usuarios').insert({
      id: created.user.id,
      nombre: input.nombre,
      telefono: input.telefono ?? null,
      rol: input.rol,
      especialidad: input.especialidad ?? null,
      bio: input.bio ?? null,
      foto_url: input.foto_url ?? null,
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
});

app.patch('/api/users/:id', requireRoles('admin', 'super_admin'), async (req, res) => {
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
      .select('id,nombre,rol,telefono,especialidad,bio,foto_url,activo')
      .single();

    if (updateError) return res.status(400).json({ error: updateError.message });
    res.json(data);
  } catch (error) {
    console.error('edit user', error);
    res.status(500).json({ error: 'No se pudo editar el usuario' });
  }
});

app.post('/api/users/:id/reset-password', requireRoles('super_admin'), async (req, res) => {
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

    if (updateError) return res.status(400).json({ error: updateError.message });
    res.json({ ok: true });
  } catch (error) {
    console.error('reset password', error);
    res.status(500).json({ error: 'No se pudo actualizar la contraseña' });
  }
});

// ------------------------------------------------------------
// FRONTEND WEB - servido por el MISMO Web Service de Render
// ------------------------------------------------------------
const publicDir = path.join(__dirname, 'public');

// SDK navegador de Supabase servido localmente desde la dependencia npm.
// Evita fallos de CSP/Helmet por módulos externos de jsDelivr.
const supabaseBrowserDir = path.join(
  __dirname,
  'node_modules',
  '@supabase',
  'supabase-js',
  'dist',
  'umd',
);
app.use('/vendor/supabase', express.static(supabaseBrowserDir, {
  maxAge: '7d',
  immutable: true,
}));
app.use(express.static(publicDir, {
  extensions: ['html'],
  maxAge: '1h',
}));

// Las rutas reales del backend deben devolver JSON 404.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Ruta API no encontrada' });
});

app.use('/webhooks', (_req, res) => {
  res.status(404).json({ error: 'Ruta webhook no encontrada' });
});

// Fallback SPA / frontend.

app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/webhooks/') || req.path === '/health') {
    return next();
  }
  return res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Barbería API v3.1 escuchando en ${PORT}`);
});
