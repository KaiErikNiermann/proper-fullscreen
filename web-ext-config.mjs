/* Keeps the packaged artifact to just what the browser loads: manifest, dist/, icons/. */
export default {
  build: { overwriteDest: true },
  ignoreFiles: [
    'src/**',
    'test/**',
    'docs/**',
    'node_modules/**',
    '.github/**',
    '.githooks/**',
    '.remember/**',
    'web-ext-artifacts/**',
    'build.js',
    'eslint.config.js',
    'tsconfig.json',
    'package.json',
    'pnpm-lock.yaml',
    'web-ext-config.mjs',
    '.editorconfig',
    '.gitignore',
    'README.md',
  ],
};
