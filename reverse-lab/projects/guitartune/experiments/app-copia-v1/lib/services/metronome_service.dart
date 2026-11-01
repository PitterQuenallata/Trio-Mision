import 'dart:async';
import 'dart:math' as math;

import 'package:audioplayers/audioplayers.dart';

import 'tone_generator.dart';

class MetronomeService {
  final AudioPlayer _accentPlayer = AudioPlayer();
  final AudioPlayer _beatPlayer = AudioPlayer();

  Timer? _timer;
  double _bpm = 120;
  int _beatsPerBar = 4;
  int _subdivision = 1;
  int _currentBeat = 0;
  bool _isPlaying = false;

  final _tickController = StreamController<int>.broadcast();
  Stream<int> get tickStream => _tickController.stream;

  double get bpm => _bpm;
  int get beatsPerBar => _beatsPerBar;
  bool get isPlaying => _isPlaying;

  Future<void> initialize() async {
    final accentBytes = ToneGenerator.generateAccentClick();
    final beatBytes = ToneGenerator.generateClick();
    await _accentPlayer.setSourceBytes(accentBytes);
    await _beatPlayer.setSourceBytes(beatBytes);
    await _accentPlayer.setReleaseMode(ReleaseMode.stop);
    await _beatPlayer.setReleaseMode(ReleaseMode.stop);
  }

  void setBpm(double bpm) {
    _bpm = math.max(20, math.min(300, bpm));
    if (_isPlaying) {
      _restartTimer();
    }
  }

  void setTimeSignature(int beatsPerBar, {int subdivision = 1}) {
    _beatsPerBar = beatsPerBar;
    _subdivision = subdivision;
    _currentBeat = 0;
    if (_isPlaying) {
      _restartTimer();
    }
  }

  void play() {
    if (_isPlaying) return;
    _isPlaying = true;
    _currentBeat = 0;
    _tick();
    _restartTimer();
  }

  void pause() {
    _isPlaying = false;
    _timer?.cancel();
    _timer = null;
  }

  void stop() {
    pause();
    _currentBeat = 0;
  }

  void _restartTimer() {
    _timer?.cancel();
    final intervalMs = 60000.0 / (_bpm * _subdivision);
    _timer = Timer.periodic(
      Duration(microseconds: (intervalMs * 1000).round()),
      (_) => _tick(),
    );
  }

  void _tick() {
    _currentBeat++;
    if (_currentBeat >= _beatsPerBar * _subdivision) {
      _currentBeat = 0;
    }

    final isAccent = _currentBeat % _subdivision == 0 &&
        (_currentBeat ~/ _subdivision) == 0;

    if (isAccent) {
      _accentPlayer.resume();
    } else if (_currentBeat % _subdivision == 0) {
      _beatPlayer.resume();
    }

    _tickController.add(_currentBeat);
  }

  Future<void> dispose() async {
    stop();
    await _tickController.close();
    await _accentPlayer.dispose();
    await _beatPlayer.dispose();
  }
}
