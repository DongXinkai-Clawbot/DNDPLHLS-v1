import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { scalaArchiveIndex, loadScalaScale, type ScalaArchiveEntry, type ScalaArchiveScale } from '../../../utils/scalaArchive';
import { createLogger } from '../../../utils/logger';
import { VirtualList } from '../../common/VirtualList';

type SortOption = 'name-asc' | 'name-desc' | 'count-asc' | 'count-desc';

type ScalaArchivePickerProps = {
    selectedId: string | null;
    onSelect: (id: string | null, scale: ScalaArchiveScale | null) => void;
};

// Estimate note count from filename for fast initial filtering
const estimateNoteCount = (fileName: string): number | null => {
    // Pattern like "12-31.scl" means 12-note scale in 31-EDO approximation
    const match = fileName.match(/^(\d+)-/);
    if (match) return parseInt(match[1], 10);
    // Pattern like "12_note" or similar
    const match2 = fileName.match(/(\d+)[_-]?note/i);
    if (match2) return parseInt(match2[1], 10);
    return null;
};

const enrichedIndex = scalaArchiveIndex.map(entry => ({
    ...entry,
    estimatedCount: estimateNoteCount(entry.fileName)
}));

const log = createLogger('scala/archive');

export const ScalaArchivePicker: React.FC<ScalaArchivePickerProps> = ({ selectedId, onSelect }) => {
    const [search, setSearch] = useState('');
    const [minCount, setMinCount] = useState<number | ''>('');
    const [maxCount, setMaxCount] = useState<number | ''>('');
    const [sortBy, setSortBy] = useState<SortOption>('name-asc');
    const [loadedScale, setLoadedScale] = useState<ScalaArchiveScale | null>(null);
    const [loading, setLoading] = useState(false);
    const listHeight = 128;
    const rowHeight = 24;

    // Filter and sort the index
    const filteredItems = useMemo(() => {
        let items = enrichedIndex;

        // Search filter
        if (search.trim()) {
            const query = search.toLowerCase().trim();
            items = items.filter(entry =>
                entry.displayName.toLowerCase().includes(query) ||
                entry.fileName.toLowerCase().includes(query)
            );
        }

        // Note count filter (only for items with estimated count)
        if (minCount !== '') {
            items = items.filter(entry =>
                entry.estimatedCount === null || entry.estimatedCount >= minCount
            );
        }
        if (maxCount !== '') {
            items = items.filter(entry =>
                entry.estimatedCount === null || entry.estimatedCount <= maxCount
            );
        }

        // Sort
        items = [...items].sort((a, b) => {
            switch (sortBy) {
                case 'name-asc':
                    return a.displayName.localeCompare(b.displayName);
                case 'name-desc':
                    return b.displayName.localeCompare(a.displayName);
                case 'count-asc':
                    return (a.estimatedCount ?? 999) - (b.estimatedCount ?? 999);
                case 'count-desc':
                    return (b.estimatedCount ?? 0) - (a.estimatedCount ?? 0);
                default:
                    return 0;
            }
        });

        return items;
    }, [search, minCount, maxCount, sortBy]);

    // Load scale when selected
    const handleSelect = useCallback(async (entry: ScalaArchiveEntry) => {
        if (entry.id === selectedId) {
            // Deselect
            onSelect(null, null);
            setLoadedScale(null);
            return;
        }

        setLoading(true);
        try {
            const scale = await loadScalaScale(entry.id);
            setLoadedScale(scale);
            onSelect(entry.id, scale);
        } catch (e) {
            log.error('Failed to load Scala scale', e);
            setLoadedScale(null);
            onSelect(null, null);
        } finally {
            setLoading(false);
        }
    }, [selectedId, onSelect]);

    // Load currently selected scale on mount
    useEffect(() => {
        if (selectedId && !loadedScale) {
            setLoading(true);
            loadScalaScale(selectedId)
                .then(scale => setLoadedScale(scale))
                .finally(() => setLoading(false));
        }
    }, [selectedId, loadedScale]);

    return (
        <div className="space-y-2">
            {/* Search and Filters */}
            <div className="flex gap-2">
                <input
                    type="text"
                    placeholder="Search scales..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 bg-black border border-gray-700 text-xs text-white rounded px-2 py-1 focus:border-indigo-500 outline-none"
                />
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="bg-black border border-gray-700 text-xs text-white rounded px-2 py-1 focus:border-indigo-500 outline-none"
                    style={{ colorScheme: 'dark' }}
                >
                    <option value="name-asc">Name A-Z</option>
                    <option value="name-desc">Name Z-A</option>
                    <option value="count-asc">Notes ↑</option>
                    <option value="count-desc">Notes ↓</option>
                </select>
            </div>

            <div className="flex gap-2 items-center">
                <span className="text-[8px] text-gray-500">Notes:</span>
                <input
                    type="number"
                    placeholder="Min"
                    value={minCount}
                    onChange={(e) => setMinCount(e.target.value ? parseInt(e.target.value, 10) : '')}
                    className="w-12 bg-black border border-gray-700 text-xs text-white rounded px-1 py-0.5 text-center focus:border-indigo-500 outline-none"
                    min={1}
                />
                <span className="text-[8px] text-gray-500">-</span>
                <input
                    type="number"
                    placeholder="Max"
                    value={maxCount}
                    onChange={(e) => setMaxCount(e.target.value ? parseInt(e.target.value, 10) : '')}
                    className="w-12 bg-black border border-gray-700 text-xs text-white rounded px-1 py-0.5 text-center focus:border-indigo-500 outline-none"
                    min={1}
                />
                <span className="text-[8px] text-gray-500 ml-auto">{filteredItems.length} scales</span>
            </div>

            {/* Scale List */}
            <div className="h-32 bg-black/50 border border-gray-800 rounded scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                {filteredItems.length === 0 ? (
                    <div className="text-[9px] text-gray-600 p-2 text-center">No scales found</div>
                ) : (
                    <VirtualList
                        items={filteredItems}
                        itemHeight={rowHeight}
                        height={listHeight}
                        className="h-32 overflow-y-auto"
                        getKey={(entry) => entry.id}
                        renderItem={(entry) => (
                            <button
                                onClick={() => handleSelect(entry)}
                                className={`w-full text-left px-2 py-1 text-[9px] border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors ${entry.id === selectedId ? 'bg-indigo-900/50 text-indigo-200' : 'text-gray-400'
                                    }`}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="truncate">{entry.displayName}</span>
                                    {entry.estimatedCount !== null && (
                                        <span className="text-[8px] text-gray-600 ml-1 shrink-0">
                                            ~{entry.estimatedCount}
                                        </span>
                                    )}
                                </div>
                            </button>
                        )}
                    />
                )}
            </div>

            {/* Preview */}
            {loading && (
                <div className="text-[9px] text-gray-500 italic">Loading scale...</div>
            )}
            {!loading && loadedScale && selectedId && (
                <div className="bg-indigo-900/20 border border-indigo-800/50 rounded p-2 space-y-1">
                    <div className="text-[9px] text-indigo-300 font-bold truncate">{loadedScale.displayName}</div>
                    <div className="text-[8px] text-gray-400">
                        <span className="font-bold">{loadedScale.count}</span> notes |
                        Period: <span className="font-mono">{loadedScale.periodCents.toFixed(1)}¢</span>
                    </div>
                    <div className="text-[8px] text-gray-500 truncate">
                        {loadedScale.ratios.slice(0, 6).join(', ')}
                        {loadedScale.ratios.length > 6 && '...'}
                    </div>
                </div>
            )}
        </div>
    );
};
