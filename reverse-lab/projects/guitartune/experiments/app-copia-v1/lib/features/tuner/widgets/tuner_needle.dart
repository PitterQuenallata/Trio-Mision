import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../models/note.dart';

class TunerNeedle extends StatelessWidget {
  final double cents;
  final TuningStatus status;
  final double width;

  const TunerNeedle({
    super.key,
    required this.cents,
    required this.status,
    this.width = 280,
  });

  @override
  Widget build(BuildContext context) {
    final clamped = cents.clamp(-50.0, 50.0);
    final progress = (clamped + 50) / 100;

    Color activeColor;
    switch (status) {
      case TuningStatus.inTune:
        activeColor = AppColors.inTune;
      case TuningStatus.sharp:
        activeColor = AppColors.sharp;
      case TuningStatus.flat:
        activeColor = AppColors.flat;
      case TuningStatus.silent:
      case TuningStatus.unstable:
        activeColor = AppColors.textMuted;
    }

    return SizedBox(
      width: width,
      height: 80,
      child: CustomPaint(
        painter: _NeedlePainter(
          progress: progress,
          activeColor: activeColor,
          isSilent: status == TuningStatus.silent,
        ),
      ),
    );
  }
}

class _NeedlePainter extends CustomPainter {
  final double progress;
  final Color activeColor;
  final bool isSilent;

  _NeedlePainter({
    required this.progress,
    required this.activeColor,
    required this.isSilent,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final centerY = size.height - 16;
    final arcRadius = size.width / 2 - 16;
    final center = Offset(size.width / 2, centerY);

    final arcRect = Rect.fromCircle(center: center, radius: arcRadius);
    final trackPaint = Paint()
      ..color = AppColors.surfaceLight
      ..style = PaintingStyle.stroke
      ..strokeWidth = 6;

    canvas.drawArc(arcRect, math.pi, math.pi, false, trackPaint);

    final activePaint = Paint()
      ..color = activeColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 6
      ..strokeCap = StrokeCap.round;

    final activeSweep = math.pi * progress;
    canvas.drawArc(
      arcRect,
      math.pi,
      activeSweep,
      false,
      activePaint,
    );

    final angle = math.pi + math.pi * progress;
    final needleLength = arcRadius - 8;
    final tip = center + Offset(
      math.cos(angle) * needleLength,
      math.sin(angle) * needleLength,
    );

    final needlePaint = Paint()
      ..color = isSilent ? AppColors.textMuted : activeColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3;
    canvas.drawLine(center, tip, needlePaint);

    final dotPaint = Paint()
      ..color = isSilent ? AppColors.textMuted : activeColor
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, 6, dotPaint);

    _drawTickMarks(canvas, center, arcRadius);
  }

  void _drawTickMarks(Canvas canvas, Offset center, double radius) {
    final tickPaint = Paint()
      ..color = AppColors.textMuted
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;

    const ticks = 11;
    for (var i = 0; i < ticks; i++) {
      final t = i / (ticks - 1);
      final angle = math.pi + math.pi * t;
      final inner = radius - 18;
      final outer = radius - 12;
      final start = center + Offset(math.cos(angle) * inner, math.sin(angle) * inner);
      final end = center + Offset(math.cos(angle) * outer, math.sin(angle) * outer);
      canvas.drawLine(start, end, tickPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _NeedlePainter oldDelegate) {
    return oldDelegate.progress != progress ||
        oldDelegate.activeColor != activeColor ||
        oldDelegate.isSilent != isSilent;
  }
}
