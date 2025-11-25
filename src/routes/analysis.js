const express = require('express');
const router = express.Router();
const HubSpotService = require('../services/hubspotService');
const { calculateMultiThreadingScore, generateRecommendations } = require('../services/scoringService');
const { calculateCoverageAnalysis, generateMissingChecklist, trackStakeholderLifecycle, calculateChampionStrength } = require('../services/coverageAnalysisService');
const { predictDealRisk, analyzeStageVelocity } = require('../services/riskPredictionService');
const { generateThreadingAlerts, sendAlerts } = require('../services/alertService');
const { handleWorkflowAction, getAvailableActions } = require('../services/workflowActionsService');
const { generateDealHealthReport, generateCoachingPacket, generatePipelineDashboard, generateTimelineEvents, formatReportAsHtml } = require('../services/reportService');
const { getContextualRecommendations, renderEmailTemplate, EMAIL_TEMPLATES, PLAYBOOKS, ROLE_CHECKLISTS } = require('../services/playbookService');
const oauthRoutes = require('./oauth');

/**
 * Get coverage analysis (breadth vs depth) for a deal
 */
router.get('/coverage/:dealId', async (req, res) => {
  const { dealId } = req.params;
  const { portalId } = req.query;
  
  try {
    const accessToken = await oauthRoutes.getAccessToken(portalId);
    const hubspotService = new HubSpotService(accessToken);
    const dealData = await hubspotService.getDealWithContacts(dealId);
    
    const scoreData = calculateMultiThreadingScore(dealData, { enableRoleInference: true });
    const coverageAnalysis = calculateCoverageAnalysis(
      dealData.contacts || [],
      { dealStage: dealData.deal?.dealstage }
    );
    
    res.json({
      dealId,
      dealName: dealData.deal?.dealname,
      score: scoreData.overallScore,
      coverage: coverageAnalysis,
      missingChecklist: generateMissingChecklist(coverageAnalysis)
    });
  } catch (error) {
    console.error('Coverage analysis error:', error);
    res.status(500).json({ error: 'Failed to get coverage analysis' });
  }
});

/**
 * Get champion strength analysis for a deal
 */
router.get('/champion/:dealId', async (req, res) => {
  const { dealId } = req.params;
  const { portalId } = req.query;
  
  try {
    const accessToken = await oauthRoutes.getAccessToken(portalId);
    const hubspotService = new HubSpotService(accessToken);
    const dealData = await hubspotService.getDealWithContacts(dealId);
    
    const scoreData = calculateMultiThreadingScore(dealData, { enableRoleInference: true });
    
    // Find champion(s)
    const champions = scoreData.contacts.filter(c => 
      (c.effectiveRole || '').toUpperCase() === 'CHAMPION'
    );
    
    if (champions.length === 0) {
      return res.json({
        dealId,
        hasChampion: false,
        recommendation: 'No champion identified. Consider developing an internal advocate.',
        potentialChampions: scoreData.contacts
          .filter(c => c.engagementScore >= 50)
          .map(c => ({ name: c.name, email: c.email, engagementScore: c.engagementScore }))
      });
    }
    
    const championAnalysis = champions.map(champion => ({
      contact: {
        name: champion.name,
        email: champion.email,
        jobTitle: champion.jobTitle
      },
      strength: calculateChampionStrength(champion, {})
    }));
    
    res.json({
      dealId,
      hasChampion: true,
      champions: championAnalysis
    });
  } catch (error) {
    console.error('Champion analysis error:', error);
    res.status(500).json({ error: 'Failed to get champion analysis' });
  }
});

/**
 * Get risk prediction for a deal
 */
