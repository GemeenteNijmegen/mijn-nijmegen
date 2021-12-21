import { App, Stack, StackProps, aws_dynamodb as DynamoDB } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface PipelineStackProps extends StackProps{
  branchName: string;
}

export class PipelineStackDevelopment extends Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    // define resources here...
    new DynamoDB.Table(this, 'sessions', {
      partitionKey: { name: 'sessionid', type: DynamoDB.AttributeType.STRING }
  });
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