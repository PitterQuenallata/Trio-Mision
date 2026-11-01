import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/note.dart';
import 'audio_recorder_service.dart';
import 'pitch_detector_service.dart';

final tunerServiceProvider = Provider<TunerService>((ref) {
  final service = TunerService();
  ref.onDispose(() => service.dispose());
  return service;
});

class TunerService {
  final AudioRecorderService _recorder = AudioRecorderService();
  final PitchDetectorService _detector = PitchDetectorService(sampleRate: 22050);

  final _resultController = StreamController<PitchResult>.broadcast();
  Stream<PitchResult> get resultStream => _resultController.stream;

  bool _isRecording = false;
  bool get isRecording => _isRecording;

  double _a4 = 440.0;
  double get a4 => _a4;
  set a4(double value) => _a4 = value;

  Future<void> start() async {
    if (_isRecording) return;
    await _recorder.start();
    _isRecording = true;

    final buffer = Float32List(_detector.bufferSize);
    var index = 0;

    _recorder.pcmStream.listen((samples) {
      for (var i = 0; i < samples.length; i++) {
        buffer[index] = samples[i];
        index++;
        if (index >= buffer.length) {
          final result = _detector.detect(buffer, a4: _a4);
          _resultController.add(result);
          index = 0;
        }
      }
    });
  }

  Future<void> stop() async {
    _isRecording = false;
    await _recorder.stop();
  }

  Future<void> dispose() async {
    await stop();
    await _resultController.close();
    await _recorder.dispose();
  }
}
