/**
 * Alert Service - Real-time threading alerts for Slack/Email
 * 
 * This service provides:
 * 1. Threading alert generation
 * 2. Slack webhook integration
 * 3. Email alert formatting
 * 4. Alert prioritization and throttling
 */

const axios = require('axios');

// Alert types and their configurations
const ALERT_CONFIGS = {
  SINGLE_THREADED: {
    severity: 'HIGH',
    title: '🚨 Single-Threaded Deal Alert',
    color: '#f2545b', // Red
    throttleMinutes: 1440 // Once per day
  },
  NO_NEW_CONTACTS: {
    severity: 'MEDIUM',
    title: '⚠️ No New Contact Involvement',
    color: '#f5c26b', // Yellow
    throttleMinutes: 720 // Twice per day
  },
  CHAMPION_DISENGAGED: {
    severity: 'HIGH',
    title: '🌟 Champion Engagement Drop',
    color: '#f2545b',
    throttleMinutes: 480 // Three times per day
  },
  DM_NOT_ENGAGED: {
    severity: 'HIGH',
    title: '🎯 Decision Maker Not Engaged',
    color: '#f2545b',
    throttleMinutes: 720
  },
  SCORE_DROPPED: {
    severity: 'MEDIUM',
    title: '📉 Score Dropped Significantly',
    color: '#f5c26b',
    throttleMinutes: 480
  },
  COVERAGE_GAP: {
    severity: 'MEDIUM',
    title: '📊 Coverage Gap Detected',
    color: '#f5c26b',
    throttleMinutes: 1440
  },
  STAKEHOLDER_INACTIVE: {
    severity: 'LOW',
    title: '⏰ Stakeholder Inactive',
    color: '#516f90', // Gray
    throttleMinutes: 1440
  }
};

// In-memory alert tracking for throttling (use Redis in production)
const alertHistory = new Map();

/**
 * Check if alert should be throttled
 * @param {string} dealId - Deal identifier
 * @param {string} alertType - Type of alert
 * @returns {boolean} Whether to throttle
 */
function shouldThrottle(dealId, alertType) {
  const key = `${dealId}-${alertType}`;
  const lastSent = alertHistory.get(key);
  
  if (!lastSent) {
    return false;
  }
  
  const config = ALERT_CONFIGS[alertType] || { throttleMinutes: 60 };
  const throttleMs = config.throttleMinutes * 60 * 1000;
  
  return (Date.now() - lastSent) < throttleMs;
}

/**
 * Record that an alert was sent
 * @param {string} dealId - Deal identifier
 * @param {string} alertType - Type of alert
 */
function recordAlertSent(dealId, alertType) {
  const key = `${dealId}-${alertType}`;
  alertHistory.set(key, Date.now());
}

/**
 * Generate threading alerts based on deal analysis
 * @param {Object} dealData - Deal data including contacts and scores
 * @param {Object} scoreData - Multi-threading score analysis
 * @param {Object} coverageAnalysis - Coverage analysis data
 * @param {Object} lifecycleData - Stakeholder lifecycle tracking data
 * @returns {Array} Generated alerts
 */
