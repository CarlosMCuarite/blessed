class AppConfig {
  static const appName = 'Barbería';

  // Supabase del proyecto actual.
  // La anon key puede vivir en la app: la seguridad real depende de RLS.
  // Puedes sobreescribir estos valores con --dart-define cuando quieras.
  static const supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://ebqlluyzcmcbrexsrofv.supabase.co',
  );

  static const supabasePublishableKey = String.fromEnvironment(
    'SUPABASE_PUBLISHABLE_KEY',
    defaultValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVicWxsdXl6Y21jYnJleHNyb2Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NTI0NzQsImV4cCI6MjEwNDEyODQ3NH0.TXsEjnnUSo9ziPVfTGK4Q3aK0QjAJhb9zJYqo8mggzY',
  );

  static const backendUrl = String.fromEnvironment(
    'BACKEND_URL',
    defaultValue: 'http://10.0.2.2:10000',
  );

  static void validate() {
    if (supabaseUrl.isEmpty) {
      throw StateError('SUPABASE_URL no configurada');
    }
    if (supabasePublishableKey.isEmpty) {
      throw StateError('SUPABASE_PUBLISHABLE_KEY no configurada');
    }
    if (backendUrl.isEmpty) {
      throw StateError('BACKEND_URL no configurada');
    }
  }
}
