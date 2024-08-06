import { Stack } from 'aws-cdk-lib';
import { LambdaIntegration, RestApi, ApiKey } from 'aws-cdk-lib/aws-apigateway';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { ZaakgerichtwerkenFunction } from './app/zaakgerichtwerken/zaakgerichtwerken-function';
import { Configurable, Configuration } from './Configuration';
import { Statics } from './statics';

interface ZaakAggregatorStackProps extends Configurable { }
export class ZaakAggregatorStack extends Stack {
  private configuration: Configuration;
  constructor(scope: Construct, id: string, props: ZaakAggregatorStackProps) {
    super(scope, id);
    this.configuration = props.configuration;
    const api = this.api();

    const resource = api.root.addResource('zaken');

    const zgwLambda = this.zaakgerichtwerkenLambda();
    resource.addMethod('GET', new LambdaIntegration(zgwLambda), {
      apiKeyRequired: true,
    });
  }

  private zaakgerichtwerkenLambda() {
    const jwtSecret = Secret.fromSecretNameV2(this, 'jwt-token-secret', Statics.vipJwtSecret);
    const tokenSecret = Secret.fromSecretNameV2(this, 'taken-token-secret', Statics.vipTakenSecret);
    const submissionstorageKey = Secret.fromSecretNameV2(this, 'taken-submission-secret', Statics.submissionstorageKey);
    const zgwLambda = new ZaakgerichtwerkenFunction(this, 'zgwfunction', {
      environment: {
        VIP_JWT_SECRET_ARN: jwtSecret.secretArn,
        VIP_TAKEN_SECRET_ARN: tokenSecret.secretArn,
        SUBMISSIONSTORAGE_SECRET_ARN: submissionstorageKey.secretArn,
        VIP_JWT_USER_ID: StringParameter.valueForStringParameter(this, Statics.ssmOpenZaakUserId),
        VIP_JWT_CLIENT_ID: StringParameter.valueForStringParameter(this, Statics.ssmOpenZaakClientId),
        VIP_BASE_URL: StringParameter.valueForStringParameter(this, Statics.ssmOpenZaakBaseUrl),
        VIP_TOKEN_BASE_URL: StringParameter.valueForStringParameter(this, Statics.ssmOpenZaakTakenBaseUrl),
        SUBMISSIONSTORAGE_BASE_URL: StringParameter.valueForStringParameter(this, Statics.ssmSubmissionstorageBaseUrl),
        ALLOWED_ZAKEN_DOMAINS: this.configuration.zakenAllowDomains.join(','),
      },
    });
    for (let secret of [jwtSecret, tokenSecret, submissionstorageKey]) {
      secret.grantRead(zgwLambda);
    }
    return zgwLambda;
  }

  private api() {
    const api = new RestApi(this, 'zaken', {
      description: 'API Gateway for ZaakAggregator',
    });

    const plan = api.addUsagePlan('plan', {
      description: 'internal use',
    });
    const key = new ApiKey(this, 'apikey', {
      description: 'Internal use for Mijn Nijmegen',
    });

    plan.addApiKey(key);
    plan.node.addDependency(key);
    plan.addApiStage({
      stage: api.deploymentStage,
    });
    new StringParameter(this, 'gateway-url', {
      parameterName: Statics.ssmZaakAggregatorApiGatewayEndpointUrl,
      description: 'url for the API Gateway',
      stringValue: api.deploymentStage.urlForPath(),
    });
    return api;
  }
}
