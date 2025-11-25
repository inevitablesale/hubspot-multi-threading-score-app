const express = require('express');
const router = express.Router();
const HubSpotService = require('../services/hubspotService');
const { calculateMultiThreadingScore, generateRecommendations } = require('../services/scoringService');
const oauthRoutes = require('./oauth');

/**
 * CRM Card data fetch endpoint
 * Called by HubSpot when displaying the CRM card on deal records
 * 
 * HubSpot CRM Card specification:
 * https://developers.hubspot.com/docs/api/crm/extensions/crm-cards
 */
router.get('/deal', async (req, res) => {
  const { hs_object_id, portalId } = req.query;
  
  if (!hs_object_id) {
    return res.status(400).json({
      results: [],
      primaryAction: null,
      error: 'Missing deal ID'
    });
  }
  
  try {
    // Get access token
    let accessToken;
    try {
      accessToken = await oauthRoutes.getAccessToken(portalId);
    } catch (authError) {
      // Return a card prompting authorization
      return res.json({
        results: [{
          objectId: 1,
          title: 'Authorization Required',
          properties: [{
            label: 'Status',
            dataType: 'STATUS',
            value: 'Please authorize the app to view multi-threading scores.'
          }]
        }],
        primaryAction: {
          type: 'IFRAME',
          width: 500,
          height: 300,
          uri: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/oauth/authorize`,
          label: 'Authorize App'
        }
      });
    }
    
    const hubspotService = new HubSpotService(accessToken);
    
    // Get deal data with contacts
    const dealData = await hubspotService.getDealWithContacts(hs_object_id);
    
    // Calculate multi-threading score
    const scoreData = calculateMultiThreadingScore(dealData);
    
    // Generate recommendations
    const recommendations = generateRecommendations(scoreData);
    
    // Format response for HubSpot CRM Card
    const cardResponse = formatCrmCardResponse(scoreData, recommendations, dealData.dealId);
    
    res.json(cardResponse);
  } catch (error) {
    console.error('CRM Card error:', error);
    res.json({
      results: [{
        objectId: 1,
        title: 'Error Loading Score',
        properties: [{
          label: 'Error',
          dataType: 'STRING',
          value: 'Unable to calculate multi-threading score. Please try again.'
        }]
      }]
    });
  }
});

/**
 * Format score data into HubSpot CRM Card response format
 */
function formatCrmCardResponse(scoreData, recommendations, dealId) {
  const results = [];
  
  // Main score card
  results.push({
    objectId: 1,
    title: 'Multi-Threading Score',
    link: null,
    properties: [
      {
        label: 'Overall Score',
        dataType: 'NUMERIC',
        value: scoreData.overallScore
      },
      {
        label: 'Risk Level',
        dataType: 'STATUS',
        value: scoreData.riskLevel,
        optionType: scoreData.riskLevel === 'LOW' ? 'SUCCESS' : 
                    scoreData.riskLevel === 'MEDIUM' ? 'WARNING' : 'DANGER'
      },
      {
        label: 'Stakeholders',
        dataType: 'NUMERIC',
        value: scoreData.contactCount
      },
      {
        label: 'Engaged Contacts',
        dataType: 'NUMERIC',
        value: scoreData.threadDepth
      }
    ]
  });
  
  // Score breakdown card
  results.push({
    objectId: 2,
    title: 'Score Breakdown',
    properties: [
      {
        label: 'Engagement Score',
        dataType: 'NUMERIC',
        value: scoreData.engagementScore
      },
      {
        label: 'Participation Score',
        dataType: 'NUMERIC',
        value: scoreData.participationScore
      },
      {
        label: 'Role Coverage Score',
        dataType: 'NUMERIC',
        value: scoreData.roleCoverageScore
      }
    ]
  });
  
  // Role coverage card
  const roleInfo = {
    objectId: 3,
    title: 'Role Coverage',
    properties: [
      {
        label: 'Covered Roles',
        dataType: 'STRING',
        value: scoreData.coveredRoles.length > 0 
          ? scoreData.coveredRoles.map(r => r.toLowerCase().replace('_', ' ')).join(', ')
          : 'None identified'
      }
    ]
  };
  
  if (scoreData.missingKeyRoles.length > 0) {
    roleInfo.properties.push({
      label: 'Missing Key Roles',
      dataType: 'STRING',
      value: scoreData.missingKeyRoles.map(r => r.toLowerCase().replace('_', ' ')).join(', ')
    });
  }
  
  results.push(roleInfo);
  
  // Top recommendations
  const topRecs = recommendations.slice(0, 3);
  if (topRecs.length > 0) {
    results.push({
      objectId: 4,
      title: 'Recommendations',
      properties: topRecs.map((rec, index) => ({
        label: rec.title,
        dataType: 'STRING',
        value: rec.message
      }))
    });
  }
  
  // Contact engagement summary (top 5 contacts)
  if (scoreData.contacts.length > 0) {
    const topContacts = scoreData.contacts
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 5);
    
    results.push({
      objectId: 5,
      title: 'Contact Engagement',
      properties: topContacts.map(contact => ({
        label: contact.name || contact.email,
        dataType: 'STRING',
        value: `${contact.role} - Score: ${contact.engagementScore}/100 (${contact.engagements.total} interactions)`
      }))
    });
  }
  
  return {
    results,
    primaryAction: {
      type: 'ACTION_HOOK',
      httpMethod: 'POST',
      uri: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/crm-card/refresh`,
      label: 'Refresh Score',
      associatedObjectProperties: ['hs_object_id']
    },
    secondaryActions: [
      {
        type: 'IFRAME',
        width: 800,
        height: 600,
        uri: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/crm-card/details?dealId=${dealId}`,
        label: 'View Details'
      }
    ]
  };
}

/**
 * Refresh score action handler
 */
router.post('/refresh', async (req, res) => {
  const { hs_object_id } = req.body;
  
  try {
    // The refresh is handled by the card reloading
    res.json({
      message: 'Score refresh triggered',
      resultType: 'RELOAD_CARD'
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.json({
      message: 'Failed to refresh score',
      resultType: 'ERROR'
    });
  }
});

/**
 * Detailed view endpoint (for iframe)
 */
router.get('/details', async (req, res) => {
  const { dealId, portalId } = req.query;
  
  if (!dealId) {
    return res.status(400).send('Missing deal ID');
  }
  
  try {
    let accessToken;
    try {
      accessToken = await oauthRoutes.getAccessToken(portalId);
    } catch (authError) {
      return res.redirect('/oauth/authorize');
    }
    
    const hubspotService = new HubSpotService(accessToken);
    const dealData = await hubspotService.getDealWithContacts(dealId);
    const scoreData = calculateMultiThreadingScore(dealData);
    const recommendations = generateRecommendations(scoreData);
    
    // Send HTML response for detailed view
    res.send(generateDetailedHtml(dealData, scoreData, recommendations));
  } catch (error) {
    console.error('Details error:', error);
    res.status(500).send('Error loading details');
  }
});

/**
 * Generate HTML for detailed view iframe
 */
function generateDetailedHtml(dealData, scoreData, recommendations) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Multi-Threading Score Details</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: 'Lexend Deca', 'Helvetica Neue', sans-serif; 
      padding: 20px;
      background: #f5f8fa;
      color: #33475b;
    }
    .header {
      background: #2e475d;
      color: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .header h1 { font-size: 24px; margin-bottom: 10px; }
    .score-circle {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: ${scoreData.riskColor};
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: bold;
      float: right;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 15px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .card h2 { 
      font-size: 16px; 
      color: #516f90; 
      margin-bottom: 15px;
      border-bottom: 1px solid #eaf0f6;
      padding-bottom: 10px;
    }
    .score-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
    }
    .score-item {
      text-align: center;
      padding: 15px;
      background: #f5f8fa;
      border-radius: 6px;
    }
    .score-item .value { font-size: 28px; font-weight: bold; color: #00a4bd; }
    .score-item .label { font-size: 12px; color: #516f90; margin-top: 5px; }
    .recommendation {
      padding: 12px;
      margin-bottom: 10px;
      border-left: 3px solid;
      background: #f5f8fa;
      border-radius: 0 6px 6px 0;
    }
    .recommendation.HIGH { border-color: #f2545b; }
    .recommendation.MEDIUM { border-color: #f5c26b; }
    .recommendation.LOW { border-color: #00a4bd; }
    .recommendation h3 { font-size: 14px; margin-bottom: 5px; }
    .recommendation p { font-size: 13px; color: #516f90; }
    .contact-table {
      width: 100%;
      border-collapse: collapse;
    }
    .contact-table th, .contact-table td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #eaf0f6;
    }
    .contact-table th { 
      font-size: 12px; 
      color: #516f90; 
      font-weight: 500;
    }
    .engagement-bar {
      height: 8px;
      background: #eaf0f6;
      border-radius: 4px;
      overflow: hidden;
    }
    .engagement-bar .fill {
      height: 100%;
      background: #00a4bd;
      border-radius: 4px;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 500;
    }
    .badge.role { background: #eaf0f6; color: #33475b; }
  </style>
</head>
<body>
  <div class="header">
    <div class="score-circle">${scoreData.overallScore}</div>
    <h1>${dealData.deal.dealname || 'Deal'}</h1>
    <p>Multi-Threading Stakeholder Coverage Analysis</p>
  </div>

  <div class="card">
    <h2>Score Breakdown</h2>
    <div class="score-grid">
      <div class="score-item">
        <div class="value">${scoreData.overallScore}</div>
        <div class="label">Overall Score</div>
      </div>
      <div class="score-item">
        <div class="value">${scoreData.engagementScore}</div>
        <div class="label">Engagement</div>
      </div>
      <div class="score-item">
        <div class="value">${scoreData.participationScore}</div>
        <div class="label">Participation</div>
      </div>
      <div class="score-item">
        <div class="value">${scoreData.roleCoverageScore}</div>
        <div class="label">Role Coverage</div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>Recommendations</h2>
    ${recommendations.map(rec => `
      <div class="recommendation ${rec.priority}">
        <h3>${rec.title}</h3>
        <p>${rec.message}</p>
        <p><strong>Action:</strong> ${rec.action}</p>
      </div>
    `).join('')}
  </div>

  <div class="card">
    <h2>Stakeholder Engagement (${scoreData.contactCount} contacts)</h2>
    <table class="contact-table">
      <thead>
        <tr>
          <th>Contact</th>
          <th>Role</th>
          <th>Job Title</th>
          <th>Engagement</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody>
        ${scoreData.contacts.map(contact => `
          <tr>
            <td><strong>${contact.name}</strong><br><small>${contact.email}</small></td>
            <td><span class="badge role">${contact.role}</span></td>
            <td>${contact.jobTitle}</td>
            <td>
              <div class="engagement-bar">
                <div class="fill" style="width: ${contact.engagementScore}%"></div>
              </div>
              <small>${contact.engagements.emails}📧 ${contact.engagements.meetings}📅 ${contact.engagements.calls}📞</small>
            </td>
            <td><strong>${contact.engagementScore}</strong>/100</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>Role Coverage</h2>
    <p><strong>Covered:</strong> ${scoreData.coveredRoles.length > 0 ? scoreData.coveredRoles.join(', ') : 'None'}</p>
    ${scoreData.missingKeyRoles.length > 0 ? `<p><strong>Missing Key Roles:</strong> ${scoreData.missingKeyRoles.join(', ')}</p>` : ''}
  </div>
</body>
</html>
  `;
}

module.exports = router;
