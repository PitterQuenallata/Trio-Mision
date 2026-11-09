import React, { Suspense, lazy } from 'react';
import {
  createRouter,
  createRoute,
  createRootRoute,
  createHashHistory,
  RouterProvider,
  Outlet,
  useLocation,
  useNavigate,
  Navigate,
} from '@tanstack/react-router';
import { BlakorShell } from '../../shared/components/layout/blakor-shell';
import { IOSSpinner } from '../../components/ui/ios-spinner';
import { useAuth } from '../../shared/auth/auth-context';
import { canAccessRoute, canEnterPanel } from '../../shared/auth/permissions';
import { SinAccesoPage } from '../../modules/auth/pages/sin-acceso-page';

// Carga de pantalla: mientras se restaura la sesión o se carga una sección.
function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-muted-foreground animate-in fade-in duration-200">
      <IOSSpinner size="md" />
      <span className="text-xs font-medium tracking-wide">Cargando…</span>
    </div>
  );
}

const withSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => {
  return function SuspenseWrappedRoute(props: any) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
};

// Route-level code splitting: cada sección se carga solo al entrar en su ruta.
const page = (load: () => Promise<Record<string, unknown>>, name: string) =>
  withSuspense(lazy(() => load().then((m) => ({ default: m[name] as React.ComponentType<any> }))));

const LoginPage = page(() => import('../../modules/auth/pages/login-page'), 'LoginPage');
const AuthErrorFullscreenPage = page(() => import('../../modules/auth/pages/auth-error-fullscreen-page'), 'AuthErrorFullscreenPage');
const DashboardPage = page(() => import('../../modules/dashboard/pages/dashboard-page'), 'DashboardPage');
const UsuariosPage = page(() => import('../../modules/usuarios/pages/usuarios-page'), 'UsuariosPage');
const MiGrupoPage = page(() => import('../../modules/mi-grupo/pages/mi-grupo-page'), 'MiGrupoPage');
const GruposPage = page(() => import('../../modules/grupos/pages/grupos-page'), 'GruposPage');
const GrupoPage = page(() => import('../../modules/grupos/pages/grupo-page'), 'GrupoPage');
const AlbumPage = page(() => import('../../modules/grupos/pages/album-page'), 'AlbumPage');
const NuevoLanzamientoPage = page(() => import('../../modules/grupos/pages/nuevo-lanzamiento-page'), 'NuevoLanzamientoPage');

// Rutas que se muestran sin el shell de navegación.
const STANDALONE_PATHS = new Set(['/auth/login']);

// 1. Root Route with Shell Layout
const rootRoute = createRootRoute({
  component: function RootLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { status, identidad } = useAuth();

    // Current path including search params
    const searchStr = location.searchStr || '';
    const fullPath = searchStr ? `${location.pathname}?${searchStr}` : location.pathname;

    const handleNavigate = (path: string) => {
      const cleanPath = path.replace(/^#/, '');
      const [to, query] = cleanPath.split('?');
      if (query) {
        const searchParams = Object.fromEntries(new URLSearchParams(query));
        navigate({ to, search: searchParams });
      } else {
        navigate({ to });
      }
    };

    if (STANDALONE_PATHS.has(location.pathname)) {
      return <Outlet />;
    }

    // Guard de autenticación y de rol. Mientras se restaura la sesión no se decide nada.
    if (status === 'loading') {
      return <PageLoader />;
    }
    if (status === 'anonymous') {
      return <Navigate to="/auth/login" />;
    }
    // Sin rol staff ni membresía de manager: no entra al panel.
    if (identidad && !canEnterPanel(identidad)) {
      return <SinAccesoPage variant="panel" />;
    }
    const allowed = identidad ? canAccessRoute(location.pathname, identidad) : false;

    return (
      <BlakorShell currentPath={fullPath} onNavigate={handleNavigate}>
        {allowed ? <Outlet /> : <SinAccesoPage variant="ruta" />}
      </BlakorShell>
    );
  },
  notFoundComponent: () => <AuthErrorFullscreenPage forcedCode="404" />,
});

// 2. Rutas del panel (path literal para el tipado de TanStack Router)
const routeRaiz = createRoute({ getParentRoute: () => rootRoute, path: '/', component: DashboardPage });
const routeDashboard = createRoute({ getParentRoute: () => rootRoute, path: '/dashboard', component: DashboardPage });
const routeLogin = createRoute({ getParentRoute: () => rootRoute, path: '/auth/login', component: LoginPage });
const routeMiGrupo = createRoute({ getParentRoute: () => rootRoute, path: '/mi-grupo', component: MiGrupoPage });
const routeGrupos = createRoute({ getParentRoute: () => rootRoute, path: '/grupos', component: GruposPage });
const routeGrupo = createRoute({
  getParentRoute: () => rootRoute,
  path: '/grupos/$grupoId',
  component: function GrupoRoute() {
    const { grupoId } = routeGrupo.useParams();
    return <GrupoPage grupoId={grupoId} />;
  },
});
const routeAlbum = createRoute({
  getParentRoute: () => rootRoute,
  path: '/grupos/$grupoId/albumes/$albumId',
  component: function AlbumRoute() {
    const { grupoId, albumId } = routeAlbum.useParams();
    return <AlbumPage grupoId={grupoId} albumId={albumId} />;
  },
});
const routeNuevoLanzamiento = createRoute({
  getParentRoute: () => rootRoute,
  path: '/grupos/$grupoId/nuevo',
  component: function NuevoRoute() {
    const { grupoId } = routeNuevoLanzamiento.useParams();
    return <NuevoLanzamientoPage grupoId={grupoId} />;
  },
});
const routeUsuarios = createRoute({ getParentRoute: () => rootRoute, path: '/usuarios', component: UsuariosPage });

const routeTree = rootRoute.addChildren([
  routeRaiz,
  routeDashboard,
  routeLogin,
  routeMiGrupo,
  routeGrupos,
  routeGrupo,
  routeAlbum,
  routeNuevoLanzamiento,
  routeUsuarios,
]);

// 4. Create Router with Hash History
const hashHistory = createHashHistory();

export const router = createRouter({
  routeTree,
  history: hashHistory,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// 5. Main Type-Safe TanStack Router Root Component
export const AppRouter: React.FC = () => {
  return <RouterProvider router={router} />;
};
