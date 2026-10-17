#!/usr/bin/env bash
# Requires pre-provisioned Artifact Registry, Cloud SQL, service account and secret.
set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${CLOUD_SQL_CONNECTION_NAME:?Set CLOUD_SQL_CONNECTION_NAME (project:region:instance)}"
: "${POSTGRES_USER:?Set POSTGRES_USER}"
: "${POSTGRES_DB:?Set POSTGRES_DB}"
: "${DB_PASSWORD_SECRET:?Set DB_PASSWORD_SECRET (Secret Manager secret name)}"

REGION="${REGION:-asia-east1}"
SERVICE="${SERVICE:-binsoon-api}"
REPOSITORY="${REPOSITORY:-binsoon}"
RUNTIME_SERVICE_ACCOUNT="${RUNTIME_SERVICE_ACCOUNT:-binsoon-api@${GCP_PROJECT_ID}.iam.gserviceaccount.com}"
SECRET_VERSION="${SECRET_VERSION:-latest}"
BUILD_SERVICE_ACCOUNT="${BUILD_SERVICE_ACCOUNT:-binsoon-build@${GCP_PROJECT_ID}.iam.gserviceaccount.com}"
PUBLIC_ACCESS="${PUBLIC_ACCESS:-false}"
case "$PUBLIC_ACCESS" in
  true) ACCESS_FLAG=--allow-unauthenticated ;;
  false) ACCESS_FLAG=--no-allow-unauthenticated ;;
  *) echo 'PUBLIC_ACCESS must be true or false' >&2; exit 2 ;;
esac

BACKEND_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_TAG="${IMAGE_TAG:-$(date -u +%Y%m%d%H%M%S)-$(git -C "$BACKEND_DIR" rev-parse --short HEAD)}"
IMAGE="${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${REPOSITORY}/${SERVICE}:${IMAGE_TAG}"
JOB="${SERVICE}-initialize"
# gcloud's default comma delimiter is safe for this project's validated names.
ENV_VARS="POSTGRES_HOST=/cloudsql/${CLOUD_SQL_CONNECTION_NAME},POSTGRES_PORT=5432,POSTGRES_USER=${POSTGRES_USER},POSTGRES_DB=${POSTGRES_DB}"

GCLOUD="${GCLOUD:-gcloud}"
"$GCLOUD" builds submit "$BACKEND_DIR" --project="$GCP_PROJECT_ID" \
  --config="$BACKEND_DIR/deploy/cloudbuild.yaml" \
  --service-account="projects/${GCP_PROJECT_ID}/serviceAccounts/${BUILD_SERVICE_ACCOUNT}" \
  --substitutions="_IMAGE=${IMAGE}" --quiet
# Resolve the immutable image digest so both the job and service use the same build.
DIGEST="$("$GCLOUD" artifacts docker images describe "$IMAGE" --project="$GCP_PROJECT_ID" --format='value(image_summary.digest)')"
: "${DIGEST:?Could not resolve built image digest}"
IMAGE="${IMAGE%:*}@${DIGEST}"

"$GCLOUD" run jobs deploy "$JOB" \
  --project="$GCP_PROJECT_ID" --region="$REGION" --image="$IMAGE" \
  --service-account="$RUNTIME_SERVICE_ACCOUNT" \
  --set-cloudsql-instances="$CLOUD_SQL_CONNECTION_NAME" \
  --set-env-vars="$ENV_VARS" \
  --set-secrets="POSTGRES_PASSWORD=${DB_PASSWORD_SECRET}:${SECRET_VERSION}" \
  --command=python --args=-m,scripts.initialize_db \
  --tasks=1 --parallelism=1 --max-retries=0 --task-timeout=600s \
  --cpu=1 --memory=512Mi --quiet

"$GCLOUD" run jobs execute "$JOB" --project="$GCP_PROJECT_ID" --region="$REGION" --wait --quiet

"$GCLOUD" run deploy "$SERVICE" \
  --project="$GCP_PROJECT_ID" --region="$REGION" --image="$IMAGE" \
  --service-account="$RUNTIME_SERVICE_ACCOUNT" --execution-environment=gen2 \
  --add-cloudsql-instances="$CLOUD_SQL_CONNECTION_NAME" \
  --set-env-vars="$ENV_VARS" \
  --set-secrets="POSTGRES_PASSWORD=${DB_PASSWORD_SECRET}:${SECRET_VERSION}" \
  --port=8080 --cpu=1 --memory=512Mi --concurrency=8 \
  --min-instances=0 --max-instances=2 --timeout=60s \
  "$ACCESS_FLAG" --quiet

"$GCLOUD" run services describe "$SERVICE" --project="$GCP_PROJECT_ID" --region="$REGION" --format='value(status.url)'
