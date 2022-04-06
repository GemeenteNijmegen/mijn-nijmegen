const { awscdk } = require('projen');
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.17.0',
  cdkVersionPinning: true,
  defaultReleaseBranch: 'main',
  name: 'mijnnijmegen',
  deps: [
    'dotenv',
    '@aws-cdk/aws-apigatewayv2-alpha',
    '@aws-cdk/aws-apigatewayv2-integrations-alpha',
    '@aws-solutions-constructs/aws-lambda-dynamodb@2.0.0',
    'cdk-remote-stack',
  ], /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  devDeps: [
    'copyfiles',
  ], /* Build dependencies for this module. */
  depsUpgradeOptions: {
    workflowOptions: {
      branches: ['acceptance'],
    },
  },
  // packageName: undefined,  /* The "name" in package.json. */
  // release: undefined,      /* Add release management to this project. */
  mutableBuild: true,
  jestOptions: {
    jestConfig: {
      setupFiles: ['dotenv/config'],
      testPathIgnorePatterns: ['/node_modules/', '/cdk.out'],
      roots: ['src', 'test'],
    },
  },
  scripts: {
    'install:login': 'copyfiles -f src/shared/*.js src/app/login/shared && cd src/app/login && npm install',
    'install:auth': 'copyfiles -f src/shared/*.js src/app/auth/shared && cd src/app/auth && npm install',
    'install:home': 'copyfiles -f src/shared/*.js src/app/home/shared && cd src/app/home && npm install',
    'install:logout': 'copyfiles -f src/shared/*.js src/app/logout/shared && cd src/app/logout && npm install',
    'postinstall': 'npm run install:login && npm run install:auth && npm run install:home && npm run install:logout',
  },
  eslintOptions: {
    devdirs: ['src/app/login/tests', 'src/app/auth/tests', 'src/app/home/tests', 'src/app/uitkeringen/tests', 'src/app/logout/tests', '/test', '/build-tools'],
  },
  gitignore: [
    '.env',
    '.vscode',
    'src/app/**/shared',
    '.DS_Store',
  ],
});
project.synth();