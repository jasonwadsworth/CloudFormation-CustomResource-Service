const AWS = require('aws-sdk');

const sts = new AWS.STS();

exports.handler = async (event, context) => {
  const attempt = event.result ? event.result.attempt + 1 : 0;
  try {
    console.log('Received event:', JSON.stringify(event, null, 2));

    const assumeRoleResponse = await sts.assumeRole({
      RoleArn: event.ResourceProperties.RoleArn,
      RoleSessionName: event.RequestId,
      ExternalId: `${event.RequestId}${new Date().valueOf()}`,
      DurationSeconds: 3600,
    }).promise();

    const accessParams = {
      accessKeyId: assumeRoleResponse.Credentials.AccessKeyId,
      secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey,
      sessionToken: assumeRoleResponse.Credentials.SessionToken,
    };

    const lambda = new AWS.Lambda(accessParams);

    const rawEvent = {
      ...event
    };

    delete rawEvent.result;

    const params = {
      FunctionName: event.ResourceProperties.FunctionArn,
      InvocationType: "RequestResponse",
      LogType: "Tail",
      Payload: JSON.stringify(rawEvent)
    };
    const response = await lambda.invoke(params).promise();

    if (response.StatusCode === 200) {
      const responsePayload = JSON.parse(response.Payload);

      const isCompleteOrFailed = responsePayload.Status === "SUCCESS" || responsePayload.Status === "FAILED";

      if (isCompleteOrFailed) {
        // it's done, so return the response
        console.debug('it\'s done, so return the response');
        return {
          isCompleteOrFailed: true,
          response: responsePayload
        };
      }
      else {
        if (attempt >= 29) {
          // it's not done, but we aren't going to wait any longer
          return {
            isCompleteOrFailed: true,
            response: {
              Status: "FAILED",
              Reason: "Timeout processing resource. Max attempts exceeded."
            }
          }
        }
        else {
          // it's not done, it will be attempted again
          console.debug('it\'s not done, it will be attempted again');
          return {
            isCompleteOrFailed: false,
            attempt: attempt
          }
        }
      }
    }
    else if (response.StatusCode >= 500) {
      // throwing here so that the logic of marking it as failed is in one place
      throw new Error(`Error calling remote function. Status code was ${response.StatusCode}.`);
    }
    else {
      // other errors are not retry-able, so we are done
      return {
        isCompleteOrFailed: true,
        response: {
          Status: 'FAILED',
          Reason: 'Bad request'
        }
      };
    }
  }
  catch (e) {
    console.warn(e.message);
    if (attempt >= 29) {
      return {
        isCompleteOrFailed: true,
        error: e,
        response: {
          Status: "FAILED",
          Reason: `Max attempts exceeded. ${e.message}`
        }
      }
    }
    else {
      return {
        isCompleteOrFailed: false,
        attempt: attempt,
        error: e
      }
    }
  }
};
