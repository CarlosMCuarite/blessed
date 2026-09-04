class Barber {
  const Barber({required this.id, required this.name});
  final String id;
  final String name;

  factory Barber.fromMap(Map<String, dynamic> map) => Barber(
        id: map['id'].toString(),
        name: map['nombre'].toString(),
      );
}
