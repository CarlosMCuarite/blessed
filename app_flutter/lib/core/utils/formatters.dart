import 'package:intl/intl.dart';

class AppFormatters {
  static final _date = DateFormat('dd/MM/yyyy');
  static final _shortDate = DateFormat('EEE d', 'es');
  static final _fullDate = DateFormat("EEEE d 'de' MMMM", 'es');

  static String date(DateTime value) => _date.format(value);
  static String shortDate(DateTime value) => _shortDate.format(value);
  static String fullDate(DateTime value) => _fullDate.format(value);
  static String isoDate(DateTime value) => DateFormat('yyyy-MM-dd').format(value);

  static String hhmm(Object? value) {
    final text = value?.toString() ?? '';
    return text.length >= 5 ? text.substring(0, 5) : text;
  }
}
