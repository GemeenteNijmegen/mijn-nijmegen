export class Statics {

  /**
   * Name of this project
   * Used in PipelineStack and Statics
   */
  static readonly projectName = 'mijnnijmegen';
  /**
   * Github repository of this project
   * Used in the PipelineStack
   * TODO make sure this is correct
   */
  static readonly githubRepository = `GemeenteNijmegen/${Statics.projectName}`;

  static readonly ssmDummyParameter = `/${Statics.projectName}/dummy/parameter`;

  // MARK: environments
  static readonly buildEnvironment = {
    account: '',
    region: 'eu-central-1',
  }

  static readonly productionEnvironment = {
    account: '',
    region: 'eu-central-1',
  }

  static readonly acceptanceEnvironment = {
    account: '',
    region: 'eu-central-1',
  }

  static readonly developmentEnvironment = {
    account: '',
    region: 'eu-central-1',
  }

  // MARK: account hostedzone
  static readonly accountHostedzonePath = '/gemeente-nijmegen/account/hostedzone';
  static readonly accountHostedzoneName = '/gemeente-nijmegen/account/hostedzone/id';
  static readonly accountHostedzoneId = '/gemeente-nijmegen/account/hostedzone/name';

}