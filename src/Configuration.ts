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
   * Environment to place the pipeline
   */
  buildEnvironment: Environment;

  /**
   * Environment to deploy the application
   */
  deploymentEnvironment: Environment;

  /**
   * CNAME records to deploy in the hosted zone
   */
  cnameRecords?: { [key: string]: string };

  /**
   * A DS record (value) to deploy in the hosted zone
   */
  dsRecord?: string;

  /**
   * Boolean to indicate if the environment to deploy to is in
   * the new landingzone. (for including permissionboundaryaspect or other stuff)
   */
  envIsInNewLandingZone: boolean;

  /**
   * The CDK name of the pipeline stack (can be removed after
   * moving to new lz)
   */
  pipelineStackCdkName: string;
}


const EnvironmentConfigurations: {[key:string]: Configuration} = {
  'acceptance': {
    branch: 'acceptance',
    buildEnvironment: Statics.deploymentEnvironment,
    deploymentEnvironment: Statics.acceptanceEnvironment,
    cnameRecords: undefined, // Manually created in old env?
    dsRecord: '52561 13 2 90CF3C35FDDC30AF42FB4BCCDCCB1123500050D70F1D4886D6DE25502F3BC50A',
    envIsInNewLandingZone: false,
    pipelineStackCdkName: 'mijnuitkering-pipeline-acceptance',
  },
  'production': {
    branch: 'production',
    buildEnvironment: Statics.deploymentEnvironment,
    deploymentEnvironment: Statics.productionEnvironment,
    cnameRecords: undefined, // Manually created in old env?
    dsRecord: '60066 13 2 932CD585B029E674E17C4C33DFE7DE2C84353ACD8C109760FD17A6CDBD0CF3FA',
    envIsInNewLandingZone: false,
    pipelineStackCdkName: 'mijnuitkering-pipeline-production',
  },
  'acceptance-new-lz': {
    branch: 'acceptance-new-lz',
    buildEnvironment: Statics.gnBuildEnvironment,
    deploymentEnvironment: Statics.gnMijnNijmegenAccpEnvironment,
    cnameRecords: {
      _554c359f26fbc43f02d85e43dccd6336: '_430b5afffdedea75381eaec545e8189c.vrcmzfbvtx.acm-validations.aws.',
    },
    dsRecord: '3766 13 2 11761745E09473E6CE95DB798CF1ADB69B4433E73EEFC9F7FE341561966EA154',
    envIsInNewLandingZone: true,
    pipelineStackCdkName: 'mijnnijmegen-pipeline-acceptance',
  },
  'production-new-lz': {
    branch: 'production-new-lz',

    buildEnvironment: Statics.gnBuildEnvironment,
    deploymentEnvironment: Statics.gnMijnNijmegenProdEnvironment,
    cnameRecords: {
      _abe87d0d7f8458c5f75c5d1e0bf6efdb: '_0d3e717e52354c47bf6b0c16612b709d.jzckvmdcqj.acm-validations.aws.',
    },
    dsRecord: '40951 13 2 1EFF20C0264CD1FDE6C7C858398BC2141768CC014A7BB27997F323076B7C47ED',
    envIsInNewLandingZone: true,
    pipelineStackCdkName: 'mijnnijmegen-pipeline-production',
  },
};

export function getEnvironmentConfiguration(branchName: string) {
  const conf = EnvironmentConfigurations[branchName];
  if (!conf) {
    throw Error(`No configuration found for branch ${branchName}`);
  }
  return conf;
}