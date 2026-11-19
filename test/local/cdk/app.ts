import { App } from 'aws-cdk-lib';
import { localConfig } from './localConfig';
import { LocalMijnNijmegenStack } from './LocalMijnNijmegenStack';

const app = new App();

new LocalMijnNijmegenStack(app, 'LocalMijnNijmegenStack', {
  env: { account: localConfig.account, region: localConfig.region },
});

app.synth();
