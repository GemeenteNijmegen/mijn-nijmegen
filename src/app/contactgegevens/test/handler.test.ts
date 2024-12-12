import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { ContactgegevensRequestHandler } from "../ContactgegevensRequestHandler";
import { OpenKlantAPIMock } from "../OpenKlantApi";
import { randomUUID } from "crypto";

// const ddbMock = mockClient(DynamoDBClient);
const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });


describe('Contactgegevens handler', () => {

  test('Initalization', () => {
    const handler = new ContactgegevensRequestHandler({
      dynamoDBClient,
      openKlantApi: mockOpenKlantApi(),
    });
    expect(handler).toBeDefined();
  });

});


function mockOpenKlantApi() {
  const openKlantApiMock = new OpenKlantAPIMock();
  const appendUuid = (obj: any) => Promise.resolve({ uuid: randomUUID(), ...obj });
  jest.spyOn(openKlantApiMock, 'createNatuurlijkPersoon').mockImplementation(async () => {
    return {} as any;
  });
  jest.spyOn(openKlantApiMock, 'addPartijIdentificatie').mockImplementation(appendUuid);
  jest.spyOn(openKlantApiMock, 'getPartijWithDigitaleAdresen').mockImplementation(appendUuid);
  return openKlantApiMock;
}