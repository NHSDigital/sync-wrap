


resource "null_resource" "sync-async-create" {
  triggers = {
    package = file("../../../src/lambdas/package_lambda.py")
    source = file("../../../src/lambdas/sync_async.py")
    pipfiile = file("../../../Pipfile")
  }

  provisioner "local-exec" {
    command = "cd ../../..;pipenv run python3 src/lambdas/package_lambda.py --dest /tmp/sync-async-lambda --overwrite sync_async"
  }
}

data "archive_file" "sync-async" {
  type        = "zip"
  output_path = "sync_async.zip"
  source_dir  = "/tmp/sync-async-lambda"
  depends_on = [
      null_resource.sync-async-create
  ]
}

resource "null_resource" "echo-create" {
  triggers = {
    package = file("../../../src/lambdas/package_lambda.py")
    source = file("../../../src/lambdas/echo.py")
    pipfiile = file("../../../Pipfile")
  }

  provisioner "local-exec" {
    command = "cd ../../..;pipenv run python3 src/lambdas/package_lambda.py --dest /tmp/echo-lambda --overwrite echo"
  }
}

data "archive_file" "echo" {
  type        = "zip"
  output_path = "echo.zip"
  source_dir = "/tmp/echo-lambda"
  depends_on = [
    null_resource.echo-create
  ]
}

resource "aws_api_gateway_rest_api" "api" {
  name = "sync-async-api"
  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_deployment" "api" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  stage_name = var.stage

  depends_on  = [
    aws_api_gateway_integration.echo,
    aws_api_gateway_integration.sync-async,

  ]

}

resource "aws_api_gateway_resource" "echo" {
  rest_api_id = "${aws_api_gateway_rest_api.api.id}"
  parent_id   = "${aws_api_gateway_rest_api.api.root_resource_id}"
  path_part   = "echo"
}

resource "aws_api_gateway_resource" "sync" {
  rest_api_id = "${aws_api_gateway_rest_api.api.id}"
  parent_id   = "${aws_api_gateway_rest_api.api.root_resource_id}"
  path_part   = "sync"
}

resource "aws_api_gateway_resource" "echo-proxy" {
  rest_api_id = "${aws_api_gateway_rest_api.api.id}"
  parent_id   = "${aws_api_gateway_resource.echo.id}"
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_resource" "sync-async-proxy" {
  rest_api_id = "${aws_api_gateway_rest_api.api.id}"
  parent_id   = "${aws_api_gateway_resource.sync.id}"
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "echo-any" {
  rest_api_id   = "${aws_api_gateway_rest_api.api.id}"
  resource_id   = "${aws_api_gateway_resource.echo-proxy.id}"
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "sync-async-any" {
  rest_api_id   = "${aws_api_gateway_rest_api.api.id}"
  resource_id   = "${aws_api_gateway_resource.sync-async-proxy.id}"
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "echo" {
  rest_api_id = "${aws_api_gateway_rest_api.api.id}"
  resource_id = "${aws_api_gateway_resource.echo-proxy.id}"
  http_method = "${aws_api_gateway_method.echo-any.http_method}"
  type        = "AWS_PROXY"
  content_handling = "CONVERT_TO_BINARY"
  uri         = "${aws_lambda_function.echo.invoke_arn}"
}

resource "aws_api_gateway_integration" "sync-async" {
  rest_api_id = "${aws_api_gateway_rest_api.api.id}"
  resource_id = "${aws_api_gateway_resource.sync-async-proxy.id}"
  http_method = "${aws_api_gateway_method.sync-async-any.http_method}"
  type        = "AWS_PROXY"
  content_handling = "CONVERT_TO_BINARY"
  uri         = "${aws_lambda_function.sync-async.invoke_arn}"
}

# Lambda


resource "aws_lambda_function" "echo" {
  filename         = "${data.archive_file.echo.output_path}"
  source_code_hash = "${data.archive_file.echo.output_base64sha256}"
  function_name = "echo"
  role          = "${aws_iam_role.lambda_assume_role.arn}"
  handler       = "echo.handler"
  runtime       = "python3.7"

  environment {
    variables = {
      upstream = var.upstream
      allow_insecure = var.allow_insecure
    }
  }
}

resource "aws_lambda_function" "sync-async" {
  filename         = "${data.archive_file.sync-async.output_path}"
  source_code_hash = "${data.archive_file.sync-async.output_base64sha256}"
  function_name = "sync_async"
  role          = "${aws_iam_role.lambda_assume_role.arn}"
  handler       = "sync_async.handler"
  runtime       = "python3.7"

  environment {
    variables = {
      upstream = var.upstream
      allow_insecure = var.allow_insecure
    }
  }
}

resource "aws_lambda_permission" "echo-invoke" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.echo.function_name}"
  principal     = "apigateway.amazonaws.com"

  # More: http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-control-access-using-iam-policies-to-invoke-api.html
  #source_arn = "arn:aws:execute-api:${var.myregion}:${var.accountId}:${aws_api_gateway_rest_api.api.id}/*/${aws_api_gateway_method.method.http_method}${aws_api_gateway_resource.resource.path}"
}

resource "aws_lambda_permission" "sync-async-invoke" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.sync-async.function_name}"
  principal     = "apigateway.amazonaws.com"

  # More: http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-control-access-using-iam-policies-to-invoke-api.html
  #source_arn = "arn:aws:execute-api:${var.myregion}:${var.accountId}:${aws_api_gateway_rest_api.api.id}/*/${aws_api_gateway_method.method.http_method}${aws_api_gateway_resource.resource.path}"
}


# IAM
resource "aws_iam_role" "lambda_assume_role" {
  name = "lambda-assume-role"

  assume_role_policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
POLICY
}