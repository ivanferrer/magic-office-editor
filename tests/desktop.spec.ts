import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';

test('aplicativo Electron salva, abre, exporta PDF/DOCX e revisa por IPC', async () => {
    test.setTimeout(90000);
    const directory = await mkdtemp(join(tmpdir(), 'magic-desktop-'));
    const executablePath = process.env.MAGIC_EXECUTABLE;
    const app = await electron.launch({
        executablePath,
        args: [
            ...(executablePath ? [] : ['.']),
            ...(process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox'] : []),
            `--user-data-dir=${join(directory, 'profile')}`,
        ],
        env: { ...process.env, MAGIC_DEV_URL: '' },
    });
    let server: ReturnType<typeof createServer> | undefined;
    try {
        const page = await app.firstWindow();
        await expect(page.getByRole('textbox', { name: 'Conteúdo do documento' })).toBeVisible();
        const document = {
            format: 'magic-office' as const,
            version: 1 as const,
            title: 'Teste nativo',
            content: {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Nós vai testar o aplicativo.' }],
                    },
                ],
            },
            page: { size: 'A4' as const, margin: 25 },
            updatedAt: new Date().toISOString(),
        };
        const magicPath = join(directory, 'teste.magic');
        await app.evaluate(({ dialog }, path) => {
            dialog.showSaveDialog = (async () => ({
                canceled: false,
                filePath: path,
            })) as typeof dialog.showSaveDialog;
        }, magicPath);
        const saved = await page.evaluate((doc) => window.magic!.save(doc, true), document);
        expect(saved).toBe(magicPath);
        expect(JSON.parse(await readFile(magicPath, 'utf8')).content).toEqual(document.content);
        await app.evaluate(({ dialog }, path) => {
            dialog.showOpenDialog = (async () => ({
                canceled: false,
                filePaths: [path],
            })) as typeof dialog.showOpenDialog;
        }, magicPath);
        const opened = await page.evaluate(() => window.magic!.open());
        expect(opened?.document?.title).toBe(document.title);
        const docxPath = join(directory, 'teste.docx');
        await app.evaluate(({ dialog }, path) => {
            dialog.showSaveDialog = (async () => ({
                canceled: false,
                filePath: path,
            })) as typeof dialog.showSaveDialog;
        }, docxPath);
        await page.evaluate((doc) => window.magic!.exportDocx(doc), document);
        expect((await readFile(docxPath)).subarray(0, 2).toString()).toBe('PK');
        await app.evaluate(({ dialog }, path) => {
            dialog.showOpenDialog = (async () => ({
                canceled: false,
                filePaths: [path],
            })) as typeof dialog.showOpenDialog;
        }, docxPath);
        expect((await page.evaluate(() => window.magic!.open()))?.html).toContain(
            'Nós vai testar o aplicativo.',
        );
        const pdfPath = join(directory, 'teste.pdf');
        await app.evaluate(({ dialog }, path) => {
            dialog.showSaveDialog = (async () => ({
                canceled: false,
                filePath: path,
            })) as typeof dialog.showSaveDialog;
        }, pdfPath);
        await page.evaluate(
            (doc) => window.magic!.pdf('<h1>Exportação PDF</h1><p>Conteúdo de teste.</p>', doc),
            document,
        );
        expect((await readFile(pdfPath)).subarray(0, 4).toString()).toBe('%PDF');
        await page.evaluate((doc) => window.magic!.autosave(doc), document);
        const versions = await page.evaluate(() => window.magic!.history());
        expect(versions.some((v) => v.document.title === document.title)).toBe(true);
        server = createServer(async (request, response) => {
            for await (const _chunk of request) {
                /* drain request */
            }
            response.setHeader('Content-Type', 'application/json');
            response.end(
                JSON.stringify({
                    message: {
                        content: JSON.stringify({
                            suggestions: [
                                {
                                    blockId: 'b1',
                                    original: 'Nós vai',
                                    replacement: 'Nós vamos',
                                    reason: 'Concordância.',
                                },
                            ],
                        }),
                    },
                }),
            );
        });
        await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
        const port = (server.address() as any).port;
        await page.evaluate(
            (endpoint) =>
                window.magic!.saveSettings({ provider: 'ollama', endpoint, model: 'test' }),
            `http://127.0.0.1:${port}`,
        );
        const suggestions = await page.evaluate(() =>
            window.magic!.review({
                mode: 'grammar',
                instructions: '',
                blocks: [{ id: 'b1', text: 'Nós vai testar.' }],
            }),
        );
        expect(suggestions[0].replacement).toBe('Nós vamos');
        await expect(page.evaluate(() => typeof (window as any).require)).resolves.toBe(
            'undefined',
        );
        await page.screenshot({ path: 'screenshots/desktop.png' });
    } finally {
        server?.closeAllConnections();
        server?.close();
        await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
        await app.close().catch(() => {});
        await rm(directory, { recursive: true, force: true });
    }
});
