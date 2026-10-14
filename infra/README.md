# infra

[OpenTofu](https://opentofu.org) code for the cloud resources the app uses
outside Railway (Railway itself is `.railway/railway.ts`). So far: the dev
environment's GCP media bucket, and the service account the api uses for
it. Each root's values (GCP project, web origin) are in its gitignored
`terraform.tfvars`, copied from `terraform.tfvars.example`.

- `modules/media-bucket/`: the private media bucket, its CORS, and a service
  account with Storage Object Admin on it only. Reused by every
  environment.
- `envs/dev/`: the dev root, with state in `gs://<project_id>-tfstate`,
  and an `.envrc` that points gcloud at its
  project under [direnv](https://direnv.net). A production root will be
  `envs/prod/`, in its own project with its own state bucket.

Apply by hand (`tofu init`, `tofu plan`, `tofu apply` in a root); CI only
checks formatting and validity. Setup, state, keys, and the reasons are in
[docs/infrastructure.md](../docs/infrastructure.md).

What doesn't belong here: secrets (service account keys are created with
`gcloud`, never in tofu, so they stay out of the state), Railway settings,
and anything app code configures itself.
