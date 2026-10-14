variable "project_id" {
  description = "The GCP project that holds the bucket and service account."
  type        = string
}

variable "bucket_name" {
  description = "The bucket's name (globally unique); the api's GCS_BUCKET."
  type        = string
}

variable "location" {
  description = "The bucket's region, e.g. us-west1."
  type        = string
}

variable "web_origins" {
  description = "Origins allowed by the bucket's CORS: the web app's URLs, e.g. https://example.com (no trailing slash)."
  type        = list(string)
}

variable "service_account_id" {
  description = "The api service account's id (the part before @)."
  type        = string
  default     = "api-storage"
}
