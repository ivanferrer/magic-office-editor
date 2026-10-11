import type { Editor } from '@tiptap/core';
import {
    Bold,
    Italic,
    Underline,
    Strikethrough,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    List,
    ListOrdered,
    Undo2,
    Redo2,
    Highlighter,
    IndentIncrease,
    IndentDecrease,
    ImagePlus,
    Table2,
    Link2,
    ScissorsLineDashed,
    Search,
    Pilcrow,
    Minus,
    FilePlus2,
    FolderOpen,
    Save,
    Download,
    Printer,
    History,
    WandSparkles,
    Settings2,
    Trash2,
    Columns3,
    Rows3,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export function ToolButton({
    label,
    icon: Icon,
    action,
    active = false,
    disabled = false,
}: {
    label: string;
    icon: LucideIcon;
    action: () => void;
    active?: boolean;
    disabled?: boolean;
}) {
    return (
        <button
            className={`tool-button ${active ? 'active' : ''}`}
            title={label}
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={action}
        >
            <Icon size={18} />
        </button>
    );
}

export function Toolbar({
    editor,
    tab,
    actions,
    page,
    setPage,
}: {
    editor: Editor;
    tab: string;
    actions: Record<string, () => void>;
    page: { size: 'A4' | 'Letter'; margin: number };
    setPage: (page: { size: 'A4' | 'Letter'; margin: number }) => void;
}) {
    const selectionType = editor.isActive('heading')
        ? `h${editor.getAttributes('heading').level}`
        : 'p';
    function indent(delta: number) {
        const type = editor.isActive('heading') ? 'heading' : 'paragraph';
        editor
            .chain()
            .focus()
            .updateAttributes(type, {
                indent: Math.min(6, Math.max(0, (editor.getAttributes(type).indent || 0) + delta)),
            })
            .run();
    }
    const actionButton = (label: string, icon: LucideIcon, name: string) => (
        <button key={name} className="ribbon-action" onClick={actions[name]}>
            {(() => {
                const Icon = icon;
                return <Icon size={21} />;
            })()}
            <span>{label}</span>
        </button>
    );
    return (
        <div className="ribbon" role="toolbar" aria-label="Formatação do documento">
            {tab === 'Arquivo' && (
                <>
                    <div className="ribbon-group">
                        {actionButton('Novo', FilePlus2, 'new')}
                        {actionButton('Abrir', FolderOpen, 'open')}
                        {actionButton('Salvar', Save, 'save')}
                        {actionButton('Salvar como', Save, 'saveAs')}
                        <span className="group-caption">DOCUMENTO</span>
                    </div>
                    <div className="ribbon-group">
                        {actionButton('Exportar', Download, 'export')}
                        {actionButton('Imprimir', Printer, 'print')}
                        {actionButton('Histórico', History, 'history')}
                        <span className="group-caption">ARQUIVOS E VERSÕES</span>
                    </div>
                </>
            )}
            {tab === 'Início' && (
                <>
                    <div className="ribbon-group compact">
                        <ToolButton
                            label="Desfazer (Ctrl+Z)"
                            icon={Undo2}
                            action={() => editor.chain().focus().undo().run()}
                            disabled={!editor.can().undo()}
                        />
                        <ToolButton
                            label="Refazer (Ctrl+Y)"
                            icon={Redo2}
                            action={() => editor.chain().focus().redo().run()}
                            disabled={!editor.can().redo()}
                        />
                        <span className="group-caption">EDIÇÃO</span>
                    </div>
                    <div className="ribbon-group font-group">
                        <div className="ribbon-row">
                            <select
                                aria-label="Fonte"
                                value={editor.getAttributes('textStyle').fontFamily || 'Calibri'}
                                onChange={(e) =>
                                    editor.chain().focus().setFontFamily(e.target.value).run()
                                }
                            >
                                {[
                                    'Calibri',
                                    'Arial',
                                    'Georgia',
                                    'Times New Roman',
                                    'Verdana',
                                    'Courier New',
                                ].map((font) => (
                                    <option key={font}>{font}</option>
                                ))}
                            </select>
                            <select
                                aria-label="Tamanho da fonte"
                                value={editor.getAttributes('textStyle').fontSize || '12pt'}
                                onChange={(e) =>
                                    editor.chain().focus().setFontSize(e.target.value).run()
                                }
                            >
                                {[8, 10, 11, 12, 14, 16, 18, 24, 32, 48].map((size) => (
                                    <option key={size} value={`${size}pt`}>
                                        {size}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="ribbon-row">
                            <ToolButton
                                label="Negrito (Ctrl+B)"
                                icon={Bold}
                                active={editor.isActive('bold')}
                                action={() => editor.chain().focus().toggleBold().run()}
                            />
                            <ToolButton
                                label="Itálico (Ctrl+I)"
                                icon={Italic}
                                active={editor.isActive('italic')}
                                action={() => editor.chain().focus().toggleItalic().run()}
                            />
                            <ToolButton
                                label="Sublinhado (Ctrl+U)"
                                icon={Underline}
                                active={editor.isActive('underline')}
                                action={() => editor.chain().focus().toggleUnderline().run()}
                            />
                            <ToolButton
                                label="Tachado"
                                icon={Strikethrough}
                                active={editor.isActive('strike')}
                                action={() => editor.chain().focus().toggleStrike().run()}
                            />
                            <ToolButton
                                label="Realçar texto"
                                icon={Highlighter}
                                active={editor.isActive('highlight')}
                                action={() =>
                                    editor
                                        .chain()
                                        .focus()
                                        .toggleHighlight({ color: '#fff0a8' })
                                        .run()
                                }
                            />
                            <label className="color-tool" title="Cor do texto">
                                <span>A</span>
                                <input
                                    type="color"
                                    aria-label="Cor do texto"
                                    value={editor.getAttributes('textStyle').color || '#252433'}
                                    onInput={(e) =>
                                        editor.chain().focus().setColor(e.currentTarget.value).run()
                                    }
                                />
                            </label>
                        </div>
                        <span className="group-caption">FONTE</span>
                    </div>
                    <div className="ribbon-group paragraph-group">
                        <div className="ribbon-row">
                            {(
                                [
                                    [AlignLeft, 'left', 'Alinhar à esquerda'],
                                    [AlignCenter, 'center', 'Centralizar'],
                                    [AlignRight, 'right', 'Alinhar à direita'],
                                    [AlignJustify, 'justify', 'Justificar'],
                                ] as [LucideIcon, string, string][]
                            ).map(([icon, value, label]) => (
                                <ToolButton
                                    key={value}
                                    label={label}
                                    icon={icon}
                                    active={editor.isActive({ textAlign: value })}
                                    action={() => editor.chain().focus().setTextAlign(value).run()}
                                />
                            ))}
                            <select
                                aria-label="Espaçamento entre linhas"
                                value={
                                    editor.getAttributes(
                                        editor.isActive('heading') ? 'heading' : 'paragraph',
                                    ).lineHeight || '1.5'
                                }
                                onChange={(e) =>
                                    editor
                                        .chain()
                                        .focus()
                                        .updateAttributes(
                                            editor.isActive('heading') ? 'heading' : 'paragraph',
                                            { lineHeight: e.target.value },
                                        )
                                        .run()
                                }
                            >
                                {['1', '1.15', '1.5', '2'].map((value) => (
                                    <option key={value}>{value}</option>
                                ))}
                            </select>
                        </div>
                        <div className="ribbon-row">
                            <ToolButton
                                label="Lista com marcadores"
                                icon={List}
                                active={editor.isActive('bulletList')}
                                action={() => editor.chain().focus().toggleBulletList().run()}
                            />
                            <ToolButton
                                label="Lista numerada"
                                icon={ListOrdered}
                                active={editor.isActive('orderedList')}
                                action={() => editor.chain().focus().toggleOrderedList().run()}
                            />
                            <ToolButton
                                label="Diminuir recuo"
                                icon={IndentDecrease}
                                action={() => indent(-1)}
                            />
                            <ToolButton
                                label="Aumentar recuo"
                                icon={IndentIncrease}
                                action={() => indent(1)}
                            />
                            <ToolButton
                                label="Limpar formatação"
                                icon={Pilcrow}
                                action={() =>
                                    editor.chain().focus().unsetAllMarks().clearNodes().run()
                                }
                            />
                        </div>
                        <span className="group-caption">PARÁGRAFO</span>
                    </div>
                    <div className="ribbon-group style-group">
                        <select
                            aria-label="Estilo do parágrafo"
                            value={selectionType}
                            onChange={(e) =>
                                e.target.value === 'p'
                                    ? editor.chain().focus().setParagraph().run()
                                    : editor
                                          .chain()
                                          .focus()
                                          .setHeading({
                                              level: Number(e.target.value[1]) as 1 | 2 | 3,
                                          })
                                          .run()
                            }
                        >
                            <option value="p">Texto normal</option>
                            <option value="h1">Título 1</option>
                            <option value="h2">Título 2</option>
                            <option value="h3">Título 3</option>
                        </select>
                        <span className="style-preview">Aa</span>
                        <span className="group-caption">ESTILOS</span>
                    </div>
                    <div className="ribbon-group compact">
                        {actionButton('Localizar', Search, 'find')}
                        <span className="group-caption">BUSCA</span>
                    </div>
                </>
            )}
            {tab === 'Inserir' && (
                <>
                    <div className="ribbon-group">
                        {actionButton('Imagem', ImagePlus, 'image')}
                        {actionButton('Tabela', Table2, 'table')}
                        {actionButton('Link', Link2, 'link')}
                        <span className="group-caption">CONTEÚDO</span>
                    </div>
                    <div className="ribbon-group">
                        <button
                            className="ribbon-action"
                            onClick={() =>
                                editor.chain().focus().insertContent({ type: 'pageBreak' }).run()
                            }
                        >
                            <ScissorsLineDashed size={21} />
                            <span>Quebra de página</span>
                        </button>
                        <button
                            className="ribbon-action"
                            onClick={() => editor.chain().focus().setHorizontalRule().run()}
                        >
                            <Minus size={21} />
                            <span>Linha horizontal</span>
                        </button>
                        <span className="group-caption">ESTRUTURA</span>
                    </div>
                    {editor.isActive('table') && (
                        <div className="ribbon-group">
                            <ToolButton
                                label="Adicionar linha"
                                icon={Rows3}
                                action={() => editor.chain().focus().addRowAfter().run()}
                            />
                            <ToolButton
                                label="Adicionar coluna"
                                icon={Columns3}
                                action={() => editor.chain().focus().addColumnAfter().run()}
                            />
                            <ToolButton
                                label="Excluir tabela"
                                icon={Trash2}
                                action={() => editor.chain().focus().deleteTable().run()}
                            />
                            <span className="group-caption">TABELA</span>
                        </div>
                    )}
                </>
            )}
            {tab === 'Página' && (
                <>
                    <div className="ribbon-group page-group">
                        <label>
                            Papel
                            <select
                                value={page.size}
                                onChange={(e) =>
                                    setPage({ ...page, size: e.target.value as 'A4' | 'Letter' })
                                }
                            >
                                <option>A4</option>
                                <option>Letter</option>
                            </select>
                        </label>
                        <label>
                            Margens
                            <select
                                value={page.margin}
                                onChange={(e) =>
                                    setPage({ ...page, margin: Number(e.target.value) })
                                }
                            >
                                <option value="15">Estreitas · 15 mm</option>
                                <option value="25">Normais · 25 mm</option>
                                <option value="30">Largas · 30 mm</option>
                            </select>
                        </label>
                        <span className="group-caption">CONFIGURAÇÃO DE PÁGINA</span>
                    </div>
                    <p className="ribbon-note">
                        A edição usa uma folha contínua.
                        <br />A paginação final aparece no PDF e na impressão.
                    </p>
                </>
            )}
            {tab === 'Revisão' && (
                <>
                    <div className="ribbon-group">
                        {actionButton('Revisar com IA', WandSparkles, 'review')}
                        {actionButton('Configurar IA', Settings2, 'settings')}
                        {actionButton('Histórico', History, 'history')}
                        <span className="group-caption">REVISÃO E CONTROLE</span>
                    </div>
                    <p className="ribbon-note">
                        Sua voz continua sendo sua.
                        <br />
                        Cada sugestão só muda o texto depois da sua aprovação.
                    </p>
                </>
            )}
        </div>
    );
}
