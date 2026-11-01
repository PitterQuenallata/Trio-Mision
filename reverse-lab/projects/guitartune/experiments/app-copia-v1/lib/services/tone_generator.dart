import 'dart:math' as math;
import 'dart:typed_data';

class ToneGenerator {
  static Uint8List generateSineTone({
    required double frequency,
    required double sampleRate,
    required double durationSeconds,
    double amplitude = 0.8,
  }) {
    final samples = (sampleRate * durationSeconds).round();
    final bytes = ByteData(samples * 2 * 2); // stereo int16
    for (var i = 0; i < samples; i++) {
      final t = i / sampleRate;
      final envelope = 1.0 - (i / samples);
      final value = ((math.sin(2 * math.pi * frequency * t) *
              amplitude *
              envelope *
              32767)
          .toInt());
      bytes.setInt16(i * 4, value, Endian.little);
      bytes.setInt16(i * 4 + 2, value, Endian.little);
    }
    return _wrapWav(bytes.buffer.asUint8List(), sampleRate.round());
  }

  static Uint8List generateClick({
    double sampleRate = 44100,
    double durationSeconds = 0.05,
    double frequency = 1000,
    double amplitude = 0.9,
  }) {
    final samples = (sampleRate * durationSeconds).round();
    final bytes = ByteData(samples * 2 * 2);
    for (var i = 0; i < samples; i++) {
      final t = i / sampleRate;
      final envelope = math.exp(-t * 40);
      final value = ((math.sin(2 * math.pi * frequency * t) *
              amplitude *
              envelope *
              32767)
          .toInt());
      bytes.setInt16(i * 4, value, Endian.little);
      bytes.setInt16(i * 4 + 2, value, Endian.little);
    }
    return _wrapWav(bytes.buffer.asUint8List(), sampleRate.round());
  }

  static Uint8List generateAccentClick({
    double sampleRate = 44100,
    double durationSeconds = 0.07,
    double frequency = 1500,
    double amplitude = 1.0,
  }) {
    return generateClick(
      sampleRate: sampleRate,
      durationSeconds: durationSeconds,
      frequency: frequency,
      amplitude: amplitude,
    );
  }

  static Uint8List _wrapWav(Uint8List pcmData, int sampleRate) {
    final totalLength = pcmData.length + 44;
    final header = ByteData(44);
    header.setUint8(0, 0x52); // 'R'
    header.setUint8(1, 0x49); // 'I'
    header.setUint8(2, 0x46); // 'F'
    header.setUint8(3, 0x46); // 'F'
    header.setUint32(4, totalLength - 8, Endian.little);
    header.setUint8(8, 0x57); // 'W'
    header.setUint8(9, 0x41); // 'A'
    header.setUint8(10, 0x56); // 'V'
    header.setUint8(11, 0x45); // 'E'
    header.setUint8(12, 0x66); // 'f'
    header.setUint8(13, 0x6D); // 'm'
    header.setUint8(14, 0x74); // 't'
    header.setUint8(15, 0x20); // ' '
    header.setUint32(16, 16, Endian.little);
    header.setUint16(20, 1, Endian.little); // PCM
    header.setUint16(22, 2, Endian.little); // stereo
    header.setUint32(24, sampleRate, Endian.little);
    header.setUint32(28, sampleRate * 2 * 2, Endian.little);
    header.setUint16(32, 4, Endian.little);
    header.setUint16(34, 16, Endian.little);
    header.setUint8(36, 0x64); // 'd'
    header.setUint8(37, 0x61); // 'a'
    header.setUint8(38, 0x74); // 't'
    header.setUint8(39, 0x61); // 'a'
    header.setUint32(40, pcmData.length, Endian.little);

    final result = Uint8List(totalLength);
    result.setRange(0, 44, header.buffer.asUint8List());
    result.setRange(44, totalLength, pcmData);
    return result;
  }
}
