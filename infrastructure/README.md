# Infrastructure

## Prerequisites

- AWS CLI configured with appropriate permissions
- Docker installed and running
- ECR repository created: `freelancing-agent`
- ECS cluster created: `freelancing-agent`
- ECS services created: `freelancing-agent-api`, `freelancing-agent-worker`
- AWS Secrets Manager secret created with all required keys

## Environment Variables Required in Secrets Manager

Create a secret named `freelancing-agent/production` with these keys:
- MONGODB_URI
- REDIS_URL
- FREELANCER_API_TOKEN
- FREELANCER_API_BASE_URL
- OPENAI_API_KEY
- JWT_SECRET

## Deploying

```bash
export AWS_REGION=us-east-1
export ECR_REPO=freelancing-agent
export ECS_CLUSTER=freelancing-agent
export SECRETS_ARN=arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:freelancing-agent/production

./infrastructure/deploy.sh
```

## Frontend Deployment

The React frontend is deployed separately to S3 + CloudFront:

```bash
cd frontend
npm run build
aws s3 sync dist/ s3://YOUR_BUCKET_NAME/ --delete
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

## Health Check

The API health check endpoint is at `/health`. Add this route to Rails:

```ruby
# In routes.rb
get "/health", to: proc { [200, {}, ["ok"]] }
```
