# CareLoop — AWS Production Architecture & Security Specification

This document details the enterprise-grade AWS security posture, compliance, and deployment architecture implemented for CareLoop.

---

## 1. High-Level AWS Architecture

```
                       ┌───────────────────────┐
                       │   AWS Route 53        │
                       │   (DNS & Healthcheck) │
                       └───────────┬───────────┘
                                   │
                       ┌───────────▼───────────┐
                       │   AWS CloudFront CDN  │
                       │   (TLS 1.3 Termination│
                       └───────────┬───────────┘
                                   │
                       ┌───────────▼───────────┐
                       │   AWS WAF             │
                       │   (Rate limit, DDoS,  │
                       │    OWASP Top 10)      │
                       └───────────┬───────────┘
                                   │
                       ┌───────────▼───────────┐
                       │   Application Load    │
                       │   Balancer (ALB)      │
                       └───────────┬───────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              │                                         │
    ┌─────────▼───────────┐                   ┌─────────▼───────────┐
    │  ECS Fargate / EB   │                   │  Amazon S3 Bucket   │
    │  Node.js API        │                   │  Encrypted Family   │
    │  (Port 4000)        │                   │  Memory Assets      │
    └─────────┬───────────┘                   └─────────┬───────────┘
              │                                         │
    ┌─────────▼───────────┐                   ┌─────────▼───────────┐
    │  AWS Secrets Manager│                   │  CloudFront OAC     │
    │  & AWS KMS (Keys)   │                   │  Origin Access      │
    └─────────────────────┘                   └─────────────────────┘
              │
    ┌─────────▼───────────┐
    │  Amazon SES /       │
    │  AWS Cognito Pool   │
    │  (Auth & 6-Digit)   │
    └─────────────────────┘
```

---

## 2. Authentication & Identity (AWS Cognito & SES)

### AWS Cognito User Pool
- **User Attributes**: `email` (primary alias, verified), `name`, `custom:role` (`caregiver` | `patient` | `clinician`).
- **Password Policy**:
  - Minimum 10 characters.
  - Require lowercase, uppercase, numbers, and special symbols.
- **MFA / Code-Generated Auth**:
  - Optional TOTP authenticator app integration or SMS/Email verification codes.
  - JWT tokens signed via asymmetric RS256 with key rotation.
  - Client token verification using public JWKS: `https://cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/jwks.json`.

### AWS SES (Simple Email Service)
- **Domain Verification**: DKIM (DomainKeys Identified Mail) with three CNAME records in Route 53.
- **DMARC Policy**: `v=DMARC1; p=reject; rua=mailto:dmarc-reports@careloop.health`.
- **SPF Record**: `v=spf1 include:amazonses.com ~all`.
- **Rate & Reputation**: Dedicated IP pool recommended for transactional medical OTP emails to guarantee < 2.5 second delivery latency.

---

## 3. Data Protection & Encryption (AWS KMS)

- **Encryption at Rest**:
  - AWS KMS Customer Managed Keys (CMK) configured with annual rotation.
  - S3 bucket default encryption: `aws:kms` using dedicated Key ARN.
  - Database (RDS/Aurora) encrypted using KMS CMK.
- **Encryption in Transit**:
  - Strict HTTPS enforcement with TLS 1.3 minimum.
  - HTTP Strict Transport Security (HSTS) with `max-age=63072000; includeSubDomains; preload`.

---

## 4. Web Application Firewall (AWS WAF) Rules

1. **AWS-Managed Common Rule Set**: Defends against OWASP Top 10 vulnerabilities (SQLi, XSS, RCE).
2. **AWS-Managed IP Reputation List**: Blocks known malicious IP addresses, scanners, and botnets.
3. **Custom Rate Limiting Rule**:
   - Limit: 300 requests per 5-minute window per IP for general endpoints.
   - Limit: 10 requests per 10-minute window for `/api/auth/send-otp` to eliminate SMS/Email flooding.

---

## 5. Storage & Vault Security (Amazon S3)

- **Block Public Access**: All 4 S3 Block Public Access settings enabled (`BlockPublicAcls`, `IgnorePublicAcls`, `BlockPublicPolicy`, `RestrictPublicBuckets`).
- **CloudFront Origin Access Control (OAC)**: Media bucket only accepts read requests signed by CloudFront Distribution ARN.
- **Presigned URLs**: Caregiver photo uploads utilize short-lived (15-minute) AWS S3 Presigned `PUT` URLs generated server-side after verifying JWT authentication.

---

## 6. IAM Least-Privilege Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSESEmailDispatch",
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "arn:aws:ses:us-east-1:*:identity/careloop.health"
    },
    {
      "Sid": "AllowS3FamilyVaultAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::careloop-patient-assets/*"
    },
    {
      "Sid": "AllowKMSDecrypt",
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt",
        "kms:GenerateDataKey"
      ],
      "Resource": "arn:aws:kms:us-east-1:*:key/careloop-production-key"
    }
  ]
}
```

---

## 7. Deployment Instructions

### Option A: Docker Deployment (Fastest)
```bash
cd backend
docker build -t careloop-api:latest -f ../infra/Dockerfile .
docker run -p 4000:4000 --env-file .env careloop-api:latest
```

### Option B: AWS Elastic Beanstalk
```bash
eb init -p node.js careloop-api --region us-east-1
eb create careloop-production-env
eb setenv JWT_SECRET="your-64-bit-key" AWS_REGION="us-east-1"
eb deploy
```
