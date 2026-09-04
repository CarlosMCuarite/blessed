import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/validators.dart';
import '../../core/widgets/pro_ui.dart';
import '../../data/models/barber.dart';
import '../../data/models/time_slot.dart';
import '../../data/repositories/repositories.dart';
import '../auth/login_page.dart';

class PublicBookingPage extends ConsumerStatefulWidget {
  const PublicBookingPage({super.key});

  @override
  ConsumerState<PublicBookingPage> createState() => _PublicBookingPageState();
}

class _PublicBookingPageState extends ConsumerState<PublicBookingPage> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();

  List<Barber> _barbers = [];
  List<TimeSlot> _slots = [];
  Barber? _barber;
  TimeSlot? _slot;
  DateTime _date = DateTime.now();
  bool _loading = true;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadBarbers();
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _loadBarbers() async {
    try {
      final result =
          await ref.read(bookingRepositoryProvider).listBarbers();
      if (!mounted) return;
      setState(() {
        _barbers = result;
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        showAppError(context, e);
      }
    }
  }

  Future<void> _loadSlots() async {
    if (_barber == null) return;
    setState(() {
      _slots = [];
      _slot = null;
      _loading = true;
    });
    try {
      final data = await ref
          .read(bookingRepositoryProvider)
          .availableSlots(_barber!.id, _date);
      if (mounted) setState(() => _slots = data);
    } catch (e) {
      if (mounted) showAppError(context, e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    if (_barber == null) {
      showAppError(context, Exception('Selecciona un barbero'));
      return;
    }
    if (_slot == null) {
      showAppError(context, Exception('Selecciona un horario'));
      return;
    }
    if (!_formKey.currentState!.validate()) return;

    setState(() => _submitting = true);
    try {
      await ref.read(bookingRepositoryProvider).createReservation(
            barberId: _barber!.id,
            clientName: _name.text,
            clientPhone: _phone.text,
            date: _date,
            start: _slot!.start,
          );
      if (!mounted) return;

      await showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          icon: const Icon(Icons.check_circle, color: Colors.green, size: 44),
          title: const Text('Reserva confirmada'),
          content: Text(
            '${_barber!.name}\n'
            '${AppFormatters.date(_date)} · '
            '${AppFormatters.hhmm(_slot!.start)}',
            textAlign: TextAlign.center,
          ),
          actionsAlignment: MainAxisAlignment.center,
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Listo'),
            )
          ],
        ),
      );

      _name.clear();
      _phone.clear();
      _slot = null;
      await _loadSlots();
    } catch (e) {
      if (mounted) showAppError(context, e);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dates = List.generate(
      14,
      (i) => DateUtils.dateOnly(DateTime.now().add(Duration(days: i))),
    );

    return Scaffold(
      appBar: AppBar(
        title: const BrandMark(),
        actions: [
          TextButton.icon(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const LoginPage()),
            ),
            icon: const Icon(Icons.lock_outline, size: 18),
            label: const Text('Personal'),
          ),
          const SizedBox(width: 10),
        ],
      ),
      body: _loading && _barbers.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : ResponsiveBody(
              maxWidth: 980,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(28),
                    decoration: BoxDecoration(
                      color: AppTheme.ink,
                      borderRadius: BorderRadius.circular(28),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'TU PRÓXIMO CORTE,\nSIN ESPERAS.',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 30,
                            height: 1.05,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -.7,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Elige profesional, fecha y hora. Tu cita queda confirmada al instante.',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: .7),
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 26),
                  const PageHeader(
                    title: 'Reserva tu cita',
                    subtitle: 'Completa los pasos y confirma en menos de un minuto.',
                  ),
                  const SizedBox(height: 20),
                  _Section(
                    number: '01',
                    title: 'Elige tu barbero',
                    child: _barbers.isEmpty
                        ? const EmptyState(
                            icon: Icons.content_cut,
                            title: 'Sin barberos disponibles',
                            message: 'Vuelve a intentarlo más tarde.',
                          )
                        : Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: _barbers.map((b) {
                              final selected = _barber?.id == b.id;
                              return ChoiceChip(
                                selected: selected,
                                avatar: const Icon(Icons.person_outline),
                                label: Text(b.name),
                                onSelected: (_) async {
                                  setState(() => _barber = b);
                                  await _loadSlots();
                                },
                              );
                            }).toList(),
                          ),
                  ),
                  const SizedBox(height: 14),
                  _Section(
                    number: '02',
                    title: 'Elige la fecha',
                    child: SizedBox(
                      height: 76,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: dates.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemBuilder: (_, i) {
                          final d = dates[i];
                          final selected =
                              DateUtils.isSameDay(d, _date);
                          return InkWell(
                            borderRadius: BorderRadius.circular(14),
                            onTap: _barber == null
                                ? null
                                : () async {
                                    setState(() => _date = d);
                                    await _loadSlots();
                                  },
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 180),
                              width: 74,
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: selected
                                    ? AppTheme.ink
                                    : Colors.white,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: AppTheme.line),
                              ),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    AppFormatters.shortDate(d),
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      color: selected
                                          ? Colors.white
                                          : Colors.black87,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  _Section(
                    number: '03',
                    title: 'Elige la hora',
                    child: _barber == null
                        ? const Text(
                            'Primero selecciona un barbero.',
                            style: TextStyle(color: Colors.black54),
                          )
                        : _loading
                            ? const LinearProgressIndicator()
                            : _slots.isEmpty
                                ? const EmptyState(
                                    icon: Icons.schedule,
                                    title: 'Sin horarios libres',
                                    message:
                                        'Prueba con otra fecha o barbero.',
                                  )
                                : Wrap(
                                    spacing: 8,
                                    runSpacing: 8,
                                    children: _slots.map((s) {
                                      final selected =
                                          _slot?.start == s.start;
                                      return ChoiceChip(
                                        selected: selected,
                                        label: Text(
                                          '${AppFormatters.hhmm(s.start)} – ${AppFormatters.hhmm(s.end)}',
                                        ),
                                        onSelected: (_) =>
                                            setState(() => _slot = s),
                                      );
                                    }).toList(),
                                  ),
                  ),
                  const SizedBox(height: 14),
                  _Section(
                    number: '04',
                    title: 'Tus datos',
                    child: Form(
                      key: _formKey,
                      child: Column(
                        children: [
                          TextFormField(
                            controller: _name,
                            textCapitalization: TextCapitalization.words,
                            decoration: const InputDecoration(
                              labelText: 'Nombre',
                              prefixIcon: Icon(Icons.person_outline),
                            ),
                            validator: (v) => Validators.requiredText(
                              v,
                              label: 'El nombre',
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _phone,
                            keyboardType: TextInputType.phone,
                            decoration: const InputDecoration(
                              labelText: 'Teléfono',
                              prefixIcon: Icon(Icons.phone_outlined),
                            ),
                            validator: Validators.phone,
                          ),
                          const SizedBox(height: 16),
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton.icon(
                              onPressed: _submitting ? null : _submit,
                              icon: _submitting
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : const Icon(Icons.check),
                              label: Text(
                                _submitting
                                    ? 'Confirmando...'
                                    : 'Confirmar reserva',
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.number,
    required this.title,
    required this.child,
  });

  final String number;
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(19),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  number,
                  style: const TextStyle(
                    color: AppTheme.gold,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.4,
                  ),
                ),
                const SizedBox(width: 9),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            child,
          ],
        ),
      ),
    );
  }
}
