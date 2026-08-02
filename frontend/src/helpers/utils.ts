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

export const getDisplayValue = (selected: string[]) => {
    if (selected.length === 0) return 'Any';
    if (selected.length <= 2) return selected.join(', ');
    return `${selected.length} selected`;
};

export const getGenresDisplayValue = (selectedGenres: string[], selectedFormats: string[]) => {
    const totalSelected = (selectedGenres?.length || 0) + (selectedFormats?.length || 0);
    return totalSelected === 0 ? 'Any' : `${totalSelected} selected`;
};
   