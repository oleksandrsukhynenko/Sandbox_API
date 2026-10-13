import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

/**
 * Sends an empty JSON object to POST /Account/v1/Authorized using Node HTTP(S).
 * Unlike Playwright, this helper does not automatically add Content-Type.
 * No user credentials are sent and the response body is not parsed as JSON.
 *
 * @param baseURL - API origin used to resolve the Authorized endpoint.
 * @param contentType - Explicit request Content-Type; undefined omits the header.
 * @returns Response status, response Content-Type, outgoing Content-Type and UTF-8 body.
 * @throws Rejects on request or response errors, or after 15 seconds of socket inactivity.
 */
export async function sendRawCredentials(baseURL: string, contentType?: string) {
  const url = new URL('/Account/v1/Authorized', baseURL);
  const payload = JSON.stringify({});
  const sendRequest = url.protocol === 'https:' ? httpsRequest : httpRequest;

  return new Promise<{
    status: number | undefined;
    contentType: string | undefined;
    sentContentType: string | number | string[] | undefined;
    body: string;
  }>((resolve, reject) => {
    const outgoing = sendRequest(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(contentType === undefined ? {} : { 'Content-Type': contentType }),
      },
    }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('error', reject);
      response.on('end', () => resolve({
        status: response.statusCode,
        contentType: response.headers['content-type'],
        sentContentType: outgoing.getHeader('content-type'),
        body,
      }));
    });
    outgoing.setTimeout(15000, () => outgoing.destroy(new Error('Raw HTTP request timed out')));
    outgoing.on('error', reject);
    outgoing.end(payload);
  });
}