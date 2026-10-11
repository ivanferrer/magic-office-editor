import { app, BrowserWindow, ipcMain, dialog, safeStorage, Menu, session } from 'electron';
import { readFile, stat, mkdir, rm } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import mammoth from 'mammoth';
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import { createDocument, documentSchema, safeFilename, textDocument } from '../src/shared/document';
import type { AISettings, MagicDocument } from '../src/shared/types';
import { atomicWrite, RecoveryStore } from './storage';
import { defaultSettings, listModels, reviewText, settingsSchema } from './ai';
import { exportDocx } from './docx';

let window: BrowserWindow;
let currentPath: string | null = null;
let canClose = false;
let dirty = false;
let reviewing: AbortController | null = null;
let store: RecoveryStore;
let settingsPath = '';
let fileBusy = false;

function validateDocument(value: unknown): MagicDocument {
    if (JSON.stringify(value).length > 30_000_000)
        throw new Error('O documento excede o limite de 30 MB.');
    return documentSchema.parse(value);
}

async function readSettings(includeKey = false): Promise<AISettings> {
    try {
        const saved = JSON.parse(await readFile(settingsPath, 'utf8'));
        const config = settingsSchema.parse(saved);
        let apiKey: string | undefined;
        if (includeKey && saved.encryptedKey) {
            if (!safeStorage.isEncryptionAvailable())
                throw new Error('Não foi possível acessar a chave protegida pelo sistema.');
            apiKey = safeStorage.decryptString(Buffer.from(saved.encryptedKey, 'base64'));
        }
        return {
            provider: config.provider,
            endpoint: config.endpoint,
            model: config.model,
            hasKey: Boolean(saved.encryptedKey),
            ...(includeKey ? { apiKey } : {}),
        };
    } catch (error: any) {
        if (error.code === 'ENOENT') return { ...defaultSettings, hasKey: false };
        throw new Error(
            'Não foi possível ler a configuração da IA. Salve as configurações novamente.',
        );
    }
}

function trusted(event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent): boolean {
    return (
        event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame
    );
}

function handle(channel: string, fn: (...args: any[]) => unknown): void {
    ipcMain.handle(channel, async (event, ...args) => {
        if (!trusted(event)) throw new Error('Origem não autorizada.');
        try {
            return await fn(...args);
        } catch (error: any) {
            if (error instanceof z.ZodError)
                throw new Error('Dados inválidos. Confira o documento ou as configurações.');
            if (error.name === 'AbortError') throw new Error('Revisão cancelada.');
            if (error.name === 'TimeoutError')
                throw new Error(
                    'A IA demorou mais de 120 segundos. Use um trecho menor ou outro modelo.',
                );
            if (error.code === 'ENOSPC')
                throw new Error('Não há espaço no disco para salvar o documento.');
            if (error.code === 'EACCES' || error.code === 'EPERM')
                throw new Error('Sem permissão para gravar neste local. Escolha outra pasta.');
            if (error.message === 'fetch failed')
                throw new Error(
                    'Não foi possível conectar à IA. Confira o endereço, o modelo e se o serviço está em execução.',
                );
            throw new Error(
                String(error.message ?? 'Não foi possível concluir a operação.').slice(0, 500),
            );
        }
    });
}

async function fileAction<T>(action: () => Promise<T>): Promise<T> {
    if (fileBusy) throw new Error('Aguarde a operação de arquivo atual terminar.');
    fileBusy = true;
    try {
        return await action();
    } finally {
        fileBusy = false;
    }
}

async function saveTarget(title: string, extension: string): Promise<string | null> {
    const result = await dialog.showSaveDialog(window, {
        title: 'Salvar documento',
        defaultPath: `${safeFilename(title)}.${extension}`,
        filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
    });
    if (result.canceled || !result.filePath) return null;
    return extname(result.filePath).toLowerCase() === `.${extension}`
        ? result.filePath
        : `${result.filePath}.${extension}`;
}