function generateThreadingAlerts(dealData, scoreData, coverageAnalysis = null, lifecycleData = null) {
  const alerts = [];
  const dealId = dealData.dealId || dealData.deal?.hs_object_id;
  const dealName = dealData.deal?.dealname || 'Unknown Deal';
  
  // Alert: Single-threaded deal
  if (scoreData.contactCount <= 1 && !shouldThrottle(dealId, 'SINGLE_THREADED')) {
    alerts.push({
      type: 'SINGLE_THREADED',
      ...ALERT_CONFIGS.SINGLE_THREADED,
      dealId,
      dealName,
      message: `This deal has only ${scoreData.contactCount} contact(s). High risk of deal loss if this contact becomes unavailable.`,
      recommendation: 'Add additional stakeholders to reduce single-thread exposure.',
      data: {
        contactCount: scoreData.contactCount,
        currentScore: scoreData.overallScore
      }
    });
  }
  
  // Alert: No new contacts in 14 days
  if (lifecycleData?.changes) {
    const recentNewStakeholders = lifecycleData.changes.filter(c => c.type === 'NEW_STAKEHOLDER');
    const daysSinceSnapshot = lifecycleData.daysSinceLastSnapshot || 0;
    
    if (recentNewStakeholders.length === 0 && daysSinceSnapshot >= 14 && !shouldThrottle(dealId, 'NO_NEW_CONTACTS')) {
      alerts.push({
        type: 'NO_NEW_CONTACTS',
        ...ALERT_CONFIGS.NO_NEW_CONTACTS,
        dealId,
        dealName,
        message: `Deal has gone ${daysSinceSnapshot} days without new contact involvement.`,
        recommendation: 'Consider expanding stakeholder engagement to reduce deal risk.',
        data: {
          daysSinceNewContact: daysSinceSnapshot
        }
      });
    }
  }
  
  // Alert: Champion dropped below threshold
  const championContacts = scoreData.contacts?.filter(c => 
    (c.role || '').toUpperCase() === 'CHAMPION' || 
    (c.effectiveRole || '').toUpperCase() === 'CHAMPION'
  ) || [];
  
  championContacts.forEach(champion => {
    if (champion.engagementScore < 30 && !shouldThrottle(dealId, 'CHAMPION_DISENGAGED')) {
      alerts.push({
        type: 'CHAMPION_DISENGAGED',
        ...ALERT_CONFIGS.CHAMPION_DISENGAGED,
        dealId,
        dealName,
        message: `Champion "${champion.name}" has dropped below engagement threshold (Score: ${champion.engagementScore}/100).`,
        recommendation: 'Re-engage your champion with a check-in call or meeting.',
        data: {
          championName: champion.name,
          engagementScore: champion.engagementScore
        }
      });
    }
  });
  
  // Alert: Decision Maker not engaged
  const dmContacts = scoreData.contacts?.filter(c => 
    (c.role || '').toUpperCase() === 'DECISION_MAKER' || 
    (c.effectiveRole || '').toUpperCase() === 'DECISION_MAKER'
  ) || [];
  
  if (dmContacts.length === 0 && scoreData.contactCount > 0 && !shouldThrottle(dealId, 'DM_NOT_ENGAGED')) {
    alerts.push({
      type: 'DM_NOT_ENGAGED',
      ...ALERT_CONFIGS.DM_NOT_ENGAGED,
      dealId,
      dealName,
      message: 'No Decision Maker has been identified or engaged on this deal.',
      recommendation: 'Identify and engage the decision maker through your champion.',
      data: {
        missingRoles: scoreData.missingKeyRoles || []
      }
    });
  } else {
    dmContacts.forEach(dm => {
      if (dm.engagementScore < 20 && !shouldThrottle(dealId, 'DM_NOT_ENGAGED')) {
        alerts.push({
          type: 'DM_NOT_ENGAGED',
          ...ALERT_CONFIGS.DM_NOT_ENGAGED,
          dealId,
          dealName,
          message: `Decision Maker "${dm.name}" has very low engagement (Score: ${dm.engagementScore}/100).`,
          recommendation: 'Schedule an executive briefing or proposal review meeting.',
          data: {
            dmName: dm.name,
            engagementScore: dm.engagementScore
          }
        });
      }
    });
  }
  
  // Alert: Score dropped significantly
  if (lifecycleData?.changes) {
    const scoreChange = lifecycleData.changes.find(c => c.type === 'SCORE_CHANGE');
    if (scoreChange && scoreChange.change <= -15 && !shouldThrottle(dealId, 'SCORE_DROPPED')) {
      alerts.push({
        type: 'SCORE_DROPPED',
        ...ALERT_CONFIGS.SCORE_DROPPED,
        dealId,
        dealName,
        message: `Multi-threading score dropped from ${scoreChange.previousScore} to ${scoreChange.currentScore} (${scoreChange.change} points).`,
        recommendation: 'Review stakeholder engagement and address any gaps.',
        data: {
          previousScore: scoreChange.previousScore,
          currentScore: scoreChange.currentScore,
          change: scoreChange.change
        }
      });
    }
  }
  
  // Alert: Coverage gap
  if (coverageAnalysis && !coverageAnalysis.meetsStageExpectations && !shouldThrottle(dealId, 'COVERAGE_GAP')) {
    const missingRoles = coverageAnalysis.breadth?.stageAnalysis?.missingRequired || [];
    if (missingRoles.length > 0) {
      alerts.push({
        type: 'COVERAGE_GAP',
        ...ALERT_CONFIGS.COVERAGE_GAP,
        dealId,
        dealName,
        message: `Deal does not meet stage expectations. Missing: ${missingRoles.join(', ')}.`,
        recommendation: 'Address role coverage gaps before advancing the deal stage.',
        data: {
          missingRoles,
          coverageScore: coverageAnalysis.coverageScore,
          requiredThreshold: coverageAnalysis.adjustedThreshold
        }
      });
    }
  }
  
  return alerts;
}

