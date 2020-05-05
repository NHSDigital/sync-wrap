

locals {
  base_uri = "http://localhost:4567/restapis/${aws_api_gateway_rest_api.api.id}/${aws_api_gateway_deployment.api.stage_name}/_user_request_"
}

output "local_uris" {
  value = [
    "${local.base_uri}/${aws_api_gateway_resource.echo.path_part}/any",
    "${local.base_uri}/${aws_api_gateway_resource.sync.path_part}/any"
  ]
}