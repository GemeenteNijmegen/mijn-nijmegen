const { GemeenteNijmegenCdkApp } = require('@gemeentenijmegen/projen-project-type');
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
  deps: [
    '@aws-lambda-powertools/logger',
    '@aws-sdk/client-dynamodb',
    '@aws-sdk/client-secrets-manager',
    '@gemeentenijmegen/projen-project-type',
    '@gemeentenijmegen/aws-constructs',
    '@gemeentenijmegen/apiclient',
    '@gemeentenijmegen/apigateway-http',
    '@gemeentenijmegen/session',
    '@gemeentenijmegen/cross-region-parameteres',
    '@gemeentenijmegen/utils',
    'dotenv',
    '@aws-sdk/client-secrets-manager',
    '@aws-solutions-constructs/aws-lambda-dynamodb',
    'openid-client',
    'mustache',
    '@types/mustache',
    'axios',
    'cookie',
    'openid-client',
    'object-mapper',
    'xml2js',
    'jsonwebtoken',
    'zod',
    'validator',
    'content-disposition',
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
    '@gemeentenijmegen/components-css',
    '@utrecht/document-css@1.5.0',
    '@utrecht/button-css@2.3.0',
    '@utrecht/paragraph-css@2.3.1',
  ], /* Build dependencies for this module. */
  mutableBuild: true,
  jestOptions: {
    jestConfig: {
      setupFiles: ['dotenv/config'],
      moduleFileExtensions: [
        'js', 'json', 'jsx', 'ts', 'tsx', 'node', 'mustache',
      ],
      transform: {
        '\\.[jt]sx?$': 'ts-jest',
        '^.+\\.mustache$': '@glen/jest-raw-loader',
      },
      testPathIgnorePatterns: ['/node_modules/', '/cdk.out', '/test/playwright'],
      roots: ['src', 'test'],
    },
  },
  eslintOptions: {
    devdirs: ['src/**/tests', '/test', '/build-tools'],
  },
  bundlerOptions: {
    loaders: {
      mustache: 'text',
    },
  },
  gitignore: [
    'src/app/**/tests/output',
    'test/playwright/report',
    'test/playwright/screenshots',
    'src/app/static-resources/static/styles/ds.*',
  ],
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
    '--sourcemap',
  ].join(' '),
  description: 'Bundle css from DS',
});
project.compileTask.spawn(cssBundleTask);

project.synth();
