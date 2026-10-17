# OpenTofu state: one bucket per environment, made by hand; the project too

Each environment's state is in a GCS bucket in that environment's project
(`gs://<project_id>-tfstate`), versioned, with the backend's native locking.
The bucket is created once with two `gcloud` commands: a bootstrap root
managing it would need its own state, kept locally or migrated into the
bucket it creates, which is more moving parts than two commands. The GCP
project is created by hand for similar reasons: linking billing needs the
billing account, and a root that creates its own project would need its
state elsewhere. Both are in [Infrastructure](../infrastructure.md).
