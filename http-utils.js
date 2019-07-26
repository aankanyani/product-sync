'use strict';

const request = require('request');
const config = require('./config.json');
const fastXmlParser = require('fast-xml-parser');

const options = {
  ignoreNameSpace : true
};
// request.debug = true;

// const appErrors = require('core-functions/app-errors');
// const GatewayTimeout = appErrors.GatewayTimeout;

// Constants
const ETIMEDOUT = 'ETIMEDOUT';
const ESOCKETTIMEDOUT = 'ESOCKETTIMEDOUT';

// Defaults
const DEFAULT_TIMEOUT_MS = 2000;

module.exports = {
  get: get,
  post: post,
  postCustom: postCustom
};

let count = 0;

/**
 * Sends an HTTP GET request based on the given opts to the specified URL.
 * @param {string} url
 * @param {HttpGetOpts} opts
 * @return {Promise.<HttpResult>}
 */
function get(url, opts) {
  const startMs = Date.now();

  const timeoutMs = opts && opts.timeoutMs ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;

  const params = {
    url: url,
    method: 'GET',
    headers: opts ? opts.headers : {},
    qs: opts ? opts.queryParameters : {},
    timeout: timeoutMs
  };

  return new Promise((resolve, reject) => {
    try {
      request(params, (error, response, body) => {
        const tookMs = Date.now() - startMs;

        if (error) {
          if (error.code === ETIMEDOUT || error.code === ESOCKETTIMEDOUT) {
            const errMsg = `GET request to ${url} timed out after ${tookMs} ms while waiting for a response`;

            reject(error);
          } else {
            reject(error);
          }
        } else {
          // Create a safer response object (with a non-enumerable reference to the original response
          const resp = {statusCode: response.statusCode, headers: response.headers};
          Object.defineProperty(resp, 'response',
            {value: response, enumerable: false, writable: true, configurable: true}
          );

          resolve({response: resp, body: body});
        }
      });

    } catch (err) {
      const tookMs = Date.now() - startMs;
      reject(err);
    }
  });
}

/**
 * Sends an HTTP POST request based on the given opts to the specified URL.
 * @param {string} url
 * @param {HttpPostOpts} opts
 * @return {Promise.<HttpResult>}
 */
function post(url, opts, context) {
  let c = ++count;

  const startMs = Date.now();

  const timeoutMs = opts && opts.timeoutMs ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;

  const params = {
    url: url,
    method: 'POST',
    headers: opts ? opts.headers : {},
    qs: opts ? opts.queryParameters : {},
    timeout: timeoutMs,
    body: opts ? opts.body : undefined,
    time: true
  };

  return new Promise((resolve, reject) => {
    request(params, (error, response, body) => {
      const tookMs = Date.now() - startMs;

      if (error) {
        if (error.code === ETIMEDOUT || error.code === ESOCKETTIMEDOUT) {
          const errMsg = `${c} - ${new Date().toISOString()} POST request to ${url} timed out after ${tookMs} ms while waiting for a response from (${url})`;
          // reject(new GatewayTimeout(errMsg));
          reject(error);
        } else {
          reject(error);
        }
      } else {
        // Create a safer response object (with a non-enumerable reference to the original response
        const resp = {statusCode: response.statusCode, headers: response.headers};
        Object.defineProperty(resp, 'response', {
          value: response,
          enumerable: false,
          writable: true,
          configurable: true
        });

        resolve({response: resp, body: body});
      }
    }).on('error', error => {
        const tookMs = Date.now() - startMs;
        reject(error);
      });
  });
}

function postCustom (httpRequestOpts){
  return new Promise((resolve, reject) => {
    try{
      const opts = {
        body: httpRequestOpts.body,
        timeoutMs: config.ServiceTimeOut,
        headers: {
          'content-type': 'text/xml',
          'SOAPAction': httpRequestOpts.soapAction
        }
      };

      return post(httpRequestOpts.url, opts)
      .then(res => {
        const response = res && res.response;
        const body = res && res.body;
        if (response.statusCode === 200) {
            let jsonResponse = null;

            if(fastXmlParser.validate(res.body) === true){
              jsonResponse = fastXmlParser.parse(res.body,options);

              resolve(jsonResponse.Envelope.Body)
          }else{
            reject(new Error(`There was an error retrieving ${httpRequestOpts.responseObject}.`))
          }
        }else{
          reject(new Error(JSON.stringify(response)));
        }
      })
      .catch(err => {
        reject(err);
      });
    }catch(err){
      reject(err);
    } 
  });
}