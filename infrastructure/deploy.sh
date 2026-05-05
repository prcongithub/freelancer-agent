#!/bin/bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPO="${ECR_REPO:-freelancing-agent}"
ECS_CLUSTER="${ECS_CLUSTER:-freelancing-agent}"
ECS_SERVICE_API="${ECS_SERVICE_API:-freelancing-agent-api}"
ECS_SERVICE_WORKER="${ECS_SERVICE_WORKER:-freelancing-agent-worker}"

AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com"
GIT_SHA=$(git rev-parse --short HEAD)
IMAGE_TAG="${ECR_REGISTRY}/${ECR_REPO}:${GIT_SHA}"
LATEST_TAG="${ECR_REGISTRY}/${ECR_REPO}:latest"

echo "=== Building production Docker image (${GIT_SHA}) ==="
docker build -f Dockerfile.production -t "${ECR_REPO}:${GIT_SHA}" .
docker tag "${ECR_REPO}:${GIT_SHA}" "${IMAGE_TAG}"
docker tag "${ECR_REPO}:${GIT_SHA}" "${LATEST_TAG}"

echo "=== Authenticating with ECR ==="
aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin "${ECR_REGISTRY}"

echo "=== Pushing image to ECR ==="
docker push "${IMAGE_TAG}"
docker push "${LATEST_TAG}"

echo "=== Updating ECS services ==="
aws ecs update-service \
  --cluster "${ECS_CLUSTER}" \
  --service "${ECS_SERVICE_API}" \
  --force-new-deployment \
  --region "${AWS_REGION}" \
  --output text --query "service.serviceName"

aws ecs update-service \
  --cluster "${ECS_CLUSTER}" \
  --service "${ECS_SERVICE_WORKER}" \
  --force-new-deployment \
  --region "${AWS_REGION}" \
  --output text --query "service.serviceName"

echo "=== Waiting for API service to stabilize ==="
aws ecs wait services-stable \
  --cluster "${ECS_CLUSTER}" \
  --services "${ECS_SERVICE_API}" \
  --region "${AWS_REGION}"

echo "=== Waiting for Worker service to stabilize ==="
aws ecs wait services-stable \
  --cluster "${ECS_CLUSTER}" \
  --services "${ECS_SERVICE_WORKER}" \
  --region "${AWS_REGION}"

echo "=== Setting CloudWatch log retention ==="
aws logs put-retention-policy \
  --log-group-name "/ecs/freelancing-agent" \
  --retention-in-days 30 \
  --region "${AWS_REGION}" || true

echo "Deployed image: ${IMAGE_TAG}"
echo "=== Deploy complete! ==="
