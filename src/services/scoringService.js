/**
 * Scoring Service - Calculates multi-threading stakeholder coverage scores
 * 
 * The scoring system evaluates:
 * 1. Contact Engagement Score - How engaged are contacts with the deal
 * 2. Participation Frequency Score - How often do stakeholders participate
 * 3. Buying Role Coverage Score - Are key decision-makers involved
 * 4. Overall Multi-Threading Score - Combined stakeholder coverage assessment
 */

// Buying roles and their importance weights
const BUYING_ROLE_WEIGHTS = {
  'DECISION_MAKER': 30,
  'BUDGET_HOLDER': 25,
  'CHAMPION': 20,
  'INFLUENCER': 15,
  'END_USER': 10,
  'BLOCKER': 5,
  'OTHER': 5
};

// Key roles that should ideally be covered for a strong multi-threaded deal
const KEY_ROLES = ['DECISION_MAKER', 'BUDGET_HOLDER', 'CHAMPION'];

/**
 * Calculate engagement score for a single contact
 * @param {Object} engagements - Contact engagement data
 * @returns {number} Score between 0-100
 */
function calculateContactEngagementScore(engagements) {
  const { emails = 0, meetings = 0, calls = 0 } = engagements;
  
  // Weighted engagement scoring
  // Meetings are most valuable, then calls, then emails
  const meetingPoints = Math.min(meetings * 20, 40);  // Max 40 points
  const callPoints = Math.min(calls * 15, 30);        // Max 30 points
  const emailPoints = Math.min(emails * 5, 30);       // Max 30 points
  
  return Math.min(meetingPoints + callPoints + emailPoints, 100);
}

/**
 * Calculate participation frequency score
 * Measures how many contacts have meaningful engagement
 * @param {Array} contacts - Array of contact objects with engagement data
 * @returns {number} Score between 0-100
 */
function calculateParticipationScore(contacts) {
  if (contacts.length === 0) return 0;
  
  const activeContacts = contacts.filter(contact => {
    const total = contact.engagements?.total || 0;
    return total >= 2; // At least 2 engagements to be considered active
  });
  
  const participationRate = activeContacts.length / contacts.length;
  
  // Score based on participation rate and absolute number of active contacts
  const rateScore = participationRate * 60;
  const volumeBonus = Math.min(activeContacts.length * 10, 40);
  
  return Math.min(Math.round(rateScore + volumeBonus), 100);
}

/**
 * Calculate buying role coverage score
 * Measures if key decision-making roles are represented
 * @param {Array} contacts - Array of contact objects with role data
 * @returns {Object} Score and missing roles
 */
function calculateRoleCoverageScore(contacts) {
  const coveredRoles = new Set();
  let rolePoints = 0;
  
  contacts.forEach(contact => {
    const role = contact.properties?.hs_buying_role?.toUpperCase() || 'OTHER';
    coveredRoles.add(role);
    rolePoints += BUYING_ROLE_WEIGHTS[role] || BUYING_ROLE_WEIGHTS.OTHER;
  });
  
  // Check which key roles are missing
  const missingKeyRoles = KEY_ROLES.filter(role => !coveredRoles.has(role));
  
  // Calculate coverage percentage of key roles
  const keyCoverage = ((KEY_ROLES.length - missingKeyRoles.length) / KEY_ROLES.length) * 100;
  
  // Score combines key role coverage and diversity of roles
  const diversityBonus = Math.min(coveredRoles.size * 10, 30);
  const finalScore = Math.min(Math.round(keyCoverage * 0.7 + diversityBonus), 100);
  
  return {
    score: finalScore,
    coveredRoles: Array.from(coveredRoles),
    missingKeyRoles,
    rolePoints
  };
}

/**
 * Calculate overall multi-threading score
 * @param {Object} data - Deal data with contacts
 * @returns {Object} Comprehensive score breakdown
 */
