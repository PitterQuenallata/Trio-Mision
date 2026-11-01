class SongLine {
  final String? chords;
  final String lyrics;
  final double? timestampSeconds;

  const SongLine({
    this.chords,
    required this.lyrics,
    this.timestampSeconds,
  });
}

class SongSection {
  final String name;
  final List<SongLine> lines;

  const SongSection({required this.name, required this.lines});
}

class Song {
  final String title;
  final String artist;
  final List<SongSection> sections;

  const Song({
    required this.title,
    required this.artist,
    required this.sections,
  });

  List<SongLine> get allLines {
    return sections.expand((s) => s.lines).toList();
  }
}

abstract final class SampleSongs {
  static const example = Song(
    title: 'Example Song',
    artist: 'Unknown Artist',
    sections: [
      SongSection(
        name: 'Verse 1',
        lines: [
          SongLine(chords: 'C              G', lyrics: 'When I find myself in times of trouble'),
          SongLine(chords: 'Am             F', lyrics: 'Mother Mary comes to me'),
          SongLine(chords: 'C              G', lyrics: 'Speaking words of wisdom'),
          SongLine(chords: 'F       C      G', lyrics: 'Let it be'),
        ],
      ),
      SongSection(
        name: 'Chorus',
        lines: [
          SongLine(chords: 'C              G', lyrics: 'Let it be, let it be'),
          SongLine(chords: 'Am             F', lyrics: 'Let it be, let it be'),
          SongLine(chords: 'C              G', lyrics: 'Whisper words of wisdom'),
          SongLine(chords: 'F       C      G', lyrics: 'Let it be'),
        ],
      ),
      SongSection(
        name: 'Verse 2',
        lines: [
          SongLine(chords: 'C              G', lyrics: 'And when the broken-hearted people'),
          SongLine(chords: 'Am             F', lyrics: 'Living in the world agree'),
          SongLine(chords: 'C              G', lyrics: 'There will be an answer'),
          SongLine(chords: 'F       C      G', lyrics: 'Let it be'),
        ],
      ),
    ],
  );
}
