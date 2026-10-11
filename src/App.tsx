import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { EditorState } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import DOMPurify from 'dompurify';
import {
    Sparkles,
    Save,
    Download,
    ChevronDown,
    Check,
    X,
    Settings2,
    WandSparkles,
    ShieldCheck,
    CircleCheck,
    FileText,
    ListTree,
    History,
    ArrowRight,
    LoaderCircle,
    Search,
    FolderOpen,
    FilePlus2,
    Minus,
    Plus,
    PanelLeftClose,
    PanelLeftOpen,
    AlertCircle,
} from 'lucide-react';
import { Toolbar } from './components/Toolbar';
import { Modal } from './components/Modal';
import { Settings } from './components/Settings';
import { editorExtensions } from './editor/extensions';
import {
    collectBlocks,
    anchorSuggestions,
    mapSuggestions,
    applySuggestion,
    findMatches,
    type AnchoredSuggestion,
} from './editor/review';
import { createDocument } from './shared/document';
import type { AISettings, MagicDocument, NativeAPI, Recovery, ReviewMode } from './shared/types';

const initial = createDocument('Boas-vindas ao Magic Office');
initial.content = {
    type: 'doc',
    content: [
        {
            type: 'paragraph',
            content: [
                {
                    type: 'text',
                    text: 'UM NOVO ESPAÇO PARA ESCREVER',
                    marks: [{ type: 'textStyle', attrs: { color: '#8771ad', fontSize: '10pt' } }],
                },
            ],
        },
        {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Grandes ideias começam com uma página.' }],
        },
        {
            type: 'paragraph',
            content: [
                {
                    type: 'text',
                    text: 'Este é o seu espaço para criar, organizar e dar forma às palavras. Escreva com liberdade. Quando precisar de um segundo olhar, a revisão por IA estará aqui ao lado.',
                },
            ],
        },
        {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Seu texto. Sua voz.' }],
        },
        {
            type: 'paragraph',
            content: [
                {
                    type: 'text',
                    text: 'Selecione um trecho para revisar apenas aquela parte, ou revise o documento inteiro. Compare cada sugestão e escolha o que faz sentido para você.',
                },
            ],
        },
        {
            type: 'bulletList',
            content: [
                {
                    type: 'listItem',
                    content: [
                        {
                            type: 'paragraph',
                            content: [
                                {
                                    type: 'text',
                                    text: 'Dê forma às ideias com títulos, imagens e tabelas.',
                                },
                            ],
                        },
                    ],
                },
                {
                    type: 'listItem',
                    content: [
                        {
                            type: 'paragraph',
                            content: [
                                {
                                    type: 'text',
                                    text: 'Mantenha uma cópia editável no formato .magic.',
                                },
                            ],
                        },
                    ],
                },
                {
                    type: 'listItem',
                    content: [
                        {
                            type: 'paragraph',
                            content: [
                                { type: 'text', text: 'Compartilhe seu trabalho em DOCX ou PDF.' },
                            ],
                        },
                    ],
                },
            ],
        },
        { type: 'paragraph', content: [] },
        {
            type: 'paragraph',
            content: [
                { type: 'text', text: 'O próximo parágrafo é seu.', marks: [{ type: 'italic' }] },
            ],
        },
    ],
};

const fallbackSettings: AISettings = {
    provider: 'ollama',
    endpoint: 'http://127.0.0.1:11434',
    model: 'qwen3:8b',
    hasKey: false,
};
const fingerprint = (doc: MagicDocument) =>
    JSON.stringify({ title: doc.title, content: doc.content, page: doc.page });
const cleanHTML = (html: string) =>
    DOMPurify.sanitize(html, {
        FORBID_TAGS: [
            'script',
            'iframe',
            'object',
            'embed',
            'svg',
            'math',
            'form',
            'input',
            'button',
        ],
        ADD_ATTR: ['data-page-break'],
    });

