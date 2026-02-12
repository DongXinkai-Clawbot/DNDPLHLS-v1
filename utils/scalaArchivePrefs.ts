export const SCALA_ARCHIVE_PREFS_KEY = 'scalaArchivePrefs_v1';

export type ScalaArchivePrefs = {
    showArchive: boolean;
    hiddenIds: string[];
};

const defaultPrefs: ScalaArchivePrefs = {
    showArchive: true,
    hiddenIds: []
};

const normalizePrefs = (value: any): ScalaArchivePrefs => {
    const showArchive = value?.showArchive !== false;
    const hiddenIds = Array.isArray(value?.hiddenIds)
        ? value.hiddenIds.filter((id: any) => typeof id === 'string')
        : [];
    return { showArchive, hiddenIds };
};

export const readScalaArchivePrefs = (): ScalaArchivePrefs => {
    if (typeof window === 'undefined') return defaultPrefs;
    try {
        const raw = localStorage.getItem(SCALA_ARCHIVE_PREFS_KEY);
        if (!raw) return defaultPrefs;
        return normalizePrefs(JSON.parse(raw));
    } catch {
        return defaultPrefs;
    }
};

export const writeScalaArchivePrefs = (prefs: ScalaArchivePrefs) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(SCALA_ARCHIVE_PREFS_KEY, JSON.stringify(prefs));
    } catch {}
};
