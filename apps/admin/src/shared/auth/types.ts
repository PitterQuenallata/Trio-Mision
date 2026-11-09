// Identidad que devuelve GET /api/v1/me (contrato de la API 0.13.0).

export type StaffRole = 'admin' | 'editor' | 'vendedor';
export type ArtistRole = 'member' | 'manager';

export interface ArtistMembership {
  artist_id: string;
  role: ArtistRole;
}

export interface Identidad {
  user_id: string;
  email?: string;
  role: string;
  display_name?: string;
  staff_roles: StaffRole[];
  artist_memberships: ArtistMembership[];
}