function calculateMultiThreadingScore(data) {
  const { contacts = [] } = data;
  
  // Calculate individual scores
  const contactEngagementScores = contacts.map(contact => ({
    contactId: contact.id,
    name: `${contact.properties?.firstname || ''} ${contact.properties?.lastname || ''}`.trim() || 'Unknown',
    email: contact.properties?.email || 'N/A',
    role: contact.properties?.hs_buying_role || 'Not specified',
    jobTitle: contact.properties?.jobtitle || 'Not specified',
    engagementScore: calculateContactEngagementScore(contact.engagements || {}),
    engagements: contact.engagements || { emails: 0, meetings: 0, calls: 0, total: 0 }
  }));
  
  const avgEngagementScore = contactEngagementScores.length > 0
    ? Math.round(contactEngagementScores.reduce((sum, c) => sum + c.engagementScore, 0) / contactEngagementScores.length)
    : 0;
  
  const participationScore = calculateParticipationScore(contacts);
  const roleCoverage = calculateRoleCoverageScore(contacts);
  
  // Calculate thread depth (number of engaged stakeholders)
  const threadDepth = contacts.filter(c => (c.engagements?.total || 0) > 0).length;
  
  // Overall score calculation with weights
  // - Engagement: 30%
  // - Participation: 25%
  // - Role Coverage: 35%
  // - Thread Depth Bonus: 10%
  const threadDepthBonus = Math.min(threadDepth * 10, 10);
  const overallScore = Math.round(
    avgEngagementScore * 0.30 +
    participationScore * 0.25 +
    roleCoverage.score * 0.35 +
    threadDepthBonus
  );
  
  // Determine risk level
  let riskLevel;
  let riskColor;
  if (overallScore >= 70) {
    riskLevel = 'LOW';
    riskColor = '#00a4bd'; // HubSpot teal
  } else if (overallScore >= 40) {
    riskLevel = 'MEDIUM';
    riskColor = '#f5c26b'; // HubSpot yellow
  } else {
    riskLevel = 'HIGH';
    riskColor = '#f2545b'; // HubSpot red
  }
  
  return {
    overallScore,
    engagementScore: avgEngagementScore,
    participationScore,
    roleCoverageScore: roleCoverage.score,
    contactCount: contacts.length,
    threadDepth,
    riskLevel,
    riskColor,
    coveredRoles: roleCoverage.coveredRoles,
    missingKeyRoles: roleCoverage.missingKeyRoles,
    contacts: contactEngagementScores
  };
}

/**
 * Generate actionable recommendations based on score analysis
 * @param {Object} scoreData - Score breakdown from calculateMultiThreadingScore
 * @returns {Array} Array of recommendation objects
 */
function generateRecommendations(scoreData) {
  const recommendations = [];
  
  // Single-thread exposure warning
  if (scoreData.contactCount <= 1) {
    recommendations.push({
      priority: 'HIGH',
      type: 'SINGLE_THREAD_RISK',
      title: '⚠️ Single-Thread Exposure',
      message: 'This deal has only one contact. Add more stakeholders to reduce risk of deal loss if this contact becomes unavailable.',
      action: 'Identify and add additional stakeholders from the organization.'
    });
  }
  
  // Missing key decision makers
  if (scoreData.missingKeyRoles.length > 0) {
    const missingRolesFormatted = scoreData.missingKeyRoles.map(r => r.toLowerCase().replace('_', ' ')).join(', ');
    recommendations.push({
      priority: 'HIGH',
      type: 'MISSING_ROLES',
      title: '🎯 Missing Key Roles',
      message: `Key buying roles not yet identified: ${missingRolesFormatted}.`,
      action: 'Research the organization structure and identify contacts filling these roles.'
    });
  }
  
  // Low engagement contacts
  const lowEngagementContacts = scoreData.contacts.filter(c => c.engagementScore < 30);
  if (lowEngagementContacts.length > 0) {
    recommendations.push({
      priority: 'MEDIUM',
      type: 'LOW_ENGAGEMENT',
      title: '📊 Low Engagement Stakeholders',
      message: `${lowEngagementContacts.length} contact(s) have minimal engagement. Consider reaching out.`,
      action: `Re-engage: ${lowEngagementContacts.map(c => c.name).slice(0, 3).join(', ')}`
    });
  }
  
  // No champion identified
  if (!scoreData.coveredRoles.includes('CHAMPION')) {
    recommendations.push({
      priority: 'MEDIUM',
      type: 'NO_CHAMPION',
      title: '🌟 No Champion Identified',
      message: 'A champion can help advocate for your solution internally.',
      action: 'Identify a contact who is enthusiastic about your solution and could advocate internally.'
    });
  }
  
  // Good multi-threading
  if (scoreData.overallScore >= 70 && scoreData.contactCount >= 3) {
    recommendations.push({
      priority: 'LOW',
      type: 'STRONG_POSITION',
      title: '✅ Strong Multi-Threading',
      message: 'This deal has good stakeholder coverage. Focus on maintaining momentum.',
      action: 'Continue regular engagement with all stakeholders and prepare for closing activities.'
    });
  }
  
  // Low overall score
  if (scoreData.overallScore < 40) {
    recommendations.push({
      priority: 'HIGH',
      type: 'CRITICAL_COVERAGE',
      title: '🚨 Critical Coverage Gap',
      message: 'This deal has significant multi-threading gaps that increase deal risk.',
      action: 'Prioritize stakeholder mapping and engagement as immediate next steps.'
    });
  }
  
  return recommendations.sort((a, b) => {
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

module.exports = {
  calculateMultiThreadingScore,
  calculateContactEngagementScore,
  calculateParticipationScore,
  calculateRoleCoverageScore,
  generateRecommendations,
  BUYING_ROLE_WEIGHTS,
  KEY_ROLES
};
