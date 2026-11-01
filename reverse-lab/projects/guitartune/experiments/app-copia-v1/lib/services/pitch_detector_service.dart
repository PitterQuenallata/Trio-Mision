import 'dart:math' as math;
import 'dart:typed_data';

import '../models/note.dart';

class PitchDetectorService {
  final double sampleRate;
  final int bufferSize;

  PitchDetectorService({this.sampleRate = 22050, this.bufferSize = 2048});

  PitchResult detect(Float32List buffer, {double a4 = 440.0}) {
    final frequency = _yinPitch(buffer);
    if (frequency <= 0 || frequency.isNaN) {
      return PitchResult(
        frequency: 0,
        note: '-',
        octave: 0,
        cents: 0,
        confidence: 0,
        isStable: false,
      );
    }

    final noteData = PitchResult.fromFrequency(frequency, a4: a4);
    final confidence = _estimateConfidence(buffer, frequency);

    return PitchResult(
      frequency: frequency,
      note: noteData.note,
      octave: noteData.octave,
      cents: noteData.cents,
      confidence: confidence,
      isStable: confidence > 0.6,
    );
  }

  double _yinPitch(Float32List buffer) {
    const threshold = 0.15;
    final halfBuffer = buffer.length ~/ 2;
    final difference = Float32List(halfBuffer);

    for (var tau = 0; tau < halfBuffer; tau++) {
      var sum = 0.0;
      for (var i = 0; i < halfBuffer; i++) {
        final delta = buffer[i] - buffer[i + tau];
        sum += delta * delta;
      }
      difference[tau] = sum;
    }

    difference[0] = 1;
    var runningSum = 0.0;
    for (var tau = 1; tau < halfBuffer; tau++) {
      runningSum += difference[tau];
      difference[tau] *= tau / runningSum;
    }

    var tau = -1;
    for (var i = 2; i < halfBuffer; i++) {
      if (difference[i] < threshold &&
          difference[i] < difference[i - 1] &&
          difference[i] < difference[i + 1]) {
        tau = i;
        break;
      }
    }

    if (tau == -1 || tau == 0) return 0;

    final betterTau = _parabolicInterpolation(difference, tau);
    return sampleRate / betterTau;
  }

  double _parabolicInterpolation(Float32List difference, int tau) {
    final alpha = difference[tau - 1];
    final beta = difference[tau];
    final gamma = difference[tau + 1];
    final p = 0.5 * (alpha - gamma) / (alpha - 2 * beta + gamma);
    return tau + p;
  }

  double _estimateConfidence(Float32List buffer, double frequency) {
    final period = (sampleRate / frequency).round();
    if (period <= 0 || period >= buffer.length) return 0;

    var autocorr = 0.0;
    var energy = 0.0;
    for (var i = 0; i < buffer.length - period; i++) {
      autocorr += buffer[i] * buffer[i + period];
      energy += buffer[i] * buffer[i];
    }
    if (energy == 0) return 0;
    return autocorr / energy;
  }
}
