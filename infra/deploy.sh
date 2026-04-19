#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Flappy Aadhan — Full deploy script
# Usage: ./infra/deploy.sh [--region us-east-1] [--profile myprofile]
#
# Prerequisites:
#   - AWS CLI v2 installed and configured
#   - AWS SAM CLI installed  (brew install aws-sam-cli)
#   - Node.js 20+ installed
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

STACK_NAME="flappy-aadhan"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
PROFILE="${AWS_PROFILE:-default}"
SAM_BUCKET=""   # filled in automatically after first deploy

# Parse optional flags
while [[ $# -gt 0 ]]; do
  case $1 in
    --region)  REGION="$2";  shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "▶ Region:  $REGION"
echo "▶ Profile: $PROFILE"
echo "▶ Stack:   $STACK_NAME"
echo ""

# ── Step 1: Install Lambda dependencies ──────────────────────────────────────
echo "── [1/5] Installing Lambda dependencies..."
cd "$ROOT_DIR/lambda"
npm ci --omit=dev --silent
cd "$ROOT_DIR"

# ── Step 2: SAM build ─────────────────────────────────────────────────────────
echo "── [2/5] Building SAM application..."
sam build \
  --template-file "$SCRIPT_DIR/template.yaml" \
  --region "$REGION" \
  --profile "$PROFILE"

# ── Step 3: SAM deploy (creates/updates stack) ────────────────────────────────
echo "── [3/5] Deploying CloudFormation stack..."
sam deploy \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --capabilities CAPABILITY_IAM \
  --resolve-s3 \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset

# ── Step 4: Fetch stack outputs ───────────────────────────────────────────────
echo "── [4/5] Fetching stack outputs..."
OUTPUTS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query "Stacks[0].Outputs" \
  --output json)

BUCKET=$(echo "$OUTPUTS"       | python3 -c "import sys,json; o=json.load(sys.stdin); print(next(x['OutputValue'] for x in o if x['OutputKey']=='FrontendBucketName'))")
CF_URL=$(echo "$OUTPUTS"       | python3 -c "import sys,json; o=json.load(sys.stdin); print(next(x['OutputValue'] for x in o if x['OutputKey']=='CloudFrontURL'))")
DIST_ID=$(echo "$OUTPUTS"      | python3 -c "import sys,json; o=json.load(sys.stdin); print(next(x['OutputValue'] for x in o if x['OutputKey']=='DistributionId'))")
API_ENDPOINT=$(echo "$OUTPUTS" | python3 -c "import sys,json; o=json.load(sys.stdin); print(next(x['OutputValue'] for x in o if x['OutputKey']=='ApiEndpoint'))")

echo "   Bucket:      $BUCKET"
echo "   CF URL:      $CF_URL"
echo "   Dist ID:     $DIST_ID"
echo "   API:         $API_ENDPOINT"

# ── Step 5: Upload frontend assets ────────────────────────────────────────────
echo "── [5/5] Uploading frontend to S3..."

# index.html — no-cache so players always get the latest version
aws s3 cp "$ROOT_DIR/index.html" "s3://$BUCKET/index.html" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html; charset=utf-8"

# Assets — long cache (1 year) since filenames are stable
aws s3 sync "$ROOT_DIR/assets/" "s3://$BUCKET/assets/" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --cache-control "public, max-age=31536000, immutable" \
  --delete

# Invalidate CloudFront cache for index.html only (assets are immutable)
echo "   Invalidating CloudFront cache for /index.html..."
aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths "/index.html" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --output text --query "Invalidation.Id" | xargs -I{} echo "   Invalidation ID: {}"

echo ""
echo "✅ Deploy complete!"
echo "   Game URL: $CF_URL"
echo "   API:      $API_ENDPOINT"
echo ""
echo "   Next: add the API endpoint to your game config:"
echo "   API_ENDPOINT: '$API_ENDPOINT'"
