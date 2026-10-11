import { mkdir, readFile, writeFile, rename, readdir, unlink, copyFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { documentSchema } from '../src/shared/document';
import type { MagicDocument, Recovery } from '../src/shared/types';

export async function atomicWrite(
    path: string,
    data: string | Uint8Array,
    backup = false,
): Promise<void> {
    const temp = `${path}.${randomUUID()}.tmp`;
    try {
        await writeFile(temp, data, { flag: 'wx' });
        if (backup) {
            try {
                await copyFile(path, `${path}.bak`);
            } catch (error: any) {
                if (error.code !== 'ENOENT') throw error;
            }
        }
        await rename(temp, path);
    } finally {
        await unlink(temp).catch(() => {});
    }
}

export class RecoveryStore {
    private slot = '';
    private previous = '';
    private lastRotation = 0;
    private queue = Promise.resolve();
    constructor(private readonly directory: string) {}

    reset(): void {
        this.slot = '';
        this.previous = '';
        this.lastRotation = 0;
    }

    save(document: MagicDocument, path: string | null): Promise<void> {
        const operation = this.queue.then(async () => {
            const parsed = documentSchema.parse(document);
            const fingerprint = JSON.stringify({ ...parsed, updatedAt: '', path });
            if (fingerprint === this.previous) return;
            await mkdir(this.directory, { recursive: true });
            if (!this.slot || Date.now() - this.lastRotation > 30000) {
                this.slot = `${Date.now()}-${randomUUID()}.json`;
                this.lastRotation = Date.now();
            }
            const entry: Recovery = { id: this.slot, document: parsed, path };
            await atomicWrite(join(this.directory, this.slot), JSON.stringify(entry));
            this.previous = fingerprint;
            const files = (await readdir(this.directory))
                .filter((f) => /^\d+-[\da-f-]+\.json$/.test(f))
                .sort()
                .reverse();
            await Promise.all(files.slice(60).map((f) => unlink(join(this.directory, f))));
        });
        this.queue = operation.catch(() => {});
        return operation;
    }

    async list(): Promise<Recovery[]> {
        await this.queue;
        await mkdir(this.directory, { recursive: true });
        const files = (await readdir(this.directory))
            .filter((f) => /^\d+-[\da-f-]+\.json$/.test(f))
            .sort()
            .reverse();
        const entries = await Promise.all(
            files.slice(0, 60).map((f) => this.read(f).catch(() => null)),
        );
        return entries.filter((r): r is Recovery => Boolean(r));
    }

    async read(id: string): Promise<Recovery> {
        if (basename(id) !== id || !/^\d+-[\da-f-]+\.json$/.test(id))
            throw new Error('Versão inválida.');
        const value = JSON.parse(await readFile(join(this.directory, id), 'utf8'));
        return { id, path: null, document: documentSchema.parse(value.document) };
    }
}
