var apiKey = process.env.SENDGRID_API_KEY;
var apiEndpoint = process.env.NOTIFICATION_URL;

var axios = require("axios").default;
var log = require("loglevel");

function notify(to, from, subject, body) {
  var data = {
    personalizations: [
      {
        to: [
          {
            email: to,
          },
        ],
      },
    ],
    from: {
      email: from,
    },
    subject: subject,
    content: [
      {
        type: "text/html",
        value: body,
      },
    ],
  };
  log.debug(`using endpoint ${apiEndpoint}`);
  return axios({
    method: "post",
    url: apiEndpoint,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    data: data,
  });
}

module.exports = {
  notify,
};