router.get('/risk/:dealId', async (req, res) => {
  const { dealId } = req.params;
  const { portalId } = req.query;
  
  try {
    const accessToken = await oauthRoutes.getAccessToken(portalId);
    const hubspotService = new HubSpotService(accessToken);
    const dealData = await hubspotService.getDealWithContacts(dealId);
    
    const scoreData = calculateMultiThreadingScore(dealData, { enableRoleInference: true });
    const riskPrediction = predictDealRisk(dealData, scoreData, {});
    const stageVelocity = analyzeStageVelocity(dealData);
    
    res.json({
      dealId,
      dealName: dealData.deal?.dealname,
      currentStage: dealData.deal?.dealstage,
      riskPrediction,
      stageVelocity
    });
  } catch (error) {
    console.error('Risk prediction error:', error);
    res.status(500).json({ error: 'Failed to get risk prediction' });
  }
});

/**
 * Generate and optionally send threading alerts
 */
router.post('/alerts/:dealId', async (req, res) => {
  const { dealId } = req.params;
  const { portalId, slackWebhookUrl, sendNotifications = false } = req.body;
  
  try {
    const accessToken = await oauthRoutes.getAccessToken(portalId);
    const hubspotService = new HubSpotService(accessToken);
    const dealData = await hubspotService.getDealWithContacts(dealId);
    
    const scoreData = calculateMultiThreadingScore(dealData, { enableRoleInference: true });
    const coverageAnalysis = calculateCoverageAnalysis(
      dealData.contacts || [],
      { dealStage: dealData.deal?.dealstage }
    );
    
    const alerts = generateThreadingAlerts(dealData, scoreData, coverageAnalysis, null);
    
    let sendResults = null;
    if (sendNotifications && alerts.length > 0) {
      sendResults = await sendAlerts(alerts, { slackWebhookUrl });
    }
    
    res.json({
      dealId,
      alertCount: alerts.length,
      alerts,
      sendResults
    });
  } catch (error) {
    console.error('Alert generation error:', error);
    res.status(500).json({ error: 'Failed to generate alerts' });
  }
});

/**
 * Execute a workflow action
 */
router.post('/workflow/action', async (req, res) => {
  const { actionType, params, dealId, portalId } = req.body;
  
  try {
    const accessToken = await oauthRoutes.getAccessToken(portalId);
    const hubspotService = new HubSpotService(accessToken);
    const dealData = await hubspotService.getDealWithContacts(dealId);
    
    const result = handleWorkflowAction(actionType, params, dealData);
    
    res.json({
      dealId,
      actionType,
      result
    });
  } catch (error) {
    console.error('Workflow action error:', error);
    res.status(500).json({ error: 'Failed to execute workflow action' });
  }
});

/**
 * Get available workflow actions
 */
router.get('/workflow/actions', (req, res) => {
  res.json({
    actions: getAvailableActions()
  });
});

/**
 * Generate deal health report
 */
