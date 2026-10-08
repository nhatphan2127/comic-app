// Authorization rules in one place. Role checks on routes (requireRole) answer "may this kind of user
// call this endpoint?"; these answer "may THIS user touch THIS resource?".
import * as contributorRepo from '../repositories/contributorRepository.js';

export const STAFF_ROLES = ['admin', 'moderator'];

export const isStaff = (user) => STAFF_ROLES.includes(user?.role);

// Staff can manage any comic; everyone else only comics they contribute to.
export async function canManageComic(user, comicId) {
  if (isStaff(user)) return true;
  return contributorRepo.isContributor('comic', comicId, user.id);
}
