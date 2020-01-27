exports.handler = (event, context) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  if (event.result && event.result.response) {
    console.log("Create a response and send it to the presigned URL.");
    sendResponse(event.result.response, event);
  }
  else {
    console.log("An error occurred, so created an error response and send it to the presigned URL.");
    sendResponse({ status: "FAILED", reason: "An error occurred during processing. See logs for details." }, event);
  }

  function sendResponse(response, event) {
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
