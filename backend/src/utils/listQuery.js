// Query-string parsing shared by every collection endpoint:
//   ?page=2&pageSize=20          pagination (1-based)
//   ?sort=-rating,name           sorting: comma-separated fields, "-" = descending
//   ?contentRating=safe,erotica  multi-value filter: comma-separated or repeated (?a=x&a=y)
// Invalid values are rejected with 400 instead of being silently replaced.
import { BadRequestError } from '../errors.js';

function toInteger(value, name, fallback) {
  if (value === undefined || value === '') return fallback;
  if (Array.isArray(value) || !/^\d+$/.test(String(value))) {
    throw new BadRequestError(`"${name}" must be a positive integer`);
  }
  return Number(value);
}

export function parsePagination(query, { defaultPageSize = 20, maxPageSize = 100 } = {}) {
  const page = toInteger(query.page, 'page', 1);
  const pageSize = toInteger(query.pageSize, 'pageSize', defaultPageSize);
  if (page < 1) throw new BadRequestError('"page" must be 1 or greater');
  if (pageSize < 1 || pageSize > maxPageSize) {
    throw new BadRequestError(`"pageSize" must be between 1 and ${maxPageSize}`);
  }
  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
}

// Returns [[field, 'ASC' | 'DESC'], ...] or `fallback` when no sort is given.
// `fields` is the whitelist: only these names ever reach the database layer.
export function parseSort(value, fields, fallback = []) {
  const items = parseList(value, { lowercase: false });
  if (!items.length) return fallback;
  return items.map((item) => {
    const descending = item.startsWith('-');
    const field = descending ? item.slice(1) : item;
    if (!fields.includes(field)) {
      throw new BadRequestError(`Cannot sort by "${field}". Allowed: ${fields.join(', ')}`);
    }
    return [field, descending ? 'DESC' : 'ASC'];
  });
}

// "a,b" or ["a", "b,c"] → ['a', 'b', 'c'] (trimmed, de-duplicated).
export function parseList(value, { lowercase = true } = {}) {
  const values = [];
  const push = (item) => {
    if (Array.isArray(item)) return item.forEach(push);
    if (typeof item !== 'string') return;
    for (const part of item.split(',')) {
      const trimmed = part.trim();
      if (trimmed) values.push(lowercase ? trimmed.toLowerCase() : trimmed);
    }
  };
  push(value);
  return [...new Set(values)];
}

// Like parseList, but every value must be one of `allowed`.
export function parseEnumList(value, name, allowed) {
  const values = parseList(value);
  const invalid = values.filter((item) => !allowed.includes(item));
  if (invalid.length) {
    throw new BadRequestError(`Invalid "${name}": ${invalid.join(', ')}. Allowed: ${allowed.join(', ')}`);
  }
  return values;
}

export function parseBoolean(value, name) {
  if (value === undefined || value === '') return undefined;
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  throw new BadRequestError(`"${name}" must be true or false`);
}

export const pageMeta = ({ page, pageSize }, totalItems) => ({
  page,
  pageSize,
  totalItems,
  totalPages: Math.ceil(totalItems / pageSize),
});
