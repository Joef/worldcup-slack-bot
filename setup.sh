#!/usr/bin/env bash
set -euo pipefail

# ── Inputs ────────────────────────────────────────────────────────────────────
SLACK_TOKEN_VALUE=""
SLACK_CHANNEL_VALUE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--token)   SLACK_TOKEN_VALUE="$2";   shift 2 ;;
    -c|--channel) SLACK_CHANNEL_VALUE="$2"; shift 2 ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

if [[ -z "${SLACK_TOKEN_VALUE}" || -z "${SLACK_CHANNEL_VALUE}" ]]; then
  echo "Usage: ./deploy.sh -t <slack-token> -c <slack-channel>"
  echo "  Example: ./deploy.sh --token xoxb-123456 --channel '#worldcup'"
  exit 1
fi

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

# ── One-time setup (safe to re-run) ───────────────────────────────────────────

echo "Enabling required GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudscheduler.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  --project="${PROJECT_ID}"

echo "Creating service account..."
gcloud iam service-accounts create "${SA_NAME}" \
  --display-name="WorldCup Bot" \
  --project="${PROJECT_ID}" || true

echo "Creating GCS bucket for state..."
gcloud storage buckets create "gs://${BUCKET_NAME}" \
  --location="${REGION}" \
  --project="${PROJECT_ID}" || true

echo "Granting SA objectAdmin on bucket..."
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET_NAME}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin"

echo "Creating secrets in Secret Manager..."
echo -n "${SLACK_TOKEN_VALUE}" | \
  gcloud secrets create slack-token --data-file=- --project="${PROJECT_ID}" || true
echo -n "#${SLACK_CHANNEL_VALUE}" | \
  gcloud secrets create slack-channel --data-file=- --project="${PROJECT_ID}" || true

echo "Granting SA access to secrets..."
for SECRET in slack-token slack-channel; do
  gcloud secrets add-iam-policy-binding "${SECRET}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --project="${PROJECT_ID}"
done

echo "Uploading initial DB state to GCS..."
echo '{"live_matches":[],"etag":{}}' | \
  gcloud storage cp - "gs://${BUCKET_NAME}/worldCupDB.json" || true


echo "Creating Cloud Scheduler trigger (every minute)..."
gcloud scheduler jobs create http "${JOB_NAME}-trigger" \
  --location="${REGION}" \
  --schedule="15-23,0-4 * * *" \
  --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${JOB_NAME}:run" \
  --http-method=POST \
  --oauth-service-account-email="${SA_EMAIL}" \
  --project="${PROJECT_ID}" || true