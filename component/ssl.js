'use strict';

let moment  = require('moment-datetime');
let exec    = require('child_process').exec;
let sprintf = require('sprintf-js').sprintf;

let command = 'openssl s_client -connect %s:443 -servername %s < /dev/null 2> /dev/null |'
    + 'openssl x509 -noout -enddate |'
    + 'perl -pe "chomp; s/^.*?=//"';

module.exports = function(config) {
    return process.env.AWS_STATUS_NOTIFIER_SSL_CHECK_URLS.replace(/[\r\n]/g, '').split(',').map(url => {
        let cmd = sprintf(command, url, url);

        return new Promise((resolve,reject) => {
            exec(cmd, function(err, stdout, stderr){
                if (err) {
                    console.log("error occured.")
                    console.log(err);
                    reject(err);
                    return;
                }

                let expire = new Date((moment(stdout).unix() * 1000));
                let now    = new Date();
                let diff   = expire.getTime() - now.getTime();
                let remain_day = Math.round(diff / (60 * 60 * 24 * 1000));

                console.log(sprintf("%s ==> %s (%s)", url, remain_day, stdout));

                if (!(remain_day % 10 == 0 || remain_day <= 10) )   {
                    return resolve();
                }

                let attachments = [{
                    title: url,
                    color: 'good',
                    text:  sprintf("remain of day is `%s` (expire at %s)", remain_day, expire.toISOString()),
                    mrkdwn_in: ['text'],
                }];

                resolve({
                    username: "SSL Expire Check",
                    icon_emoji: ':closed_lock_with_key:',
                    attachments: attachments,
                });
            });
        });
    });
};
