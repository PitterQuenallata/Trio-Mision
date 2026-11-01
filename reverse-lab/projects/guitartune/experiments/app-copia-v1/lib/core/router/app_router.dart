import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/premium/premium_plans_screen.dart';
import '../../features/premium/premium_onboarding_screen.dart';
import '../../features/song/song_viewer_screen.dart';
import '../../features/tools/chords/chord_library_screen.dart';
import '../../features/tools/metronome/metronome_screen.dart';
import '../../features/tools/tools_screen.dart';
import '../../features/tuner/tuner_screen.dart';
import '../../shared/widgets/app_shell.dart';

abstract final class AppRoutes {
  static const home = '/';
  static const tuner = '/tuner';
  static const tools = '/tools';
  static const metronome = '/tools/metronome';
  static const chordLibrary = '/tools/chords';
  static const songViewer = '/song';
  static const premiumOnboarding = '/premium/onboarding';
  static const premiumPlans = '/premium/plans';
}

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: AppRoutes.premiumOnboarding,
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.home,
                builder: (context, state) => const PlaceholderScreen(title: 'Songs'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.tuner,
                builder: (context, state) => const TunerScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.tools,
                builder: (context, state) => const ToolsScreen(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: AppRoutes.metronome,
        builder: (context, state) => const MetronomeScreen(),
      ),
      GoRoute(
        path: AppRoutes.chordLibrary,
        builder: (context, state) => const ChordLibraryScreen(),
      ),
      GoRoute(
        path: AppRoutes.songViewer,
        builder: (context, state) => const SongViewerScreen(),
      ),
      GoRoute(
        path: AppRoutes.premiumOnboarding,
        builder: (context, state) => const PremiumOnboardingScreen(),
      ),
      GoRoute(
        path: AppRoutes.premiumPlans,
        builder: (context, state) => const PremiumPlansScreen(),
      ),
    ],
  );
});

class PlaceholderScreen extends StatelessWidget {
  final String title;
  const PlaceholderScreen({super.key, required this.title});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Text(title, style: Theme.of(context).textTheme.headlineSmall),
      ),
    );
  }
}
