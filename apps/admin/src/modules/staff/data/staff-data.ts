import { StaffMember, PermissionRow } from '../types/staff.types';

export const initialStaffMembers: StaffMember[] = [
  {
    id: 'staff-1',
    name: 'John Daniels',
    email: 'admin@blakor.dev',
    role: 'Super Admin (Owner)',
    access: 'Acceso Total',
    twoFactor: true,
    lastActive: 'En línea',
    avatar: 'JD',
  },
  {
    id: 'staff-2',
    name: 'Mariana Rivera',
    email: 'mariana.sec@blakor.dev',
    role: 'Security & Compliance',
    access: 'Auditoría + RBAC',
    twoFactor: true,
    lastActive: 'Hace 10 min',
    avatar: 'MR',
  },
  {
    id: 'staff-3',
    name: 'Nicolás Silva',
    email: 'nicolas.ops@blakor.dev',
    role: 'DevOps Lead',
    access: 'Infraestructura & Logs',
    twoFactor: true,
    lastActive: 'Hace 1 hora',
    avatar: 'NS',
  },
  {
    id: 'staff-4',
    name: 'Camila Torres',
    email: 'camila.fin@blakor.dev',
    role: 'Billing Specialist',
    access: 'Facturación & Pagos',
    twoFactor: false,
    lastActive: 'Hace 1 día',
    avatar: 'CT',
  },
];

export const initialPermissionsMatrix: PermissionRow[] = [
  { module: 'Dashboard Ejecutivo', superAdmin: true, security: true, devOps: true, billing: false },
  { module: 'Gestión de Usuarios', superAdmin: true, security: true, devOps: false, billing: false },
  { module: 'Facturación & Pasarelas', superAdmin: true, security: false, devOps: false, billing: true },
  { module: 'Licenciamiento SaaS', superAdmin: true, security: true, devOps: true, billing: true },
  { module: 'Matriz RBAC & Roles', superAdmin: true, security: true, devOps: false, billing: false },
  { module: 'Auditoría Forense & Logs', superAdmin: true, security: true, devOps: true, billing: false },
  { module: 'Configuración del Sistema', superAdmin: true, security: false, devOps: true, billing: false },
];
