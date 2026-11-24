// Testes end-to-end da aplicação Electron (Playwright).
module.exports = {
  testDir: './tests',
  timeout: 90000,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: { trace: 'off' }
};
