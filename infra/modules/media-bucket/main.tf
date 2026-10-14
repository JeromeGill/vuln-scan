# A private bucket for the app's files, and the service account the
# api uses to sign upload and download URLs for it (docs/storage.md). The
# account's key isn't created here, so it never reaches the state
# (docs/infrastructure.md#the-service-account-key).

resource "google_storage_bucket" "media" {
  project  = var.project_id
  name     = var.bucket_name
  location = var.location

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  # Browsers upload and download straight to and from the bucket with signed
  # URLs, so it must allow the web origin.
  cors {
    origin          = var.web_origins
    method          = ["PUT", "GET", "HEAD"]
    response_header = ["Content-Type", "x-goog-content-length-range"]
    max_age_seconds = 3600
  }
}

resource "google_service_account" "api" {
  project      = var.project_id
  account_id   = var.service_account_id
  display_name = "api (object storage)"
}

# Object admin on this bucket only, not the project.
resource "google_storage_bucket_iam_member" "api" {
  bucket = google_storage_bucket.media.name
  role   = "roles/storage.objectAdmin"
  member = google_service_account.api.member
}
