exports.handler = (event, context) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  if (event.Records) {
    for (let record of event.Records) {
      if (record.eventSource && record.eventSource === "aws:sqs") {
        const errorMessage = record.messageAttributes && record.messageAttributes.ErrorMessage ? record.messageAttributes.ErrorMessage.stringValue : "Failed to process message";
        const body = JSON.parse(record.body);
        if (body.Records) {
          for (let subRecord of body.Records) {
            if (subRecord.Sns && subRecord.Sns.Message) {
              const message = JSON.parse(subRecord.Sns.Message);
              sendResponse({
                Status: "FAILED",
                Reason: errorMessage
              }, message);
            }
          }
        }
      }
      else if (record.Sns && record.Sns.Message) {
        const message = JSON.parse(record.Sns.Message);
        sendResponse({
          Status: "FAILED",
          Reason: "Failed to process message"
        }, message);
      }
    }
  }
  else if (event.result && event.result.response) {
    console.log("Create a response and send it to the presigned URL.");
    sendResponse(event.result.response, event);
  }
  else {
    console.log("An error occurred, so created an error response and send it to the presigned URL.");
    sendResponse({ status: "FAILED", reason: "An error occurred during processing. See logs for details." }, event);
  }

  function sendResponse(response, event) {
    console.log("EVENT: " + JSON.stringify(event));
    var responseBody = JSON.stringify({
      Status: response.Status,
      Reason: response.Reason,
      PhysicalResourceId: response.PhysicalResourceId || context.logStreamName,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      NoEcho: response.NoEcho || false,
      Data: response.Data
    });

    console.log("Response body:\n", responseBody);

    var https = require("https");
    var url = require("url");

    var parsedUrl = url.parse(event.ResponseURL);
    var options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.path,
      method: "PUT",
      headers: {
        "content-type": "",
        "content-length": responseBody.length
      }
    };

    var request = https.request(options, function (response) {
      console.log("Status code: " + response.statusCode);
      console.log("Status message: " + response.statusMessage);
      context.done();
    });

    request.on("error", function (error) {
      console.log("send(..) failed executing https.request(..): " + error);
      context.done();
    });

    request.write(responseBody);
    request.end();
  }
};