async function renderOutput(
    html: unknown,
    document: unknown,
    print: boolean,
): Promise<string | boolean | null> {
    const doc = validateDocument(document);
    if (typeof html !== 'string' || html.length > 30_000_000) throw new Error('Conteúdo inválido.');
    const path = print ? null : await saveTarget(doc.title, 'pdf');
    if (!print && !path) return null;
    const clean = sanitizeHtml(html, {
        allowedTags: [
            'p',
            'h1',
            'h2',
            'h3',
            'strong',
            'em',
            'u',
            's',
            'span',
            'br',
            'ul',
            'ol',
            'li',
            'blockquote',
            'table',
            'thead',
            'tbody',
            'tr',
            'th',
            'td',
            'img',
            'hr',
            'mark',
            'a',
            'div',
        ],
        allowedAttributes: {
            '*': ['style'],
            img: ['src', 'width', 'height', 'alt'],
            td: ['colspan', 'rowspan'],
            th: ['colspan', 'rowspan'],
            ol: ['start'],
            a: ['href'],
        },
        allowedSchemes: ['https', 'http', 'mailto'],
        allowedSchemesByTag: { img: ['data'] },
        allowedStyles: {
            '*': {
                color: [/^#[\da-f]{3,8}$/i, /^rgb\([\d,\s]+\)$/],
                'background-color': [/^#[\da-f]{3,8}$/i, /^rgb\([\d,\s]+\)$/],
                'text-align': [/^(left|right|center|justify)$/],
                'font-family': [/^[\w\s,'-]+$/],
                'font-size': [/^\d+(\.\d+)?(pt|px)$/],
                'line-height': [/^[\d.]+$/],
                'margin-left': [/^\d+(px|pt)$/],
                'break-after': [/^page$/],
            },
        },
        exclusiveFilter: (frame) =>
            frame.tag === 'img' &&
            !/^data:image\/(png|jpeg|jpg|gif);base64,/.test(frame.attribs.src ?? ''),
    });
    const directory = join(app.getPath('temp'), `magic-print-${randomUUID()}`);
    await mkdir(directory);
    const file = join(directory, 'print.html');
    const markup = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><style>@page{size:${doc.page.size};margin:${doc.page.margin}mm}body{font:12pt Calibri,Arial,sans-serif;line-height:1.5;color:#20202a;margin:0}p{margin:0 0 8pt}h1,h2,h3{break-after:avoid;line-height:1.2}table{border-collapse:collapse;width:100%;margin:12pt 0}th,td{border:1px solid #aaa;padding:6pt;vertical-align:top}th{background:#eeeaf8}img{max-width:100%;height:auto}blockquote{border-left:3px solid #aaa;margin-left:0;padding-left:14pt}a{color:inherit}hr{border:0;border-top:1px solid #ccc}li p{margin:0}p{orphans:2;widows:2}</style></head><body>${clean}</body></html>`;
    await atomicWrite(file, markup);
    const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
            partition: `print-${randomUUID()}`,
        },
    });
    printWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    try {
        await printWindow.loadFile(file);
        await printWindow.webContents.executeJavaScript(
            'Promise.all([document.fonts.ready, ...Array.from(document.images, i => i.decode().catch(() => {}))])',
        );
        if (print)
            return await new Promise<boolean>((resolve, reject) =>
                printWindow.webContents.print(
                    { silent: false, printBackground: true },
                    (success, reason) =>
                        success || /cancel/i.test(reason)
                            ? resolve(success)
                            : reject(new Error(reason)),
                ),
            );
        const buffer = await printWindow.webContents.printToPDF({
            printBackground: true,
            preferCSSPageSize: true,
            displayHeaderFooter: true,
            headerTemplate: '<span></span>',
            footerTemplate:
                '<div style="font-size:9px;text-align:center;width:100%;color:#666"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
            margins: {
                top: doc.page.margin / 25.4,
                bottom: doc.page.margin / 25.4,
                left: doc.page.margin / 25.4,
                right: doc.page.margin / 25.4,
            },
        });
        await atomicWrite(path!, buffer);
        return path;
    } finally {
        printWindow.destroy();
        await rm(directory, { recursive: true, force: true });
    }
}

function registerIPC(): void {
    handle('document:open', () =>
        fileAction(async () => {
            const result = await dialog.showOpenDialog(window, {
                properties: ['openFile'],
                filters: [{ name: 'Documentos', extensions: ['magic', 'docx', 'txt'] }],
            });
            if (result.canceled) return null;
            const path = result.filePaths[0];
            if ((await stat(path)).size > 30_000_000)
                throw new Error('O arquivo excede o limite de 30 MB.');
            const extension = extname(path).toLowerCase();
            const title = basename(path, extension);
            const buffer = await readFile(path);
            let opened: any;
            if (extension === '.magic')
                opened = {
                    path,
                    title,
                    document: validateDocument(JSON.parse(buffer.toString('utf8'))),
                    warnings: [],
                };
            else if (extension === '.txt')
                opened = {
                    path: null,
                    title,
                    document: textDocument(buffer.toString('utf8'), title),
                    warnings: [],
                };
            else if (extension === '.docx') {
                const converted = await mammoth.convertToHtml(
                    { buffer },
                    { externalFileAccess: false },
                );
                if (converted.value.length > 30_000_000)
                    throw new Error('O conteúdo expandido do DOCX excede 30 MB.');
                opened = {
                    path: null,
                    title,
                    html: converted.value,
                    warnings: [
                        'DOCX importado como cópia. Cabeçalhos, rodapés, notas, seções e diagramação avançada podem não ser preservados.',
                        ...converted.messages.map((m) => m.message).slice(0, 4),
                    ],
                };
            } else throw new Error('Formato não suportado.');
            currentPath = opened.path;
            store.reset();
            return opened;
        }),
    );
    handle('document:save', (value, saveAs = false) =>
        fileAction(async () => {
            const document = validateDocument(value);
            const path =
                !saveAs && currentPath ? currentPath : await saveTarget(document.title, 'magic');
            if (!path) return null;
            await atomicWrite(path, JSON.stringify(document, null, 4), true);
            currentPath = path;
            await store.save(document, currentPath);
            return path;
        }),
    );
    handle('document:new', async () => {
        currentPath = null;
        store.reset();
    });
    handle('document:autosave', async (value) => {
        await store.save(validateDocument(value), currentPath);
    });
    handle('document:history', () => store.list());
    handle('document:restore', async (id) => {
        const entry = await store.read(z.string().parse(id));
        currentPath = null;
        store.reset();
        return entry;
    });
    handle('document:docx', (value) =>
        fileAction(async () => {
            const doc = validateDocument(value);
            const path = await saveTarget(doc.title, 'docx');
            if (path) await atomicWrite(path, await exportDocx(doc));
            return path;
        }),
    );
    handle('document:text', (text, title) =>
        fileAction(async () => {
            z.string().max(30_000_000).parse(text);
            z.string().max(240).parse(title);
            const path = await saveTarget(title, 'txt');
            if (path) await atomicWrite(path, text);
            return path;
        }),
    );
    handle('document:pdf', (html, doc) => fileAction(() => renderOutput(html, doc, false)));
    handle('document:print', (html, doc) => fileAction(() => renderOutput(html, doc, true)));
    handle('document:image', () =>
        fileAction(async () => {
            const result = await dialog.showOpenDialog(window, {
                properties: ['openFile'],
                filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'gif'] }],
            });
            if (result.canceled) return null;
            const path = result.filePaths[0];
            if ((await stat(path)).size > 8_000_000)
                throw new Error('Escolha uma imagem de até 8 MB.');
            const extension = extname(path).slice(1).toLowerCase();
            if (!['png', 'jpg', 'jpeg', 'gif'].includes(extension))
                throw new Error('Formato de imagem inválido.');
            return `data:image/${extension === 'jpg' ? 'jpeg' : extension};base64,${(await readFile(path)).toString('base64')}`;
        }),
    );
    handle('ai:settings', () => readSettings());
    handle('ai:save-settings', async (input) => {
        const config = settingsSchema.parse(input);
        let encryptedKey: string | undefined;
        try {
            const old = JSON.parse(await readFile(settingsPath, 'utf8'));
            if (old.endpoint === config.endpoint && old.provider === config.provider)
                encryptedKey = old.encryptedKey;
        } catch {
            /* A new profile has no saved key. */
        }
        if (config.clearKey) encryptedKey = undefined;
        if (config.apiKey) {
            if (
                !safeStorage.isEncryptionAvailable() ||
                (process.platform === 'linux' &&
                    safeStorage.getSelectedStorageBackend() === 'basic_text')
            )
                throw new Error(
                    'O sistema não oferece armazenamento seguro para a chave. Configure o cofre do sistema ou use Ollama local.',
                );
            encryptedKey = safeStorage.encryptString(config.apiKey).toString('base64');
        }
        await atomicWrite(
            settingsPath,
            JSON.stringify({
                provider: config.provider,
                endpoint: config.endpoint,
                model: config.model,
                encryptedKey,
            }),
        );
        return readSettings();
    });
    handle('ai:test', async () => listModels(await readSettings(true)));
    handle('ai:review', async (request) => {
        if (reviewing) throw new Error('Já existe uma revisão em andamento.');
        const controller = new AbortController();
        reviewing = controller;
        try {
            return await reviewText(
                await readSettings(true),
                request,
                AbortSignal.any([controller.signal, AbortSignal.timeout(120000)]),
            );
        } finally {
            if (reviewing === controller) reviewing = null;
        }
    });
    handle('ai:cancel', () => {
        reviewing?.abort();
    });
    ipcMain.on('document:dirty', (event, value) => {
        if (trusted(event)) dirty = Boolean(value);
    });
    handle('window:close', () => {
        canClose = true;
        window.close();
    });
}

