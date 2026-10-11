import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import mammoth from 'mammoth';
import { createDocument, documentSchema, textDocument } from '../src/shared/document';
import { validateSuggestions, settingsSchema, reviewText, requestSchema } from '../electron/ai';
import { atomicWrite, RecoveryStore } from '../electron/storage';
import { exportDocx } from '../electron/docx';

test('documento nativo preserva Unicode e rejeita versões desconhecidas', () => {
    const doc = textDocument('Revisão: ação, café e coração. ✨\nSegundo parágrafo.', 'Meu livro');
    assert.deepEqual(documentSchema.parse(JSON.parse(JSON.stringify(doc))), doc);
    assert.throws(() => documentSchema.parse({ ...doc, version: 2 }));
});

test('gravação atômica cria backup e não deixa temporários', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'magic-test-'));
    try {
        const path = join(directory, 'book.magic');
        await atomicWrite(path, 'primeira versão', true);
        await atomicWrite(path, 'segunda versão', true);
        assert.equal(await readFile(path, 'utf8'), 'segunda versão');
        assert.equal(await readFile(`${path}.bak`, 'utf8'), 'primeira versão');
        assert.equal((await readdir(directory)).filter((file) => file.endsWith('.tmp')).length, 0);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('recuperação mantém a versão mais recente e nunca restaura sobre o original', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'magic-recovery-'));
    try {
        const store = new RecoveryStore(directory);
        const a = textDocument('Uma frase.', 'Livro');
        const b = textDocument('Uma frase melhor.', 'Livro');
        await Promise.all([store.save(a, '/livro.magic'), store.save(b, '/livro.magic')]);
        const entries = await store.list();
        assert.equal(entries.length, 1);
        assert.deepEqual(entries[0].document.content, b.content);
        assert.equal((await store.read(entries[0].id)).path, null);
        await assert.rejects(store.read('../arquivo-secreto'));
        await writeFile(join(directory, '123-aaaa.json'), 'arquivo corrompido');
        assert.equal((await store.list()).length, 1);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('sugestões inventadas, ambíguas e sobrepostas não são aplicáveis', () => {
    const blocks = [{ id: 'b1', text: 'Nós vai à escola. Sim sim.' }];
    const suggestion = {
        blockId: 'b1',
        original: 'Nós vai',
        replacement: 'Nós vamos',
        reason: 'Concordância verbal.',
    };
    const result = validateSuggestions(
        JSON.stringify({
            suggestions: [
                suggestion,
                suggestion,
                { ...suggestion, original: 'sim', replacement: 'sim!' },
                { ...suggestion, blockId: 'inexistente' },
                { ...suggestion, original: 'não existe' },
            ],
        }),
        blocks,
    );
    assert.deepEqual(result, [suggestion, { ...suggestion, original: 'sim', replacement: 'sim!' }]);
    assert.throws(() =>
        validateSuggestions(
            JSON.stringify({ suggestions: [{ ...suggestion, original: 'x' }] }),
            blocks,
        ),
    );
    assert.throws(() => validateSuggestions('resposta sem JSON', blocks));
    assert.deepEqual(validateSuggestions('```json\n{"suggestions": []}\n```', blocks), []);
    assert.throws(() =>
        validateSuggestions(JSON.stringify({ suggestions: [{ ...suggestion, original: 'sim' }] }), [
            { id: 'b1', text: 'sim sim' },
        ]),
    );
});

test('limites de revisão e transporte de chaves são validados', () => {
    const config = {
        provider: 'compatible',
        endpoint: 'https://api.exemplo.com/v1',
        model: 'modelo',
    };
    assert.equal(settingsSchema.safeParse(config).success, true);
    for (const endpoint of [
        'http://externo.example/v1',
        'https://user:secret@exemplo.com/v1',
        'file:///etc/passwd',
        'https://exemplo.com?key=secret',
    ])
        assert.equal(settingsSchema.safeParse({ ...config, endpoint }).success, false);
    assert.equal(
        settingsSchema.safeParse({ ...config, endpoint: 'http://127.0.0.1:11434' }).success,
        true,
    );
    assert.equal(
        requestSchema.safeParse({
            mode: 'grammar',
            instructions: '',
            blocks: [{ id: 'b1', text: 'x'.repeat(18001) }],
        }).success,
        false,
    );
});

test('revisão faz a chamada real de protocolo e valida o resultado do provedor', async () => {
    let captured: any;
    const server = createServer(async (request, response) => {
        let body = '';
        for await (const chunk of request) body += chunk;
        captured = {
            path: request.url,
            auth: request.headers.authorization,
            body: JSON.parse(body),
        };
        response.setHeader('Content-Type', 'application/json');
        const content = JSON.stringify({
            suggestions: [
                {
                    blockId: 'b1',
                    original: 'Nós vai',
                    replacement: 'Nós vamos',
                    reason: 'Concordância.',
                },
            ],
        });
        response.end(
            JSON.stringify(
                request.url === '/api/chat'
                    ? { message: { content } }
                    : { choices: [{ message: { content } }] },
            ),
        );
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as any).port;
    try {
        const input = {
            blocks: [{ id: 'b1', text: 'Nós vai hoje.' }],
            mode: 'grammar' as const,
            instructions: '',
        };
        const base = `http://127.0.0.1:${port}`;
        const local = await reviewText(
            { provider: 'ollama', endpoint: base, model: 'test' },
            input,
            AbortSignal.timeout(3000),
        );
        assert.equal(captured.path, '/api/chat');
        assert.equal(captured.body.stream, false);
        assert.equal(captured.body.format, 'json');
        assert.equal(captured.auth, undefined);
        assert.equal(local[0].replacement, 'Nós vamos');
        await reviewText(
            { provider: 'compatible', endpoint: `${base}/v1`, model: 'test', apiKey: 'test-key' },
            input,
            AbortSignal.timeout(3000),
        );
        assert.equal(captured.path, '/v1/chat/completions');
        assert.equal(captured.auth, 'Bearer test-key');
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});

test('exportação DOCX produz arquivo reimportável com títulos, listas e tabelas', async () => {
    const doc = createDocument('Teste de exportação');
    doc.content = {
        type: 'doc',
        content: [
            {
                type: 'heading',
                attrs: { level: 1 },
                content: [{ type: 'text', text: 'Capítulo um' }],
            },
            {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Texto em negrito.', marks: [{ type: 'bold' }] }],
            },
            {
                type: 'orderedList',
                content: [
                    {
                        type: 'listItem',
                        content: [
                            {
                                type: 'paragraph',
                                content: [{ type: 'text', text: 'Primeiro item' }],
                            },
                        ],
                    },
                ],
            },
            {
                type: 'table',
                content: [
                    {
                        type: 'tableRow',
                        content: [
                            {
                                type: 'tableCell',
                                content: [
                                    {
                                        type: 'paragraph',
                                        content: [{ type: 'text', text: 'Célula de tabela' }],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            { type: 'pageBreak' },
            { type: 'paragraph', content: [{ type: 'text', text: 'Após a quebra.' }] },
        ],
    };
    const buffer = await exportDocx(doc);
    assert.equal(buffer.subarray(0, 2).toString(), 'PK');
    const imported = await mammoth.convertToHtml({ buffer });
    assert.match(imported.value, /<h1>Capítulo um<\/h1>/);
    assert.match(imported.value, /<strong>Texto em negrito\.<\/strong>/);
    assert.match(imported.value, /<ol>/);
    assert.match(imported.value, /<table>/);
    assert.match(imported.value, /Após a quebra/);
});
