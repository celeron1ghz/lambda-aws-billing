const exec = require('child_process').execSync;

module.exports.kms = () => {
    return {
        GENERAL_SLACK_WEBHOOK_URL: exec(`aws ssm get-parameter --name /slack/webhook/dev --with-decryption --query 'Parameter.Value' --output text`).toString(),
        AWS_STATUS_NOTIFIER_SSL_CHECK_URLS: exec(`aws ssm get-parameter --name /ssl_check/check_urls --with-decryption --query 'Parameter.Value' --output text`).toString(),
    };
};
