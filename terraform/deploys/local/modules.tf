
module "sync-async-api" {
  source = "../../modules/sync-async-api"
  stage  = "local"
  upstream = "https://localhost:9003"
  allow_insecure = true
}