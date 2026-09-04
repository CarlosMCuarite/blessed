class AppConfig {
  static const appName = 'Barbería';
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabasePublishableKey =
      String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY');
  static const backendUrl = String.fromEnvironment('BACKEND_URL');

  static void validate() {
    final missing = <String>[];
    if (supabaseUrl.isEmpty) missing.add('SUPABASE_URL');
    if (supabasePublishableKey.isEmpty) missing.add('SUPABASE_PUBLISHABLE_KEY');
    if (backendUrl.isEmpty) missing.add('BACKEND_URL');

    if (missing.isNotEmpty) {
      throw StateError(
        'Faltan variables --dart-define: ${missing.join(', ')}',
      );
    }
  }
}
