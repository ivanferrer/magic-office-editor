export interface RichNode {
    type: string;
    attrs?: Record<string, any>;
    text?: string;
    marks?: { type: string; attrs?: Record<string, any> }[];
    content?: RichNode[];
}

export interface MagicDocument {
    format: 'magic-office';
    version: 1;
    title: string;
    content: RichNode;
    page: { size: 'A4' | 'Letter'; margin: number };
    updatedAt: string;
}

export type Provider = 'ollama' | 'compatible';
export interface AISettings {
    provider: Provider;
    endpoint: string;
    model: string;
    hasKey?: boolean;
    apiKey?: string;
    clearKey?: boolean;
}
export type ReviewMode = 'grammar' | 'clarity' | 'style';
export interface ReviewBlock {
    id: string;
    text: string;
}
export interface Suggestion {
    blockId: string;
    original: string;
    replacement: string;
    reason: string;
}
export interface ReviewRequest {
    blocks: ReviewBlock[];
    mode: ReviewMode;
    instructions: string;
}
export interface OpenResult {
    path: string | null;
    document?: MagicDocument;
    html?: string;
    title: string;
    warnings: string[];
}
export interface Recovery {
    document: MagicDocument;
    path: string | null;
    id: string;
}
export interface NativeAPI {
    open(): Promise<OpenResult | null>;
    save(document: MagicDocument, saveAs?: boolean): Promise<string | null>;
    exportDocx(document: MagicDocument): Promise<string | null>;
    exportText(text: string, title: string): Promise<string | null>;
    pdf(html: string, document: MagicDocument): Promise<string | null>;
    print(html: string, document: MagicDocument): Promise<boolean>;
    image(): Promise<string | null>;
    autosave(document: MagicDocument): Promise<void>;
    history(): Promise<Recovery[]>;
    restore(id: string): Promise<Recovery>;
    newDocument(): Promise<void>;
    settings(): Promise<AISettings>;
    saveSettings(settings: AISettings): Promise<AISettings>;
    testConnection(): Promise<string[]>;
    review(request: ReviewRequest): Promise<Suggestion[]>;
    cancelReview(): Promise<void>;
    setDirty(dirty: boolean): void;
    onClose(callback: () => void): () => void;
    finishClose(): Promise<void>;
}

declare global {
    interface Window {
        magic?: NativeAPI;
    }
}
