import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/utils/validators.dart';
import '../../core/widgets/pro_ui.dart';
import '../../core/widgets/role_shell.dart';
import '../../data/models/user_profile.dart';
import '../../data/repositories/repositories.dart';
import '../../services/backend_api.dart';

class SuperAdminHome extends ConsumerStatefulWidget {
  const SuperAdminHome({super.key, required this.profile});
  final UserProfile profile;

  @override
  ConsumerState<SuperAdminHome> createState() => _SuperAdminHomeState();
}

class _SuperAdminHomeState extends ConsumerState<SuperAdminHome> {
  int _index = 0;
  bool _loading = true;
  List<UserProfile> _staff = [];

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    setState(() => _loading = true);
    try {
      final all = await ref.read(staffRepositoryProvider).listStaff();
      if (mounted) {
        setState(() {
          _staff = all
              .where((u) => u.role != UserRole.superAdmin)
              .toList();
        });
      }
    } catch (e) {
      if (mounted) showAppError(context, e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _createAdmin() async {
    final name = TextEditingController();
    final email = TextEditingController();
    final pass = TextEditingController();
    final key = GlobalKey<FormState>();

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Nuevo administrador'),
        content: SizedBox(
          width: 420,
          child: Form(
            key: key,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: name,
                  decoration: const InputDecoration(labelText: 'Nombre'),
                  validator: (v) =>
                      Validators.requiredText(v, label: 'El nombre'),
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: email,
                  decoration: const InputDecoration(labelText: 'Correo'),
                  validator: Validators.email,
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: pass,
                  obscureText: true,
                  decoration:
                      const InputDecoration(labelText: 'Contraseña inicial'),
                  validator: Validators.password,
                ),
              ],
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

    if (ok != true) return;
    try {
      await ref.read(backendApiProvider).createUser(
            email: email.text,
            password: pass.text,
            name: name.text,
            role: 'admin',
          );
      await _refresh();
    } catch (e) {
      if (mounted) showAppError(context, e);
    }
  }

  Future<void> _resetPassword(UserProfile user) async {
    final pass = TextEditingController();
    final key = GlobalKey<FormState>();

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Nueva contraseña · ${user.name}'),
        content: Form(
          key: key,
          child: TextFormField(
            controller: pass,
            obscureText: true,
            decoration: const InputDecoration(
              labelText: 'Nueva contraseña',
              helperText: 'Mínimo 8 caracteres',
            ),
            validator: Validators.password,
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
            child: const Text('Actualizar'),
          ),
        ],
      ),
    );

    if (ok != true) return;
    try {
      await ref.read(backendApiProvider).resetPassword(
            userId: user.id,
            newPassword: pass.text,
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Contraseña actualizada')),
        );
      }
    } catch (e) {
      if (mounted) showAppError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final admins = _staff.where((u) => u.role == UserRole.admin).length;
    final barbers = _staff.where((u) => u.role == UserRole.barber).length;

    final pages = [
      ResponsiveBody(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            PageHeader(
              title: 'Control del sistema',
              subtitle: 'Usuarios, accesos y seguridad.',
              trailing: FilledButton.icon(
                onPressed: _createAdmin,
                icon: const Icon(Icons.admin_panel_settings_outlined),
                label: const Text('Nuevo admin'),
              ),
            ),
            const SizedBox(height: 18),
            LayoutBuilder(
              builder: (_, c) {
                final w = c.maxWidth < 700 ? c.maxWidth : (c.maxWidth - 12) / 2;
                return Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    SizedBox(
                      width: w,
                      child: MetricCard(
                        label: 'Administradores',
                        value: '$admins',
                        icon: Icons.admin_panel_settings_outlined,
                      ),
                    ),
                    SizedBox(
                      width: w,
                      child: MetricCard(
                        label: 'Barberos',
                        value: '$barbers',
                        icon: Icons.content_cut,
                      ),
                    ),
                  ],
                );
              },
            ),
            const SizedBox(height: 22),
            ..._staff.map(_userCard),
          ],
        ),
      ),
      ResponsiveBody(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const PageHeader(
              title: 'Seguridad',
              subtitle:
                  'El restablecimiento de contraseña pasa por el backend seguro.',
            ),
            const SizedBox(height: 18),
            ..._staff.map(
              (u) => Card(
                child: ListTile(
                  leading: const Icon(Icons.shield_outlined),
                  title: Text(u.name,
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  subtitle: Text(u.role.dbValue),
                  trailing: FilledButton.tonalIcon(
                    onPressed: () => _resetPassword(u),
                    icon: const Icon(Icons.password, size: 18),
                    label: const Text('Cambiar'),
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
      title: 'Super Admin',
      index: _index,
      onDestinationSelected: (i) => setState(() => _index = i),
      destinations: const [
        NavigationDestination(icon: Icon(Icons.people_outline), label: 'Usuarios'),
        NavigationDestination(icon: Icon(Icons.security_outlined), label: 'Seguridad'),
      ],
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(onRefresh: _refresh, child: pages[_index]),
    );
  }

  Widget _userCard(UserProfile u) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Card(
        child: ListTile(
          leading: CircleAvatar(
            child: Text(u.name.isEmpty ? '?' : u.name[0].toUpperCase()),
          ),
          title: Text(u.name,
              style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text('${u.role.dbValue} · ${u.phone ?? 'Sin teléfono'}'),
          trailing: Icon(
            u.active ? Icons.check_circle : Icons.block,
            color: u.active ? Colors.green : Colors.red,
          ),
        ),
      ),
    );
  }
}
