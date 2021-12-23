import { App, Stack, StackProps, Tags, aws_dynamodb as DynamoDB, pipelines, Stage, RemovalPolicy, Environment, CfnParameter } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as Dotenv from 'dotenv';
import { Statics } from './statics';

export interface PipelineStackProps extends StackProps{
  branchName: string;
  deployToEnvironment: Environment;
}

class PipelineStack extends Stack {
  branchName: string;
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);
    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);
    this.branchName = props.branchName;
    const pipeline = this.pipeline();
    pipeline.addStage(new SessionsStage(this, 'sessions', { env: props.deployToEnvironment }));
  }

  pipeline(): pipelines.CodePipeline {
    const connectionArn = new CfnParameter(this, 'connectionArn');
    const source = pipelines.CodePipelineSource.connection('GemeenteNijmegen/mijn-uitkering', this.branchName, {
      connectionArn: connectionArn.valueAsString,
    });
    const pipeline = new pipelines.CodePipeline(this, 'mijnuitkering', {
      pipelineName: 'mijn-uitkering',
      dockerEnabledForSelfMutation: true,
      dockerEnabledForSynth: true,
      crossAccountKeys: true,
      synth: new pipelines.ShellStep('Synth', {
        input: source,
        env: {
          BRANCH_NAME: this.branchName,
        },
        commands: [
          'yarn install --frozen-lockfile', //nodig om projen geinstalleerd te krijgen
          'npx projen build',
          'npx projen synth',
        ],
      }),
    });
    return pipeline;
  }
}

class SessionsStage extends Stage {
  constructor(scope: Construct, id: string, props: {}) {
    super(scope, id, props);
    new SessionsStack(this, 'sessions-stack');
  }
}

export class SessionsTable extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    new DynamoDB.Table(this, 'sessions-table', {
      partitionKey: { name: 'sessionid', type: DynamoDB.AttributeType.STRING },
      billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
      tableName: 'mijnuitkering-sessions',
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }
}

/**
 * For session storage a sessions-table is created in dynamoDB. Session
 * state is maintained by relating an opaque session cookie value to this table.
 */
export class SessionsStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    new SessionsTable(this, 'sessions-table');
  }
}

export class PipelineStackDevelopment extends PipelineStack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

  }
}

export class PipelineStackAcceptance extends PipelineStack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

  }
}

// for development, use sandbox account
const deploymentEnvironment = {
  account: '418648875085',
  region: 'eu-west-1',
};

const sandboxEnvironment = {
  account: '122467643252',
  region: 'eu-west-1',
};

const acceptanceEnvironment = {
  account: '315037222840',
  region: 'eu-west-1',
};

Dotenv.config();
const app = new App();


if ('BRANCH_NAME' in process.env == false || process.env.BRANCH_NAME == 'development') {
  new PipelineStackDevelopment(app, 'mijnuitkering-pipeline-development',
    {
      env: deploymentEnvironment,
      branchName: 'development',
      deployToEnvironment: sandboxEnvironment,
    },
  );
} else if (process.env.BRANCH_NAME == 'acceptance') {
  new PipelineStackAcceptance(app, 'mijnuitkering-pipeline-acceptance',
    {
      env: deploymentEnvironment,
      branchName: 'acceptance',
      deployToEnvironment: acceptanceEnvironment,
    },
  );
}

app.synth();