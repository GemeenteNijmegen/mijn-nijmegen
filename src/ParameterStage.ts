import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import { Aspects, aws_ssm as SSM, aws_secretsmanager as SecretsManager, Stack, Stage, StageProps, Tags } from 'aws-cdk-lib';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { Statics } from './statics';

export interface ParameterStageProps extends StageProps, Configurable { }

/**
 * Stage for creating SSM parameters. This needs to run
 * before stages that use them.
 */
export class ParameterStage extends Stage {
  constructor(scope: Construct, id: string, props: ParameterStageProps) {
    super(scope, id, props);
    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);
    Aspects.of(this).add(new PermissionsBoundaryAspect());

    new ParameterStack(this, 'params', { configuration: props.configuration });
  }
}

interface ParameterStackProps extends Configurable { };
/**
 * Stack that creates ssm parameters for the application.
 * These need to be present before stacks that use them.
 */
export class ParameterStack extends Stack {
  constructor(scope: Construct, id: string, props: ParameterStackProps) {
    super(scope, id);
    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);

    const params = new ssmParamsConstruct(this, 'plain');
    if (props.configuration.mijnProductenLive) {
      params.addProductenParameters();
    }

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
     * Application configuration
     */
    new SSM.StringParameter(this, 'ssm_config_2', {
      stringValue: 'false',
      parameterName: Statics.ssmUseYiviKvk,
      description: 'Feature flag Yivi using KVK',
    });

    /**
     * authentication parameters
     */
    this.addSignicatOidcParameters();

    new SSM.StringParameter(this, 'ssm_auth_3', {
      stringValue: 'openid',
      parameterName: Statics.ssmOIDCScope,
    });

    new SSM.StringParameter(this, 'ssm_auth_4', {
      stringValue: 'idp_scoping:digid',
      parameterName: Statics.ssmDIGIDScope,
    });

    new SSM.StringParameter(this, 'ssm_auth_5', {
      stringValue: 'idp_scoping:yivi',
      parameterName: Statics.ssmYiviScope,
    });

    new SSM.StringParameter(this, 'ssm_auth_6', {
      stringValue: 'pbdf.gemeente.personalData.bsn',
      parameterName: Statics.ssmYiviBsnAttribute,
      description: 'Yivi bsn attribute to obtain from claims',
    });

    new SSM.StringParameter(this, 'ssm_auth_7', {
      stringValue: 'pbdf.signicat.kvkTradeRegister.kvkNumber',
      parameterName: Statics.ssmYiviKvkNumberAttribute,
      description: 'Yivi kvk number attribute to obtain from claims',
    });

    new SSM.StringParameter(this, 'ssm_auth_10', {
      stringValue: 'pbdf.signicat.kvkTradeRegister.name',
      parameterName: Statics.ssmYiviKvkNameAttribute,
      description: 'Yivi kvk name attribute to obtain from claims',
    });

    new SSM.StringParameter(this, 'ssm_auth_8', {
      stringValue: '-',
      parameterName: Statics.ssmYiviCondisconScope,
      description: 'Conditional disclosure scope for Yivi',
    });

    new SSM.StringParameter(this, 'ssm_auth_9', {
      stringValue: 'eherkenning',
      parameterName: Statics.ssmEherkenningScope,
      description: 'OIDC scope for eherkenning',
    });

    new SSM.StringParameter(this, 'ssm_uitkering_2', {
      stringValue: '-',
      parameterName: Statics.ssmMTLSClientCert,
    });

    new SSM.StringParameter(this, 'ssm_uitkering_3', {
      stringValue: '-',
      parameterName: Statics.ssmMTLSRootCA,
    });

    new SSM.StringParameter(this, 'ssm_uitkering_4', {
      stringValue: 'https://data-test.nijmegen.nl/mijnNijmegenData',
      parameterName: Statics.ssmUitkeringsApiEndpointUrl,
    });

    new SecretsManager.Secret(this, 'secret_2', {
      secretName: Statics.secretMTLSPrivateKey,
      description: 'mTLS certificate private key',
    });

