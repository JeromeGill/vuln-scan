# GCP infrastructure in OpenTofu, applied by hand

Cloud resources outside Railway (so far the dev media bucket) are code in
`infra/`, with [OpenTofu](https://opentofu.org) rather than Terraform: the
same language and providers under an open-source licence (Terraform's is
the BSL). Railway's own Infrastructure as Code only covers Railway.
Each environment is one root (`infra/envs/dev`) in **its own GCP project**,
with shared resources in modules, so dev credentials (on Railway, on a
laptop) never reach production. Applies are done by hand after reading the
plan; CI only runs `fmt` and `validate`, with no credentials, because giving
GitHub Actions rights to change GCP isn't worth it for a resource that
changes a few times a year. See [Infrastructure](../infrastructure.md).
