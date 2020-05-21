provider "apigee" {
  org          = var.apigee_organization
  access_token = var.apigee_token
}

terraform {
  backend "azurerm" {}

  required_providers {
    apigee = "~> 0.0"
    archive = "~> 1.3"
  }
}


data "archive_file" "async-slowapp" {
  type = "zip"
  source_dir = "../proxies/async-slowapp"
  output_path = "../build/async-slowapp.zip"
}

resource "apigee_api_proxy" "async-slowapp" {
  name = "async-slowapp-${var.apigee_environment}${var.namespace}"
  bundle = data.archive_file.async-slowapp.output_path
  bundle_sha = data.archive_file.async-slowapp.output_sha
}

resource "apigee_api_proxy_deployment" "async-slowapp" {
  proxy_name = apigee_api_proxy.async-slowapp.name
  env = var.apigee_environment
  revision = "latest"

  # This tells the deploy to give existing connections a 60 grace period before abandoning them,
  # and otherwise deploys seamlessly.
  override = true
  delay = 60

  # Explicit dependency
  depends_on = [apigee_api_proxy.async-slowapp]
}

data "archive_file" "sync-wrap" {
  type = "zip"
  source_dir = "../proxies/sync-wrap"
  output_path = "../build/sync-wrap.zip"
}



resource "apigee_api_proxy" "sync-wrap" {
  name = "sync-wrap-${var.apigee_environment}${var.namespace}"
  bundle = data.archive_file.async-slowapp.output_path
  bundle_sha = data.archive_file.async-slowapp.output_sha
}

resource "apigee_api_proxy_deployment" "sync-wrap" {
  proxy_name = apigee_api_proxy.sync-wrap.name
  env = var.apigee_environment
  revision = "latest"

  # This tells the deploy to give existing connections a 60 grace period before abandoning them,
  # and otherwise deploys seamlessly.
  override = true
  delay = 60

  # Explicit dependency
  depends_on = [apigee_api_proxy.sync-wrap]
}
