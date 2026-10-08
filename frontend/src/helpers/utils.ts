export const slugify = (text: string) =>
    text
        .toString()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '')
        .replace(/-+/g, '-');

export const parsePageNumber = (name: string) => {
    const matches = name.match(/(\d+)/g);
    if (!matches) return NaN;
    return parseInt(matches[matches.length - 1], 10);
};

export const formatDisplayValue = (value?: string, options: string[] = []) => {
    if (!value) return '';
    const normalized = value.toString().trim();
    const matchedOption = options.find((option) => option.toLowerCase() === normalized.toLowerCase());
    if (matchedOption) {
        return matchedOption;
    }

    return normalized
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

export const toggleArrayItem = <T,>(arr: T[], item: T): T[] => {
    return arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];
};

/** Display title for a comic, falling back to its first alternate name. */
export const getComicTitle = (comic: { name?: string; names?: Array<{ name: string }> }) =>
    comic.name || comic.names?.[0]?.name || 'Untitled';

/** Compact number: 950 -> "950", 1500 -> "1.5K", 2300000 -> "2.3M" */
export const formatCount = (value?: number | null) =>
    new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value ?? 0);
