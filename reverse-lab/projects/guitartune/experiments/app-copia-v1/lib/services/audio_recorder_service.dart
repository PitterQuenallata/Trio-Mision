import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';

class AudioRecorderService {
  final AudioRecorder _recorder = AudioRecorder();
  final _sampleRate = 22050;

  StreamSubscription<List<int>>? _pcmSubscription;
  final _pcmController = StreamController<Float32List>.broadcast();

  Stream<Float32List> get pcmStream => _pcmController.stream;

  bool _isRecording = false;
  bool get isRecording => _isRecording;

  int get sampleRate => _sampleRate;

  Future<bool> requestPermission() async {
    final status = await Permission.microphone.request();
    return status.isGranted;
  }

  Future<void> start() async {
    if (_isRecording) return;
    if (!await requestPermission()) {
      throw Exception('Microphone permission denied');
    }

    _isRecording = true;
    final stream = await _recorder.startStream(
      const RecordConfig(
        encoder: AudioEncoder.pcm16bits,
        numChannels: 1,
        sampleRate: 22050,
      ),
    );

    _pcmSubscription = stream.listen(
      (bytes) {
        final int16 = Int16List.sublistView(Uint8List.fromList(bytes).buffer.asInt16List());
        final float = Float32List(int16.length);
        for (var i = 0; i < int16.length; i++) {
          float[i] = int16[i] / 32768.0;
        }
        _pcmController.add(float);
      },
      onError: (e) => debugPrint('Audio stream error: $e'),
    );
  }

  Future<void> stop() async {
    _isRecording = false;
    await _pcmSubscription?.cancel();
    _pcmSubscription = null;
    await _recorder.stop();
  }

  Future<void> dispose() async {
    await stop();
    await _pcmController.close();
    await _recorder.dispose();
  }
}
