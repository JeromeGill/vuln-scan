variable "project_id" {
  description = "The dev GCP project (created by hand, docs/infrastructure.md)."
  type        = string
}

variable "region" {
  description = "Region for regional resources; us-west1 is near Railway's sfo."
  type        = string
}

variable "web_origins" {
  description = "The Railway web app's origins, for the media bucket's CORS."
  type        = list(string)
}
