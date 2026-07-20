import { GemeenteNijmegenCdkApp } from '@gemeentenijmegen/projen-project-type';
import { Transform, TypeScriptModuleResolution } from 'projen/lib/javascript';

const project = new GemeenteNijmegenCdkApp({
  cdkVersion: '2.22.0',
  defaultReleaseBranch: 'production',
  majorVersion: 1,
  name: 'mijnnijmegen',
  depsUpgradeOptions: {
    workflowOptions: {
      branches: ['development'],
      labels: ['auto-merge'],
    },
  },
  projenrcTs: true,
  deps: [
    '@aws-lambda-powertools/logger',
    '@aws-sdk/client-dynamodb',
    '@aws-sdk/client-secrets-manager',
    '@gemeentenijmegen/projen-project-type',
    '@gemeentenijmegen/aws-constructs',
    '@gemeentenijmegen/apiclient',
    '@gemeentenijmegen/apigateway-http',
    '@gemeentenijmegen/session',
    '@gemeentenijmegen/cross-region-parameters',
    '@gemeentenijmegen/utils',
    'dotenv',
    '@aws-sdk/client-secrets-manager',
    '@aws-solutions-constructs/aws-lambda-dynamodb',
    'openid-client',
    'mustache',
    '@types/mustache',
    'axios',
    'cookie',
    'object-mapper',
    'xml2js',
    'jsonwebtoken',
    'zod',
    'validator',
    'content-disposition',
    'chokidar',
  ], /* Runtime dependencies of this module. */
  devDeps: [
    '@types/validator',
    '@types/content-disposition',
    '@types/aws-lambda',
    '@aws-sdk/types',
    '@aws-sdk/client-ssm',
    'aws-sdk-client-mock',
    'axios-mock-adapter',
    'copyfiles',
    '@playwright/test',
    '@playwright/test',
    'aws-sdk-client-mock',
    '@glen/jest-raw-loader',
    'jest-aws-client-mock',
    'esbuild',
    '@gemeentenijmegen/design-tokens',
    '@gemeentenijmegen/layout-css',
    '@gemeentenijmegen/components-css',
    '@gemeentenijmegen/semantic-html',
    '@gemeentenijmegen/font',
    '@gemeentenijmegen/web-components',
    '@utrecht/document-css@1.5.0',
    '@utrecht/button-css@2.3.0',
    '@utrecht/button-group-css@1.4.0',
    '@utrecht/paragraph-css@2.3.1',
    '@utrecht/heading-1-css@1.5.0',
    '@utrecht/heading-2-css@1.5.0',
    '@utrecht/heading-3-css@1.5.0',
    '@utrecht/heading-4-css@1.5.0',
    '@utrecht/heading-5-css@1.5.0',
    '@utrecht/heading-6-css@1.5.0',
    '@utrecht/page-body-css',
    '@utrecht/rich-text-css',
    '@utrecht/pre-heading-css',
    '@utrecht/link-css@1.6.0',
    '@utrecht/form-field-css@3.0.1',
    '@utrecht/form-label-css@3.0.1',
    '@utrecht/textbox-css@4.0.1',
    '@utrecht/form-field-description-css@3.0.1',
    '@utrecht/form-field-error-message-css@3.0.1',
  ], /* Build dependencies for this module. */
  jestOptions: {
    jestConfig: {
      setupFiles: ['dotenv/config'],
      moduleFileExtensions: [
        'js', 'json', 'jsx', 'ts', 'tsx', 'node', 'mustache',
      ],
      transform: {
        '\\.[jt]sx?$': new Transform('ts-jest', {
          isolatedModules: true,
        }),
        '^.+\\.mustache$': new Transform('@glen/jest-raw-loader'),
      },
      transformIgnorePatterns: [
        'node_modules/(?!(openid-client)/)',
      ],
      testPathIgnorePatterns: ['/node_modules/', '/cdk.out', '/test/playwright'],
      roots: ['src', 'test'],
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
    },
  },
  eslintOptions: {
    dirs: ['src'],
    devdirs: ['src/**/tests', '/test', '/build-tools'],
  },
  bundlerOptions: {
    loaders: {
      mustache: 'text',
    },
  },
  tsconfig: {
    compilerOptions: {
      isolatedModules: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    },
  },
  tsconfigDev: {
    compilerOptions: {
      module: 'CommonJS',
      moduleResolution: TypeScriptModuleResolution.NODE,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    },
  },
  gitignore: [
    'src/app/**/tests/output',
    'test/playwright/report',
    'test/playwright/screenshots',
    'src/app/static-resources/static/styles/ds.*',
    'src/app/static-resources/static/styles/*.woff2',
    'src/app/static-resources/static/styles/*.woff',
    'src/app/static-resources/static/styles/*.ttf',
    'src/app/static-resources/static/js/web-components/',
    '/preview/',
  ],
});

const previewCmd = 'ts-node -P tsconfig.json --transpile-only -r ./src/preview/mustache-register.js';

project.addTask('preview', {
  exec: `${previewCmd} ./src/preview/render-previews.ts`,
  description: 'Render preview HTML for all pages once',
});

project.addTask('preview:watch', {
  exec: `${previewCmd} ./src/preview/watch.ts`,
  description: 'Watch templates and re-render preview HTML on changes',
});

const cssBundleTask = project.addTask('bundle:css-bundle', {
  exec: [
    'esbuild ./src/app/static-resources/static/styles/ds-input.js',
    '--bundle',
    '--target=node22',
    '--platform=node',
    '--outfile=./src/app/static-resources/static/styles/ds.js',
    '--loader:.css=css',
    '--loader:.mustache=text',
    '--loader:.woff2=file',
    '--loader:.woff=file',
    '--loader:.ttf=file',
    '--asset-names=[name]',
    '--sourcemap',
  ].join(' '),
  description: 'Bundle css from DS',
});
project.compileTask.spawn(cssBundleTask);

const copyWcTask = project.addTask('bundle:copy-web-components', {
  description: 'Copy prebuilt NLDS web component IIFE bundles to static/js/web-components/',
  steps: [
    { exec: 'mkdir -p src/app/static-resources/static/js/web-components' },
    { exec: 'cp node_modules/@gemeentenijmegen/web-components/dist/nijmegen-header.js src/app/static-resources/static/js/web-components/' },
    { exec: 'cp node_modules/@gemeentenijmegen/web-components/dist/nijmegen-mobile-menu.js src/app/static-resources/static/js/web-components/' },
    { exec: 'cp node_modules/@gemeentenijmegen/web-components/dist/nijmegen-toolbar-button.js src/app/static-resources/static/js/web-components/' },
  ],
});
project.compileTask.spawn(copyWcTask);


project.synth();
