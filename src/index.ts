import { App } from 'aws-cdk-lib';
import { getBranchToBuild, getConfiguration } from './Configuration';
import { PipelineStack } from './PipelineStack';
import { Statics } from './Statics';

const branchToBuild = getBranchToBuild('acceptance');
const configuration = getConfiguration(branchToBuild);
console.info('Building branch:', branchToBuild);

// TODO replace old main file with this file!

const app = new App();

const stackName = `${Statics.projectName}-pipeline-${configuration.branchName}`;
new PipelineStack(app, stackName, {
  env: configuration.buildEnvironment,
  configuration: configuration,
});

app.synth();