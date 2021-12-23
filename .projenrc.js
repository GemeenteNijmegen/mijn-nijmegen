const { awscdk } = require('projen');
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.3.0',
  defaultReleaseBranch: 'main',
  name: 'app2',

  deps: [
    'dotenv',
    '@aws-cdk/aws-apigatewayv2-alpha',
    '@aws-cdk/aws-apigatewayv2-integrations-alpha',
  ], /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  devDeps: [
  ], /* Build dependencies for this module. */
  // packageName: undefined,  /* The "name" in package.json. */
  // release: undefined,      /* Add release management to this project. */
  jestOptions: {
    jestConfig: {
      setupFiles: ['dotenv/config'],
    },
  },
  gitignore: [
    '.env',
    '.vscode',
  ],
});
project.synth();