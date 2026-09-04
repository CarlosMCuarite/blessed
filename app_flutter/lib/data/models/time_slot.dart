class TimeSlot {
  const TimeSlot({required this.start, required this.end});
  final String start;
  final String end;

  factory TimeSlot.fromMap(Map<String, dynamic> map) => TimeSlot(
        start: map['hora_inicio'].toString(),
        end: map['hora_fin'].toString(),
      );
}
