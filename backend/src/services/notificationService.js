import * as notificationRepo from '../repositories/notificationRepository.js';
import * as comicRepo from '../repositories/comicRepository.js';
import * as chapterRepo from '../repositories/chapterRepository.js';
import * as commentRepo from '../repositories/commentRepository.js';
import * as blockRepo from '../repositories/blockRepository.js';
import * as contributorRepo from '../repositories/contributorRepository.js';
import { NotFoundError } from '../errors.js';

export async function listForUser(userId, { isRead, page }) {
  const { rows, count } = await notificationRepo.listForUser(userId, { isRead, limit: page.limit, offset: page.offset });
  return { items: rows, totalItems: count };
}

// Another user's notification is reported as "not found", never as "forbidden", so ids don't leak.
export async function setRead(userId, notificationId, isRead) {
  if (!(await notificationRepo.setRead(notificationId, userId, isRead))) throw new NotFoundError('Notification not found');
  return notificationRepo.findForUser(notificationId, userId);
}

// ---------- Sending ----------
// Notifications are a side effect: the action that triggers them has already succeeded, so a failure
// here is logged instead of turning that success into an error. `type` decides the tab in the UI:
// anything containing "system" goes to System, the rest to Comics.

async function send(rows) {
  try {
    await notificationRepo.insertMany(rows);
  } catch (err) {
    console.error('Unable to create notifications:', err);
  }
}

// A single notification for one user, e.g. the answer to their contributor request.
export const sendTo = (userId, { type, title, content, redirectPath = null }) => send([{ userId, type, title, content, redirectPath }]);

const isLive = (ctx) =>
  ctx.status === 'accept' && ctx.visibility === 'public' && ctx.comicStatus === 'accept' && ctx.comicVisibility === 'public';

const chapterLabel = (ctx) => `Chapter ${ctx.chapterNumber}${ctx.title ? `: ${ctx.title}` : ''}`;

// A chapter just became readable: tell everyone who follows its comic (except whoever uploaded it).
export async function notifyNewChapter(chapterId, uploaderId = null) {
  const ctx = await notificationRepo.findChapterContext(chapterId);
  if (!ctx || !isLive(ctx)) return;
  const followers = (await notificationRepo.listFollowerIds(ctx.comicId)).filter((id) => id !== uploaderId);
  await send(
    followers.map((userId) => ({
      userId,
      type: 'new_chapter',
      title: `${ctx.comicName} has a new chapter`,
      content: chapterLabel(ctx),
      redirectPath: `/comics/${ctx.comicUrl}/${ctx.id}`,
    })),
  );
}

// A moderator accepted or rejected a submission: tell its contributors.
// `edit`: the decision was about changes to a comic that is already live (and stays live either way).
export async function notifyReviewDecision(type, targetId, status, { edit = false } = {}) {
  const contributors = await contributorRepo.listForTarget(type, targetId);
  if (!contributors.length) return;

  let name;
  let redirectPath;
  if (type === 'comic') {
    const comic = await comicRepo.findById(targetId);
    name = (await comicRepo.findSummaryById(targetId))?.name || 'Your comic';
    redirectPath = (status === 'accept' || edit) && comic ? `/comics/${comic.url}` : '/studio/suggestions';
  } else {
    const ctx = await notificationRepo.findChapterContext(targetId);
    name = ctx ? `${ctx.comicName} · ${chapterLabel(ctx)}` : 'Your chapter';
    redirectPath = status === 'accept' && ctx && isLive(ctx) ? `/comics/${ctx.comicUrl}/${ctx.id}` : '/studio/uploads';
  }

  const accepted = status === 'accept';
  const message = edit
    ? {
        title: accepted ? 'Your edit was approved' : 'Your edit was rejected',
        content: accepted
          ? `Your changes to ${name} are now live.`
          : `Your changes to ${name} were not accepted. The approved version is still live; you can edit it and submit again.`,
      }
    : {
        title: accepted ? 'Your submission was approved' : 'Your submission was rejected',
        content: accepted ? `${name} is now live.` : `${name} was not accepted. You can edit it and submit again.`,
      };
  await send(contributors.map(({ userId }) => ({ userId, type: 'system_review', ...message, redirectPath })));
}

// Someone replied to a comment: tell its author (unless they replied to themselves).
export async function notifyReply(type, targetId, parentCommentId, replyId, replierId, replyText) {
  const parent = await commentRepo.findById(type, parentCommentId);
  if (!parent || parent.userId === replierId) return;
  if (await blockRepo.exists(parent.userId, replierId)) return; // the parent's author blocked the replier

  let base;
  if (type === 'comic') {
    const comic = await comicRepo.findById(targetId);
    base = comic && `/comics/${comic.url}`;
  } else {
    const chapter = await chapterRepo.findById(targetId);
    const comic = chapter && (await comicRepo.findById(chapter.comicId));
    base = comic && `/comics/${comic.url}/${chapter.id}`;
  }
  if (!base) return;

  const preview = replyText.length > 120 ? `${replyText.slice(0, 117)}…` : replyText;
  await send([
    {
      userId: parent.userId,
      type: 'comment_reply',
      title: 'New reply to your comment',
      content: preview,
      redirectPath: `${base}?cm_id=${replyId}`,
    },
  ]);
}
