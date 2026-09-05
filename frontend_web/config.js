export const CONFIG = {
  SUPABASE_URL: 'https://ebqlluyzcmcbrexsrofv.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVicWxsdXl6Y21jYnJleHNyb2Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NTI0NzQsImV4cCI6MjEwNDEyODQ3NH0.TXsEjnnUSo9ziPVfTGK4Q3aK0QjAJhb9zJYqo8mggzY',
  BACKEND_URL: '',

  ROUTES: {
    home: '/',
    catalogo: '/catalogo',
    reservar: '/reservar',
    login: '/login',

    panel: '/panel',
    agenda: '/panel/agenda',
    reservas: '/panel/reservas',
    barberos: '/panel/barberos',
    catalogoAdmin: '/panel/catalogo',
    galeria: '/panel/galeria',
    horarios: '/panel/horarios',
    usuarios: '/panel/usuarios',
    seguridad: '/panel/seguridad',
    configuracion: '/panel/configuracion'
  },

  DEFAULTS: {
    nombre_negocio: 'Blessed Barber Studio',
    subtitulo: 'Barber • Studio',
    slogan: 'Tu estilo, tu mejor versión',
    telefono: '',
    whatsapp: '',
    direccion: '',
    horario: 'Atención con reserva previa',
    instagram_url: '',
    facebook_url: '',
    tiktok_url: '',
    maps_url: '',

    hero_titulo: 'TU ESTILO, TU MEJOR VERSIÓN',
    hero_subtitulo: 'Cortes modernos, barba, perfilado y una experiencia profesional. Reserva online sin esperas.',
    home_cta: 'RESERVA TU CITA',
    catalogo_titulo: 'Servicios Blessed',
    catalogo_subtitulo: 'Elige el servicio que mejor va contigo.',
    login_titulo: 'Bienvenido',
    login_subtitulo: 'Ingresa con tu correo y contraseña.',

    color_primario: '#11100f',
    color_acento: '#b89454',
    logo_url: '/assets/logo_blessed.png',
    banner_principal_url: '/assets/banner_dark.png',
    banner_secundario_url: '/assets/banner_light.png'
  }
};
