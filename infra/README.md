# Infrastructure

Terraform-managed AWS infrastructure for SplitSmart.

In Milestone 0 this is a **skeleton**: provider + variables only, no resources. Subsequent milestones add VPC/networking, RDS (Postgres), ElastiCache (Redis), S3 (receipts), and ECS Fargate / EKS for the API and workers.

## Usage

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # edit values
terraform init
terraform plan
```

Configure a remote state backend (S3 + DynamoDB lock) before collaborative use.
