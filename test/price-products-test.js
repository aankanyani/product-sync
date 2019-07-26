const test = require('tape');

const copying = require('core-functions/copying');
const apiLambdas = require('aws-core-utils/api-lambdas');
const lambaCache = require('aws-core-utils/lambda-cache');

const pricesProducts = require('../price-products')

const region = 'eu-west-1';
const stage = 'uat';

let awsContext = {
  "callbackWaitsForEmptyEventLoop": true,
  "logGroupName": "/aws/lambda/testEnv",
  "logStreamName": "2017/08/10/[$LATEST]299dda7fbb8c4e3ea1f0b9134964217a",
  "functionName": "testEnv",
  "memoryLimitInMB": "128",
  "functionVersion": "$LATEST",
  "invokeid": "8eb5080e-95fa-11e6-bd1c-f71cd98ce778",
  "awsRequestId": "8eb5080e-95fa-11e6-bd1c-f71cd98ce778",
  "invokedFunctionArn": "arn:aws:lambda:eu-west-1:963627074169:function:testEnv:UAT"
};

const event = {
  "BusinessUnit": ""
}

test('Can get product details.', t => {
  process.env.AWS_REGION = region;
  const context = generateContext();

  apiLambdas.configureStandardContext(context, undefined, require('../context-options.json'), null, awsContext);

  pricesProducts.getPriceAndProducts(event, context).then(results => {
      console.log(JSON.stringify(results));
      t.pass();
      t.end();
  }, error =>{
      console.log(error);
      t.end(error);
  }).catch(err =>{
      t.pass();
      t.end();
  });
});

function generateContext() {
  const context = {};
  context.stage  = stage;
  const lambdaOptions = copying.copy(require('../context-options.json').lambdaOptions);
  lambaCache.configureLambda(context, lambdaOptions);
  return context;
}