import { GetSecretValueCommand, GetSecretValueCommandOutput, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';
import { OpenIDConnect } from '../OpenIDConnect';

beforeAll(() => {
  process.env.APPLICATION_URL_BASE = 'http://localhost';
  process.env.OIDC_CLIENT_ID = 'ok';
});

const secretsMock = mockClient(SecretsManagerClient);
const output: GetSecretValueCommandOutput = {
  $metadata: {},
  SecretString: 'ditiseennepgeheim',
};
secretsMock.on(GetSecretValueCommand).resolves(output);

//Move this test to OIDC test
test('Incorrect state errors', async () => {
  const oidc = new OpenIDConnect();
  expect.assertions(1); // Otherwise, if the catch claused is missed, the test would succeed
  try {
    await oidc.authorize('test', 'state1', 'state2');
  } catch (e: any) {
    console.debug(e);
    expect(e.message).toMatch('state does not match session state');
  }

});