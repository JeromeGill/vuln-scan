# The dev environment: GCP resources for the Railway dev deployment, in their
# own project (docs/infrastructure.md).

terraform {
  required_version = "~> 1.13"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.6"
    }
  }

  # Created by hand once, before the first `tofu init`
  # (docs/infrastructure.md#remote-state). Locks natively. Named after the
  # project: OpenTofu evaluates variables in the backend block early.
  backend "gcs" {
    bucket = "${var.project_id}-tfstate"
    prefix = "envs/dev"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region

  # Bill API quota to this project: with a user's credentials (gcloud's
  # application default login), some APIs otherwise refuse requests.
  billing_project       = var.project_id
  user_project_override = true
}

# Kept enabled on destroy: other things in the project may use them.
resource "google_project_service" "this" {
  for_each = toset([
    "iam.googleapis.com",
    "storage.googleapis.com",
  ])

  service            = each.value
  disable_on_destroy = false
}

module "media_bucket" {
  source = "../../modules/media-bucket"

  project_id  = var.project_id
  bucket_name = "${var.project_id}-media"
  location    = var.region
  web_origins = var.web_origins

  depends_on = [google_project_service.this]
}
