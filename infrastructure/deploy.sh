#!/bin/bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPO="${ECR_REPO:-freelancing-agent}"
ECS_CLUSTER="${ECS_CLUSTER:-freelancing-agent}"
ECS_SERVICE_API="${ECS_SERVICE_API:-freelancing-agent-api}"
ECS_SERVICE_WORKER="${ECS_SERVICE_WORKER:-freelancing-agent-worker}"

AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com"
IMAGE_TAG="${ECR_REGISTRY}/${ECR_REPO}:latest"

echo "=== Building production Docker image ==="
docker build -f Dockerfile.production -t "${ECR_REPO}:latest" .
docker tag "${ECR_REPO}:latest" "${IMAGE_TAG}"

echo "=== Authenticating with ECR ==="
aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin "${ECR_REGISTRY}"

echo "=== Pushing image to ECR ==="
docker push "${IMAGE_TAG}"

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

echo "=== Deploy complete! ==="
