class ChordPosition {
  /// Fret number for each string (1-6, high to low or low to high depending on convention).
  /// null = open string, -1 = muted string (x).
  final List<int?> frets;
  final List<int?> fingers;
  final int baseFret;
  final String? barre;

  const ChordPosition({
    required this.frets,
    required this.fingers,
    this.baseFret = 0,
    this.barre,
  });

  /// Strings are ordered from low E (index 0) to high E (index 5).
  List<int?> get fretsLowToHigh => frets;
}

class ChordDefinition {
  final String root;
  final String type;
  final String fullName;
  final List<ChordPosition> positions;

  const ChordDefinition({
    required this.root,
    required this.type,
    required this.fullName,
    required this.positions,
  });
}

abstract final class ChordLibrary {
  static const roots = [
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

  static const types = [
    'major',
    'minor',
    '7',
    'maj7',
    'm7',
    'sus2',
    'sus4',
  ];

  static const Map<String, ChordDefinition> chords = {
    'C major': ChordDefinition(
      root: 'C',
      type: 'major',
      fullName: 'C major',
      positions: [
        ChordPosition(
          frets: [-1, 3, 2, 0, 1, 0],
          fingers: [null, 3, 2, null, 1, null],
          baseFret: 0,
        ),
        ChordPosition(
          frets: [-1, 3, 5, 5, 5, 3],
          fingers: [null, 1, 2, 3, 4, 1],
          baseFret: 3,
          barre: '1',
        ),
      ],
    ),
    'C minor': ChordDefinition(
      root: 'C',
      type: 'minor',
      fullName: 'C minor',
      positions: [
        ChordPosition(
          frets: [-1, 3, 5, 5, 4, 3],
          fingers: [null, 1, 3, 4, 2, 1],
          baseFret: 3,
          barre: '1',
        ),
      ],
    ),
    'D major': ChordDefinition(
      root: 'D',
      type: 'major',
      fullName: 'D major',
      positions: [
        ChordPosition(
          frets: [-1, -1, 0, 2, 3, 2],
          fingers: [null, null, null, 1, 3, 2],
          baseFret: 0,
        ),
      ],
    ),
    'D minor': ChordDefinition(
      root: 'D',
      type: 'minor',
      fullName: 'D minor',
      positions: [
        ChordPosition(
          frets: [-1, -1, 0, 2, 3, 1],
          fingers: [null, null, null, 2, 3, 1],
          baseFret: 0,
        ),
      ],
    ),
    'E major': ChordDefinition(
      root: 'E',
      type: 'major',
      fullName: 'E major',
      positions: [
        ChordPosition(
          frets: [0, 2, 2, 1, 0, 0],
          fingers: [null, 2, 3, 1, null, null],
          baseFret: 0,
        ),
      ],
    ),
    'E minor': ChordDefinition(
      root: 'E',
      type: 'minor',
      fullName: 'E minor',
      positions: [
        ChordPosition(
          frets: [0, 2, 2, 0, 0, 0],
          fingers: [null, 2, 3, null, null, null],
          baseFret: 0,
        ),
      ],
    ),
    'F major': ChordDefinition(
      root: 'F',
      type: 'major',
      fullName: 'F major',
      positions: [
        ChordPosition(
          frets: [1, 3, 3, 2, 1, 1],
          fingers: [1, 3, 4, 2, 1, 1],
          baseFret: 1,
          barre: '1',
        ),
      ],
    ),
    'F minor': ChordDefinition(
      root: 'F',
      type: 'minor',
      fullName: 'F minor',
      positions: [
        ChordPosition(
          frets: [1, 3, 3, 1, 1, 1],
          fingers: [1, 3, 4, 1, 1, 1],
          baseFret: 1,
          barre: '1',
        ),
      ],
    ),
    'G major': ChordDefinition(
      root: 'G',
      type: 'major',
      fullName: 'G major',
      positions: [
        ChordPosition(
          frets: [3, 2, 0, 0, 0, 3],
          fingers: [2, 1, null, null, null, 3],
          baseFret: 0,
        ),
        ChordPosition(
          frets: [3, 5, 5, 4, 3, 3],
          fingers: [1, 3, 4, 2, 1, 1],
          baseFret: 3,
          barre: '1',
        ),
      ],
    ),
    'G minor': ChordDefinition(
      root: 'G',
      type: 'minor',
      fullName: 'G minor',
      positions: [
        ChordPosition(
          frets: [3, 5, 5, 3, 3, 3],
          fingers: [1, 3, 4, 1, 1, 1],
          baseFret: 3,
          barre: '1',
        ),
      ],
    ),
    'A major': ChordDefinition(
      root: 'A',
      type: 'major',
      fullName: 'A major',
      positions: [
        ChordPosition(
          frets: [-1, 0, 2, 2, 2, 0],
          fingers: [null, null, 1, 2, 3, null],
          baseFret: 0,
        ),
      ],
    ),
    'A minor': ChordDefinition(
      root: 'A',
      type: 'minor',
      fullName: 'A minor',
      positions: [
        ChordPosition(
          frets: [-1, 0, 2, 2, 1, 0],
          fingers: [null, null, 2, 3, 1, null],
          baseFret: 0,
        ),
      ],
    ),
    'B major': ChordDefinition(
      root: 'B',
      type: 'major',
      fullName: 'B major',
      positions: [
        ChordPosition(
          frets: [-1, 2, 4, 4, 4, 2],
          fingers: [null, 1, 2, 3, 4, 1],
          baseFret: 2,
          barre: '1',
        ),
      ],
    ),
    'B minor': ChordDefinition(
      root: 'B',
      type: 'minor',
      fullName: 'B minor',
      positions: [
        ChordPosition(
          frets: [-1, 2, 4, 4, 3, 2],
          fingers: [null, 1, 3, 4, 2, 1],
          baseFret: 2,
          barre: '1',
        ),
      ],
    ),
    'G 7': ChordDefinition(
      root: 'G',
      type: '7',
      fullName: 'G 7',
      positions: [
        ChordPosition(
          frets: [3, 2, 0, 0, 0, 1],
          fingers: [3, 2, null, null, null, 1],
          baseFret: 0,
        ),
      ],
    ),
    'D 7': ChordDefinition(
      root: 'D',
      type: '7',
      fullName: 'D 7',
      positions: [
        ChordPosition(
          frets: [-1, -1, 0, 2, 1, 2],
          fingers: [null, null, null, 2, 1, 3],
          baseFret: 0,
        ),
      ],
    ),
    'E 7': ChordDefinition(
      root: 'E',
      type: '7',
      fullName: 'E 7',
      positions: [
        ChordPosition(
          frets: [0, 2, 0, 1, 0, 0],
          fingers: [null, 2, null, 1, null, null],
          baseFret: 0,
        ),
      ],
    ),
    'A 7': ChordDefinition(
      root: 'A',
      type: '7',
      fullName: 'A 7',
      positions: [
        ChordPosition(
          frets: [-1, 0, 2, 0, 2, 0],
          fingers: [null, null, 2, null, 1, null],
          baseFret: 0,
        ),
      ],
    ),
  };

  static ChordDefinition? find(String root, String type) {
    final key = '$root $type';
    return chords[key];
  }

  static List<ChordDefinition> search(String query) {
    final lower = query.toLowerCase();
    return chords.values
        .where((c) =>
            c.fullName.toLowerCase().contains(lower) ||
            c.root.toLowerCase().contains(lower))
        .toList();
  }
}
