export function formatTimeAgo(updatedAt?: string | Date | null): string {
    if (!updatedAt) {
        return 'Recently';
    }

    const now = Date.now();
    const time = new Date(updatedAt).getTime();

    const diff = Math.floor((now - time) / 1000); // seconds

    const minutes = Math.floor(diff / 60);
    if (minutes < 60) {
        return `${Math.max(1, minutes)}m ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours}h ago`;
    }

    const days = Math.floor(hours / 24);
    if (days < 7) {
        return `${days}d ago`;
    }

    const weeks = Math.floor(days / 7);
    if (weeks < 4) {
        return `${weeks}w ago`;
    }

    const months = Math.floor(days / 30);
    if (months < 12) {
        return `${months}mo ago`;
    }

    const years = Math.floor(days / 365);
    return `${years}y ago`;
}