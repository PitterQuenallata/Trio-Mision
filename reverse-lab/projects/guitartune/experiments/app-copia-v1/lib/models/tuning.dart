class GuitarString {
  final int number;
  final String note;
  final int octave;
  final double frequency;

  const GuitarString({
    required this.number,
    required this.note,
    required this.octave,
    required this.frequency,
  });
}

class Tuning {
  final String name;
  final String instrument;
  final List<GuitarString> strings;

  const Tuning({
    required this.name,
    required this.instrument,
    required this.strings,
  });
}

abstract final class Tunings {
  static const standardGuitar = Tuning(
    name: 'Standard',
    instrument: 'Guitar 6-string',
    strings: [
      GuitarString(number: 6, note: 'E', octave: 2, frequency: 82.41),
      GuitarString(number: 5, note: 'A', octave: 2, frequency: 110.00),
      GuitarString(number: 4, note: 'D', octave: 3, frequency: 146.83),
      GuitarString(number: 3, note: 'G', octave: 3, frequency: 196.00),
      GuitarString(number: 2, note: 'B', octave: 3, frequency: 246.94),
      GuitarString(number: 1, note: 'E', octave: 4, frequency: 329.63),
    ],
  );

  static const dropD = Tuning(
    name: 'Drop D',
    instrument: 'Guitar 6-string',
    strings: [
      GuitarString(number: 6, note: 'D', octave: 2, frequency: 73.42),
      GuitarString(number: 5, note: 'A', octave: 2, frequency: 110.00),
      GuitarString(number: 4, note: 'D', octave: 3, frequency: 146.83),
      GuitarString(number: 3, note: 'G', octave: 3, frequency: 196.00),
      GuitarString(number: 2, note: 'B', octave: 3, frequency: 246.94),
      GuitarString(number: 1, note: 'E', octave: 4, frequency: 329.63),
    ],
  );

  static const standardUkulele = Tuning(
    name: 'Standard',
    instrument: 'Ukulele',
    strings: [
      GuitarString(number: 4, note: 'G', octave: 4, frequency: 392.00),
      GuitarString(number: 3, note: 'C', octave: 4, frequency: 261.63),
      GuitarString(number: 2, note: 'E', octave: 4, frequency: 329.63),
      GuitarString(number: 1, note: 'A', octave: 4, frequency: 440.00),
    ],
  );
}
