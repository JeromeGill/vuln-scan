output "bucket_name" {
  description = "The api's GCS_BUCKET."
  value       = google_storage_bucket.media.name
}

output "service_account_email" {
  description = "The account to create the api's GCS_CREDENTIALS key for."
  value       = google_service_account.api.email
}
