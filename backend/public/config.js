export const CONFIG = {
  SUPABASE_URL: 'https://ebqlluyzcmcbrexsrofv.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVicWxsdXl6Y21jYnJleHNyb2Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NTI0NzQsImV4cCI6MjEwNDEyODQ3NH0.TXsEjnnUSo9ziPVfTGK4Q3aK0QjAJhb9zJYqo8mggzY',
  BACKEND_URL: '',

  ROUTES: {
    home: '/',
    reservar: '/reservar',
    login: '/login',
    panel: '/panel',
    agenda: '/panel/agenda',
    reservas: '/panel/reservas',
    barberos: '/panel/barberos',
    horarios: '/panel/horarios',
    usuarios: '/panel/usuarios',
    seguridad: '/panel/seguridad',
    configuracion: '/panel/configuracion',
    galeria: '/panel/galeria'
  },

  DEFAULTS: {
    nombre_negocio: 'Blessed Barber Studio',
    subtitulo: 'Barber • Studio',
    telefono: '',
    whatsapp: '',
    direccion: '',
    horario: 'Atención con reserva previa',
    hero_titulo: 'TU ESTILO, TU MEJOR VERSIÓN',
    hero_subtitulo: 'Reserva con tu barbero favorito, elige un horario disponible y confirma tu cita en segundos.',
    home_cta: 'RESERVA TU CITA',
    color_primario: '#11100f',
    color_acento: '#b89454',
    logo_url: '/assets/logo_blessed.png',
    banner_principal_url: '/assets/banner_dark.png',
    banner_secundario_url: '/assets/banner_light.png'
  }
};
