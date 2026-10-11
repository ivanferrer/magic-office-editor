import { test, expect, type Page } from '@playwright/test';

async function setup(page: Page) {
    await page.addInitScript(() => {
        const w = window as any;
        w.saved = [];
        w.magic = {
            settings: async () => ({
                provider: 'ollama',
                endpoint: 'http://127.0.0.1:11434',
                model: 'test',
            }),
            history: async () => [],
            setDirty: () => {},
            onClose: () => () => {},
            autosave: async () => {},
            newDocument: async () => {},
            save: async (doc: unknown) => {
                w.saved.push(doc);
                return 'C:\\Documentos\\teste.magic';
            },
            review: async (request: any) =>
                ({
                    suggestions: request.blocks
                        .filter((block: any) => block.text.includes('Nós vai'))
                        .map((block: any) => ({
                            blockId: block.id,
                            original: 'Nós vai',
                            replacement: 'Nós vamos',
                            reason: 'Concordância verbal.',
                        })),
                }).suggestions,
        };
    });
    await page.goto('/');
    await expect(page.getByRole('textbox', { name: 'Conteúdo do documento' })).toBeVisible();
}

async function replaceDocument(page: Page, text: string) {
    const editor = page.getByRole('textbox', { name: 'Conteúdo do documento' });
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText(text);
}

test('editor formata, salva e confirma alterações antes de abrir novo documento', async ({
    page,
}) => {
    await setup(page);
    await replaceDocument(page, 'Meu primeiro documento.');
    await page.keyboard.press('ControlOrMeta+a');
    await page.getByRole('button', { name: 'Negrito (Ctrl+B)', exact: true }).click();
    await expect(page.locator('.document-editor strong')).toContainText('Meu primeiro documento.');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    expect(await page.evaluate(() => (window as any).saved.length)).toBe(1);
    await page.getByRole('textbox', { name: 'Nome do documento' }).fill('Meu livro');
    await page.getByRole('button', { name: 'Novo documento', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Salvar antes de continuar?');
    await page.getByRole('button', { name: 'Salvar e continuar', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Nome do documento' })).toHaveValue(
        'Documento sem título',
    );
    expect(await page.evaluate(() => (window as any).saved[1].title)).toBe('Meu livro');
    await expect(
        page.getByRole('button', { name: 'Desfazer (Ctrl+Z)', exact: true }),
    ).toBeDisabled();
});

test('sugestão aceita muda apenas o trecho e pode ser desfeita', async ({ page }) => {
    await setup(page);
    await replaceDocument(page, 'Nós vai à escola. O restante fica igual.');
    await page.keyboard.press('ArrowRight');
    await page.getByRole('button', { name: 'Revisar documento', exact: true }).click();
    await expect(page.locator('.suggestion-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Aceitar', exact: true }).click();
    await expect(page.locator('.document-editor')).toContainText(
        'Nós vamos à escola. O restante fica igual.',
    );
    await page.locator('.document-editor').click();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.locator('.document-editor')).toContainText(
        'Nós vai à escola. O restante fica igual.',
    );
});

test('sugestões mantêm a posição após inserção anterior e invalidam texto modificado', async ({
    page,
}) => {
    await setup(page);
    await replaceDocument(page, 'Nós vai à escola.');
    await page.keyboard.press('ArrowRight');
    await page.getByRole('button', { name: 'Revisar documento', exact: true }).click();
    await expect(page.locator('.suggestion-card')).toHaveCount(1);
    await page.locator('.document-editor').click();
    await page.keyboard.press('ControlOrMeta+Home');
    await page.keyboard.insertText('Hoje: ');
    await page.getByRole('button', { name: 'Aceitar', exact: true }).click();
    await expect(page.locator('.document-editor')).toContainText('Hoje: Nós vamos à escola.');
    await replaceDocument(page, 'Nós vai de novo.');
    await page.keyboard.press('ArrowRight');
    await page.getByRole('button', { name: 'Revisar documento', exact: true }).click();
    await expect(page.locator('.suggestion-card')).toHaveCount(1);
    await replaceDocument(page, 'O documento mudou completamente.');
    await expect(page.locator('.suggestion-card')).toHaveCount(0);
});

test('substituição em lote é desfeita em uma única operação', async ({ page }) => {
    await setup(page);
    await replaceDocument(page, 'casa bonita, casa nova');
    await page.getByRole('button', { name: 'Localizar', exact: true }).click();
    await page.getByLabel('Localizar (diferencia maiúsculas)').fill('casa');
    await page.getByLabel('Substituir por', { exact: true }).fill('morada');
    await page.getByRole('button', { name: 'Substituir todas' }).click();
    await expect(page.locator('.document-editor')).toContainText('morada bonita, morada nova');
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.locator('.document-editor').click();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.locator('.document-editor')).toContainText('casa bonita, casa nova');
});

test('interface inicial não apresenta erros de JavaScript', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await setup(page);
    await page.screenshot({ path: 'screenshots/editor.png', fullPage: true });
    expect(errors).toEqual([]);
});
