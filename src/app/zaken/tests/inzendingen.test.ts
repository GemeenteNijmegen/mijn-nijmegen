import { Bsn } from '@gemeentenijmegen/utils';
import sampleDownloadLink from './samples/download.json';
import sampleInzending from './samples/inzending.json';
import sampleInzendingen from './samples/list-inzendingen.json';
import { Inzendingen } from '../Inzendingen';
import { Person } from '../User';

const inzendingen = new Inzendingen({ baseUrl: 'https://example.com', accessKey: 'test-access-key' });
jest.spyOn(inzendingen, 'request').mockImplementation((endpoint, _params) => {
  if (endpoint.includes('submissions/')) {
    return Promise.resolve(sampleInzending);
  }
  return Promise.resolve(sampleInzendingen);
});
jest.spyOn(inzendingen, 'download').mockImplementation(() => Promise.resolve(sampleDownloadLink));


describe('Inzendingen from submission storage', () => {
  const person = new Person(new Bsn('900222670'), 'test', 'token');
  test('Getting a list of submissions', async() => {
    const submissions = await inzendingen.list(person);
    expect(submissions).toHaveLength(23);
    expect(submissions.pop()).toHaveProperty('identifier');
  });

  test('Getting a single submission', async() => {
    const submission = await inzendingen.get('APV1.234', person);
    expect(submission).toHaveProperty('identifier');
  });

  test('Getting a single submission download link', async() => {
    const submission = await inzendingen.download('APV1.234', 'APV1.234/APV1.234.pdf', person);
    expect(submission).toHaveProperty('downloadUrl');
  });
});

describe('Inzendingen from submission storage without delegated_token in session', () => {
  const person = new Person(new Bsn('900222670'), 'test', undefined);

  test('Getting a list of submissions', async() => {
    const submissions = await inzendingen.list(person);
    expect(submissions).toHaveLength(23);
    expect(submissions.pop()).toHaveProperty('identifier');
  });

  test('Getting a single submission', async() => {
    const submission = await inzendingen.get('APV1.234', person);
    expect(submission).toHaveProperty('identifier');
  });

  test('Getting a single submission download link', async() => {
    const submission = await inzendingen.download('APV1.234', 'APV1.234/APV1.234.pdf', person);
    expect(submission).toHaveProperty('downloadUrl');
  });
});
