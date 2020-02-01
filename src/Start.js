const AWS = require('aws-sdk');

const stepFunctions = new AWS.StepFunctions();

exports.handler = async (event) => {

  if (event.Records) {
    for (const record of event.Records) {
      const messageJson = JSON.parse(record.Sns.Message);

      await startStateMachine(record.Sns.Message, messageJson.RequestId);
    }
  }
  else {
    console.info("Non SNS request");
    await startStateMachine(JSON.stringify(event), event.RequestId);
  }
};

async function startStateMachine(input, requestId) {
  const params = {
    stateMachineArn: process.env.StateMachineArn,
    input: input,
    name: `${requestId}`
  };

  try {
    await stepFunctions.startExecution(params).promise();
  }
  catch (e) {
    if (e.code && e.code === 'ExecutionAlreadyExists') {
      // we are currently eating this error, assuming that it's a duplicate call and thus the first call will suffice
      console.warn('Tried to run an execution that was already run. Ignoring. ' + requestId);
    }
    else {
      console.warn(e);
      Promise.reject(e);
    }
  }
}
