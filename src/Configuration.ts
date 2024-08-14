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
   * Feature flag: if this is not true, the lamba will
   * use the old (layer7) BRP api.
   */
  readonly brpHaalCentraalIsLive?: boolean;

  /**
   * Feature flag: if this is not true, the lambda will
   * return 404.
   */
  readonly zakenIsLive?: boolean;

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
   * Set this to true if you want the verwerkingenlogging inzage-page to be created
   */
  readonly inzageLive?: boolean;

  /**
   * Enable PoC authentication service adding a configuration for it
   * Note requires configuration of the client secret through secretmanaget
   * @default - no authenticaiton service
   */
  readonly authenticationServiceConfiguration?: {
    endpoint: string;
    clientId: string;
  };

  /**
   * If set, the internal ZGW-connection code is not used, instead we fetch results
   * from the 'zaakaggregator' API. This is a feature flag to allow for development
   * of the zaakaggregator in parallel to existing functionality.
   */
  readonly useZakenFromAggregatorAPI?: boolean;
}


const EnvironmentConfigurations: {[key:string]: Configuration} = {
  development: {
    branch: 'development',
    buildEnvironment: Statics.gnBuildEnvironment,
    deploymentEnvironment: Statics.gnMijnNijmegenDevEnvironment,
    cnameRecords: {
      _e4ff6e8ae7bc7524819aa925e2cae281: '_0d5a2be7528f49daefc4b67ec7f31f85.sdgjtdhdhz.acm-validations.aws.',
    },
    dsRecord: '1092 13 2 1F367460EB372760AA306E8BA29C64AD04BCA7AB515E30CA99FE710A1484A0FE',
    pipelineStackCdkName: 'mijnnijmegen-pipeline-development',
    pipelineName: 'mijnnijmegen-development',
    brpHaalCentraalIsLive: true,
    zakenUseTaken: true,
    zakenIsLive: true,
    zakenUseSubmissions: true,
    // authenticationServiceConfiguration: {
    //   clientId: '0588239d-3fb8-42af-9f0a-96cbfe199a8e',
    //   endpoint: 'https://auth-service.sandbox-01.csp-nijmegen.nl/oauth/token',
    // },
    inzageLive: true,
    useZakenFromAggregatorAPI: true,
  },
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
    brpHaalCentraalIsLive: true,
    zakenUseTaken: true,
    zakenIsLive: true,
    zakenUseSubmissions: true,
    // authenticationServiceConfiguration: {
    //   clientId: '0588239d-3fb8-42af-9f0a-96cbfe199a8e',
    //   endpoint: 'https://auth-service.sandbox-01.csp-nijmegen.nl/oauth/token',
    // },
    inzageLive: false,
    useZakenFromAggregatorAPI: true,
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
    brpHaalCentraalIsLive: false,
    zakenUseTaken: false,
    zakenIsLive: true,
    zakenUseSubmissions: true,
    inzageLive: false,
    useZakenFromAggregatorAPI: true,
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
