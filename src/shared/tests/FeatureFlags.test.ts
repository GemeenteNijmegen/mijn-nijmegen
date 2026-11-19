import { GetParameterCommand, ParameterNotFound, SSMClient } from '@aws-sdk/client-ssm';
import { mockClient } from 'aws-sdk-client-mock';
import { FeatureFlags } from '../FeatureFlags';

const ssmMock = mockClient(SSMClient);
const PARAM = '/cdk/mijn-nijmegen/flags/test';

function flagsAt(clock: { t: number }) {
  return new FeatureFlags({ ssmClient: new SSMClient({ region: 'eu-west-1' }), now: () => clock.t });
}

function paramValue(value: string) {
  return { Parameter: { Name: PARAM, Value: value } };
}

beforeEach(() => {
  ssmMock.reset();
  jest.spyOn(console, 'warn').mockImplementation(() => { });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('FeatureFlags', () => {
  test('returns true for true and false for false', async () => {
    ssmMock.on(GetParameterCommand, { Name: PARAM }).resolves(paramValue('true'));
    expect(await flagsAt({ t: 0 }).isEnabled(PARAM, false)).toBe(true);
    ssmMock.reset();
    ssmMock.on(GetParameterCommand, { Name: PARAM }).resolves(paramValue('false'));
    expect(await flagsAt({ t: 0 }).isEnabled(PARAM, true)).toBe(false);
  });

  test('normalises casing and whitespace', async () => {
    for (const [stored, expected] of [['True', true], [' FALSE ', false], ['yes', false]] as const) {
      ssmMock.reset();
      ssmMock.on(GetParameterCommand).resolves(paramValue(stored));
      expect(await flagsAt({ t: 0 }).isEnabled(PARAM, !expected)).toBe(expected);
    }
  });

  test('caches within ttl', async () => {
    const clock = { t: 0 };
    const flags = flagsAt(clock);
    ssmMock.on(GetParameterCommand).resolves(paramValue('true'));
    await flags.isEnabled(PARAM, false);
    clock.t = 59_999;
    await flags.isEnabled(PARAM, false);
    expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(1);
  });

  test('refetches after ttl and returns the new value', async () => {
    const clock = { t: 0 };
    const flags = flagsAt(clock);
    ssmMock.on(GetParameterCommand).resolvesOnce(paramValue('true')).resolvesOnce(paramValue('false'));
    expect(await flags.isEnabled(PARAM, true)).toBe(true);
    clock.t = 60_001;
    expect(await flags.isEnabled(PARAM, true)).toBe(false);
    expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(2);
  });

  test('returns default when SSM throws', async () => {
    ssmMock.on(GetParameterCommand).rejects(new Error('boom'));
    expect(await flagsAt({ t: 0 }).isEnabled(PARAM, true)).toBe(true);
    expect(await flagsAt({ t: 0 }).isEnabled(PARAM, false)).toBe(false);
  });

  test('returns default when parameter not found', async () => {
    ssmMock.on(GetParameterCommand).rejects(new ParameterNotFound({ message: 'nope', $metadata: {} }));
    expect(await flagsAt({ t: 0 }).isEnabled(PARAM, true)).toBe(true);
  });

  test('returns default when SSM does not answer within the timeout', async () => {
    ssmMock.on(GetParameterCommand).callsFake(() => new Promise(() => { }));
    const flags = new FeatureFlags({ ssmClient: new SSMClient({ region: 'eu-west-1' }), timeoutMs: 20 });
    expect(await flags.isEnabled(PARAM, true)).toBe(true);
  });

  test('does not cache failures', async () => {
    const flags = flagsAt({ t: 0 });
    ssmMock.on(GetParameterCommand).rejectsOnce(new Error('boom')).resolves(paramValue('false'));
    expect(await flags.isEnabled(PARAM, true)).toBe(true);
    expect(await flags.isEnabled(PARAM, true)).toBe(false);
    expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(2);
  });
});
