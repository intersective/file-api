const AWS = require('aws-sdk');
require('dotenv').config();

async function trigger() {
  const lambda = new AWS.Lambda({
    region: process.env.REGION,
    endpoint: 'http://127.0.0.1:3002'
  });
  const opts = {
    FunctionName: `${ process.env.STACK_NAME }-statistics-${ process.env.ENV }-calculation`,
    InvocationType: 'RequestResponse',
    Payload: JSON.stringify({
      type: process.env.TRIGGER_TYPE,
      id: process.env.TRIGGER_ID
    }),
  };

  const res = await lambda.invoke(opts).promise();
  if (res) {
    console.log('res:', JSON.stringify(JSON.parse(res.Payload), null, 2));
  } else {
    console.log('finished');
  }
}

trigger();
