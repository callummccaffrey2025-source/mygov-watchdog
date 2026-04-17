module.exports = {
  ci: {
    collect: {
      url: ['http://127.0.0.1:3000/','http://127.0.0.1:3000/mps'],
      startServerCommand: 'pnpm start',
      numberOfRuns: 1,
      settings: {
        chromeFlags: '--no-sandbox --disable-gpu --disable-dev-shm-usage'
      }
    },
    assert: {
      // keep assertions light for now; tighten later in PRs
      preset: 'lighthouse:recommended',
      assertions: {
        'legacy-javascript-insight': 'warn',
        'color-contrast': 'warn',
        'heading-order': 'warn',
        'network-dependency-tree-insight': 'warn',
        'unused-javascript': 'warn',
        'render-blocking-resources': 'warn',
        'render-blocking-insight': 'warn',
        'legacy-javascript': 'warn'
      }
    },
    upload: { target: 'filesystem', outputDir: '.lhci' }
  }
};
