import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/utils/formatters.dart';
import '../../core/utils/validators.dart';
import '../../core/widgets/pro_ui.dart';
import '../../core/widgets/role_shell.dart';
import '../../data/models/reservation.dart';
import '../../data/models/user_profile.dart';
import '../../data/repositories/repositories.dart';
import '../../services/backend_api.dart';

class AdminHome extends ConsumerStatefulWidget {
  const AdminHome({super.key, required this.profile});
  final UserProfile profile;

  @override
  ConsumerState<AdminHome> createState() => _AdminHomeState();
}

class _AdminHomeState extends ConsumerState<AdminHome> {
  int _index = 0;
  bool _loading = true;
  List<Reservation> _reservations = [];
  List<UserProfile> _barbers = [];

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    setState(() => _loading = true);
    try {
      final repo = ref.read(staffRepositoryProvider);
      final results = await Future.wait([
        repo.allReservations(),
        repo.listStaff(role: 'barbero'),
      ]);
      if (!mounted) return;
      setState(() {
        _reservations = results[0] as List<Reservation>;
        _barbers = results[1] as List<UserProfile>;
      });
    } catch (e) {
      if (mounted) showAppError(context, e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _newBarber() async {
    final name = TextEditingController();
    final phone = TextEditingController();
    final email = TextEditingController();
    final password = TextEditingController();
    final key = GlobalKey<FormState>();

    final create = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Nuevo barbero'),
        content: SizedBox(
          width: 430,
          child: Form(
            key: key,
            child: SingleChildScrollView(
              child: Column(
                children: [
                  TextFormField(
                    controller: name,
                    decoration: const InputDecoration(labelText: 'Nombre'),
                    validator: (v) =>
                        Validators.requiredText(v, label: 'El nombre'),
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: phone,
                    decoration: const InputDecoration(labelText: 'Teléfono'),
                    validator: Validators.phone,
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(labelText: 'Correo'),
                    validator: Validators.email,
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: password,
                    obscureText: true,
                    decoration:
                        const InputDecoration(labelText: 'Contraseña inicial'),
                    validator: Validators.password,
                  ),
                ],
              ),
            ),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancelar')),
          FilledButton(
            onPressed: () {
              if (key.currentState!.validate()) Navigator.pop(ctx, true);
            },
            child: const Text('Crear'),
          ),
        ],
      ),
    );

    if (create != true) return;

    try {
      await ref.read(backendApiProvider).createUser(
            email: email.text,
            password: password.text,
            name: name.text,
            phone: phone.text,
            role: 'barbero',
          );
      await _refresh();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Barbero creado correctamente')),
        );
      }
    } catch (e) {
      if (mounted) showAppError(context, e);
    }
  }

  Future<void> _toggleBarber(UserProfile user) async {
    try {
      await ref.read(backendApiProvider).editUser(
            userId: user.id,
            active: !user.active,
          );
      await _refresh();
    } catch (e) {
      if (mounted) showAppError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final today = DateUtils.dateOnly(DateTime.now());
    final todayCount = _reservations
        .where((r) => DateUtils.isSameDay(r.date, today))
        .length;
    final upcoming = _reservations
        .where((r) => !r.date.isBefore(today) && r.status == 'reservada')
        .length;
    final activeBarbers = _barbers.where((b) => b.active).length;

    final pages = [
      ResponsiveBody(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const PageHeader(
              title: 'Panel general',
              subtitle: 'Resumen operativo de la barbería.',
            ),
            const SizedBox(height: 18),
            LayoutBuilder(
              builder: (context, c) {
                final width = c.maxWidth < 720
                    ? c.maxWidth
                    : (c.maxWidth - 24) / 3;
                return Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    SizedBox(
                      width: width,
                      child: MetricCard(
                        label: 'Citas de hoy',
                        value: '$todayCount',
                        icon: Icons.today_outlined,
                      ),
                    ),
                    SizedBox(
                      width: width,
                      child: MetricCard(
                        label: 'Próximas',
                        value: '$upcoming',
                        icon: Icons.event_available_outlined,
                      ),
                    ),
                    SizedBox(
                      width: width,
                      child: MetricCard(
                        label: 'Barberos activos',
                        value: '$activeBarbers',
                        icon: Icons.groups_outlined,
                      ),
                    ),
                  ],
                );
              },
            ),
            const SizedBox(height: 24),
            const Text('Próximas citas',
                style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900)),
            const SizedBox(height: 10),
            ..._reservations
                .where((r) => !r.date.isBefore(today))
                .take(6)
                .map(_reservationCard),
          ],
        ),
      ),
      ResponsiveBody(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            PageHeader(
              title: 'Reservas',
              subtitle: '${_reservations.length} registros',
              trailing: IconButton(
                onPressed: _refresh,
                icon: const Icon(Icons.refresh),
              ),
            ),
            const SizedBox(height: 16),
            if (_reservations.isEmpty)
              const EmptyState(
                icon: Icons.event_busy,
                title: 'Sin reservas',
                message: 'Las nuevas citas aparecerán aquí.',
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
            PageHeader(
              title: 'Barberos',
              subtitle: 'Administra tu equipo de trabajo.',
              trailing: FilledButton.icon(
                onPressed: _newBarber,
                icon: const Icon(Icons.person_add_alt_1),
                label: const Text('Nuevo'),
              ),
            ),
            const SizedBox(height: 16),
            ..._barbers.map(
              (b) => Card(
                child: ListTile(
                  leading: CircleAvatar(
                    child: Text(
                      b.name.isEmpty ? '?' : b.name[0].toUpperCase(),
                    ),
                  ),
                  title: Text(b.name,
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  subtitle: Text(b.phone ?? 'Sin teléfono'),
                  trailing: Switch(
                    value: b.active,
                    onChanged: (_) => _toggleBarber(b),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    ];

    return RoleShell(
      profile: widget.profile,
      title: 'Administración',
      index: _index,
      onDestinationSelected: (i) => setState(() => _index = i),
      destinations: const [
        NavigationDestination(
            icon: Icon(Icons.dashboard_outlined), label: 'Resumen'),
        NavigationDestination(
            icon: Icon(Icons.calendar_month_outlined), label: 'Reservas'),
        NavigationDestination(
            icon: Icon(Icons.content_cut), label: 'Barberos'),
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
          leading: const CircleAvatar(child: Icon(Icons.event_outlined)),
          title: Text(
            '${r.clientName} · ${AppFormatters.hhmm(r.start)}',
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
          subtitle: Text(
            '${AppFormatters.date(r.date)} · ${r.barberName ?? 'Barbero'}\n${r.clientPhone}',
          ),
          isThreeLine: true,
          trailing: StatusPill(status: r.status),
        ),
      ),
    );
  }
}
