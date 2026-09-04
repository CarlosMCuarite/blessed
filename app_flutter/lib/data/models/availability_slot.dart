class AvailabilitySlot {
  const AvailabilitySlot({
    required this.id,
    required this.day,
    required this.start,
    required this.end,
  });

  final int id;
  final int day;
  final String start;
  final String end;

  factory AvailabilitySlot.fromMap(Map<String, dynamic> map) =>
      AvailabilitySlot(
        id: map['id'] as int,
        day: map['dia_semana'] as int,
        start: map['hora_inicio'].toString(),
        end: map['hora_fin'].toString(),
      );
}
