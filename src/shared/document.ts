import { z } from 'zod';
import type { MagicDocument, RichNode } from './types';

const nodeSchema: z.ZodType<RichNode> = z.lazy(() =>
    z.object({
        type: z.string().max(60),
        text: z.string().optional(),
        attrs: z.record(z.string(), z.unknown()).optional(),
        marks: z
            .array(
                z.object({ type: z.string(), attrs: z.record(z.string(), z.unknown()).optional() }),
            )
            .max(30)
            .optional(),
        content: z.array(nodeSchema).optional(),
    }),
);

export const documentSchema = z.object({
    format: z.literal('magic-office'),
    version: z.literal(1),
    title: z.string().min(1).max(240),
    content: nodeSchema.refine((n) => n.type === 'doc', 'Documento inválido'),
    page: z.object({ size: z.enum(['A4', 'Letter']), margin: z.number().min(10).max(40) }),
    updatedAt: z.string(),
});

export function createDocument(title = 'Documento sem título'): MagicDocument {
    return {
        format: 'magic-office',
        version: 1,
        title,
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
        page: { size: 'A4', margin: 25 },
        updatedAt: new Date().toISOString(),
    };
}

export function plainText(node: RichNode): string {
    if (node.type === 'text') return node.text ?? '';
    if (node.type === 'hardBreak') return '\n';
    const text = (node.content ?? []).map(plainText).join('');
    return ['paragraph', 'heading', 'listItem', 'tableRow'].includes(node.type)
        ? `${text}\n`
        : text;
}

export function textDocument(text: string, title: string): MagicDocument {
    return {
        ...createDocument(title),
        content: {
            type: 'doc',
            content: text
                .split(/\r?\n/)
                .map((line) => ({
                    type: 'paragraph',
                    content: line ? [{ type: 'text', text: line }] : undefined,
                })),
        },
    };
}

export function safeFilename(title: string): string {
    return (
        title
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
            .replace(/[. ]+$/, '')
            .slice(0, 100) || 'documento'
    );
}
