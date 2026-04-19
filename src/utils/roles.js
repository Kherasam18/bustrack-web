// src/utils/roles.js — Role constants and route guard helpers matching backend ENUM values
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  SCHOOL_ADMIN: 'SCHOOL_ADMIN',
};

/**
 * Returns the default redirect path for a given role.
 * @param {string} role — user role from the JWT payload
 * @returns {string} — the default route path for that role
 */
export function getDefaultRoute(role) {
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return '/super-admin/schools';
    case ROLES.SCHOOL_ADMIN:
      return '/school-admin/dashboard';
    default:
      return '/login';
  }
}

/**
 * Returns true if the given user role satisfies the required role.
 * @param {string} userRole — the authenticated user's role
 * @param {string} requiredRole — the role required to access a route
 * @returns {boolean}
 */
export function hasRole(userRole, requiredRole) {
  if (!userRole || !requiredRole) {
    return false;
  }
  return userRole === requiredRole;
}
