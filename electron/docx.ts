import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    Table,
    TableRow,
    TableCell,
    WidthType,
    ImageRun,
    ExternalHyperlink,
    LevelFormat,
    PageBreak,
    convertMillimetersToTwip,
} from 'docx';
import type { RichNode, MagicDocument } from '../src/shared/types';
import { documentSchema } from '../src/shared/document';
import { imageSize } from 'image-size';

const alignments: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
    left: AlignmentType.LEFT,
    center: AlignmentType.CENTER,
    right: AlignmentType.RIGHT,
    justify: AlignmentType.JUSTIFIED,
};

function color(value: unknown): string | undefined {
    return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value.slice(1) : undefined;
}

function inline(node: RichNode): (TextRun | ImageRun | ExternalHyperlink)[] {
    if (node.type === 'hardBreak') return [new TextRun({ break: 1 })];
    if (node.type === 'image') {
        const match = /^data:image\/(png|jpeg|jpg|gif);base64,([A-Za-z0-9+/=]+)$/.exec(
            node.attrs?.src ?? '',
        );
        if (!match) return [];
        const data = Buffer.from(match[2], 'base64');
        let dimensions;
        try {
            dimensions = imageSize(data);
        } catch {
            throw new Error('Uma imagem do documento está inválida. Remova-a antes de exportar.');
        }
        const naturalWidth = dimensions.width || 440;
        const naturalHeight = dimensions.height || 300;
        const scale = Math.min(1, 520 / naturalWidth, 680 / naturalHeight);
        const width = Math.round(naturalWidth * scale);
        const height = Math.round(naturalHeight * scale);
        return [
            new ImageRun({
                data,
                type:
                    match[1] === 'jpg'
                        ? 'jpg'
                        : match[1] === 'jpeg'
                          ? 'jpg'
                          : (match[1] as 'png' | 'gif'),
                transformation: { width, height },
            }),
        ];
    }
    if (node.type !== 'text') return (node.content ?? []).flatMap(inline);
    const marks = node.marks ?? [];
    const has = (name: string) => marks.some((m) => m.type === name);
    const style = marks.find((m) => m.type === 'textStyle')?.attrs ?? {};
    const size = parseFloat(style.fontSize);
    const run = new TextRun({
        text: node.text ?? '',
        bold: has('bold'),
        italics: has('italic'),
        strike: has('strike'),
        underline: has('underline') ? {} : undefined,
        color: color(style.color),
        font: style.fontFamily?.split(',')[0]?.replace(/["']/g, ''),
        size: Number.isFinite(size) ? Math.round(size * 2) : undefined,
        highlight: has('highlight') ? 'yellow' : undefined,
    });
    const link = marks.find((m) => m.type === 'link')?.attrs?.href;
    return typeof link === 'string' && /^(https?:|mailto:)/i.test(link)
        ? [new ExternalHyperlink({ link, children: [run] })]
        : [run];
}

export async function exportDocx(document: MagicDocument): Promise<Buffer> {
    const doc = documentSchema.parse(document);
    let listIndex = 0;
    const numbering: any[] = [];
    function blocks(
        nodes: RichNode[],
        list?: { reference: string; level: number },
    ): (Paragraph | Table)[] {
        return nodes.flatMap((node): (Paragraph | Table)[] => {
            if (node.type === 'bulletList' || node.type === 'orderedList') {
                const reference = `list-${listIndex++}`;
                const ordered = node.type === 'orderedList';
                const level = Math.min(list ? list.level + 1 : 0, 8);
                numbering.push({
                    reference,
                    levels: Array.from({ length: 9 }, (_, i) => ({
                        level: i,
                        format: ordered ? LevelFormat.DECIMAL : LevelFormat.BULLET,
                        text: ordered ? `%${i + 1}.` : '•',
                        start: Number(node.attrs?.start) || 1,
                        alignment: AlignmentType.LEFT,
                        style: { paragraph: { indent: { left: 720 * (i + 1), hanging: 260 } } },
                    })),
                });
                return (node.content ?? []).flatMap((item) => {
                    let first = true;
                    return (item.content ?? []).flatMap((child) => {
                        if (child.type === 'paragraph') {
                            const result = blocks(
                                [child],
                                first ? { reference, level } : undefined,
                            );
                            first = false;
                            return result;
                        }
                        return blocks([child], { reference, level });
                    });
                });
            }
            if (node.type === 'table') {
                return [
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: (node.content ?? []).map(
                            (row) =>
                                new TableRow({
                                    children: (row.content ?? []).map(
                                        (cell) =>
                                            new TableCell({
                                                children: blocks(
                                                    cell.content ?? [{ type: 'paragraph' }],
                                                ),
                                                columnSpan: Math.max(
                                                    1,
                                                    Number(cell.attrs?.colspan) || 1,
                                                ),
                                                rowSpan: Math.max(
                                                    1,
                                                    Number(cell.attrs?.rowspan) || 1,
                                                ),
                                                shading:
                                                    cell.type === 'tableHeader'
                                                        ? { fill: 'EEEAF8' }
                                                        : undefined,
                                            }),
                                    ),
                                }),
                        ),
                    }),
                ];
            }
            if (node.type === 'blockquote') return blocks(node.content ?? []);
            if (node.type === 'horizontalRule')
                return [
                    new Paragraph({
                        border: { bottom: { color: 'CCCCCC', style: 'single', size: 6 } },
                    }),
                ];
            if (node.type === 'pageBreak') return [new Paragraph({ children: [new PageBreak()] })];
            const headings = [
                HeadingLevel.HEADING_1,
                HeadingLevel.HEADING_2,
                HeadingLevel.HEADING_3,
            ];
            return [
                new Paragraph({
                    children: inline(node),
                    heading:
                        node.type === 'heading'
                            ? headings[Math.min((Number(node.attrs?.level) || 1) - 1, 2)]
                            : undefined,
                    alignment: alignments[node.attrs?.textAlign] ?? AlignmentType.LEFT,
                    numbering: list ? { reference: list.reference, level: list.level } : undefined,
                    spacing: {
                        after: 160,
                        line: Math.round(240 * (Number(node.attrs?.lineHeight) || 1.5)),
                    },
                    indent: node.attrs?.indent
                        ? { left: Number(node.attrs.indent) * 360 }
                        : undefined,
                }),
            ];
        });
    }
    const children = blocks(doc.content.content ?? []);
    const margin = convertMillimetersToTwip(doc.page.margin);
    return Packer.toBuffer(
        new Document({
            creator: 'Magic Office Editor',
            title: doc.title,
            styles: { default: { document: { run: { font: 'Calibri', size: 24 } } } },
            numbering: { config: numbering },
            sections: [
                {
                    properties: {
                        page: {
                            size:
                                doc.page.size === 'A4'
                                    ? { width: 11906, height: 16838 }
                                    : { width: 12240, height: 15840 },
                            margin: { top: margin, bottom: margin, left: margin, right: margin },
                        },
                    },
                    children,
                },
            ],
        }),
    );
}
