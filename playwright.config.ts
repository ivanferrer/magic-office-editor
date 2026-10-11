import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    testMatch: '*.spec.ts',
    fullyParallel: false,
    workers: 1,
    timeout: 30000,
    use: {
        baseURL: 'http://127.0.0.1:5173',
        viewport: { width: 1460, height: 980 },
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
    reporter: [['list'], ['html', { open: 'never' }]],
    webServer: {
        command: 'npx vite preview --host 127.0.0.1 --port 5173',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: !process.env.CI,
    },
});
