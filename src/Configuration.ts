import { Statics } from './statics';

/**
 * Adds a configuration field to another interface
 */
export interface Configurable {
  configuration: Configuration;
}

/**
 * Environment object (required fields)
 */
export interface Environment {
  account: string;
  region: string;
}

/**
 * Basic configuration options per environment
 */
export interface Configuration {
  /**
   * Branch name for the applicible branch (this branch)
   */
  branch: string;

  /**
   * The pipeline will run from this environment
   *
   * Use this environment for your initial manual deploy
   */
  buildEnvironment: Environment;

  /**
   * Environment to deploy the application to
   *
   * The pipeline (which usually runs in the build account) will
   * deploy the application to this environment. This is usually
   * the workload AWS account in our default region.
   */
  deploymentEnvironment: Environment;

  /**
   * CNAME records to deploy to the hosted zone
   *
   * This will deploy the provided CNAME records to
   * the project DNS zone (in Route53)
   */
  cnameRecords?: { [key: string]: string };

  /**
   * A DS record (value) to deploy in the hosted zone
   *
   * This will deploy the provided DS record to
   * the account root DNS zone (in Route53), to provide
   * DNSSEC key chaining.
   */
  dsRecord?: string;

  /**
   * The CDK name of the pipeline stack (can be removed after
   * moving to new lz)
   */
  pipelineStackCdkName: string;
  pipelineName: string;

  /**
   * Feature flag: if this is not true, the lambda will
   * return 404.
   */
  readonly zakenIsLive?: boolean;

  /**
   * Feature flag: if this is falsey, the lambda will
   * not show the survey CTA.
   */
  readonly showSurveyCTA?: boolean;

  /**
   * Feature flag: The taken functionality is experimental
   * If this flag is not true, the taken-functionality will
   * always exit immediately.
   */
  readonly zakenUseTaken?: boolean;

  /**
   * Feature flag: The submissions functionality is experimental
   * If this flag is not true, the submissions-functionality will
   * not be called.
   */
  readonly zakenUseSubmissions?: boolean;

  /**
   * Allow zaken from these 'domains'. These values are added to
   * a call to `Zaken.allowDomains` which checks the 'zaakType'
   * for each zaak for its 'domein', and only shows zaken
   * from the allowed list.
   */
  readonly zakenAllowDomains: string[];

  /**
   * Enable PoC authentication service adding a configuration for it
   * Note requires configuration of the client secret through secretmanaget
   * @default - no authenticaiton service
   */
  readonly authenticationServiceConfiguration?: {
    endpoint: string;
    clientId: string;
  };
}


const EnvironmentConfigurations: {[key:string]: Configuration} = {
  acceptance: {
    branch: 'acceptance',
    buildEnvironment: Statics.gnBuildEnvironment,
    deploymentEnvironment: Statics.gnMijnNijmegenAccpEnvironment,
    cnameRecords: {
      _554c359f26fbc43f02d85e43dccd6336: '_430b5afffdedea75381eaec545e8189c.vrcmzfbvtx.acm-validations.aws.',
    },
    dsRecord: '3766 13 2 11761745E09473E6CE95DB798CF1ADB69B4433E73EEFC9F7FE341561966EA154',
    pipelineStackCdkName: 'mijnnijmegen-pipeline-acceptance',
    pipelineName: 'mijnnijmegen-acceptance',
    zakenUseTaken: true,
    zakenIsLive: true,
    zakenUseSubmissions: true,
    zakenAllowDomains: ['APV', 'JZ'],
    showSurveyCTA: true,
    // authenticationServiceConfiguration: {
    //   clientId: '0588239d-3fb8-42af-9f0a-96cbfe199a8e',
    //   endpoint: 'https://auth-service.sandbox-01.csp-nijmegen.nl/oauth/token',
    // },
  },
  production: {
    branch: 'production',
    buildEnvironment: Statics.gnBuildEnvironment,
    deploymentEnvironment: Statics.gnMijnNijmegenProdEnvironment,
    cnameRecords: {
      _abe87d0d7f8458c5f75c5d1e0bf6efdb: '_0d3e717e52354c47bf6b0c16612b709d.jzckvmdcqj.acm-validations.aws.',
    },
    dsRecord: '40951 13 2 1EFF20C0264CD1FDE6C7C858398BC2141768CC014A7BB27997F323076B7C47ED',
    pipelineStackCdkName: 'mijnnijmegen-pipeline-production',
    pipelineName: 'mijnnijmegen-production',
    zakenUseTaken: false,
    zakenIsLive: true,
    zakenUseSubmissions: true,
    zakenAllowDomains: ['APV'], // JZ is not yet available in prod
    showSurveyCTA: true,
  },
};

/**
 * Retrieve a configuration object by passing a branch string
 *
 * **NB**: This retrieves the subobject with key `branchName`, not
 * the subobject containing the `branchName` as the value of the `branch` key
 *
 * @param branchName the branch for which to retrieve the environment
 * @returns the configuration object for this branch
 */
export function getEnvironmentConfiguration(branchName: string): Configuration {
  const conf = EnvironmentConfigurations[branchName];
  if (!conf) {
    throw Error(`No configuration found for branch ${branchName}`);
  }
  return conf;
}
