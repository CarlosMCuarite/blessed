import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/utils/formatters.dart';
import '../models/availability_slot.dart';
import '../models/barber.dart';
import '../models/reservation.dart';
import '../models/time_slot.dart';
import '../models/user_profile.dart';

final supabaseProvider = Provider<SupabaseClient>(
  (ref) => Supabase.instance.client,
);

final bookingRepositoryProvider = Provider<BookingRepository>(
  (ref) => BookingRepository(ref.watch(supabaseProvider)),
);

final staffRepositoryProvider = Provider<StaffRepository>(
  (ref) => StaffRepository(ref.watch(supabaseProvider)),
);

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(supabaseProvider)),
);

class AuthRepository {
  AuthRepository(this._db);
  final SupabaseClient _db;

  Future<UserProfile> signIn({
    required String email,
    required String password,
  }) async {
    final response =
        await _db.auth.signInWithPassword(email: email, password: password);

    final id = response.user?.id;
    if (id == null) throw Exception('No se pudo iniciar sesión');

    final row = await _db
        .from('usuarios')
        .select('id,nombre,rol,telefono,activo')
        .eq('id', id)
        .single();

    final profile = UserProfile.fromMap(row);
    if (!profile.active) {
      await _db.auth.signOut();
      throw Exception('Tu usuario está desactivado');
    }
    return profile;
  }

  Future<void> signOut() => _db.auth.signOut();

  Future<UserProfile?> currentProfile() async {
    final id = _db.auth.currentUser?.id;
    if (id == null) return null;
    final row = await _db
        .from('usuarios')
        .select('id,nombre,rol,telefono,activo')
        .eq('id', id)
        .maybeSingle();
    return row == null ? null : UserProfile.fromMap(row);
  }
}

class BookingRepository {
  BookingRepository(this._db);
  final SupabaseClient _db;

  Future<List<Barber>> listBarbers() async {
    final data = await _db.rpc('listar_barberos_publicos');
    return (data as List)
        .map((e) => Barber.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<TimeSlot>> availableSlots(
    String barberId,
    DateTime date,
  ) async {
    final data = await _db.rpc(
      'horarios_disponibles',
      params: {
        'p_barbero_id': barberId,
        'p_fecha': AppFormatters.isoDate(date),
      },
    );
    return (data as List)
        .map((e) => TimeSlot.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<String> createReservation({
    required String barberId,
    required String clientName,
    required String clientPhone,
    required DateTime date,
    required String start,
  }) async {
    final id = await _db.rpc(
      'crear_reserva_publica',
      params: {
        'p_barbero_id': barberId,
        'p_cliente_nombre': clientName.trim(),
        'p_cliente_telefono': clientPhone.trim(),
        'p_fecha': AppFormatters.isoDate(date),
        'p_hora_inicio': start,
      },
    );
    return id.toString();
  }
}

class StaffRepository {
  StaffRepository(this._db);
  final SupabaseClient _db;

  Future<List<UserProfile>> listStaff({String? role}) async {
    var query = _db
        .from('usuarios')
        .select('id,nombre,rol,telefono,activo');
    final data = role == null
        ? await query.order('nombre')
        : await query.eq('rol', role).order('nombre');

    return (data as List)
        .map((e) => UserProfile.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<Reservation>> allReservations() async {
    final data = await _db
        .from('reservas')
        .select('*, usuarios!reservas_barbero_id_fkey(nombre)')
        .order('fecha', ascending: false)
        .order('hora_inicio');
    return (data as List)
        .map((e) => Reservation.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<Reservation>> myUpcomingReservations() async {
    final uid = _db.auth.currentUser!.id;
    final data = await _db
        .from('reservas')
        .select()
        .eq('barbero_id', uid)
        .gte('fecha', AppFormatters.isoDate(DateTime.now()))
        .order('fecha')
        .order('hora_inicio');
    return (data as List)
        .map((e) => Reservation.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<AvailabilitySlot>> myAvailability() async {
    final uid = _db.auth.currentUser!.id;
    final data = await _db
        .from('disponibilidad')
        .select()
        .eq('barbero_id', uid)
        .order('dia_semana')
        .order('hora_inicio');

    return (data as List)
        .map((e) => AvailabilitySlot.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<void> addAvailability({
    required int day,
    required int hour,
  }) async {
    final uid = _db.auth.currentUser!.id;
    await _db.from('disponibilidad').insert({
      'barbero_id': uid,
      'dia_semana': day,
      'hora_inicio': '${hour.toString().padLeft(2, '0')}:00:00',
      'hora_fin': '${(hour + 1).toString().padLeft(2, '0')}:00:00',
    });
  }

  Future<void> deleteAvailability(int id) async {
    await _db.from('disponibilidad').delete().eq('id', id);
  }

  Future<void> markAttended(String reservationId) async {
    await _db.rpc(
      'marcar_reserva_atendida',
      params: {'p_reserva_id': reservationId},
    );
  }
}
