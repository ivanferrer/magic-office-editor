import { Extension, Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import Placeholder from '@tiptap/extension-placeholder';

const ParagraphLayout = Extension.create({
    name: 'paragraphLayout',
    addGlobalAttributes() {
        return [
            {
                types: ['paragraph', 'heading'],
                attributes: {
                    lineHeight: {
                        default: '1.5',
                        parseHTML: (element) => element.style.lineHeight || '1.5',
                        renderHTML: (attrs) => ({
                            style: `line-height: ${Number(attrs.lineHeight) || 1.5}`,
                        }),
                    },
                    indent: {
                        default: 0,
                        parseHTML: (element) =>
                            Math.min(6, Math.round(parseInt(element.style.marginLeft || '0') / 24)),
                        renderHTML: (attrs) => ({
                            style: `margin-left: ${Math.min(6, Math.max(0, Number(attrs.indent) || 0)) * 24}px`,
                        }),
                    },
                },
            },
        ];
    },
});

const PageBreak = Node.create({
    name: 'pageBreak',
    group: 'block',
    atom: true,
    parseHTML: () => [{ tag: 'div[data-page-break]' }],
    renderHTML: ({ HTMLAttributes }) => [
        'div',
        mergeAttributes(HTMLAttributes, {
            'data-page-break': '',
            style: 'break-after: page',
            class: 'page-break',
        }),
    ],
});

export const editorExtensions = [
    StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: false },
        codeBlock: false,
    }),
    TextStyleKit,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Highlight.configure({ multicolor: true }),
    Image.configure({ allowBase64: true }),
    TableKit.configure({ table: { resizable: true } }),
    ParagraphLayout,
    PageBreak,
    Placeholder.configure({ placeholder: 'Comece a escrever. Suas ideias merecem espaço.' }),
];
