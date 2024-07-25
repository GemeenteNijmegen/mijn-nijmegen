import { Session } from '@gemeentenijmegen/session';
import { BrpApi } from './brpApi';
import { InzageApi } from './inzageApi';
import * as template from './templates/inzage.mustache';
import { render } from '../../shared/render';

interface InzageRequestHandlerParams {
  startdate: string;
  enddate: string;
}

export const inzageRequestHandler = async (cookies: any, params: InzageRequestHandlerParams, apiClient: any, dynamoDBClient: any): Promise<any> => {
  if (!cookies || !apiClient || !dynamoDBClient) {
    throw new Error('all handler params are required');
  }
  console.time('request');
  console.timeLog('request', 'start request');
  console.timeLog('request', 'finished init');
  let session = new Session(cookies, dynamoDBClient);
  await session.init();
  console.timeLog('request', 'init session');
  if (session.isLoggedIn() == true) {
    // Get API data
    const response = await handleLoggedinRequest(session, apiClient, params);
    console.timeEnd('request');
    return response;
  }
  console.timeEnd('request');
  return redirectResponse('/login');
};

async function handleLoggedinRequest(session: any, apiClient: any, params: InzageRequestHandlerParams) {
  console.timeLog('request', 'Api Client init');
  const bsn = session.getValue('bsn');
  const brpApi = new BrpApi(apiClient);
  const inzageApi = new InzageApi();
  console.timeLog('request', 'Brp Api');
  console.debug(params.startdate, params.enddate);
  const [brpData, verwerkingenData] = await Promise.all([brpApi.getBrpData(bsn), inzageApi.getData(bsn, params.startdate, params.enddate)]);
  const data = {
    title: 'Verwerkte persoonsgegevens',
    shownav: true,
    volledigenaam: null,
    items: null,
    startdate: '',
    enddate: '',

  };
  data.volledigenaam = brpData?.Persoon?.Persoonsgegevens?.Naam ? brpData.Persoon.Persoonsgegevens.Naam : 'Onbekende gebruiker';
  data.items = verwerkingenData.Items;
  data.startdate = params.startdate.substring(0, 'yyyy-mm-dd'.length);
  data.enddate = params.enddate.substring(0, 'yyyy-mm-dd'.length);

  // render page
  const html = await render(data, template.default);
  const response = {
    statusCode: 200,
    body: html,
    headers: {
      'Content-type': 'text/html',
    },
  };
  return response;
}

function redirectResponse(location: any, code: number = 302) {
  return {
    statusCode: code,
    body: '',
    headers: {
      Location: location,
    },
  };
};
