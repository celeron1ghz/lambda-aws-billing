# lambda-aws-billing-notifier
Post aws's billing info to slack.

## SETUP ENVIRONMENT VARIABLES
Set these value to `EC2 Parameter Store`.

 * `/slack/webhook/dev`: Slack incoming webhook URL


## SETUP SERVERLESS SCRIPT
```
git clone https://github.com/celeron1ghz/lambda-aws-billing-notifier.git
cd twitter-bot-mimin
sls deploy
```


## SEE ALSO
 * https://github.com/celeron1ghz/lambda-aws-billing-notifier.git