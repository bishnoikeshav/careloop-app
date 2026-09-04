require('dotenv').config();

module.exports = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'careloop-super-secure-production-jwt-secret-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  otpExpiresMinutes: parseInt(process.env.OTP_EXPIRES_MINUTES || '10', 10),

  // AWS Infrastructure Settings
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    cognitoUserPoolId: process.env.AWS_COGNITO_USER_POOL_ID || '',
    cognitoClientId: process.env.AWS_COGNITO_CLIENT_ID || '',
    sesSenderEmail: process.env.AWS_SES_SENDER_EMAIL || 'support@careloop.health',
    s3BucketName: process.env.AWS_S3_BUCKET_NAME || 'careloop-patient-assets',
    isAwsConfigured: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
  },

  // Security
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200 // max 200 requests per IP
  },
  corsOrigins: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:4000', 'http://127.0.0.1:4000', 'null']
};
