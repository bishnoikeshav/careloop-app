const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config');

const authRoutes = require('./routes/authRoutes');
const gameRoutes = require('./routes/gameRoutes');
const callRoutes = require('./routes/callRoutes');
const languageRoutes = require('./routes/languageRoutes');

const app = express();

// 1. Security Headers (AWS Best Practice)
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows flexible CDN embeds (Tailwind, Google Fonts)
    crossOriginEmbedderPolicy: false
  })
);

// 2. CORS Handling
app.use(
  cors({
    origin: true, // Allow local file origins & web clients
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// 3. Rate Limiting for DDoS / Brute Force Protection (AWS WAF equivalent layer)
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', limiter);

// 4. Request Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 5. Serve Frontend Static Assets (Full CareLoop Application)
const publicPath = path.resolve(__dirname, '../../');
app.use(express.static(publicPath));

// 6. API Route Mounting
app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/languages', languageRoutes);

// Health check endpoint (for AWS ALB / Elastic Beanstalk / ECS target group health checks)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    version: '1.0.0',
    awsConfigured: config.aws.isAwsConfigured
  });
});

// 404 Fallback
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: `API route ${req.method} ${req.path} not found` });
  }
  next();
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`\n======================================================`);
    console.log(`  CareLoop Production Backend Live on Port: ${config.port}`);
    console.log(`  Local URL: http://localhost:${config.port}`);
    console.log(`  Health Check: http://localhost:${config.port}/health`);
    console.log(`  AWS SES / Security Mode: ${config.aws.isAwsConfigured ? 'AWS Cloud Active' : 'Dev Simulation Mode'}`);
    console.log(`======================================================\n`);
  });
}

module.exports = app;
