import { Effect, ManagedPolicy, PolicyProps, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface LambdaReadOnlyPolicyProps extends PolicyProps {
  functionArn: string;
  logGroupArn: string;
}

export class LambdaReadOnlyPolicy extends ManagedPolicy {
  /**
     * Policy that allows read-only access to a lambda,
     * and the log group associated with the function.
     * @param scope
     * @param id
     * @param props
     */
  constructor(scope: Construct, id: string, props: LambdaReadOnlyPolicyProps) {
    super(scope, id, props);

    this.addStatements(new PolicyStatement(
      {
        effect: Effect.ALLOW,
        actions: [
          'lambda:List*',
          'lambda:GetAccountSettings',
        ],
        resources: ['*'],
      },
    ));

    this.addStatements(new PolicyStatement(
      {
        effect: Effect.ALLOW,
        actions: [
          'lambda:Get*',
        ],
        resources: [props.functionArn],
      },
    ));

    this.addStatements(new PolicyStatement(
      {
        effect: Effect.ALLOW,
        actions: [
          'logs:Describe*',
          'logs:Get*',
          'logs:List*',
          'logs:StartQuery',
          'logs:StopQuery',
          'logs:TestMetricFilter',
          'logs:FilterLogEvents',
        ],
        resources: [props.logGroupArn],
      },
    ));

    this.addStatements(new PolicyStatement(
      {
        effect: Effect.ALLOW,
        actions: [
          'logs:Describe*',
          'logs:List*',
        ],
        resources: ['*'],
      },
    ));
  }
}