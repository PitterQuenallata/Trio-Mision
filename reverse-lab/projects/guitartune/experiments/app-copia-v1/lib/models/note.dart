import 'dart:math' as math;

class PitchResult {
  final double frequency;
  final String note;
  final int octave;
  final double cents;
  final double confidence;
  final bool isStable;

  const PitchResult({
    required this.frequency,
    required this.note,
    required this.octave,
    required this.cents,
    required this.confidence,
    required this.isStable,
  });

  static const List<String> noteNames = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
  ];

  TuningStatus get status {
    if (confidence < 0.3 || frequency <= 0) return TuningStatus.silent;
    if (cents.abs() < 5) return TuningStatus.inTune;
    if (cents > 0) return TuningStatus.sharp;
    return TuningStatus.flat;
  }

  static double frequencyToMidi(double frequency, {double a4 = 440.0}) {
    if (frequency <= 0) return -1;
    return 69 + 12 * math.log(frequency / a4) / math.ln2;
  }

  static double midiToFrequency(double midi, {double a4 = 440.0}) {
    return a4 * math.pow(2, (midi - 69) / 12).toDouble();
  }

  static ({String note, int octave, double cents}) fromFrequency(
    double frequency, {
    double a4 = 440.0,
  }) {
    if (frequency <= 0) {
      return (note: '-', octave: 0, cents: 0);
    }
    final midi = frequencyToMidi(frequency, a4: a4);
    final rounded = midi.round();
    final cents = (midi - rounded) * 100;
    final noteIndex = ((rounded % 12) + 12) % 12;
    final octave = (rounded ~/ 12) - 1;
    return (
      note: noteNames[noteIndex],
      octave: octave,
      cents: cents,
    );
  }
}

enum TuningStatus { silent, flat, inTune, sharp, unstable }
