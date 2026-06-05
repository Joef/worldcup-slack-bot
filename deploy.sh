#!/usr/bin/env bash
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
PROJECT_NUMBER="500692805021"
REGION="us-central1"
JOB_NAME="worldcup-bot"
BUCKET_NAME="worldcup-bot-state"
SA_NAME="worldcup-bot-sa"


echo "Resolving project ID from project number ${PROJECT_NUMBER}..."
PROJECT_ID=$(gcloud projects describe "${PROJECT_NUMBER}" --format='value(projectId)')
echo "Project ID: ${PROJECT_ID}"

SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
IMAGE="gcr.io/${PROJECT_ID}/${JOB_NAME}"

# ── Build & deploy ─────────────────────────────────────────────────────────────

echo "Building and pushing Docker image..."
gcloud builds submit --tag "${IMAGE}" .

echo "Deploying Cloud Run Job..."
gcloud run jobs deploy "${JOB_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --service-account "${SA_EMAIL}" \
  --task-timeout=60s \
  --max-retries=0 \
  --set-env-vars="ENVIRONMENT=prod,GCS_BUCKET=${BUCKET_NAME}" \
  --set-secrets="SLACK_TOKEN=slack-token:latest,SLACK_CHANNEL=slack-channel:latest" \
  --project="${PROJECT_ID}"

echo ""
echo "Done! Test manually with:"
echo "  gcloud run jobs execute ${JOB_NAME} --region=${REGION} --wait"
