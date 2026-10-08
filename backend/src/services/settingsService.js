import * as settingsRepo from '../repositories/settingsRepository.js';
import { BadRequestError } from '../errors.js';

const AUTO_ACCEPT = 'auto_accept';

export async function isAutoAcceptEnabled() {
  return (await settingsRepo.get(AUTO_ACCEPT)) === 'true';
}

// New submissions skip the moderation queue when auto-accept is on.
export async function initialReviewStatus() {
  return (await isAutoAcceptEnabled()) ? 'accept' : 'pending';
}

export async function getSettings() {
  return { autoAccept: await isAutoAcceptEnabled() };
}

// PATCH /admin/settings: only the fields that are sent change.
export async function updateSettings({ autoAccept }) {
  if (autoAccept === undefined) throw new BadRequestError('Nothing to update: send "autoAccept"');
  if (typeof autoAccept !== 'boolean') throw new BadRequestError('"autoAccept" must be a boolean');
  await settingsRepo.set(AUTO_ACCEPT, String(autoAccept));
  return getSettings();
}
