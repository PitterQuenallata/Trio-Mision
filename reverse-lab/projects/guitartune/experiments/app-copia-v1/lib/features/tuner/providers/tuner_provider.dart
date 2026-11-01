import 'dart:async';
import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/note.dart';
import '../../../models/tuning.dart';
import '../../../services/tuner_service.dart';

enum TunerMode { chromatic, guided }

class TunerUiState {
  final TunerMode mode;
  final Tuning tuning;
  final int? selectedStringNumber;
  final bool autoSelect;
  final double a4;
  final bool isRecording;
  final PitchResult? currentResult;

  const TunerUiState({
    this.mode = TunerMode.guided,
    this.tuning = Tunings.standardGuitar,
    this.selectedStringNumber = 6,
    this.autoSelect = true,
    this.a4 = 440.0,
    this.isRecording = false,
    this.currentResult,
  });

  TunerUiState copyWith({
    TunerMode? mode,
    Tuning? tuning,
    int? selectedStringNumber,
    bool? autoSelect,
    double? a4,
    bool? isRecording,
    PitchResult? currentResult,
  }) {
    return TunerUiState(
      mode: mode ?? this.mode,
      tuning: tuning ?? this.tuning,
      selectedStringNumber: selectedStringNumber ?? this.selectedStringNumber,
      autoSelect: autoSelect ?? this.autoSelect,
      a4: a4 ?? this.a4,
      isRecording: isRecording ?? this.isRecording,
      currentResult: currentResult ?? this.currentResult,
    );
  }
}

class GuidedTuningResult {
  final GuitarString targetString;
  final double deviationCents;
  final bool isSilent;
  final bool isInTune;

  const GuidedTuningResult({
    required this.targetString,
    required this.deviationCents,
    this.isSilent = false,
    this.isInTune = false,
  });

  TuningStatus get status {
    if (isSilent) return TuningStatus.silent;
    if (isInTune) return TuningStatus.inTune;
    if (deviationCents > 0) return TuningStatus.sharp;
    return TuningStatus.flat;
  }

  String get guidanceText {
    if (isSilent) return 'Play a string';
    if (isInTune) return 'In tune';
    if (deviationCents > 0) return 'Tune down';
    return 'Tune up';
  }
}

class TunerNotifier extends StateNotifier<TunerUiState> {
  final TunerService _service;
  StreamSubscription<PitchResult>? _subscription;

  TunerNotifier(this._service) : super(const TunerUiState()) {
    _init();
  }

  Future<void> _init() async {
    _subscription = _service.resultStream.listen((result) {
      state = state.copyWith(currentResult: result);
    });
    await _service.start();
    state = state.copyWith(isRecording: true);
  }

  void setMode(TunerMode mode) => state = state.copyWith(mode: mode);

  void setTuning(Tuning tuning) {
    state = state.copyWith(
      tuning: tuning,
      selectedStringNumber: tuning.strings.first.number,
    );
  }

  void selectString(int number) {
    state = state.copyWith(
      selectedStringNumber: number,
      autoSelect: false,
    );
  }

  void setAutoSelect(bool value) {
    state = state.copyWith(autoSelect: value);
  }

  void setA4(double a4) {
    _service.a4 = a4;
    state = state.copyWith(a4: a4);
  }

  Future<void> start() async {
    if (state.isRecording) return;
    await _service.start();
    state = state.copyWith(isRecording: true);
  }

  Future<void> stop() async {
    if (!state.isRecording) return;
    await _service.stop();
    state = state.copyWith(isRecording: false);
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _service.dispose();
    super.dispose();
  }
}

final tunerStateProvider = StateNotifierProvider<TunerNotifier, TunerUiState>(
  (ref) {
    final service = ref.watch(tunerServiceProvider);
    return TunerNotifier(service);
  },
);

final guidedTuningProvider = Provider<GuidedTuningResult>((ref) {
  final ui = ref.watch(tunerStateProvider);
  final result = ui.currentResult;

  final strings = ui.tuning.strings;
  final defaultString = strings.first;

  if (result == null || result.status == TuningStatus.silent) {
    return GuidedTuningResult(
      targetString: strings.firstWhere(
        (s) => s.number == ui.selectedStringNumber,
        orElse: () => defaultString,
      ),
      deviationCents: 0,
      isSilent: true,
    );
  }

  final GuitarString target;
  if (ui.autoSelect) {
    target = strings
        .map((s) {
          final targetFreq = _scaledFrequency(s.frequency, ui.a4);
          final cents = _centsBetween(result.frequency, targetFreq);
          return (string: s, distance: cents.abs());
        })
        .reduce((a, b) => a.distance < b.distance ? a : b)
        .string;
  } else {
    target = strings.firstWhere(
      (s) => s.number == ui.selectedStringNumber,
      orElse: () => defaultString,
    );
  }

  final targetFreq = _scaledFrequency(target.frequency, ui.a4);
  final deviation = _centsBetween(result.frequency, targetFreq);

  return GuidedTuningResult(
    targetString: target,
    deviationCents: deviation,
    isInTune: deviation.abs() < 5,
  );
});

double _scaledFrequency(double baseFrequency, double a4) {
  return baseFrequency * (a4 / 440.0);
}

double _centsBetween(double detected, double target) {
  if (detected <= 0 || target <= 0) return 0;
  return 1200 * math.log(detected / target) / math.ln2;
}
