import React, { useState, useMemo } from 'react';
import { useStore } from '../../../store';
import { shallow } from 'zustand/shallow';
import { KNOWN_COMMAS } from '../../../constants';
import { derivedCommaId } from '../../../store/logic/keyboard';
import { notifyWarning, openConfirm } from '../../../utils/notifications';

export const SimpleCommaSearch = () => {
    const {
      nodes,
      setCommaLines,
      commaLines,
      savedCommas,
      deleteCustomCommaById
    } = useStore((s) => ({
      nodes: s.nodes,
      setCommaLines: s.setCommaLines,
      commaLines: s.commaLines,
      savedCommas: s.savedCommas,
      deleteCustomCommaById: s.deleteCustomCommaById
    }), shallow);
    const [search, setSearch] = useState("");

    const norm = (s: string) => (s || "").trim().toLowerCase();

    const results = useMemo(() => {
        const q = norm(search);
        const user = (savedCommas || []).map(c => ({ ...c, __source: "user" as const }));
        const known = KNOWN_COMMAS.map(c => ({ ...c, __source: "known" as const }));

        let list = [...user, ...known];
        if (q) list = list.filter(c => norm(c.name).includes(q));
        return list;
    }, [search, savedCommas]);

    const showComma = (comma: any) => {
        const root = nodes.find(n => n.gen === 0 && n.originLimit === 0);
        if (root) {
            for (const n1 of nodes) {
                for (const n2 of nodes) {
                    if (n1.id === n2.id) continue;
                    const diff = Math.abs(Math.abs(n1.cents - n2.cents) - comma.cents);
                    if (diff < 0.1) {
                        setCommaLines([{ sourceId: n1.id, targetId: n2.id, name: comma.name }]);
                        return;
                    }
                }
            }
            notifyWarning('Comma interval not found in current lattice.', 'Comma Search');
        }
    };

    return (
        <div className="bg-gray-800 p-2 rounded mt-4 border border-gray-700">
            <h4 className="text-[10px] uppercase font-bold text-gray-400 mb-2">Comma Detective</h4>
            <input 
                type="text" 
                placeholder="Search Comma (e.g. Syntonic)" 
                className="w-full bg-black text-xs p-1.5 rounded border border-gray-600 mb-2 text-white"
                value={search}
                onChange={e => setSearch(e.target.value)}
            />
            <div className="max-h-24 overflow-y-auto custom-scrollbar pr-2 space-y-1">
                {results.map((c: any) => {
                    const isUser = c.__source === "user";
                    const id = c.id ?? derivedCommaId(c);
                    return (
                        <div key={`${c.__source}:${id}`} className="flex justify-between items-center bg-black/40 px-2 py-1 rounded">
                            <div className="flex flex-col mr-2 overflow-hidden">
                                <span className={`text-[10px] font-bold truncate ${isUser ? 'text-indigo-300' : 'text-blue-200'}`} title={c.name}>
                                    {isUser ? `★ ${c.name}` : c.name}
                                    {!isUser && <span className="ml-1 text-[8px] text-gray-500 opacity-70">(built-in)</span>}
                                </span>
                                <span className="text-[9px] text-gray-500">{c.cents.toFixed(2)}¢</span>
                            </div>
                            <div className="flex gap-1 shrink-0">
                                <button onClick={() => showComma(c)} className="text-[9px] border border-blue-500 text-blue-400 px-2 rounded hover:bg-blue-500 hover:text-white">Find</button>
                                {isUser && (
                                    <button type="button" 
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onClick={(e) => { 
                                            e.stopPropagation();
                                            openConfirm({
                                                title: 'Delete Saved Comma',
                                                message: `Delete saved comma "${c.name}"?\n\nNote: built-in commas cannot be deleted and may still appear if they share the same name.`,
                                                confirmLabel: 'Delete',
                                                cancelLabel: 'Cancel',
                                                onConfirm: () => {
                                                    deleteCustomCommaById(id);
                                                    setCommaLines(commaLines.filter(l => l.name !== c.name));
                                                }
                                            });
                                        }} 
                                        className="text-[9px] text-red-500 px-1.5 hover:text-white font-bold hover:bg-red-500 rounded transition-colors"
                                        title="Delete Saved Comma"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            {commaLines.length > 0 && <button onClick={() => setCommaLines([])} className="text-[9px] text-red-400 mt-2 w-full text-center">Clear Lines</button>}
        </div>
    );
};
