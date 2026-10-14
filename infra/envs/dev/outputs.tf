output "media_bucket_name" {
  description = "The api's GCS_BUCKET on Railway."
  value       = module.media_bucket.bucket_name
}

output "api_service_account_email" {
  description = "The account whose key is the api's GCS_CREDENTIALS on Railway."
  value       = module.media_bucket.service_account_email
}