const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
    app.on('second-instance', () => {
        if (window) {
            if (window.isMinimized()) window.restore();
            window.focus();
        }
    });
    app.whenReady().then(async () => {
        app.setAppUserModelId('com.ivanferrer.magicoffice');
        settingsPath = join(app.getPath('userData'), 'ai-settings.json');
        store = new RecoveryStore(join(app.getPath('userData'), 'recovery'));
        Menu.setApplicationMenu(null);
        window = new BrowserWindow({
            width: 1460,
            height: 980,
            minWidth: 1000,
            minHeight: 700,
            title: 'Magic Office Editor',
            backgroundColor: '#f5f4f8',
            show: false,
            webPreferences: {
                preload: join(__dirname, 'preload.cjs'),
                sandbox: true,
                contextIsolation: true,
                nodeIntegration: false,
                spellcheck: true,
            },
        });
        session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) =>
            callback(false),
        );
        session.defaultSession.setPermissionCheckHandler(() => false);
        session.defaultSession.setSpellCheckerLanguages(['pt-BR', 'en-US']);
        window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        window.webContents.on('will-navigate', (event) => event.preventDefault());
        window.webContents.on('will-attach-webview', (event) => event.preventDefault());
        window.on('close', (event) => {
            if (dirty && !canClose) {
                event.preventDefault();
                window.webContents.send('window:request-close');
            } else reviewing?.abort();
        });
        registerIPC();
        const dev = !app.isPackaged && process.env.MAGIC_DEV_URL === 'http://127.0.0.1:5173';
        if (dev) await window.loadURL('http://127.0.0.1:5173');
        else await window.loadURL(pathToFileURL(join(__dirname, '../dist/index.html')).href);
        window.show();
    });
    app.on('window-all-closed', () => app.quit());
}
