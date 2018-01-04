'use strict';

const REGION = 'ap-northeast-1';

const co  = require('co');
const aws = require('aws-sdk');

const cw  = new aws.CloudWatch({ region: 'us-east-1', endpoint: 'http://monitoring.us-east-1.amazonaws.com' });
const r53 = new aws.Route53();
const ec2 = new aws.EC2({ region: REGION });
const rds = new aws.RDS({ region: REGION });
const kms = new aws.KMS({ region: REGION });
const s3  = new aws.S3();

const parameters = [
    {
        label: 'Total',
        icon:  'yen',
        param: [{ Name: 'Currency', Value: 'USD' }],
    },{
        label: 'DataTransfer',
        icon:  'calling',
        param: [{ Name: 'Currency', Value: 'USD' }, { Name: 'ServiceName', Value: 'AWSDataTransfer' }],
        description: billing => new Promise(
            (resolve,reject) => resolve(`(${ (billing['Maximum'] * (100/108) / 0.1376469948).toFixed(2)}GB maybe)`)
        ),
    },{
        label: 'EC2',
        icon:  'ec2',
        param: [{ Name: 'Currency', Value: 'USD' }, { Name: 'ServiceName', Value: 'AmazonEC2' }],
        description: billing =>
            ec2.describeInstances().promise().then(data => `(${data.Reservations.length} instances)`),
    },{
        label: 'ECS',
        icon:  'ecs',
        param: [{ Name: 'Currency', Value: 'USD' }, { Name: 'ServiceName', Value: 'AmazonECS' }],
    },{
        label: 'Lambda',
        icon:  'lambda',
        param: [{ Name: 'Currency', Value: 'USD' }, { Name: 'ServiceName', Value: 'AWSLambda' }],
    },{
        label: 'StepFunctions',
        icon:  'stepfunctions',
        param: [{ Name: 'Currency', Value: 'USD' }, { Name: 'ServiceName', Value: 'AmazonStates' }],
    },{
        label: 'Route53',
        icon:  'route53',
        param: [{ Name: 'Currency', Value: 'USD' }, { Name: 'ServiceName', Value: 'AmazonRoute53' }],
        description: billing =>
            r53.listHostedZones().promise().then(data => `(${data.HostedZones.length} hosted zone)`),
    },{
        label: 'RDS',
        icon:  'rds',
        param: [{ Name: 'Currency', Value: 'USD' }, { Name: 'ServiceName', Value: 'AmazonRDS' }],
        description: billing =>
            rds.describeDBInstances().promise().then(data => `(${data.DBInstances.length} instances)`),
    },{
        label: 'DynamoDB',
        icon:  'dynamodb',
        param: [{ Name: 'Currency', Value: 'USD' }, { Name: 'ServiceName', Value: 'AmazonDynamoDB' }],
    },{
        label: 'S3',
        icon:  's3',
        param: [{ Name: 'Currency', Value: 'USD' }, { Name: 'ServiceName', Value: 'AmazonS3' }],
        description: billing => {
            const clowdwatch = new aws.CloudWatch({region: 'ap-northeast-1', endpoint: 'http://monitoring.ap-northeast-1.amazonaws.com'});
            // adjust to start of day
            const start = new Date();
            start.setHours(0);
            start.setMinutes(0);
            start.setSeconds(0);
            const end = new Date(start.getTime());
            start.setDate(start.getDate() - 1); // get yesterday.

            return s3.listBuckets().promise()
                .then(data => {
                    return Promise.all(
                        data.Buckets.map(b => {
                            return clowdwatch.getMetricStatistics({
                                MetricName: 'BucketSizeBytes',
                                Namespace: 'AWS/S3',
                                Period: 86400, /* 1 day */
                                StartTime: start,
                                EndTime: end,
                                Statistics: ['Maximum'],
                                Dimensions: [{ Name: 'BucketName', Value: b.Name }, { Name: 'StorageType', Value: 'StandardStorage' }],
                            }).promise()
                        })
                    )
                })
                .then(data => {
                    let used = data.map(v => v.Datapoints.length ? v.Datapoints[0].Maximum : 0).reduce((a,b) => a + b);
                    used = used / ( 1024 * 1024 * 1024 ); // gigabyte
                    return `(${data.length} buckets, ${used.toFixed(2)}GB used)`;
                });
        },
    },{
        label: 'CloudFront',
        icon:  'cloudfront',
        param: [{ Name: 'Currency', Value: 'USD' }, { Name: 'ServiceName', Value: 'AmazonCloudFront' }],
    },{
        label: 'KMS',
        icon:  'kms',
        param: [{ Name: 'Currency', Value: 'USD' }, { Name: 'ServiceName', Value: 'awskms' }],
        description: billing =>
            kms.listAliases().promise().then(data => `(${data.Aliases.filter(v => !v.AliasName.match(/aws/)).length} keys)`),
    },{
        label: 'GuardDuty',
        icon:  'guardduty',
        param: [{ Name: 'Currency', Value: 'USD' }, { Name: 'ServiceName', Value: 'AmazonGuardDuty' }],
    },{
        label: 'CodeBuild',
        icon:  'codebuild',
        param: [{ Name: 'Currency', Value: 'USD' }, { Name: 'ServiceName', Value: 'CodeBuild' }],
    },{
        label: 'API Gateway',
        icon:  'apigateway',
        param: [{ Name: 'Currency', Value: 'USD' }, { Name: 'ServiceName', Value: 'AmazonApiGateway' }],
    }
];

// default value
parameters.forEach(p => {
    p.description = p.description || function(){ return Promise.resolve() };
});

module.exports = config => {
    const startDate = new Date();
    const endDate   = new Date();
    startDate.setDate(startDate.getDate() - 1); // get yesterday.

    return co(function*(){
        const ret_billing =
            yield Promise.all(
                parameters.map(param =>
                    cw.getMetricStatistics({
                        MetricName: 'EstimatedCharges',
                        Namespace: 'AWS/Billing',
                        Period: 86400,
                        StartTime: startDate,
                        EndTime: endDate,
                        Statistics: ['Maximum'],
                        Dimensions: param.param,
                    })
                    .promise()
                    .then(data => { param.billing = data; return param })
                )
            )
            .then(data => data.filter(d => d.billing.Datapoints.length != 0 && d.billing.Datapoints[0].Maximum != 0) );

        const ret_description =
            yield Promise.all(
                ret_billing.map(b =>
                    b.description(b.billing).then(data => {
                        console.log(`${b.label}#description ==>`, data);
                        b.description = data;
                        return b;
                    })
                )
            );

        const attachments = ret_description.map(d => {
            const data = d.billing.Datapoints;
            const billing = data[data.length - 1];
            return {
                title: `:${d.icon || 'thinking_face'}: ${d.label}`,
                value: "*$" + billing['Maximum'] + "* " + (d.description || ''),
                short: true,
            };
        })

        const total = attachments.shift();

        return {
            username: "AWS Billing",
            icon_emoji: ':money_with_wings:',
            text: 'Total price is ' + total.value,
            attachments: [{ mrkdwn_in: ['fields'], fields: attachments }]
        };
    });
};
