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
      childComment: [],
      _parentCommentId: c.parentCommentId
    };
  });

  flatComments.forEach(c => {
    const node = commentMap[c.id];
    if (c.parentCommentId && commentMap[c.parentCommentId]) {
      commentMap[c.parentCommentId].childComment.push(node);
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

    if (node.childComment.length === 0) {
      node.childComment = null;
    } else {
      node.childComment.sort(compareComments);
      node.childComment.forEach(processNode);
    }
  };

  roots.sort(compareComments);
  roots.forEach(processNode);
  return roots;
};
