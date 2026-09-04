class Reservation {
  const Reservation({
    required this.id,
    required this.barberId,
    required this.clientName,
    required this.clientPhone,
    required this.date,
    required this.start,
    required this.end,
    required this.status,
    this.barberName,
  });

  final String id;
  final String barberId;
  final String clientName;
  final String clientPhone;
  final DateTime date;
  final String start;
  final String end;
  final String status;
  final String? barberName;

  factory Reservation.fromMap(Map<String, dynamic> map) {
    final joined = map['usuarios'];
    return Reservation(
      id: map['id'].toString(),
      barberId: map['barbero_id'].toString(),
      clientName: map['cliente_nombre'].toString(),
      clientPhone: map['cliente_telefono'].toString(),
      date: DateTime.parse(map['fecha'].toString()),
      start: map['hora_inicio'].toString(),
      end: map['hora_fin'].toString(),
      status: map['estado'].toString(),
      barberName:
          joined is Map<String, dynamic> ? joined['nombre']?.toString() : null,
    );
  }
}
