import { Stack, Tags, Stage, aws_ssm as SSM, aws_secretsmanager as SecretsManager, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Statics } from './statics';

/**
 * Stage for creating SSM parameters. This needs to run
 * before stages that use them.
 */

export class ParameterStage extends Stage {
  constructor(scope: Construct, id: string, props: StageProps) {
    super(scope, id, props);
    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);

    new ParameterStack(this, 'params');
  }
}
/**
 * Stack that creates ssm parameters for the application.
 * These need to be present before stack that use them.
 */

export class ParameterStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);

    new ssmParamsConstruct(this, 'plain');
  }
}
/**
 * All SSM parameters needed for the application.
 * Some are created with a sensible default, others are
 * empty and need to be filled or changed via the console.
 */

export class ssmParamsConstruct extends Construct {

  constructor(scope: Construct, id: string) {
    super(scope, id);
    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);

    /**
     * authentication parameters
     */
    new SSM.StringParameter(this, 'ssm_auth_1', {
      stringValue: 'https://authenticatie-accp.nijmegen.nl',
      parameterName: Statics.ssmAuthUrlBaseParameter,
    });

    new SSM.StringParameter(this, 'ssm_auth_2', {
      stringValue: 'AawootW574MqIMRAfAgzdv8lhQYLuGY3',
      parameterName: Statics.ssmOIDCClientID,
    });

    new SSM.StringParameter(this, 'ssm_auth_3', {
      stringValue: 'openid idp_scoping:simulator idp_scoping:https://was-preprod1.digid.nl/saml/idp/metadata',
      parameterName: Statics.ssmOIDCScope,
    });

    new SSM.StringParameter(this, 'ssm_uitkering_2', {
      stringValue: '-',
      parameterName: Statics.ssmMTLSClientCert,
    });

    new SSM.StringParameter(this, 'ssm_uitkering_3', {
      stringValue: '-',
      parameterName: Statics.ssmMTLSRootCA,
    });

    new SecretsManager.Secret(this, 'secret_1', {
      secretName: Statics.secretOIDCClientSecret,
      description: 'OpenIDConnect client secret',
    });

    new SecretsManager.Secret(this, 'secret_2', {
      secretName: Statics.secretMTLSPrivateKey,
      description: 'mTLS certificate private key',
    });

    new SSM.StringParameter(this, 'ssm_brp_1', {
      stringValue: 'https://data-test.nijmegen.nl/TenT/Bevraging/Irma',
      parameterName: Statics.ssmBrpApiEndpointUrl,
    });

    new SSM.StringParameter(this, 'ssm_dns_1', {
      stringValue: '11099 13 2 D7B02BB98488B0D5AAD2509A2ADF73D69C26C9AF27D3CA5AC472A8DD6115AB08',
      parameterName: Statics.ssmNijmegenDSRecordValue,
    });

    new SSM.StringParameter(this, 'ssm_slack_1', {
      stringValue: '-',
      parameterName: Statics.ssmSlackWebhookUrl,
    });
  }
}
