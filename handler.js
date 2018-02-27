'use strict';

const Slack   = require('slack-node');
const slack   = new Slack();

const co   = require('co');
const aws  = require('aws-sdk');
const ssm  = new aws.SSM({ region: 'ap-northeast-1' });
const ri   = require('./component/ri.js');
const bill = require('./component/billing.js');

const post_to_slack = data => new Promise((resolve,reject) =>
    slack.webhook(data, (err,res) => {
        if (err) { reject(err) } else { resolve(res) }
    })
);

module.exports.aws_billing_notifier = function(event, context, callback) {
    const targets = [ ri, bill ];

    co(function*(){
        slack.setWebhook((yield ssm.getParameter({ Name: '/slack/webhook/dev', WithDecryption: true }).promise() ).Parameter.Value);

        for (const target of targets)   {
            console.log("------------------------------");
            let params = yield target({});

            if (!(params instanceof Array)) params = [params];

            for (const param of params) {
                if (!param) continue;

                //console.log("slack param: ", JSON.stringify(params));
                param.mrkdwn = true;

                const result = yield post_to_slack(param);
                //console.log("slack response: ", result);
                console.log("slack response: ", result.statusCode, result.status);
            }
        }
    })
    .then(data => {
        callback(null, data);
    })
    .catch(err => {
        console.log("error happen.");
        console.log(err);
        context.fail(err);
    })
};