    this.addZaakParameters();
    this.addOpenKlantParameters();
    this.addNotifyParameters();
    this.addHaalCentraalParameters();
  }

  private addZaakParameters() {
    new SSM.StringParameter(this, 'ssm_zaken_1', {
      stringValue: '-',
      parameterName: Statics.ssmOpenZaakUserId,
    });

    new SSM.StringParameter(this, 'ssm_zaken_2', {
      stringValue: '-',
      parameterName: Statics.ssmOpenZaakBaseUrl,
    });

    new SSM.StringParameter(this, 'ssm_zaken_3', {
      stringValue: '-',
      parameterName: Statics.ssmOpenZaakClientId,
    });

    new SSM.StringParameter(this, 'ssm_zaken_4', {
      stringValue: '-',
      parameterName: Statics.ssmOpenZaakTakenBaseUrl,
    });

    new SSM.StringParameter(this, 'ssm_zaken_5', {
      stringValue: '-',
      parameterName: Statics.ssmSubmissionstorageBaseUrl,
    });

    new SSM.StringParameter(this, 'ssm_zaken_6', {
      stringValue: '-',
      parameterName: Statics.ssmZaakAggregatorApiGatewayEndpointUrl,
    });

    new SecretsManager.Secret(this, 'zaken_secret_1', {
      secretName: Statics.vipJwtSecret,
      description: 'VIP Taken token secret',
    });

    new SecretsManager.Secret(this, 'zaken_secret_2', {
      secretName: Statics.vipTakenSecret,
      description: 'VIP Taken token secret',
    });

    new SecretsManager.Secret(this, 'zaken_secret_3', {
      secretName: Statics.submissionstorageKey,
      description: 'Submission storage API key',
    });

    new SecretsManager.Secret(this, 'zaakaggregator-api-key', {
      secretName: Statics.zaakAggregatorApiGatewayApiKey,
      description: 'Api key zaakaggregator',
    });

  }


  addOpenKlantParameters() {
    new SecretsManager.Secret(this, 'openklant-api-key', {
      secretName: Statics.ssmOpenKlantSecret,
      description: 'OpenKlant API key',
    });
    new StringParameter(this, 'openklant-api-endpiont', {
      parameterName: Statics.ssmOpenKlantEndpoint,
      description: 'OpenKlant API endpoint',
      stringValue: '-',
    });
  }


  addNotifyParameters() {
    new SecretsManager.Secret(this, 'notify-api-key', {
      secretName: Statics.ssmNotifySecret,
      description: 'NotifyNL API key',
    });

  }

  addHaalCentraalParameters() {

    new StringParameter(this, 'haal-centraal-cert', {
      parameterName: Statics.ssmHaalCentraalCert,
      description: 'HaalCentraal - cert',
      stringValue: '-',
    });

    new StringParameter(this, 'haal-centraal-base-url', {
      parameterName: Statics.ssmHaalCentraalBaseUrl,
      description: 'HaalCentraal - base url',
      stringValue: '-',
    });

    new SecretsManager.Secret(this, 'haal-centraal-private-key', {
      secretName: Statics.ssmHaalCentraalPrivateKey,
      description: 'HaalCentraal - Mtls private key',
    });

    new SecretsManager.Secret(this, 'haal-centraal-api-key', {
      secretName: Statics.ssmHaalCentraalApiKey,
      description: 'HaalCentraal - API key',
    });

  }

  addProductenParameters() {
    new StringParameter(this, 'producten-base-url', {
      parameterName: Statics.ssmProductenArcBaseUrl,
      description: 'Demo ARC producten - base url',
      stringValue: '-',
    });
    new SecretsManager.Secret(this, 'producten-token', {
      secretName: Statics.ssmProductenArcApiKey,
      description: 'Demo ARC producten - token',
    });
  }


  addSignicatOidcParameters() {
    new StringParameter(this, 'oidc-client-id', {
      parameterName: Statics._OIDCClientID,
      description: 'Mijn-Nijmegen OIDC Config - Client ID',
      stringValue: '-',
    });
    new Secret(this, 'oidc-client-secret', {
      secretName: Statics._OIDCClientSecret,
      description: 'Mijn-Nijmegen OIDC Config - Client Secret',
    });
    new StringParameter(this, 'oidc-redirect-url', {
      parameterName: Statics._OIDCClientRedirectUrl,
      description: 'Mijn-Nijmegen OIDC Config - Redirect URL back to mijn.nijmegen.nl',
      stringValue: '-',
    });
    new StringParameter(this, 'oidc-well-known', {
      parameterName: Statics._OIDCClientWellKnown,
      description: 'Mijn-Nijmegen OIDC Config - Well known URL of our IdP',
      stringValue: '-',
    });
  }
}
