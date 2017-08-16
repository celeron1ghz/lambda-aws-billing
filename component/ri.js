'use strict';

let aws     = require('aws-sdk');
let sprintf = require('sprintf-js').sprintf;
let ec2     = new aws.EC2({ region: 'ap-northeast-1' });
let rds     = new aws.RDS({ region: 'ap-northeast-1' });

module.exports = function(config) {
    console.log('Start checking reserved instance remain info.');

    let ec2ri = new Promise((resolve,reject) => {
        ec2.describeReservedInstances().promise()
            .then(data => {
                var attachments = data.ReservedInstances.map(ec2 => {
                    let endAt  = new Date(ec2.End.getTime() + 60 * 60 * 9 * 1000);
                    let diff   = endAt.getTime() - new Date().getTime();
                    let remain = Math.round(diff / 86400000);
                    console.log(sprintf("EC2 %s --> %s", ec2.ReservedInstancesId, remain));

                    if (!(remain % 10 == 0 || remain <= 10) )   {
                        return;
                    }

                    return {
                        ID: ec2.ReservedInstancesId,
                        Product: ec2.ProductDescription,
                        InstanceType: ec2.InstanceType,
                        RemainDay: remain,
                        EndAt: endAt,
                    }
                })
                .filter(v => v)
                .map(a => {
                    return {
                        title: a.ID,
                        color: 'good',
                        text:  sprintf(
                            "soft=`%s` type=`%s` remain of day is `%s` (expire at %s)",
                                a.Product, a.InstanceType, a.RemainDay, a.EndAt.toISOString()
                        ),
                        mrkdwn_in: ['text'],
                    }
                });

                if (attachments.length == 0)    {
                    return resolve();
                }

                resolve({
                    username: "EC2 Reserved Instance",
                    icon_emoji: ':ec2:',
                    attachments: attachments,
                });
            })
            .catch(err => {
                console.log("error occured");
                console.log(err);
                reject(err);
            })
    });

    let rdsri = new Promise((resolve,reject) => {
        rds.describeReservedDBInstances({}).promise()
            .then(data => {
                var attachments = data.ReservedDBInstances.map(db => {
                    let endAt = new Date(db.StartTime.getTime() + db.Duration * 1000 + 60 * 60 * 9 * 1000);
                    let diff  = endAt.getTime() - new Date().getTime();
                    let remain = Math.round(diff / 86400000);
                    console.log(sprintf("RDS %s --> %s", db.ReservedDBInstancesOfferingId, remain));

                    if (!(remain % 10 == 0 || remain <= 10) )   {
                        return;
                    }

                    return {
                        ID: db.ReservedDBInstancesOfferingId,
                        Product: db.ProductDescription,
                        InstanceType: db.DBInstanceClass,
                        RemainDay: remain,
                        EndAt: endAt,
                    }
                })
                .filter(v => v)
                .map(a => {
                    return {
                        title: a.ID,
                        color: 'good',
                        text:  sprintf(
                            "soft=`%s` type=`%s` remain of day is `%s` (expire at %s)",
                                a.Product, a.InstanceType, a.RemainDay, a.EndAt.toISOString()
                        ),
                        mrkdwn_in: ['text'],
                    }
                });

                if (attachments.length == 0)    {
                    return resolve();
                }

                resolve({
                    username: "RDS Reserved Instance",
                    icon_emoji: ':rds:',
                    attachments: attachments,
                });
            })
            .catch(err => {
                console.log("error occured");
                console.log(err);
                reject(err);
            })
    });

    return [ec2ri, rdsri];
};
