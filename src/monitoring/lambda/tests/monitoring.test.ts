import fs from 'fs';
import path from 'path';
import { parseData, createMessage } from '../index';

test('Process logs', async () => {

  const filepath = 'logs.json.gz';
  const file_buffer = fs.readFileSync(path.join(__dirname, filepath));
  const data = file_buffer.toString('base64');
  const logs = parseData(data);
  expect(logs.logGroup).toContain('/aws/lambda/mijn-api-api-stack');

  const message = createMessage(logs);
  expect(message.blocks).toHaveLength(4);
});