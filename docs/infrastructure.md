# Infrastructure (GCP, OpenTofu)

Cloud resources outside Railway are managed with
[OpenTofu](https://opentofu.org) in [`infra/`](../infra/README.md). So far
that's the dev environment's Google Cloud resources: the media bucket and
the service account the api signs URLs with. Nothing identifying is
committed: each root's values (the GCP project, the Railway web origin) go
in its gitignored `terraform.tfvars`, and everything else is named after the
project. Below, `PROJECT_ID` stands for the environment's project ID.
Railway itself is configured separately, in `.railway/railway.ts` (see
[Deployment](deployment.md)).

The api on Railway uses them through `STORAGE_DRIVER`, `GCS_BUCKET`, and
`GCS_CREDENTIALS` in `.railway/railway.ts` (see
[Deployment](deployment.md) and
[Storage](storage.md#production-when-a-provider-is-chosen)).

## Layout

| Path                                      | What                                                                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `infra/modules/media-bucket`              | the private media bucket (uniform access, public access prevention, CORS), its service account, IAM                   |
| `infra/envs/dev`                          | the dev root: the GCP project from `terraform.tfvars`, region `us-west1` (near Railway's `sfo`), APIs, the module     |
| `infra/envs/dev/terraform.tfvars.example` | the template for dev's values (project, region, the Railway web origin); copy it to the gitignored `terraform.tfvars` |
| `infra/envs/dev/.envrc`                   | [direnv](https://direnv.net): sets gcloud's project to `terraform.tfvars`'s `project_id` in that directory            |
| `.terraform.lock.hcl`                     | each root's provider lock (exact versions and hashes for Linux and macOS), committed                                  |

One root per environment, each in **its own GCP project with its own state
bucket**. Production, when it comes, is `infra/envs/prod/` using the same
module, so dev credentials can neither change nor read it.

Versions: OpenTofu `~> 1.13` (CI uses 1.13.1), the `hashicorp/google`
provider `~> 8.6`, exact version in the lock file.

## Install the tools

Only needed to change infrastructure, not to develop the app:

- **OpenTofu** 1.13: `brew install opentofu`, or the
  [installer](https://opentofu.org/docs/intro/install/) (deb/rpm repos,
  standalone binary).
- **gcloud** (Google Cloud CLI):
  [install](https://cloud.google.com/sdk/docs/install).

Then sign in twice, once for gcloud's own commands and once for the
credentials OpenTofu uses (Application Default Credentials):

```sh
gcloud auth login
gcloud auth application-default login
```

### gcloud project per directory

Optional: with [direnv](https://direnv.net) (`apt install direnv` or
`brew install direnv`, then add its
[shell hook](https://direnv.net/docs/hook.html), e.g.
`eval "$(direnv hook bash)"` in `~/.bashrc`), each root's committed `.envrc`
sets `CLOUDSDK_CORE_PROJECT` to that environment's project, so `gcloud`
commands run in `infra/envs/dev` target its project without `--project`,
and your global gcloud config applies again once you leave. Allow it once
(and again whenever it changes):

```sh
cd infra/envs/dev
direnv allow
gcloud config list   # project = PROJECT_ID
```

It only affects gcloud: OpenTofu takes the project from `terraform.tfvars`.
The commands below pass `--project` (or name it in the account email)
anyway, so they work without direnv. A new root gets its own `.envrc` with
its project.

## Remote state

State lives in a GCS bucket per environment (`gs://PROJECT_ID-tfstate`,
prefix `envs/dev`; the backend block builds the name from `var.project_id`,
which OpenTofu evaluates early, so `tofu init` needs `terraform.tfvars`), so anyone with access to the project shares it. The
`gcs` backend locks the state during `plan` and `apply` by itself.
Versioning is on, so an old state can be restored; uniform access and
public access prevention keep it private.

The state bucket can't be created by the code whose state it holds, so it's
created once by hand with `gcloud` (below) rather than by a separate
bootstrap root with its own local state to keep somewhere.

## Setting up an environment

The project is created by hand too: linking billing needs the billing
account, and a root that created its own project would need its state
outside that project. Create it in the Cloud console (which appends a
number to the name to make the global ID), then copy the root's
`terraform.tfvars.example` to `terraform.tfvars` and fill in the project ID
and the web origin. Once per project:

```sh
gcloud billing accounts list              # note the ACCOUNT_ID
gcloud billing projects link PROJECT_ID --billing-account=ACCOUNT_ID

gcloud storage buckets create gs://PROJECT_ID-tfstate \
  --project=PROJECT_ID \
  --location=us-west1 --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets update gs://PROJECT_ID-tfstate --versioning
```

Then apply the root (`plan` first, and read it):

```sh
cd infra/envs/dev
tofu init
tofu plan
tofu apply
```

The root enables the APIs it needs (`iam.googleapis.com`,
`storage.googleapis.com`), then creates the bucket `PROJECT_ID-media` and
the service account `api-storage`, with Storage Object Admin on that bucket
only. `tofu output` prints the bucket name (the api's `GCS_BUCKET`, given to
Railway as `RAILWAY_GCS_BUCKET`, see
[Deployment](deployment.md#the-railway-project-as-code)) and the account's
email.

## The service account key

The api runs on Railway, outside Google Cloud, and Railway has no workload
identity that Google could trust
([Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)),
so the api authenticates with a service account key, `GCS_CREDENTIALS`
(the key file's JSON). OpenTofu doesn't create it: the private key would be
stored in the state. Create it with `gcloud` and pipe it straight into the
Railway variable, so it's never written to disk:

```sh
gcloud iam service-accounts keys create - \
    --iam-account="$(tofu -chdir=infra/envs/dev output -raw api_service_account_email)" \
  | jq -c . \
  | npx @railway/cli variable set GCS_CREDENTIALS --stdin --service api --skip-deploys
```

(`-` writes the key to stdout; `jq -c` puts it on one line.) Set it once
`.railway/railway.ts` lists `GCS_CREDENTIALS: preserve()`, or the next
release's `config apply` would have to delete it, which it refuses (see
[Deployment](deployment.md#the-railway-project-as-code)).

To rotate it, create a new key the same way, then delete the old one:

```sh
gcloud iam service-accounts keys list --managed-by=user \
  --iam-account=api-storage@PROJECT_ID.iam.gserviceaccount.com
gcloud iam service-accounts keys delete KEY_ID \
  --iam-account=api-storage@PROJECT_ID.iam.gserviceaccount.com
```

If the `railway` step fails after the key was created, delete that key the
same way. A project under an organisation may forbid keys
(`iam.disableServiceAccountKeyCreation`); a personal project has no such
policy.

## Changing infrastructure

Edit the module or root, run `tofu fmt -recursive infra`, then `tofu plan`
and `tofu apply` in the root. Apply by hand, from a machine signed in as
above; review the plan before saying yes. When changing provider versions,
update the lock file for every platform:

```sh
tofu providers lock -platform=linux_amd64 -platform=linux_arm64 \
  -platform=darwin_amd64 -platform=darwin_arm64
```

## CI

`.github/workflows/infra.yml` runs on pull requests and pushes to `main`
that touch `infra/`: `tofu fmt -check`, then `tofu init -backend=false` and
`tofu validate` in each root. It has no Google credentials, so it never
plans or applies, and can't catch what only the API would refuse (a taken
name, a missing permission). The `pre-commit` hook also formats staged `.tf`
files with `tofu fmt` (see
[Development](development.md#git-hooks)).
