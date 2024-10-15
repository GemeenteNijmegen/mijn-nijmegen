import { GetSecretValueCommand, GetSecretValueCommandOutput, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';
import { OpenIDConnectV2 } from '../OpenIDConnectV2';

const describeLiveOIDC = process.env.LIVE_OIDC_TESTS === 'true' ? describe : describe.skip;

// Mock get secret value call
const secretsMock = mockClient(SecretsManagerClient);
const output: GetSecretValueCommandOutput = {
  $metadata: {},
  SecretString: 'ditiseennepgeheim',
};
secretsMock.on(GetSecretValueCommand).resolves(output);


describeLiveOIDC('Live OIDC V2 tests', () => {

  test('Discover and build auth url', async () => {

    const oidc = new OpenIDConnectV2({
      clientId: 'test',
      clientSecretArn: 'arn:aws:client-secret',
      wellknown: process.env.LIVE_OIDC_TESTS_DISCOVERY_URL!,
      redirectUrl: 'https://mijn.dev.nijmegen.nl/auth',
    });

    const url = await oidc.getLoginUrl(oidc.generateState(), 'openid nin');
    console.log(url);

    expect(url).toBeTruthy();

  });


});