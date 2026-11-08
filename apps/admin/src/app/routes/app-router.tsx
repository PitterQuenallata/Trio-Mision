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
} from '@tanstack/react-router';
import { BlakorShell } from '../../shared/components/layout/blakor-shell';
import { IOSSpinner } from '../../components/ui/ios-spinner';

// Fallback loader for smooth Apple-style deferred loading
function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-muted-foreground animate-in fade-in duration-200">
      <IOSSpinner size="md" />
      <span className="text-xs font-medium tracking-wide">Cargando módulo...</span>
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

// Route-level code splitting: cada dominio se carga solo al entrar en su ruta.
const page = (load: () => Promise<Record<string, unknown>>, name: string) =>
  withSuspense(lazy(() => load().then((m) => ({ default: m[name] as React.ComponentType<any> }))));

const LoginPage = page(() => import('../../modules/auth/pages/login-page'), 'LoginPage');
const AuthErrorFullscreenPage = page(() => import('../../modules/auth/pages/auth-error-fullscreen-page'), 'AuthErrorFullscreenPage');
const DashboardPage = page(() => import('../../modules/dashboard/pages/dashboard-page'), 'DashboardPage');
const CatalogoPage = page(() => import('../../modules/catalogo/pages/catalogo-page'), 'CatalogoPage');
const HimnarioPage = page(() => import('../../modules/himnario/pages/himnario-page'), 'HimnarioPage');
const ImportacionesPage = page(() => import('../../modules/importaciones/pages/importaciones-page'), 'ImportacionesPage');
const PagosPage = page(() => import('../../modules/pagos/pages/pagos-page'), 'PagosPage');
const LicenciasPage = page(() => import('../../modules/licencias/pages/licencias-page'), 'LicenciasPage');
const ServiciosPage = page(() => import('../../modules/servicios/pages/servicios-page'), 'ServiciosPage');
const UsuariosPage = page(() => import('../../modules/usuarios/pages/usuarios-page'), 'UsuariosPage');
const StaffPage = page(() => import('../../modules/staff/pages/staff-page'), 'StaffPage');
const SoportePage = page(() => import('../../modules/soporte/pages/soporte-page'), 'SoportePage');
const ReportesPage = page(() => import('../../modules/reportes/pages/reportes-page'), 'ReportesPage');
const AuditoriaPage = page(() => import('../../modules/auditoria/pages/auditoria-page'), 'AuditoriaPage');
const ConfiguracionPage = page(() => import('../../modules/configuracion/pages/configuracion-page'), 'ConfiguracionPage');

// Rutas que se muestran sin el shell de navegación.
const STANDALONE_PATHS = new Set(['/auth/login']);

// 1. Root Route with Shell Layout
const rootRoute = createRootRoute({
  component: function RootLayout() {
    const location = useLocation();
    const navigate = useNavigate();

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

    return (
      <BlakorShell currentPath={fullPath} onNavigate={handleNavigate}>
        <Outlet />
      </BlakorShell>
    );
  },
  notFoundComponent: () => <AuthErrorFullscreenPage forcedCode="404" />,
});

// 2. Rutas por dominio (cada ruta con su path literal para el tipado de TanStack Router)
const route0 = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
});

const route1 = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardPage,
});

const route2 = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/login',
  component: LoginPage,
});

const route3 = createRoute({
  getParentRoute: () => rootRoute,
  path: '/catalogo',
  component: CatalogoPage,
});

const route4 = createRoute({
  getParentRoute: () => rootRoute,
  path: '/himnario',
  component: HimnarioPage,
});

const route5 = createRoute({
  getParentRoute: () => rootRoute,
  path: '/importaciones',
  component: ImportacionesPage,
});

const route6 = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pagos',
  component: PagosPage,
});

const route7 = createRoute({
  getParentRoute: () => rootRoute,
  path: '/licencias',
  component: LicenciasPage,
});

const route8 = createRoute({
  getParentRoute: () => rootRoute,
  path: '/servicios',
  component: ServiciosPage,
});

const route9 = createRoute({
  getParentRoute: () => rootRoute,
  path: '/usuarios',
  component: UsuariosPage,
});

const route10 = createRoute({
  getParentRoute: () => rootRoute,
  path: '/staff',
  component: StaffPage,
});

const route11 = createRoute({
  getParentRoute: () => rootRoute,
  path: '/soporte',
  component: SoportePage,
});

const route12 = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reportes',
  component: ReportesPage,
});

const route13 = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auditoria',
  component: AuditoriaPage,
});

const route14 = createRoute({
  getParentRoute: () => rootRoute,
  path: '/configuracion',
  component: ConfiguracionPage,
});

const routeTree = rootRoute.addChildren([
  route0,
  route1,
  route2,
  route3,
  route4,
  route5,
  route6,
  route7,
  route8,
  route9,
  route10,
  route11,
  route12,
  route13,
  route14,
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
