# Service account keys are created with gcloud, not OpenTofu

Railway can't use Workload Identity Federation (Google has no identity to
trust for a Railway container), so the api needs a service account key
(`GCS_CREDENTIALS`). Creating it with `google_service_account_key` would
store the private key in the state, readable by anyone who can read the
state bucket, and in every old version of it. Instead tofu creates the
account and its bucket role, and the key is made with
`gcloud iam service-accounts keys create -` piped straight into
`railway variable set`, so it's never written to disk. The cost: tofu
doesn't know about keys, so rotating or revoking one is a manual `gcloud`
step (see [Infrastructure](../infrastructure.md#the-service-account-key)).
