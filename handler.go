package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"time"

	"context"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
)

type OutputService struct {
	ServiceName string
	Label       string
}

type SlackParam struct {
	Username    string                 `json:"username"`
	IconEmoji   string                 `json:"icon_emoji"`
	Text        string                 `json:"text"`
	Attachments []SlackParamAttachment `json:"attachments"`
}

type SlackParamAttachment struct {
	MrkdwnIn []string                     `json:"mrkdwn_in"`
	Fields   []SlackParamAttachmentColumn `json:"fields"`
}

type SlackParamAttachmentColumn struct {
	Title string `json:"title"`
	Value string `json:"value"`
	Short bool   `json:"short"`
}

func GetCurrentBilling(param []*cloudwatch.Dimension) (ret *cloudwatch.GetMetricStatisticsOutput, err error) {
	return cw.GetMetricStatistics(
		&cloudwatch.GetMetricStatisticsInput{
			MetricName: aws.String("EstimatedCharges"),
			Namespace:  aws.String("AWS/Billing"),
			Period:     aws.Int64(86400),
			StartTime:  aws.Time(start),
			EndTime:    aws.Time(end),
			Statistics: []*string{aws.String("Maximum")},
			Dimensions: param,
		},
	)
}

var params = []OutputService{
	{ServiceName: "AWSDataTransfer", Label: "DataTransfer"},
	{ServiceName: "AmazonEC2", Label: "EC2"},
	{ServiceName: "AmazonECS", Label: "EC2"},
	{ServiceName: "AWSLambda", Label: "Lambda"},
	{ServiceName: "AmazonStates", Label: "StepFunction"},
	{ServiceName: "AmazonRoute53", Label: "Route53"},
	{ServiceName: "AmazonRDS", Label: "RDS"},
	{ServiceName: "AmazonDynamoDB", Label: "DynamoDB"},
	{ServiceName: "AmazonS3", Label: "S3"},
	{ServiceName: "AmazonCloudFront", Label: "CloudFront"},
	{ServiceName: "awskms", Label: "KMS"},
	{ServiceName: "AmazonGuardDuty", Label: "GuardDuty"},
	{ServiceName: "CodeBuild", Label: "CodeBuild"},
	{ServiceName: "AmazonApiGateway", Label: "APIGateway"},
	{ServiceName: "AmazonVPC", Label: "VPC"},
}

var sess, _ = session.NewSession(&aws.Config{Region: aws.String("us-east-1")})
var cw = cloudwatch.New(sess)

var end = time.Now()
var start = end.Add(time.Duration(24) * time.Hour * -1) // yesterday to today

func handler(ctx context.Context, name interface{}) (interface{}, error) {
	webhookUrl := os.Getenv("SLACK_WEBHOOK_URL")
	billing := []SlackParamAttachmentColumn{}

	// each service billing
	for _, service := range params {
		res, err := GetCurrentBilling([]*cloudwatch.Dimension{
			{Name: aws.String("Currency"), Value: aws.String("USD")},
			{Name: aws.String("ServiceName"), Value: aws.String(service.ServiceName)},
		})

		if err != nil {
			fmt.Println("error on getting billing:", err)
			continue
		}

		if len(res.Datapoints) == 0 {
			continue
		}

		value := *res.Datapoints[0].Maximum

		if value == 0 {
			continue
		}

		billing = append(billing, SlackParamAttachmentColumn{
			Title: service.Label,
			Value: fmt.Sprintf("$%.2f", value),
			Short: true,
		})
	}

	if len(billing) == 0 {
		fmt.Println("no data for output. exit...")
		return "OK", nil
	}

	// global billing
	res, err := GetCurrentBilling([]*cloudwatch.Dimension{
		{Name: aws.String("Currency"), Value: aws.String("USD")},
	})

	if err != nil {
		return nil, err
	}

	value := *res.Datapoints[0].Maximum

	d, err := json.Marshal(
		&SlackParam{
			Username:  "AWS Billing",
			IconEmoji: ":money_with_wings:",
			Text:      fmt.Sprintf("Total Price: $%.2f", value),
			Attachments: []SlackParamAttachment{
				{MrkdwnIn: []string{"fields"}, Fields: billing},
			},
		},
	)

	if err != nil {
		return nil, err
	}

	resp, err := http.PostForm(webhookUrl, url.Values{"payload": {string(d)}})

	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()
	return "OK", nil
}

func main() {
	lambda.Start(handler)
}