router.get('/report/:dealId', async (req, res) => {
  const { dealId } = req.params;
  const { portalId, format = 'json' } = req.query;
  
  try {
    const accessToken = await oauthRoutes.getAccessToken(portalId);
    const hubspotService = new HubSpotService(accessToken);
    const dealData = await hubspotService.getDealWithContacts(dealId);
    
    const report = generateDealHealthReport(dealData, { includeContacts: true });
    
    if (format === 'html') {
      res.set('Content-Type', 'text/html');
      res.send(formatReportAsHtml(report));
    } else {
      res.json(report);
    }
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * Generate coaching packet for multiple deals
 */
router.post('/report/coaching', async (req, res) => {
  const { dealIds, portalId, repName, period } = req.body;
  
  try {
    const accessToken = await oauthRoutes.getAccessToken(portalId);
    const hubspotService = new HubSpotService(accessToken);
    
    // Fetch deals in parallel for better performance
    const dealPromises = dealIds.map(dealId => 
      hubspotService.getDealWithContacts(dealId)
        .catch(err => {
          console.error(`Failed to fetch deal ${dealId}:`, err.message);
          return null;
        })
    );
    
    const dealResults = await Promise.allSettled(dealPromises);
    const deals = dealResults
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value);
    
    const packet = generateCoachingPacket(deals, { repName, period });
    
    res.json(packet);
  } catch (error) {
    console.error('Coaching packet error:', error);
    res.status(500).json({ error: 'Failed to generate coaching packet' });
  }
});

/**
 * Generate pipeline dashboard
 */
router.post('/report/dashboard', async (req, res) => {
  const { dealIds, portalId, groupByStage = true } = req.body;
  
  try {
    const accessToken = await oauthRoutes.getAccessToken(portalId);
    const hubspotService = new HubSpotService(accessToken);
    
    // Fetch deals in parallel for better performance
    const dealPromises = dealIds.map(dealId => 
      hubspotService.getDealWithContacts(dealId)
        .catch(err => {
          console.error(`Failed to fetch deal ${dealId}:`, err.message);
          return null;
        })
    );
    
    const dealResults = await Promise.allSettled(dealPromises);
    const deals = dealResults
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value);
    
    const dashboard = generatePipelineDashboard(deals, { groupByStage });
    
    res.json(dashboard);
  } catch (error) {
    console.error('Dashboard generation error:', error);
    res.status(500).json({ error: 'Failed to generate dashboard' });
  }
});

/**
 * Get playbook recommendations for a deal
 */
router.get('/playbooks/:dealId', async (req, res) => {
  const { dealId } = req.params;
  const { portalId } = req.query;
  
  try {
    const accessToken = await oauthRoutes.getAccessToken(portalId);
    const hubspotService = new HubSpotService(accessToken);
    const dealData = await hubspotService.getDealWithContacts(dealId);
    
    const scoreData = calculateMultiThreadingScore(dealData, { enableRoleInference: true });
    const recommendations = getContextualRecommendations(scoreData, dealData.deal?.dealstage);
    
    res.json({
      dealId,
      dealStage: dealData.deal?.dealstage,
      recommendations
    });
  } catch (error) {
    console.error('Playbook recommendations error:', error);
    res.status(500).json({ error: 'Failed to get playbook recommendations' });
  }
});

/**
 * Get all available playbooks
 */
router.get('/playbooks', (req, res) => {
  res.json({
    playbooks: PLAYBOOKS,
    emailTemplates: EMAIL_TEMPLATES,
    roleChecklists: ROLE_CHECKLISTS
  });
});

/**
 * Render an email template with variables
 */
router.post('/playbooks/template', (req, res) => {
  const { templateId, variables } = req.body;
  
  const rendered = renderEmailTemplate(templateId, variables);
  
  if (rendered.error) {
    return res.status(404).json({ error: rendered.error });
  }
  
  res.json(rendered);
});

/**
 * Track stakeholder lifecycle changes
 */
router.post('/lifecycle/:dealId', async (req, res) => {
  const { dealId } = req.params;
  const { portalId, previousSnapshot } = req.body;
  
  try {
    const accessToken = await oauthRoutes.getAccessToken(portalId);
    const hubspotService = new HubSpotService(accessToken);
    const dealData = await hubspotService.getDealWithContacts(dealId);
    
    const currentSnapshot = calculateMultiThreadingScore(dealData, { enableRoleInference: true });
    const lifecycle = trackStakeholderLifecycle(currentSnapshot, previousSnapshot);
    const timelineEvents = generateTimelineEvents(previousSnapshot, currentSnapshot, dealData);
    
    res.json({
      dealId,
      currentSnapshot: {
        overallScore: currentSnapshot.overallScore,
        threadDepth: currentSnapshot.threadDepth,
        contactCount: currentSnapshot.contactCount,
        coveredRoles: currentSnapshot.coveredRoles,
        contacts: currentSnapshot.contacts
      },
      lifecycle,
      timelineEvents
    });
  } catch (error) {
    console.error('Lifecycle tracking error:', error);
    res.status(500).json({ error: 'Failed to track lifecycle' });
  }
});

module.exports = router;
