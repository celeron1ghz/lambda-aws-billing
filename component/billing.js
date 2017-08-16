'use strict';

const co      = require('co');
const sprintf = require('sprintf-js').sprintf;

const aws = require('aws-sdk');
const cw  = new aws.CloudWatch({ region: 'us-east-1', endpoint: 'http://monitoring.us-east-1.amazonaws.com' });
const r53 = new aws.Route53();
const ec2 = new aws.EC2({ region: 'ap-northeast-1' });
const rds = new aws.RDS({ region: 'ap-northeast-1' });
const kms = new aws.KMS({ region: 'ap-northeast-1' });
const s3  = new aws.S3();

const dimensions = [
    {
        label: 'Total',
        param: [{ Name: 'Currency', Value: 'USD' }],
    },{
        label: 'DataTransfer',
        param: [{ Name: 'Currency', Value: 'USD' }, { Name: 'ServiceName', Value: 'AWSDataTransfer' }],
        description: billing => new Promise(
            (resolve,reject) => resolve(`(${ (billing['Maximum'] * (100/108) / 0.1376469948).toFixed(2)}GB maybe)`)
        ),
    },{
        label: 'Route53',
        param: [{ Name: 'Currency', Value: 'USD' }, { Name: 'ServiceName', Value: 'AmazonRoute53' }],
        description: billing =>
            r53.listHostedZones().promise().then(data => `(${data.HostedZones.length} hosted zone)`),
    },{
        label: 'EC2',
        param: [{ Name: 'Currency', Value: 'USD' }, { Name: 'ServiceName', Value: 'AmazonEC2' }],
        description: billing =>
            ec2.describeInstances().promise().then(data => `(${data.Reservations.length} instances)`),
    },{
        label: 'RDS',
        param: [{ Name: 'Currency', Value: 'USD' }, { Name: 'ServiceName', Value: 'AmazonRDS' }],
        description: billing =>
            rds.describeDBInstances().promise().then(data => `(${data.DBInstances.length} instances)`),
    },{
        label: 'S3',
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
        label: 'KMS',
        param: [{ Name: 'Currency', Value: 'USD' }, { Name: 'ServiceName', Value: 'awskms' }],
        description: billing =>
            kms.listAliases().promise().then(data => `(${data.Aliases.filter(v => !v.AliasName.match(/aws/)).length} keys)`),
    }
];

module.exports = config => {
    const startDate = new Date();
    const endDate   = new Date();
    startDate.setDate(startDate.getDate() - 1); // get yesterday.

    return co(function*(){
        const attachments = [];

        for (const dim of dimensions)   {
            const cloudwatch_result = yield cw.getMetricStatistics({
                MetricName: 'EstimatedCharges',
                Namespace: 'AWS/Billing',
                Period: 86400, /* 1 day */
                StartTime: startDate,
                EndTime: endDate,
                Statistics: ['Maximum'],
                Dimensions: dim.param,
            }).promise()

            const datapoints = cloudwatch_result.Datapoints;

            if (datapoints.length < 1) {
                console.log(`No billing info for ${dim.label}`);
                continue;
            }

            const billing = datapoints[datapoints.length - 1];
            let opt_result = "";

            if (dim.description != null)    {
                opt_result = yield dim.description(billing);
                console.log(`${dim.label}#description ==> `, opt_result);
            }

            attachments.push(
                sprintf("*%s* = `$%s` %s", dim.label, billing['Maximum'], opt_result)
            );
        }

        return {
            username: "AWS Billing",
            icon_emoji: ':money_with_wings:',
            text: attachments.join('\n'),
        };
    });
};