export default function App() {
    const api = window.magic;
    const [meta, setMeta] = useState(initial);
    const metaRef = useRef(meta);
    metaRef.current = meta;
    const [dirty, setDirty] = useState(false);
    const [revision, setRevision] = useState(0);
    const [tab, setTab] = useState('Início');
    const [zoom, setZoom] = useState(85);
    const [outlineVisible, setOutlineVisible] = useState(true);
    const [path, setPath] = useState<string | null>(null);
    const [status, setStatus] = useState('Pronto para escrever');
    const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
    const [busy, setBusy] = useState(false);
    const [reviewBusy, setReviewBusy] = useState(false);
    const [mode, setMode] = useState<ReviewMode>('grammar');
    const [instructions, setInstructions] = useState('');
    const [suggestions, setSuggestions] = useState<AnchoredSuggestion[]>([]);
    const suggestionsRef = useRef(suggestions);
    suggestionsRef.current = suggestions;
    const [reviewed, setReviewed] = useState(false);
    const [accepted, setAccepted] = useState(0);
    const [settings, setSettings] = useState(fallbackSettings);
    const [modal, setModal] = useState<
        null | 'settings' | 'export' | 'history' | 'find' | 'link' | 'table'
    >(null);
    const [history, setHistory] = useState<Recovery[]>([]);
    const [hasRecovery, setHasRecovery] = useState(false);
    const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
    const [query, setQuery] = useState('');
    const [replacement, setReplacement] = useState('');
    const [matchIndex, setMatchIndex] = useState(0);
    const [link, setLink] = useState('https://');
    const [tableRows, setTableRows] = useState(3);
    const [tableCols, setTableCols] = useState(3);
    const reviewGeneration = useRef(0);

    const notify = useCallback(
        (text: string, error = false) =>
            setToast({
                text: text.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''),
                error,
            }),
        [],
    );
    const editor = useEditor({
        extensions: editorExtensions,
        content: initial.content,
        editorProps: {
            attributes: {
                class: 'document-editor',
                role: 'textbox',
                'aria-multiline': 'true',
                'aria-label': 'Conteúdo do documento',
                spellcheck: 'true',
                lang: 'pt-BR',
            },
            transformPastedHTML: cleanHTML,
        },
        onUpdate: () => {
            setDirty(true);
            setRevision((value) => value + 1);
        },
        onTransaction: ({ transaction }) => {
            if (transaction.docChanged && suggestionsRef.current.length) {
                const mapped = mapSuggestions(suggestionsRef.current, transaction);
                suggestionsRef.current = mapped;
                setSuggestions(mapped);
            }
            setRevision((value) => value + 1);
        },
    });

    const snapshot = useCallback(
        (): MagicDocument => ({
            ...metaRef.current,
            content: editor!.getJSON() as MagicDocument['content'],
            title: metaRef.current.title.trim() || 'Documento sem título',
            updatedAt: new Date().toISOString(),
        }),
        [editor],
    );

    useEffect(() => {
        if (!api) return;
        api.settings()
            .then(setSettings)
            .catch((error) => notify(error.message, true));
        api.history()
            .then((items) => {
                setHasRecovery(items.length > 0);
                setHistory(items);
            })
            .catch((error) => notify(error.message, true));
    }, [api, notify]);
    useEffect(() => {
        api?.setDirty(dirty);
    }, [api, dirty]);
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), toast.error ? 10000 : 5500);
        return () => clearTimeout(timer);
    }, [toast]);
    useEffect(() => {
        if (!api || !editor || !dirty) return;
        const timer = setTimeout(() => {
            const doc = snapshot();
            api.autosave(doc)
                .then(() =>
                    setStatus(
                        `Rascunho salvo às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
                    ),
                )
                .catch((error) => {
                    setStatus('Falha ao salvar rascunho');
                    notify(error.message, true);
                });
        }, 1500);
        return () => clearTimeout(timer);
    }, [api, editor, dirty, revision, meta, snapshot, notify]);

    function needAPI(): NativeAPI | null {
        if (!api) {
            notify('Abra o aplicativo instalado para acessar arquivos e a IA.', true);
            return null;
        }
        return api;
    }
    async function run(action: () => Promise<void>) {
        if (busy) return;
        setBusy(true);
        try {
            await action();
        } catch (error: any) {
            notify(error.message, true);
        } finally {
            setBusy(false);
        }
    }
    async function save(saveAs = false): Promise<boolean> {
        const native = needAPI();
        if (!native || !editor) return false;
        const doc = snapshot();
        const savedPath = await native.save(doc, saveAs);
        if (!savedPath) return false;
        setPath(savedPath);
        if (fingerprint(doc) === fingerprint(snapshot())) setDirty(false);
        setStatus('Documento salvo');
        notify('Documento salvo com sucesso.');
        return true;
    }
    function guard(action: () => Promise<void>) {
        if (dirty) setPendingAction(() => action);
        else void run(action);
    }
    useEffect(
        () =>
            api?.onClose(() => {
                if (dirty)
                    setPendingAction(() => async () => {
                        await api.finishClose();
                    });
                else void api.finishClose();
            }),
        [api, dirty],
    );

    function loadDocument(doc: MagicDocument, newPath: string | null, html?: string) {
        if (!editor) return;
        reviewGeneration.current += 1;
        if (reviewBusy) void api?.cancelReview();
        editor.commands.setContent(html ? cleanHTML(html) : doc.content, { emitUpdate: false });
        editor.view.updateState(
            EditorState.create({
                doc: editor.state.doc,
                schema: editor.schema,
                plugins: editor.state.plugins,
            }),
        );
        setMeta(doc);
        metaRef.current = doc;
        setPath(newPath);
        setDirty(Boolean(html));
        setRevision((value) => value + 1);
        setSuggestions([]);
        suggestionsRef.current = [];
        setReviewed(false);
        setAccepted(0);
        setStatus(newPath ? 'Documento aberto' : 'Pronto para escrever');
    }
    async function openDocument() {
        const native = needAPI();
        if (!native) return;
        const result = await native.open();
        if (!result) return;
        loadDocument(result.document ?? createDocument(result.title), result.path, result.html);
        if (!result.path) setDirty(true);
        if (result.warnings.length) notify(result.warnings.join(' '));
    }
    async function newDocument() {
        const native = needAPI();
        if (!native) return;
        await native.newDocument();
        loadDocument(createDocument(), null);
    }
    async function showHistory() {
        const native = needAPI();
        if (!native) return;
        setHistory(await native.history());
        setModal('history');
    }

    async function review() {
        const native = needAPI();
        if (!native || !editor || reviewBusy) return;
        const selectionOnly = !editor.state.selection.empty;
        const blocks = collectBlocks(editor, selectionOnly);
        const count = blocks.reduce((sum, block) => sum + block.text.length, 0);
        if (!count) {
            notify('Escreva ou selecione um trecho para revisar.');
            return;
        }
        if (count > 18000 || blocks.length > 250) {
            notify(
                'Selecione um trecho menor: até 18.000 caracteres e 250 parágrafos por revisão.',
                true,
            );
            return;
        }
        const original = JSON.stringify(editor.getJSON());
        const generation = ++reviewGeneration.current;
        setReviewBusy(true);
        setSuggestions([]);
        suggestionsRef.current = [];
        setReviewed(false);
        setAccepted(0);
        try {
            const result = await native.review({
                blocks: blocks.map(({ id, text }) => ({ id, text })),
                mode,
                instructions,
            });
            if (
                generation !== reviewGeneration.current ||
                JSON.stringify(editor.getJSON()) !== original
            ) {
                notify(
                    'O documento mudou durante a revisão. Revise novamente para obter sugestões atualizadas.',
                );
                return;
            }
            const anchored = anchorSuggestions(result, blocks);
            setSuggestions(anchored);
            suggestionsRef.current = anchored;
            setReviewed(true);
            notify(
                anchored.length
                    ? `${anchored.length} sugestão(ões) para você conferir.`
                    : 'A IA não sugeriu alterações para este trecho.',
            );
        } catch (error: any) {
            notify(error.message, true);
        } finally {
            setReviewBusy(false);
        }
    }
    function accept(suggestion: AnchoredSuggestion) {
        if (!editor) return;
        if (!applySuggestion(editor, suggestion)) {
            notify('Este trecho foi alterado. Faça uma nova revisão.', true);
            return;
        }
        setAccepted((value) => value + 1);
        const next = suggestionsRef.current.filter((s) => s.id !== suggestion.id);
        setSuggestions(next);
        suggestionsRef.current = next;
    }
    function reject(id: string) {
        const next = suggestionsRef.current.filter((s) => s.id !== id);
        setSuggestions(next);
        suggestionsRef.current = next;
    }

    useEffect(() => {
        function keydown(event: KeyboardEvent) {
            if (!(event.ctrlKey || event.metaKey)) return;
            const key = event.key.toLowerCase();
            if (['s', 'o', 'n', 'f', 'p'].includes(key)) event.preventDefault();
            if (modal || pendingAction || busy) return;
            if (key === 's')
                void run(async () => {
                    await save(event.shiftKey);
                });
            if (key === 'o') guard(openDocument);
            if (key === 'n') guard(newDocument);
            if (key === 'f') setModal('find');
            if (key === 'p' && api && editor)
                void run(async () => {
                    await api.print(editor.getHTML(), snapshot());
                });
        }
        window.addEventListener('keydown', keydown);
        return () => window.removeEventListener('keydown', keydown);
    });

    if (!editor) return <div className="loading">Preparando seu espaço de escrita…</div>;
    const text = editor.getText();
    const wordCount = text.trim() ? text.trim().split(/\s+/u).length : 0;
    const selectedChars = editor.state.selection.empty
        ? 0
        : editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, '\n')
              .length;
    const headings: { text: string; level: number; pos: number }[] = [];
    editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading')
            headings.push({ text: node.textContent, level: node.attrs.level, pos });
    });
    const matches = findMatches(editor, query);
    const actions = {
        new: () => guard(newDocument),
        open: () => guard(openDocument),
        save: () =>
            void run(async () => {
                await save();
            }),
        saveAs: () =>
            void run(async () => {
                await save(true);
            }),
        export: () => setModal('export'),
        print: () =>
            void run(async () => {
                const native = needAPI();
                if (native) await native.print(editor.getHTML(), snapshot());
            }),
        history: () => void run(showHistory),
        find: () => setModal('find'),
        settings: () => setModal('settings'),
        review: () => void review(),
        link: () => {
            setLink(editor.getAttributes('link').href || 'https://');
            setModal('link');
        },
        table: () => setModal('table'),
        image: () =>
            void run(async () => {
                const native = needAPI();
                if (!native) return;
                const src = await native.image();
                if (src) editor.chain().focus().setImage({ src }).run();
            }),
    };
    const exportFile = (kind: 'docx' | 'pdf' | 'txt') =>
        void run(async () => {
            const native = needAPI();
            if (!native) return;
            const result =
                kind === 'docx'
                    ? await native.exportDocx(snapshot())
                    : kind === 'pdf'
                      ? await native.pdf(editor.getHTML(), snapshot())
                      : await native.exportText(editor.getText(), meta.title);
            if (result) {
                setModal(null);
                notify(`Arquivo ${kind.toUpperCase()} exportado.`);
            }
        });
    const findNext = () => {
        if (!matches.length) return;
        const match = matches[matchIndex % matches.length];
        editor.chain().focus().setTextSelection(match).scrollIntoView().run();
        setMatchIndex((value) => value + 1);
    };

    return (
        <div className="app-shell">
            <header className="app-header">
                <div className="brand">
                    <div className="brand-mark">
                        <Sparkles size={23} strokeWidth={1.7} />
                    </div>
                    <div>
                        <strong>
                            magic<span>office</span>
                        </strong>
                        <small>ESPAÇO PARA SUAS IDEIAS</small>
                    </div>
                </div>
                <div className="document-title">
                    <input
                        aria-label="Nome do documento"
                        value={meta.title}
                        maxLength={240}
                        onChange={(e) => {
                            setMeta({ ...meta, title: e.target.value });
                            setDirty(true);
                        }}
                    />
                    <span className="save-indicator">
                        {dirty ? <span className="dirty-dot" /> : <CircleCheck size={13} />}
                        {status}
                    </span>
                </div>
                <div className="header-actions">
                    <button className="button save-button" onClick={actions.save} disabled={busy}>
                        <Save size={16} />
                        Salvar
                    </button>
                    <button className="button primary" onClick={actions.export} disabled={busy}>
                        <Download size={16} />
                        Exportar
                        <ChevronDown size={13} />
                    </button>
                </div>
            </header>
            <div className="tab-bar">
                <nav aria-label="Abas de ferramentas">
                    {['Arquivo', 'Início', 'Inserir', 'Página', 'Revisão'].map((name) => (
                        <button
                            key={name}
                            className={tab === name ? 'selected' : ''}
                            onClick={() => setTab(name)}
                        >
                            {name}
                        </button>
                    ))}
                </nav>
                <button className="text-button settings-button" onClick={actions.settings}>
                    <Settings2 size={15} />
                    Configurar IA
                </button>
            </div>
            <Toolbar
                editor={editor}
                tab={tab}
                actions={actions}
                page={meta.page}
                setPage={(page) => {
                    setMeta({ ...meta, page });
                    setDirty(true);
                }}
            />
            {!api && (
                <div className="native-banner">
                    Prévia do editor. Para arquivos locais e IA, execute o aplicativo desktop.
                </div>
            )}
            <main className={`workspace ${outlineVisible ? '' : 'without-outline'}`}>
                {outlineVisible && (
                    <aside className="outline-panel">
                        <div className="panel-label">
                            <ListTree size={16} />
                            DOCUMENTO
                            <button
                                className="icon-button"
                                title="Ocultar navegação"
                                onClick={() => setOutlineVisible(false)}
                            >
                                <PanelLeftClose size={16} />
                            </button>
                        </div>
                        <button className="outline-file active">
                            <FileText size={17} />
                            <span>{meta.title || 'Sem título'}</span>
                        </button>
                        <div className="outline-label">NESTE DOCUMENTO</div>
                        <div className="outline-items">
                            {headings.length ? (
                                headings.map((heading, index) => (
                                    <button
                                        key={index}
                                        style={{
                                            paddingLeft: `${12 + (heading.level - 1) * 12}px`,
                                        }}
                                        onClick={() =>
                                            editor
                                                .chain()
                                                .focus()
                                                .setTextSelection(heading.pos + 1)
                                                .scrollIntoView()
                                                .run()
                                        }
                                    >
                                        {heading.text || 'Título sem texto'}
                                    </button>
                                ))
                            ) : (
                                <p className="muted empty-outline">
                                    Seus títulos aparecem aqui para facilitar a navegação.
                                </p>
                            )}
                        </div>
                        <div className="outline-bottom">
                            {hasRecovery && (
                                <button className="recovery-card" onClick={actions.history}>
                                    <History size={18} />
                                    <span>
                                        Rascunhos disponíveis<small>Retome de onde parou</small>
                                    </span>
                                    <ArrowRight size={14} />
                                </button>
                            )}
                            <button className="sidebar-action" onClick={actions.new}>
                                <FilePlus2 size={16} />
                                Novo documento
                            </button>
                            <button className="sidebar-action" onClick={actions.open}>
                                <FolderOpen size={16} />
                                Abrir documento
                            </button>
                            <button className="sidebar-action" onClick={actions.history}>
                                <History size={16} />
                                Histórico e recuperação
                            </button>
                            <div className="local-note">
                                <ShieldCheck size={15} />
                                <span>
                                    Seus arquivos ficam
                                    <br />
                                    no seu computador.
                                </span>
                            </div>
                        </div>
                    </aside>
                )}
                <section className="writing-area" aria-label="Área de escrita">
                    <div className="canvas-top">
                        {!outlineVisible && (
                            <button
                                className="icon-button"
                                title="Mostrar navegação"
                                onClick={() => setOutlineVisible(true)}
                            >
                                <PanelLeftOpen size={16} />
                            </button>
                        )}
                        <span>
                            {meta.page.size} <span className="dot-separator">·</span> MARGENS{' '}
                            {meta.page.margin} MM
                        </span>
                        <span className="canvas-label">EDIÇÃO CONTÍNUA</span>
                    </div>
                    <div className="paper-scroll">
                        <div className="paper-wrapper" style={{ zoom: zoom / 100 }}>
                            <div className="ruler" aria-hidden="true">
                                {Array.from({ length: 16 }, (_, i) => (
                                    <span key={i}>{i + 1}</span>
                                ))}
                            </div>
                            <article
                                className="paper"
                                style={{
                                    width: meta.page.size === 'A4' ? '210mm' : '216mm',
                                    minHeight: meta.page.size === 'A4' ? '297mm' : '279mm',
                                    padding: `${meta.page.margin}mm`,
                                }}
                            >
                                <EditorContent editor={editor} />
                            </article>
                            <div className="paper-bottom-note">
                                Magic Office Editor · Feito para dar vida às palavras
                            </div>
                        </div>
                    </div>
                </section>
                <aside className="review-panel">
                    <div className="review-heading">
                        <div className="ai-icon">
                            <Sparkles size={19} />
                        </div>
                        <div>
                            <h2>Um segundo olhar</h2>
                            <p>Revisão com inteligência artificial</p>
                        </div>
                    </div>
                    <div className="review-controls">
                        <label>
                            O que vamos melhorar?
                            <select
                                aria-label="Tipo de revisão"
                                value={mode}
                                onChange={(e) => setMode(e.target.value as ReviewMode)}
                                disabled={reviewBusy}
                            >
                                <option value="grammar">Ortografia e gramática</option>
                                <option value="clarity">Clareza e fluidez</option>
                                <option value="style">Estilo e tom de voz</option>
                            </select>
                        </label>
                        <details>
                            <summary>Preferências de escrita</summary>
                            <textarea
                                maxLength={1000}
                                value={instructions}
                                onChange={(e) => setInstructions(e.target.value)}
                                placeholder="Ex.: preserve os diálogos e o estilo dos personagens."
                            />
                        </details>
                        <button
                            className="button primary review-button"
                            disabled={reviewBusy || busy}
                            onClick={() => void review()}
                        >
                            {reviewBusy ? (
                                <LoaderCircle className="spin" size={17} />
                            ) : (
                                <WandSparkles size={17} />
                            )}
                            {reviewBusy
                                ? 'Lendo com atenção…'
                                : selectedChars
                                  ? 'Revisar seleção'
                                  : 'Revisar documento'}
                        </button>
                        {reviewBusy && (
                            <button
                                className="text-button cancel-review"
                                onClick={() => void api?.cancelReview()}
                            >
                                Cancelar revisão
                            </button>
                        )}
                        <p className="review-scope">
                            {selectedChars
                                ? `${selectedChars.toLocaleString('pt-BR')} caracteres selecionados`
                                : 'Até 18.000 caracteres por revisão'}
                            <br />
                            {settings.provider === 'ollama' &&
                            /^http:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(settings.endpoint)
                                ? 'Processamento local com Ollama'
                                : 'O texto será enviado ao provedor configurado'}
                        </p>
                    </div>
                    <div className="suggestions-heading">
                        <span>SUGESTÕES</span>
                        <span className="count-badge">{suggestions.length}</span>
                        {accepted > 0 && <small>{accepted} aceita(s)</small>}
                    </div>
                    <div className="suggestions-list">
                        {suggestions.length ? (
                            suggestions.map((suggestion) => (
                                <article className="suggestion-card" key={suggestion.id}>
                                    <div className="suggestion-category">
                                        <span className="tiny-spark">
                                            <Sparkles size={13} />
                                        </span>
                                        {mode === 'grammar'
                                            ? 'Ajuste de escrita'
                                            : 'Sugestão editorial'}
                                        <button
                                            className="text-button"
                                            onClick={() =>
                                                editor
                                                    .chain()
                                                    .focus()
                                                    .setTextSelection({
                                                        from: suggestion.from,
                                                        to: suggestion.to,
                                                    })
                                                    .scrollIntoView()
                                                    .run()
                                            }
                                        >
                                            Ver no texto
                                        </button>
                                    </div>
                                    <p className="original-text">{suggestion.original}</p>
                                    <p className="replacement-text">
                                        {suggestion.replacement || '(remover trecho)'}
                                    </p>
                                    <p className="suggestion-reason">{suggestion.reason}</p>
                                    <div className="suggestion-actions">
                                        <button
                                            className="button accept"
                                            onClick={() => accept(suggestion)}
                                        >
                                            <Check size={15} />
                                            Aceitar
                                        </button>
                                        <button
                                            className="button reject"
                                            onClick={() => reject(suggestion.id)}
                                        >
                                            <X size={15} />
                                            Ignorar
                                        </button>
                                    </div>
                                </article>
                            ))
                        ) : (
                            <div className="review-empty">
                                <div className="empty-art">
                                    {reviewed ? (
                                        <Check size={32} strokeWidth={1.4} />
                                    ) : (
                                        <FileText size={34} strokeWidth={1.2} />
                                    )}
                                    <span>
                                        <Sparkles size={17} />
                                    </span>
                                </div>
                                <h3>
                                    {reviewBusy
                                        ? 'Cuidando de cada palavra'
                                        : reviewed
                                          ? 'Revisão concluída'
                                          : 'Sua escrita, ainda melhor'}
                                </h3>
                                <p>
                                    {reviewBusy
                                        ? 'Você pode continuar escrevendo. Se o texto mudar, será necessário revisar novamente.'
                                        : reviewed
                                          ? 'Não há sugestões pendentes. Você pode revisar outro trecho quando quiser.'
                                          : 'Correções e ideias para lapidar seu texto, sempre respeitando sua voz.'}
                                </p>
                                {!reviewed && !reviewBusy && (
                                    <div className="review-steps">
                                        <span>
                                            <Check size={13} />
                                            Compare antes de alterar
                                        </span>
                                        <span>
                                            <Check size={13} />
                                            Aceite apenas o que quiser
                                        </span>
                                        <span>
                                            <Check size={13} />
                                            Desfaça a qualquer momento
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="review-footer">
                        <ShieldCheck size={15} />
                        <span>A decisão final é sempre sua.</span>
                    </div>
                </aside>
            </main>
            <footer className="status-bar">
                <div>
                    <span>{wordCount.toLocaleString('pt-BR')} palavras</span>
                    <span>{text.length.toLocaleString('pt-BR')} caracteres</span>
                    <span className="language-status">Português (Brasil)</span>
                    {path && (
                        <span className="path-status" title={path}>
                            Arquivo salvo
                        </span>
                    )}
                </div>
                <div className="zoom-controls">
                    <button
                        aria-label="Diminuir zoom"
                        onClick={() => setZoom(Math.max(50, zoom - 5))}
                    >
                        <Minus size={14} />
                    </button>
                    <input
                        aria-label="Zoom"
                        type="range"
                        min="50"
                        max="150"
                        step="5"
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                    />
                    <button
                        aria-label="Aumentar zoom"
                        onClick={() => setZoom(Math.min(150, zoom + 5))}
                    >
                        <Plus size={14} />
                    </button>
                    <span>{zoom}%</span>
                </div>
            </footer>
            {toast && (
                <div
                    className={`toast ${toast.error ? 'error' : ''}`}
                    role={toast.error ? 'alert' : 'status'}
                >
                    {toast.error ? <AlertCircle size={18} /> : <CircleCheck size={18} />}
                    <span>{toast.text}</span>
                    <button aria-label="Dispensar aviso" onClick={() => setToast(null)}>
                        <X size={16} />
                    </button>
                </div>
            )}
            {modal === 'settings' &&
                (api ? (
                    <Settings
                        api={api}
                        initial={settings}
                        onClose={() => setModal(null)}
                        onSaved={setSettings}
                    />
                ) : (
                    <Modal title="Configurar IA" onClose={() => setModal(null)}>
                        <p>Execute o aplicativo desktop para configurar uma IA local ou por API.</p>
                    </Modal>
                ))}
            {modal === 'export' && (
                <Modal title="Compartilhe suas palavras" onClose={() => setModal(null)}>
                    <p className="muted">Escolha o formato que combina com o próximo passo.</p>
                    <div className="export-options">
                        <button disabled={busy} onClick={() => exportFile('docx')}>
                            <span className="format-icon blue">W</span>
                            <span>
                                <strong>Documento do Word</strong>
                                <small>.docx · texto, estilos básicos, imagens e tabelas</small>
                            </span>
                            <ArrowRight size={18} />
                        </button>
                        <button disabled={busy} onClick={() => exportFile('pdf')}>
                            <span className="format-icon red">PDF</span>
                            <span>
                                <strong>Documento PDF</strong>
                                <small>.pdf · páginas prontas para compartilhar ou imprimir</small>
                            </span>
                            <ArrowRight size={18} />
                        </button>
                        <button disabled={busy} onClick={() => exportFile('txt')}>
                            <span className="format-icon gray">TXT</span>
                            <span>
                                <strong>Texto simples</strong>
                                <small>.txt · somente o conteúdo, sem formatação</small>
                            </span>
                            <ArrowRight size={18} />
                        </button>
                    </div>
                    <p className="info-footnote">
                        Salve também em .magic para preservar a estrutura editável. A conversão DOCX
                        não preserva todos os recursos avançados do Word.
                    </p>
                </Modal>
            )}
            {modal === 'history' && (
                <Modal title="Histórico e recuperação" onClose={() => setModal(null)} wide>
                    <p className="muted">
                        Até 60 rascunhos recentes. Restaurar abre uma cópia, sem sobrescrever o
                        arquivo original.
                    </p>
                    <div className="history-list">
                        {history.length ? (
                            history.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setModal(null);
                                        guard(async () => {
                                            const native = needAPI();
                                            if (!native) return;
                                            const restored = await native.restore(item.id);
                                            loadDocument(restored.document, null);
                                            setDirty(true);
                                            notify(
                                                'Versão restaurada como cópia. Use Salvar para escolher um arquivo.',
                                            );
                                        });
                                    }}
                                >
                                    <FileText size={23} />
                                    <span>
                                        <strong>{item.document.title}</strong>
                                        <small>
                                            {new Date(item.document.updatedAt).toLocaleString(
                                                'pt-BR',
                                            )}
                                        </small>
                                    </span>
                                    <span className="restore-label">
                                        Restaurar <ArrowRight size={15} />
                                    </span>
                                </button>
                            ))
                        ) : (
                            <div className="empty-history">
                                <History size={30} />
                                <p>Os rascunhos aparecem aqui enquanto você escreve.</p>
                            </div>
                        )}
                    </div>
                </Modal>
            )}
            {modal === 'find' && (
                <Modal title="Localizar e substituir" onClose={() => setModal(null)}>
                    <label>
                        Localizar (diferencia maiúsculas)
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setMatchIndex(0);
                            }}
                        />
                    </label>
                    <label>
                        Substituir por
                        <input
                            value={replacement}
                            onChange={(e) => setReplacement(e.target.value)}
                        />
                    </label>
                    <p className="muted">{matches.length} ocorrência(s) encontrada(s).</p>
                    <div className="modal-actions">
                        <button className="button" disabled={!matches.length} onClick={findNext}>
                            <Search size={16} />
                            Localizar próxima
                        </button>
                        <button
                            className="button primary"
                            disabled={!matches.length}
                            onClick={() => {
                                const transaction = closeHistory(editor.state.tr);
                                for (const match of [...matches].reverse())
                                    transaction.insertText(replacement, match.from, match.to);
                                editor.view.dispatch(transaction);
                                editor.view.dispatch(closeHistory(editor.state.tr));
                                notify(
                                    `${matches.length} ocorrência(s) substituída(s). Ctrl+Z desfaz a operação.`,
                                );
                            }}
                        >
                            Substituir todas
                        </button>
                    </div>
                </Modal>
            )}
            {modal === 'link' && (
                <Modal title="Inserir link" onClose={() => setModal(null)}>
                    <label>
                        Endereço
                        <input
                            autoFocus
                            value={link}
                            onChange={(e) => setLink(e.target.value)}
                            placeholder="https://"
                        />
                    </label>
                    <p className="muted">Selecione o texto antes de inserir um link.</p>
                    <div className="modal-actions">
                        <button
                            className="button"
                            onClick={() => {
                                editor.chain().focus().extendMarkRange('link').unsetLink().run();
                                setModal(null);
                            }}
                        >
                            Remover link
                        </button>
                        <button
                            className="button primary"
                            disabled={!/^(https?:\/\/|mailto:)/i.test(link)}
                            onClick={() => {
                                editor
                                    .chain()
                                    .focus()
                                    .extendMarkRange('link')
                                    .setLink({ href: link })
                                    .run();
                                setModal(null);
                            }}
                        >
                            Aplicar link
                        </button>
                    </div>
                </Modal>
            )}
            {modal === 'table' && (
                <Modal title="Inserir tabela" onClose={() => setModal(null)}>
                    <div className="form-grid">
                        <label>
                            Linhas
                            <input
                                type="number"
                                min="1"
                                max="30"
                                value={tableRows}
                                onChange={(e) => setTableRows(Number(e.target.value))}
                            />
                        </label>
                        <label>
                            Colunas
                            <input
                                type="number"
                                min="1"
                                max="10"
                                value={tableCols}
                                onChange={(e) => setTableCols(Number(e.target.value))}
                            />
                        </label>
                    </div>
                    <div className="modal-actions">
                        <button
                            className="button primary"
                            disabled={
                                tableRows < 1 || tableRows > 30 || tableCols < 1 || tableCols > 10
                            }
                            onClick={() => {
                                editor
                                    .chain()
                                    .focus()
                                    .insertTable({
                                        rows: Math.floor(tableRows),
                                        cols: Math.floor(tableCols),
                                        withHeaderRow: true,
                                    })
                                    .run();
                                setModal(null);
                            }}
                        >
                            Inserir tabela
                        </button>
                    </div>
                </Modal>
            )}
            {pendingAction && (
                <Modal title="Salvar antes de continuar?" onClose={() => setPendingAction(null)}>
                    <p>O documento tem alterações que ainda não foram salvas no arquivo.</p>
                    <div className="modal-actions">
                        <button
                            className="button"
                            disabled={busy}
                            onClick={() => setPendingAction(null)}
                        >
                            Cancelar
                        </button>
                        <button
                            className="button"
                            disabled={busy}
                            onClick={() =>
                                void run(async () => {
                                    const action = pendingAction;
                                    if (api) await api.autosave(snapshot());
                                    setPendingAction(null);
                                    await action();
                                })
                            }
                        >
                            Continuar sem salvar arquivo
                        </button>
                        <button
                            className="button primary"
                            disabled={busy}
                            onClick={() =>
                                void run(async () => {
                                    if (await save()) {
                                        const action = pendingAction;
                                        setPendingAction(null);
                                        await action();
                                    }
                                })
                            }
                        >
                            Salvar e continuar
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
