import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class NotificationService {
  static final _local = FlutterLocalNotificationsPlugin();
  static const _channel = AndroidNotificationChannel(
    'reservas',
    'Reservas',
    description: 'Avisos de nuevas citas',
    importance: Importance.high,
  );

  static Future<void> initialize() async {
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const apple = DarwinInitializationSettings();

    await _local.initialize(
      const InitializationSettings(android: android, iOS: apple),
    );

    if (Platform.isAndroid) {
      await _local
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(_channel);
    }

    FirebaseMessaging.onMessage.listen((message) async {
      final notification = message.notification;
      if (notification == null) return;

      await _local.show(
        notification.hashCode,
        notification.title ?? 'Nueva reserva',
        notification.body ?? '',
        const NotificationDetails(
          android: AndroidNotificationDetails(
            'reservas',
            'Reservas',
            channelDescription: 'Avisos de nuevas citas',
            importance: Importance.high,
            priority: Priority.high,
          ),
          iOS: DarwinNotificationDetails(
            presentAlert: true,
            presentBadge: true,
            presentSound: true,
          ),
        ),
        payload: message.data['reserva_id']?.toString(),
      );
    });
  }

  static Future<void> registerCurrentDevice() async {
    final messaging = FirebaseMessaging.instance;

    final settings = await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    if (settings.authorizationStatus == AuthorizationStatus.denied) return;

    if (Platform.isIOS || Platform.isMacOS) {
      String? token;
      for (var attempt = 0; attempt < 20 && token == null; attempt++) {
        token = await messaging.getAPNSToken();
        if (token == null) {
          await Future<void>.delayed(const Duration(milliseconds: 500));
        }
      }
    }

    final fcm = await messaging.getToken();
    if (fcm != null) await _save(fcm);

    messaging.onTokenRefresh.listen(_save);
  }

  static Future<void> _save(String token) async {
    final db = Supabase.instance.client;
    if (db.auth.currentUser == null) return;

    await db.rpc(
      'registrar_dispositivo',
      params: {
        'p_token': token,
        'p_plataforma': Platform.isIOS ? 'ios' : 'android',
      },
    );
  }
}
