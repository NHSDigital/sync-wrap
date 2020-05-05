provider "aws" {
  version = "~> 2.59"

  region                      = var.region
  skip_credentials_validation = true
  skip_get_ec2_platforms      = true
  skip_requesting_account_id  = true
  skip_region_validation      = true

  access_key = "abc"
  secret_key = "123"

  endpoints {

    apigateway     = "http://localhost:4567"
    dynamodb       = "http://localhost:4569"
    firehose       = "http://localhost:4573"
    kinesis        = "http://localhost:4568"
    lambda         = "http://localhost:4574"
    s3             = "http://localhost:4572"
    secretsmanager = "http://localhost:4584"
    sns            = "http://localhost:4575"
    sqs            = "http://localhost:4576"
    ssm            = "http://localhost:4583"
    stepfunctions  = "http://localhost:4585"
    iam            = "http://localhost:4593"

  }
}

provider "template" {
  version = "~> 2.1.2"
}
