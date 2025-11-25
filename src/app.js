require('dotenv').config();

const express = require('express');
const path = require('path');
const oauthRoutes = require('./routes/oauth');
const webhookRoutes = require('./routes/webhook');
const crmCardRoutes = require('./routes/crmCard');
const analysisRoutes = require('./routes/analysis');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Routes
app.use('/oauth', oauthRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/crm-card', crmCardRoutes);
app.use('/api/analysis', analysisRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    app: 'HubSpot Multi-Threading Score App',
    version: '2.0.0',
    description: 'Calculates stakeholder coverage scores for deals with advanced analytics',
    features: [
      'AI-based role inference from job titles',
      'Coverage breadth vs depth analysis',
      'Stakeholder lifecycle tracking',
      'Champion reliability scoring',
      'Risk prediction with ML patterns',
      'Custom workflow actions',
      'Deal stage-specific thresholds',
      'Real-time threading alerts',
      'Inline playbooks and templates',
      'Exportable deal health reports'
    ],
    endpoints: {
      health: '/health',
      oauth: '/oauth',
      webhooks: '/webhooks',
      crmCard: '/crm-card',
      analysis: '/api/analysis'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`HubSpot Multi-Threading Score App running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
}

module.exports = app;
