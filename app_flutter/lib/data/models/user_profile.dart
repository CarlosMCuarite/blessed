enum UserRole {
  superAdmin('super_admin'),
  admin('admin'),
  barber('barbero');

  const UserRole(this.dbValue);
  final String dbValue;

  static UserRole fromDb(String value) => UserRole.values.firstWhere(
        (role) => role.dbValue == value,
        orElse: () => UserRole.barber,
      );
}

class UserProfile {
  const UserProfile({
    required this.id,
    required this.name,
    required this.role,
    required this.active,
    this.phone,
  });

  final String id;
  final String name;
  final UserRole role;
  final bool active;
  final String? phone;

  factory UserProfile.fromMap(Map<String, dynamic> map) => UserProfile(
        id: map['id'].toString(),
        name: map['nombre'].toString(),
        role: UserRole.fromDb(map['rol'].toString()),
        active: map['activo'] == true,
        phone: map['telefono']?.toString(),
      );
}
