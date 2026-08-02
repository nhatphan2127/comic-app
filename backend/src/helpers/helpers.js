export const buildCommentTree = (flatComments, sortBy = 'best') => {
  const commentMap = {};
  const roots = [];

  flatComments.forEach(c => {
    commentMap[c.id] = {
      id: c.id,
      comicId: c.comicId || null,
      chapterId: c.chapterId || null,
      content: c.content,
      like: c.likes || 0,
      dislike: c.dislikes || 0,
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
      userReaction: c.userReaction || 'none',
      user: {
        id: c.userId,
        displayName: c.displayName,
        avatar: c.avatar
      },
      childCommment: [],
      _parentCommentId: c.parentCommentId
    };
  });

  flatComments.forEach(c => {
    const node = commentMap[c.id];
    if (c.parentCommentId && commentMap[c.parentCommentId]) {
      commentMap[c.parentCommentId].childCommment.push(node);
    } else {
      roots.push(node);
    }
  });

  const compareComments = (a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }

    if (sortBy === 'oldest') {
      return new Date(a.createdAt) - new Date(b.createdAt);
    }

    const scoreA = (a.like || 0) - (a.dislike || 0);
    const scoreB = (b.like || 0) - (b.dislike || 0);
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  };

  const processNode = (node) => {
    delete node._parentCommentId;

    if (node.childCommment.length === 0) {
      node.childCommment = null;
    } else {
      node.childCommment.sort(compareComments);
      node.childCommment.forEach(processNode);
    }
  };

  roots.sort(compareComments);
  roots.forEach(processNode);
  return roots;
};

export function normalizeContentRatings(input) {
  const values = [];
  const pushValues = (value) => {
    if (Array.isArray(value)) {
      value.forEach(pushValues);
      return;
    }

    if (typeof value === 'string') {
      value.split(',').forEach((item) => {
        const trimmed = item.trim().toLowerCase();
        if (trimmed) {
          values.push(trimmed);
        }
      });
    }
  };

  pushValues(input);

  return [...new Set(values)];
}

export function buildContentRatingFilter(input) {
  const ratings = normalizeContentRatings(input);

  if (!ratings.length) {
    return { clause: '', params: [] };
  }

  return {
    clause: `LOWER(contentRating) IN (${ratings.map(() => '?').join(',')})`,
    params: ratings,
  };
}