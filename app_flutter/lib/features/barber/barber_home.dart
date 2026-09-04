import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/utils/formatters.dart';
import '../../core/widgets/pro_ui.dart';
import '../../core/widgets/role_shell.dart';
import '../../data/models/availability_slot.dart';
import '../../data/models/reservation.dart';
import '../../data/models/user_profile.dart';
import '../../data/repositories/repositories.dart';

class BarberHome extends ConsumerStatefulWidget {
  const BarberHome({super.key, required this.profile});
  final UserProfile profile;

  @override
  ConsumerState<BarberHome> createState() => _BarberHomeState();
}

class _BarberHomeState extends ConsumerState<BarberHome> {
  static const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  int _index = 0;
  int _selectedDay = 1;
  bool _loading = true;
  List<Reservation> _reservations = [];
  List<AvailabilitySlot> _availability = [];

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    setState(() => _loading = true);
    try {
      final repo = ref.read(staffRepositoryProvider);
      final values = await Future.wait([
        repo.myUpcomingReservations(),
        repo.myAvailability(),
      ]);
      if (!mounted) return;
      setState(() {
        _reservations = values[0] as List<Reservation>;
        _availability = values[1] as List<AvailabilitySlot>;
      });
    } catch (e) {
      if (mounted) showAppError(context, e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleHour(int hour) async {
    final existing = _availability.where(
      (s) =>
          s.day == _selectedDay &&
          AppFormatters.hhmm(s.start) ==
              '${hour.toString().padLeft(2, '0')}:00',
    );

    try {
      final repo = ref.read(staffRepositoryProvider);
      if (existing.isNotEmpty) {
        await repo.deleteAvailability(existing.first.id);
      } else {
        await repo.addAvailability(day: _selectedDay, hour: hour);
      }
      await _refresh();
    } catch (e) {
      if (mounted) showAppError(context, e);
    }
  }

  Future<void> _markAttended(Reservation r) async {
    try {
      await ref.read(staffRepositoryProvider).markAttended(r.id);
      await _refresh();
    } catch (e) {
      if (mounted) showAppError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final today = DateUtils.dateOnly(DateTime.now());
    final todays =
        _reservations.where((r) => DateUtils.isSameDay(r.date, today)).toList();

    final pages = [
      ResponsiveBody(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            PageHeader(
              title: 'Hola, ${widget.profile.name.split(' ').first}',
              subtitle: 'Estas son tus citas de hoy.',
            ),
            const SizedBox(height: 18),
            MetricCard(
              label: 'Citas de hoy',
              value: '${todays.length}',
              icon: Icons.today_outlined,
              caption: AppFormatters.fullDate(today),
            ),
            const SizedBox(height: 22),
            if (todays.isEmpty)
              const EmptyState(
                icon: Icons.free_breakfast_outlined,
                title: 'Agenda libre por hoy',
                message: 'Cuando recibas una reserva aparecerá aquí.',
              )
            else
              ...todays.map(_reservationCard),
          ],
        ),
      ),
      ResponsiveBody(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            PageHeader(
              title: 'Mi agenda',
              subtitle: '${_reservations.length} próximas citas',
              trailing: IconButton(
                onPressed: _refresh,
                icon: const Icon(Icons.refresh),
              ),
            ),
            const SizedBox(height: 16),
            if (_reservations.isEmpty)
              const EmptyState(
                icon: Icons.calendar_month_outlined,
                title: 'Sin próximas citas',
                message: 'Tu agenda está disponible.',
              )
            else
              ..._reservations.map(_reservationCard),
          ],
        ),
      ),
      ResponsiveBody(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const PageHeader(
              title: 'Disponibilidad',
              subtitle:
                  'Activa o desactiva bloques de una hora para cada día.',
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 46,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: 7,
                separatorBuilder: (_, __) => const SizedBox(width: 7),
                itemBuilder: (_, i) => ChoiceChip(
                  selected: _selectedDay == i,
                  label: Text(days[i]),
                  onSelected: (_) => setState(() => _selectedDay = i),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Wrap(
                  spacing: 9,
                  runSpacing: 9,
                  children: List.generate(12, (i) {
                    final hour = i + 8;
                    final label =
                        '${hour.toString().padLeft(2, '0')}:00';
                    final active = _availability.any(
                      (s) =>
                          s.day == _selectedDay &&
                          AppFormatters.hhmm(s.start) == label,
                    );
                    return FilterChip(
                      selected: active,
                      label: Text(label),
                      onSelected: (_) => _toggleHour(hour),
                    );
                  }),
                ),
              ),
            ),
          ],
        ),
      ),
    ];

    return RoleShell(
      profile: widget.profile,
      title: 'Mi espacio',
      index: _index,
      onDestinationSelected: (i) => setState(() => _index = i),
      destinations: const [
        NavigationDestination(icon: Icon(Icons.today_outlined), label: 'Hoy'),
        NavigationDestination(
            icon: Icon(Icons.event_note_outlined), label: 'Agenda'),
        NavigationDestination(
            icon: Icon(Icons.schedule_outlined), label: 'Horarios'),
      ],
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(onRefresh: _refresh, child: pages[_index]),
    );
  }

  Widget _reservationCard(Reservation r) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Card(
        child: ListTile(
          leading: CircleAvatar(
            child: Text(
              AppFormatters.hhmm(r.start),
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800),
            ),
          ),
          title: Text(r.clientName,
              style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle:
              Text('${AppFormatters.date(r.date)} · ${r.clientPhone}'),
          trailing: r.status == 'reservada'
              ? IconButton(
                  tooltip: 'Marcar atendida',
                  onPressed: () => _markAttended(r),
                  icon: const Icon(Icons.task_alt),
                )
              : const StatusPill(status: 'atendida'),
        ),
      ),
    );
  }
}
