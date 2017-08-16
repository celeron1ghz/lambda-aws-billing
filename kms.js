const exec = require('child_process').execSync;

module.exports.kms = () => {
    const ret = {};

    ['GENERAL_SLACK_WEBHOOK_URL', 'AWS_STATUS_NOTIFIER_SLACK_CHANNEL', 'AWS_STATUS_NOTIFIER_SSL_CHECK_URLS'].forEach(key => {
        const cred = exec(`credstash -r ap-northeast-1 get ${key}`).toString().replace("\n", "");
        ret[key] = cred;
    })

    return ret;
};
