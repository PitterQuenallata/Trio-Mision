import 'package:flutter_test/flutter_test.dart';

import 'package:app_copia_v1/main.dart';

void main() {
  testWidgets('App builds without crashing', (WidgetTester tester) async {
    await tester.pumpWidget(const GuitarTuneApp());
    expect(find.byType(GuitarTuneApp), findsOneWidget);
  });
}
