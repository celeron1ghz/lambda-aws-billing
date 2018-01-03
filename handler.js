'use strict';

const co      = require('co');
const Slack   = require('slack-node');
const slack   = new Slack();
slack.setWebhook(process.env.GENERAL_SLACK_WEBHOOK_URL);

//const ssl  = require('./component/ssl.js');
const ri   = require('./component/ri.js');
const bill = require('./component/billing.js');

const post_to_slack = data => new Promise((resolve,reject) =>
    slack.webhook(data, (err,res) => {
        if (err) { reject(err) } else { resolve(res) }
    })
)

module.exports.aws_status_notifier = function(event, context, callback) {
    const targets = [ ri, bill ];

    co(function*(){
        for (const target of targets)   {
            console.log("------------------------------");
            let params = yield target({});

            if (!(params instanceof Array)) params = [params];

            for (const param of params) {
                if (!param) continue;

                console.log("slack param: ", JSON.stringify(params));
                param.mrkdwn  = true;

                const result = yield post_to_slack(param);
                console.log("slack response: ", result);
            }
        }
    })
    .then(data => {
        console.log("function result ==> ", data);
        callback(null, data);
    })
    .catch(err => {
        console.log("error happen.");
        console.log(err);
        context.fail(err);
    })
};