/**
 * Format alert for Slack webhook
 * @param {Object} alert - Alert object
 * @returns {Object} Slack message payload
 */
function formatSlackAlert(alert) {
  const config = ALERT_CONFIGS[alert.type] || {};
  
  return {
    attachments: [
      {
        color: alert.color || config.color || '#516f90',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: alert.title || config.title,
              emoji: true
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Deal:*\n${alert.dealName}`
              },
              {
                type: 'mrkdwn',
                text: `*Severity:*\n${alert.severity}`
              }
            ]
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: alert.message
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Recommendation:* ${alert.recommendation}`
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Deal ID: ${alert.dealId} | Generated: ${new Date().toISOString()}`
              }
            ]
          }
        ]
      }
    ]
  };
}

/**
 * Format alert for email
 * @param {Object} alert - Alert object
 * @returns {Object} Email content
 */
function formatEmailAlert(alert) {
  const config = ALERT_CONFIGS[alert.type] || {};
  
  return {
    subject: `[${alert.severity}] ${alert.title || config.title} - ${alert.dealName}`,
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${alert.color || config.color || '#516f90'}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 20px;">${alert.title || config.title}</h1>
        </div>
        <div style="background: #f5f8fa; padding: 20px; border: 1px solid #eaf0f6; border-top: none; border-radius: 0 0 8px 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0;"><strong>Deal:</strong></td>
              <td style="padding: 10px 0;">${alert.dealName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0;"><strong>Severity:</strong></td>
              <td style="padding: 10px 0;">${alert.severity}</td>
            </tr>
          </table>
          <p style="margin: 20px 0; color: #33475b;">${alert.message}</p>
          <div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid ${alert.color || config.color};">
            <strong>Recommendation:</strong> ${alert.recommendation}
          </div>
          <p style="margin-top: 20px; font-size: 12px; color: #516f90;">
            Deal ID: ${alert.dealId} | Generated: ${new Date().toISOString()}
          </p>
        </div>
      </div>
    `,
    text: `
${alert.title || config.title}

Deal: ${alert.dealName}
Severity: ${alert.severity}

${alert.message}

Recommendation: ${alert.recommendation}

Deal ID: ${alert.dealId}
Generated: ${new Date().toISOString()}
    `
  };
}

/**
 * Send alert to Slack webhook
 * @param {Object} alert - Alert object
 * @param {string} webhookUrl - Slack webhook URL
 * @returns {Promise<Object>} Send result
 */
async function sendSlackAlert(alert, webhookUrl) {
  if (!webhookUrl) {
    return { success: false, error: 'No Slack webhook URL configured' };
  }
  
  try {
    const payload = formatSlackAlert(alert);
    await axios.post(webhookUrl, payload);
    
    // Record that alert was sent for throttling
    recordAlertSent(alert.dealId, alert.type);
    
    return { success: true, alertType: alert.type, dealId: alert.dealId };
  } catch (error) {
    console.error('Slack alert error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send multiple alerts
 * @param {Array} alerts - Array of alerts
 * @param {Object} config - Notification configuration
 * @returns {Promise<Object>} Send results
 */
async function sendAlerts(alerts, config = {}) {
  const { slackWebhookUrl, emailEnabled = false } = config;
  const results = {
    sent: [],
    failed: [],
    throttled: []
  };
  
  for (const alert of alerts) {
    // Check throttling
    if (shouldThrottle(alert.dealId, alert.type)) {
      results.throttled.push({ type: alert.type, dealId: alert.dealId });
      continue;
    }
    
    // Send to Slack
    if (slackWebhookUrl) {
      const slackResult = await sendSlackAlert(alert, slackWebhookUrl);
      if (slackResult.success) {
        results.sent.push({ type: alert.type, dealId: alert.dealId, channel: 'slack' });
      } else {
        results.failed.push({ type: alert.type, dealId: alert.dealId, channel: 'slack', error: slackResult.error });
      }
    }
    
    // Email alerts would be sent here
    // In production, integrate with SendGrid, SES, etc.
    if (emailEnabled) {
      const emailContent = formatEmailAlert(alert);
      // await sendEmail(emailContent); // Implement based on email provider
      results.sent.push({ type: alert.type, dealId: alert.dealId, channel: 'email' });
    }
  }
  
  return results;
}

/**
 * Clear alert history (for testing)
 */
function clearAlertHistory() {
  alertHistory.clear();
}

module.exports = {
  generateThreadingAlerts,
  formatSlackAlert,
  formatEmailAlert,
  sendSlackAlert,
  sendAlerts,
  shouldThrottle,
  clearAlertHistory,
  ALERT_CONFIGS
};
