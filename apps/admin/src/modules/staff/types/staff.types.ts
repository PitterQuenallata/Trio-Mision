export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  access: string;
  twoFactor: boolean;
  lastActive: string;
  avatar: string;
}

export interface PermissionRow {
  module: string;
  superAdmin: boolean;
  security: boolean;
  devOps: boolean;
  billing: boolean;
}
