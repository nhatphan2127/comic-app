// Response helpers so every controller answers in the same shape (see docs/api-conventions.md):
//   200 { data }            a single resource or a small, bounded list
//   200 { data, meta }      a page of a collection (meta from pageMeta)
//   201 { data } + Location a newly created resource
//   204 (no body)           success with nothing to return (delete, idempotent PUT)
export const API_PREFIX = '/api/v1';

export const ok = (res, data, meta) => res.status(200).json(meta ? { data, meta } : { data });

export const created = (res, location, data) => res.status(201).location(`${API_PREFIX}${location}`).json({ data });

export const noContent = (res) => res.status(204).end();
