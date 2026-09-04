class Validators {
  static String? requiredText(String? value, {String label = 'Campo'}) {
    if (value == null || value.trim().isEmpty) return '$label es obligatorio';
    if (value.trim().length < 2) return '$label es demasiado corto';
    return null;
  }

  static String? phone(String? value) {
    final v = (value ?? '').replaceAll(RegExp(r'\s+'), '');
    if (v.isEmpty) return 'El teléfono es obligatorio';
    if (!RegExp(r'^\+?[0-9]{6,15}$').hasMatch(v)) {
      return 'Ingresa un teléfono válido';
    }
    return null;
  }

  static String? email(String? value) {
    final v = (value ?? '').trim();
    if (v.isEmpty) return 'El correo es obligatorio';
    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v)) {
      return 'Ingresa un correo válido';
    }
    return null;
  }

  static String? password(String? value) {
    final v = value ?? '';
    if (v.length < 8) return 'Mínimo 8 caracteres';
    return null;
  }
}
