import { App, Stack, StackProps, Tags, aws_dynamodb as DynamoDB, pipelines, Stage, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Statics } from './statics';

export interface PipelineStackProps extends StackProps{
  branchName: string;
}

class PipelineStack extends Stack {
  branchName: string;
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);
    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);
    this.branchName = props.branchName;
    const pipeline = this.pipeline();
    pipeline.addStage(new SessionsStage(this, 'sessions'));
  }

  pipeline(): pipelines.CodePipeline {
    if (!('CONNECTION_ARN' in process.env)) {
      throw new Error('No CodeStar connection ARN provided');
    }
    const connection: string = process.env.CONNECTION_ARN!;
    const source = pipelines.CodePipelineSource.connection('GemeenteNijmegen/mijnuitkering', this.branchName, {
      connectionArn: connection,
    });
    const pipeline = new pipelines.CodePipeline(this, 'pipeline', {
      pipelineName: 'mijn-uitkering',
      dockerEnabledForSelfMutation: true,
      dockerEnabledForSynth: true,
      crossAccountKeys: true,
      synth: new pipelines.ShellStep('Synth', {
        input: source,
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
  constructor(scope: Construct, id: string) {
    super(scope, id);
    new SessionsStack(this, 'stack');
  }
}

export class SessionsTable extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    new DynamoDB.Table(this, 'sessions', {
      partitionKey: { name: 'sessionid', type: DynamoDB.AttributeType.STRING },
      billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
      // encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      // encryptionKey: kmsKeyDynamodbFormSubmissions,
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

// for development, use sandbox account
const sandboxEnvironment = {
  account: '122467643252',
  region: 'eu-west-1',
};

const app = new App();


if ('BRANCH_NAME' in process.env == false) {
  new PipelineStackDevelopment(app, 'mijnuitkering-pipeline-development',
    {
      env: sandboxEnvironment,
      branchName: 'development',
    },
  );
}

app.synth();