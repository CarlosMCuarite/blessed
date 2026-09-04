import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config/app_config.dart';

final backendApiProvider = Provider<BackendApi>((ref) => BackendApi());

class BackendApi {
  Future<Map<String, String>> _headers() async {
    final token = Supabase.instance.client.auth.currentSession?.accessToken;
    if (token == null) throw Exception('Sesión no válida');
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  Future<Map<String, dynamic>> _decode(http.Response response) async {
    final body = response.body.isEmpty
        ? <String, dynamic>{}
        : Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    if (response.statusCode >= 300) {
      throw Exception(body['error']?.toString() ?? 'Error del servidor');
    }
    return body;
  }

  Future<void> createUser({
    required String email,
    required String password,
    required String name,
    String? phone,
    required String role,
  }) async {
    final response = await http.post(
      Uri.parse('${AppConfig.backendUrl}/api/users'),
      headers: await _headers(),
      body: jsonEncode({
        'email': email.trim(),
        'password': password,
        'nombre': name.trim(),
        'telefono': phone?.trim(),
        'rol': role,
      }),
    );
    await _decode(response);
  }

  Future<void> editUser({
    required String userId,
    String? name,
    String? phone,
    bool? active,
  }) async {
    final response = await http.patch(
      Uri.parse('${AppConfig.backendUrl}/api/users/$userId'),
      headers: await _headers(),
      body: jsonEncode({
        if (name != null) 'nombre': name.trim(),
        if (phone != null) 'telefono': phone.trim(),
        if (active != null) 'activo': active,
      }),
    );
    await _decode(response);
  }

  Future<void> resetPassword({
    required String userId,
    required String newPassword,
  }) async {
    final response = await http.post(
      Uri.parse('${AppConfig.backendUrl}/api/users/$userId/reset-password'),
      headers: await _headers(),
      body: jsonEncode({'newPassword': newPassword}),
    );
    await _decode(response);
  }
}
