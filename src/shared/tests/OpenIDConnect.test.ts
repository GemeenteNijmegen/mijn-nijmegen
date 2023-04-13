import { GetSecretValueCommand, GetSecretValueCommandOutput, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { OpenIDConnect } from "../OpenIDConnect";
import { mockClient } from 'aws-sdk-client-mock';

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
  expect(async () => {
    await oidc.authorize('test', 'state1', 'state2')
  }).rejects.toThrow();
  
});