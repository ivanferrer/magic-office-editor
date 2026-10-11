import type { Editor } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import type { ReviewBlock, Suggestion } from '../shared/types';

export interface AnchoredBlock extends ReviewBlock {
    from: number;
}
export interface AnchoredSuggestion extends Suggestion {
    id: string;
    from: number;
    to: number;
}

export function collectBlocks(editor: Editor, selectionOnly: boolean): AnchoredBlock[] {
    const { from, to } = editor.state.selection;
    const blocks: AnchoredBlock[] = [];
    editor.state.doc.descendants((node, pos) => {
        if (!node.isTextblock) return true;
        const start = selectionOnly ? Math.max(pos + 1, from) : pos + 1;
        const end = selectionOnly
            ? Math.min(pos + 1 + node.content.size, to)
            : pos + 1 + node.content.size;
        if (end <= start) return false;
        // One character per inline leaf keeps offsets aligned with ProseMirror positions.
        const text = editor.state.doc.textBetween(start, end, '', '\n');
        if (text.trim()) blocks.push({ id: `b${start}`, from: start, text });
        return false;
    });
    return blocks;
}

export function anchorSuggestions(
    suggestions: Suggestion[],
    blocks: AnchoredBlock[],
): AnchoredSuggestion[] {
    return suggestions.flatMap((s, index) => {
        const block = blocks.find((b) => b.id === s.blockId);
        if (!block) return [];
        const offset = block.text.indexOf(s.original);
        if (offset < 0 || block.text.indexOf(s.original, offset + 1) >= 0) return [];
        return [
            {
                ...s,
                id: `${s.blockId}-${index}`,
                from: block.from + offset,
                to: block.from + offset + s.original.length,
            },
        ];
    });
}

export function mapSuggestions(
    suggestions: AnchoredSuggestion[],
    transaction: Transaction,
): AnchoredSuggestion[] {
    return suggestions.flatMap((s) => {
        const from = transaction.mapping.map(s.from, 1);
        const to = transaction.mapping.map(s.to, -1);
        if (from >= to || transaction.doc.textBetween(from, to, '', '\n') !== s.original) return [];
        return [{ ...s, from, to }];
    });
}

export function applySuggestion(editor: Editor, suggestion: AnchoredSuggestion): boolean {
    const { from, to, original, replacement } = suggestion;
    if (
        to > editor.state.doc.content.size ||
        editor.state.doc.textBetween(from, to, '', '\n') !== original
    )
        return false;
    // insertText treats model output as literal text, never as HTML or commands.
    editor.view.dispatch(closeHistory(editor.state.tr).insertText(replacement, from, to));
    editor.view.dispatch(closeHistory(editor.state.tr));
    return true;
}

export function findMatches(editor: Editor, query: string): { from: number; to: number }[] {
    if (!query) return [];
    const matches: { from: number; to: number }[] = [];
    editor.state.doc.descendants((node, pos) => {
        if (!node.isTextblock) return true;
        const text = node.textBetween(0, node.content.size, '', '\n');
        let index = text.indexOf(query);
        while (index >= 0) {
            matches.push({ from: pos + 1 + index, to: pos + 1 + index + query.length });
            index = text.indexOf(query, index + query.length);
        }
        return false;
    });
    return matches;
}
