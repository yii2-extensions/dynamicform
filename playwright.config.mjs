import { defineConfig } from '@playwright/test';

// Rendered acceptance pages are served by PHP. Set DYNAMICFORM_BASE_URL to use an already running server (for example
// a PHP 8.3 container); otherwise the PHP binary from PHP_BINARY (default: php) starts the built-in server.
const port = Number(process.env.DYNAMICFORM_PORT ?? 8090);
const externalBaseUrl = process.env.DYNAMICFORM_BASE_URL;
const baseUrl = (externalBaseUrl ?? `http://127.0.0.1:${port}`).replace(/\/$/, '');

const assets = {
  source: 'src/assets/yii2-dynamic-form.js',
  production: 'src/assets/yii2-dynamic-form.min.js',
};

// Plugin contracts on hand-built markup run in Vitest/jsdom (tests/js); these projects need PHP and a real browser.
const projects = ['source', 'production'].map((variant) => ({
  name: `rendered-${variant}`,
  testMatch: /rendered(-[\w-]+)?\.spec\.mjs$/,
  metadata: { variant, asset: assets[variant] },
  use: { baseURL: `${baseUrl}/${variant}/` },
}));

export default defineConfig({
  testDir: './tests/browser',
  outputDir: './runtime/playwright/test-results',
  forbidOnly: true,
  reporter: [
    ['list'],
    ['json', { outputFile: process.env.DYNAMICFORM_JSON_REPORT ?? 'runtime/playwright/report.json' }],
    ['./tests/browser/support/page-issues-reporter.mjs'],
  ],
  use: {
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects,
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `${process.env.PHP_BINARY ?? 'php'} -S 127.0.0.1:${port} tests/Support/Browser/router.php`,
        url: `${baseUrl}/source/health`,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 30_000,
      },
});
