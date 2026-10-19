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
# Custom delimiter preserves the commas in the CORS JSON array.
DEMO_AUTH_ENABLED="${DEMO_AUTH_ENABLED:-false}"
CORS_ORIGINS="${CORS_ORIGINS:-[]}"
MEDIA_BUCKET="${MEDIA_BUCKET:-}"
MEDIA_SIGNING_SERVICE_ACCOUNT="${MEDIA_SIGNING_SERVICE_ACCOUNT:-$RUNTIME_SERVICE_ACCOUNT}"
case "$DEMO_AUTH_ENABLED" in true|false) ;; *) echo 'DEMO_AUTH_ENABLED must be true or false' >&2; exit 2 ;; esac
for value in "$CLOUD_SQL_CONNECTION_NAME" "$POSTGRES_USER" "$POSTGRES_DB" "$CORS_ORIGINS" "$MEDIA_BUCKET" "$MEDIA_SIGNING_SERVICE_ACCOUNT"; do
  if [[ "$value" == *'~'* ]]; then echo 'Deployment setting contains reserved delimiter ~' >&2; exit 2; fi
done
ENV_VARS="^~^POSTGRES_HOST=/cloudsql/${CLOUD_SQL_CONNECTION_NAME}~POSTGRES_PORT=5432~POSTGRES_USER=${POSTGRES_USER}~POSTGRES_DB=${POSTGRES_DB}~DEMO_AUTH_ENABLED=${DEMO_AUTH_ENABLED}~CORS_ORIGINS=${CORS_ORIGINS}~MEDIA_BACKEND=gcs~MEDIA_BUCKET=${MEDIA_BUCKET}~MEDIA_SIGNING_SERVICE_ACCOUNT=${MEDIA_SIGNING_SERVICE_ACCOUNT}"

# Admin token; old secret setting names remain compatible.
SECRETS="POSTGRES_PASSWORD=${DB_PASSWORD_SECRET}:${SECRET_VERSION}"
ADMIN_SECRET="${ADMIN_SECRET:-${DEMO_ADMIN_SECRET:-}}"
ADMIN_SECRET_VERSION="${ADMIN_SECRET_VERSION:-${DEMO_ADMIN_SECRET_VERSION:-latest}}"
if [[ -n "$ADMIN_SECRET" ]]; then
  SECRETS+=",ADMIN_TOKEN=${ADMIN_SECRET}:${ADMIN_SECRET_VERSION}"
fi
if [[ "$DEMO_AUTH_ENABLED" == true ]]; then
  for role in CITIZEN STAFF ADMIN; do
    name="DEMO_${role}_PASSWORD_SECRET"
    secret="${!name:-}"
    name="DEMO_${role}_PASSWORD_SECRET_VERSION"
    version="${!name:-latest}"
    : "${secret:?Set DEMO_${role}_PASSWORD_SECRET (Secret Manager name, not password)}"
    SECRETS+=",DEMO_${role}_PASSWORD=${secret}:${version}"
  done
fi
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
  --set-secrets="$SECRETS" \
  --command=python --args=-m,scripts.initialize_db \
  --tasks=1 --parallelism=1 --max-retries=0 --task-timeout=600s \
  --cpu=1 --memory=512Mi --quiet

"$GCLOUD" run jobs execute "$JOB" --project="$GCP_PROJECT_ID" --region="$REGION" --wait --quiet

"$GCLOUD" run deploy "$SERVICE" \
  --project="$GCP_PROJECT_ID" --region="$REGION" --image="$IMAGE" \
  --service-account="$RUNTIME_SERVICE_ACCOUNT" --execution-environment=gen2 \
  --add-cloudsql-instances="$CLOUD_SQL_CONNECTION_NAME" \
  --set-env-vars="$ENV_VARS" \
  --set-secrets="$SECRETS" \
  --port=8080 --cpu=1 --memory=512Mi --concurrency=8 \
  --min-instances=0 --max-instances=2 --timeout=60s \
  "$ACCESS_FLAG" --quiet

"$GCLOUD" run services describe "$SERVICE" --project="$GCP_PROJECT_ID" --region="$REGION" --format='value(status.url)'
