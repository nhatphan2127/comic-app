// Role checks shared by menus, routes and panels. Roles are ordered: each one includes the ones before it.
const ROLE_RANK: Record<string, number> = { user: 0, contributor: 1, moderator: 2, admin: 3 };

const rank = (role?: string | null) => ROLE_RANK[(role || '').toLowerCase()] ?? 0;

export const canContribute = (role?: string | null) => rank(role) >= ROLE_RANK.contributor;
export const canModerate = (role?: string | null) => rank(role) >= ROLE_RANK.moderator;
export const isAdmin = (role?: string | null) => rank(role) >= ROLE_RANK.admin;
