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
