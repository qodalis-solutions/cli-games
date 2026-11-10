// Karma runs every game's Jasmine specs in ChromeHeadless; karma-esbuild
// bundles the TypeScript (specs import the sources and @qodalis/cli-core).
//
//   pnpm test              # single run, ChromeHeadless
//   CI=1 pnpm test         # same, with --no-sandbox (GitHub runners)
module.exports = function (config) {
    config.set({
        basePath: '',
        frameworks: ['jasmine'],
        plugins: ['karma-jasmine', 'karma-chrome-launcher', 'karma-esbuild'],
        files: [{ pattern: 'packages/*/src/tests/**/*.spec.ts', watched: false }],
        preprocessors: { 'packages/*/src/tests/**/*.spec.ts': ['esbuild'] },
        esbuild: {
            tsconfig: 'tsconfig.spec.json',
            target: 'es2022',
            format: 'iife',
            sourcemap: 'inline',
            singleBundle: false,
        },
        reporters: ['progress'],
        browsers: [process.env.CI ? 'ChromeHeadlessCI' : 'ChromeHeadless'],
        customLaunchers: {
            ChromeHeadlessCI: { base: 'ChromeHeadless', flags: ['--no-sandbox'] },
        },
        singleRun: true,
        autoWatch: false,
        restartOnFileChange: false,
        colors: true,
        logLevel: config.LOG_INFO,
    });
};
