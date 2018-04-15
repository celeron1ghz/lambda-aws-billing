'use strict';

const Slack   = require('slack-node');
const slack   = new Slack();

const ri   = require('./component/ri.js');
const bill = require('./component/billing.js');

const post_to_slack = data => new Promise((resolve,reject) =>
  slack.webhook(data, (err,res) => {
    if (err) { reject(err) } else { resolve(res) }
  })
);

module.exports.aws_billing_notifier = async (event, context, callback) => {
  const components = [ ri, bill ];

  try {
    slack.setWebhook(process.env.SLACK_WEBHOOK_URL);

    for (const component of components)   {
      console.log("------------------------------");
      let promises = component();
      if (!(promises instanceof Array)) promises = [promises];

      for (const promise of promises) {
        if (!promise) continue;
        const param = await promise;

        if (!param) {
          console.log("No notify, skip...");
          continue;
        }

        console.log(param)
        param.mrkdwn = true;

        console.log("slack param: ", JSON.stringify(param));
        const result = await post_to_slack(param);
        console.log("slack response: ", result.statusCode, result.status);
      }
    }

    callback(null, "OK");
  } catch(err) {
    console.log("error happen.");
    console.log(err);
    context.fail(err);
  }
};
