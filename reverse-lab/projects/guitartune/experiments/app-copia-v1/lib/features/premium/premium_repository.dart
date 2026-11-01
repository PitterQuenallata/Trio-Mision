import 'dart:async';

/// Planes de suscripción disponibles.
enum SubscriptionPlan { yearly, monthly }

/// Resultado abstracto de una operación de compra/restauración.
/// No contiene detalles de plataforma; la implementación real con
/// Google Play Billing / StoreKit proveerá los valores concretos.
enum SubscriptionResult {
  success,
  cancelled,
  pending,
  error,
  notAvailable,
}

/// Contrato para el subsistema de compras premium.
///
/// La aplicación usa esta abstracción para decidir qué funciones están
/// desbloqueadas. Una implementación real conectará con `in_app_purchase`
/// o el SDK nativo correspondiente; por ahora el proyecto solo define la
/// interfaz y un señuelo de demostración.
abstract class PremiumRepository {
  /// Emite `true` mientras la suscripción activa esté vigente.
  Stream<bool> get isPremiumStream;

  /// Estado actual síncrono (útil durante el arranque).
  Future<bool> get isPremium;

  /// Inicia la compra del [plan] seleccionado.
  Future<SubscriptionResult> purchase(SubscriptionPlan plan);

  /// Restaura compras previas vinculadas a la cuenta de la tienda.
  Future<SubscriptionResult> restorePurchases();

  /// Libera recursos nativos si es necesario.
  Future<void> dispose();
}

/// Implementación de demostración. No realiza cobros ni llama a la tienda;
/// simplemente permite probar los flujos de UI.
class DemoPremiumRepository implements PremiumRepository {
  final _controller = StreamController<bool>.broadcast();
  bool _premium = false;

  @override
  Stream<bool> get isPremiumStream => _controller.stream;

  @override
  Future<bool> get isPremium async => _premium;

  @override
  Future<SubscriptionResult> purchase(SubscriptionPlan plan) async {
    _premium = true;
    _controller.add(true);
    return SubscriptionResult.success;
  }

  @override
  Future<SubscriptionResult> restorePurchases() async {
    _premium = true;
    _controller.add(true);
    return SubscriptionResult.success;
  }

  @override
  Future<void> dispose() async {
    await _controller.close();
  }
}
