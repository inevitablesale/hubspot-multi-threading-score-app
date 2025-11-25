/**
 * Integration Service - External integrations for enriched data
 * 
 * This service provides:
 * 1. Gong/Chorus/Fireflies integration for meeting intelligence
 * 2. LinkedIn Sales Navigator integration (optional)
 * 3. Salesforce/Pipedrive interoperability
 * 4. Two-way sync capabilities
 */

const axios = require('axios');

// Default timeout for API requests (30 seconds)
const DEFAULT_REQUEST_TIMEOUT = 30000;

// Integration configuration
const INTEGRATION_CONFIGS = {
  GONG: {
    baseUrl: 'https://api.gong.io/v2',
    scopes: ['calls:read', 'users:read'],
    timeout: DEFAULT_REQUEST_TIMEOUT
  },
  CHORUS: {
    baseUrl: 'https://chorus.ai/api/v2',
    scopes: ['calls:read', 'analytics:read'],
    timeout: DEFAULT_REQUEST_TIMEOUT
  },
  FIREFLIES: {
    baseUrl: 'https://api.fireflies.ai/graphql',
    scopes: ['transcripts:read', 'meetings:read'],
    timeout: DEFAULT_REQUEST_TIMEOUT
  },
  LINKEDIN: {
    baseUrl: 'https://api.linkedin.com/v2',
    scopes: ['r_organization_social', 'r_member_social'],
    timeout: DEFAULT_REQUEST_TIMEOUT
  },
  SALESFORCE: {
    baseUrl: null, // Instance-specific
    scopes: ['api', 'refresh_token'],
    timeout: DEFAULT_REQUEST_TIMEOUT
  },
  PIPEDRIVE: {
    baseUrl: 'https://api.pipedrive.com/v1',
    scopes: ['deals:read', 'persons:read'],
    timeout: DEFAULT_REQUEST_TIMEOUT
  }
};

/**
 * Generic API client for integrations
 */
class IntegrationClient {
  constructor(integration, config) {
    this.integration = integration;
    this.config = config;
    this.baseUrl = config.baseUrl || INTEGRATION_CONFIGS[integration]?.baseUrl;
    this.accessToken = config.accessToken;
    this.timeout = config.timeout || INTEGRATION_CONFIGS[integration]?.timeout || DEFAULT_REQUEST_TIMEOUT;
  }

  async request(method, endpoint, data = null) {
    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: this.timeout,
        data
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error(`${this.integration} API error:`, error.message);
      return { 
        success: false, 
        error: error.message,
        status: error.response?.status 
      };
    }
  }
}

/**
 * Gong Integration - Meeting intelligence
 */
class GongIntegration extends IntegrationClient {
  constructor(config) {
    super('GONG', config);
  }

  async getCallsForDeal(dealId, dateRange = {}) {
    const { startDate, endDate } = dateRange;
    
    const result = await this.request('POST', '/calls/extensive', {
      filter: {
        fromDateTime: startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        toDateTime: endDate || new Date().toISOString()
      },
      contentSelector: {
        context: 'Extended',
        exposedFields: {
          content: true,
          topics: true,
          trackers: true
        }
      }
    });

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      calls: result.data.calls || [],
      totalCalls: result.data.records?.totalRecords || 0
    };
  }

  async getCallAnalytics(callId) {
    const result = await this.request('GET', `/calls/${callId}`);
    
    if (!result.success) {
      return result;
    }

    const call = result.data.call;
    
    return {
      success: true,
      analytics: {
        duration: call.duration,
        talkRatio: call.talkRatio,
        participants: call.participants?.map(p => ({
          email: p.emailAddress,
          name: p.name,
          speakingTime: p.speakingDuration,
          speakingRatio: p.speakingRatio
        })),
        topics: call.topics || [],
        sentiment: call.sentiment || null,
        keywords: call.keywords || []
      }
    };
  }

  extractStakeholderInsights(callAnalytics) {
    const insights = [];
    
    callAnalytics.forEach(call => {
      call.participants?.forEach(participant => {
        // Identify dominant speakers (potential champions)
        if (participant.speakingRatio > 0.3) {
          insights.push({
            type: 'HIGH_ENGAGEMENT',
            email: participant.email,
            indicator: 'High talk time in meetings',
            confidence: 0.7
          });
        }

        // Identify quiet participants (potential blockers or disengaged)
        if (participant.speakingRatio < 0.1 && call.participants.length > 2) {
          insights.push({
            type: 'LOW_ENGAGEMENT',
            email: participant.email,
            indicator: 'Low participation in meetings',
            confidence: 0.6
          });
        }
      });

      // Extract sentiment-based insights
      if (call.sentiment) {
        if (call.sentiment.positive > 0.7) {
          insights.push({
            type: 'POSITIVE_SENTIMENT',
            indicator: 'Highly positive meeting sentiment',
            confidence: 0.8
          });
        } else if (call.sentiment.negative > 0.5) {
          insights.push({
            type: 'CONCERN_DETECTED',
            indicator: 'Negative sentiment detected in meeting',
            confidence: 0.7
          });
        }
      }
    });

    return insights;
  }
}

/**
 * Fireflies Integration - Meeting transcripts
 */
class FirefliesIntegration extends IntegrationClient {
  constructor(config) {
    super('FIREFLIES', config);
  }

  async getTranscripts(filters = {}) {
    const query = `
      query GetTranscripts($limit: Int, $skip: Int) {
        transcripts(limit: $limit, skip: $skip) {
          id
          title
          date
          duration
          participants
          sentences {
            speaker_name
            text
            start_time
          }
          summary {
            overview
            action_items
            keywords
          }
        }
      }
    `;

    const result = await this.request('POST', '', {
      query,
      variables: { limit: filters.limit || 50, skip: filters.skip || 0 }
    });

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      transcripts: result.data?.data?.transcripts || []
    };
  }

  analyzeTranscriptForRoles(transcript) {
    const roleIndicators = [];
    const sentences = transcript.sentences || [];

    sentences.forEach(sentence => {
      const text = sentence.text.toLowerCase();

      // Budget authority indicators
      if (/\b(budget|funding|approve|authorization|spend|investment)\b/.test(text)) {
        roleIndicators.push({
          speaker: sentence.speaker_name,
          type: 'BUDGET_AUTHORITY',
          text: sentence.text,
          timestamp: sentence.start_time
        });
      }

      // Decision-making indicators
      if (/\b(decision|decide|final say|sign off|approve)\b/.test(text) && 
          /\b(i'll|i will|i need to|let me)\b/.test(text)) {
        roleIndicators.push({
          speaker: sentence.speaker_name,
          type: 'DECISION_MAKER',
          text: sentence.text,
          timestamp: sentence.start_time
        });
      }

      // Champion indicators
      if (/\b(love|excited|great fit|perfect|recommend|advocate)\b/.test(text)) {
        roleIndicators.push({
          speaker: sentence.speaker_name,
          type: 'CHAMPION',
          text: sentence.text,
          timestamp: sentence.start_time
        });
      }
    });

    return roleIndicators;
  }
}

/**
 * LinkedIn Sales Navigator Integration
 */
class LinkedInIntegration extends IntegrationClient {
  constructor(config) {
    super('LINKEDIN', config);
  }

  async getCompanyUpdates(companyId) {
    const result = await this.request('GET', `/organizations/${companyId}/updates`);
    
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      updates: result.data?.elements || []
    };
  }

  async getContactProfile(linkedInUrl) {
    // Note: LinkedIn API has strict limitations
    // This would typically use Sales Navigator API
    return {
      success: false,
      error: 'LinkedIn profile lookup requires Sales Navigator API access'
    };
  }

  detectRelevantChanges(updates) {
    const relevantChanges = [];

    updates.forEach(update => {
      // Job changes
      if (update.type === 'JOB_CHANGE') {
        relevantChanges.push({
          type: 'JOB_CHANGE',
          person: update.personUrn,
          previousTitle: update.previousTitle,
          newTitle: update.newTitle,
          date: update.date,
          impact: 'May affect deal dynamics'
        });
      }

      // New hires in decision-making roles
      if (update.type === 'NEW_HIRE' && 
          /\b(vp|director|head|chief|manager)\b/i.test(update.title)) {
        relevantChanges.push({
          type: 'NEW_DECISION_MAKER',
          person: update.personUrn,
          title: update.title,
          date: update.date,
          impact: 'New potential stakeholder identified'
        });
      }

      // Company restructuring
      if (update.type === 'RESTRUCTURE' || update.type === 'LAYOFF') {
        relevantChanges.push({
          type: 'COMPANY_CHANGE',
          description: update.description,
          date: update.date,
          impact: 'May impact deal timeline or structure'
        });
      }
    });

    return relevantChanges;
  }
}

/**
 * Salesforce Integration - CRM sync
 */
class SalesforceIntegration extends IntegrationClient {
  constructor(config) {
    super('SALESFORCE', {
      ...config,
      baseUrl: config.instanceUrl
    });
  }

  async getOpportunity(opportunityId) {
    const result = await this.request('GET', `/services/data/v58.0/sobjects/Opportunity/${opportunityId}`);
    return result;
  }

  async getOpportunityContactRoles(opportunityId) {
    const result = await this.request('GET', 
      `/services/data/v58.0/query?q=SELECT+Id,ContactId,Role,IsPrimary+FROM+OpportunityContactRole+WHERE+OpportunityId='${opportunityId}'`
    );

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      contactRoles: result.data?.records || []
    };
  }

  mapSalesforceRoleToHubSpot(sfRole) {
    const roleMapping = {
      'Decision Maker': 'DECISION_MAKER',
      'Economic Buyer': 'BUDGET_HOLDER',
      'Executive Sponsor': 'DECISION_MAKER',
      'Technical Buyer': 'INFLUENCER',
      'Champion': 'CHAMPION',
      'Influencer': 'INFLUENCER',
      'End User': 'END_USER',
      'Evaluator': 'INFLUENCER'
    };

    return roleMapping[sfRole] || 'OTHER';
  }

  async syncStakeholderData(hubspotDealId, salesforceOpportunityId) {
    const sfContactRoles = await this.getOpportunityContactRoles(salesforceOpportunityId);
    
    if (!sfContactRoles.success) {
      return sfContactRoles;
    }

    const mappedRoles = sfContactRoles.contactRoles.map(cr => ({
      salesforceContactId: cr.ContactId,
      role: this.mapSalesforceRoleToHubSpot(cr.Role),
      isPrimary: cr.IsPrimary,
      originalRole: cr.Role
    }));

    return {
      success: true,
      stakeholders: mappedRoles,
      syncedAt: new Date().toISOString()
    };
  }
}

/**
 * Pipedrive Integration - CRM sync
 */
class PipedriveIntegration extends IntegrationClient {
  constructor(config) {
    super('PIPEDRIVE', {
      ...config,
      baseUrl: `${INTEGRATION_CONFIGS.PIPEDRIVE.baseUrl}`
    });
    this.apiKey = config.apiKey;
  }

  async request(method, endpoint, data = null) {
    try {
      const separator = endpoint.includes('?') ? '&' : '?';
      const response = await axios({
        method,
        url: `${this.baseUrl}${endpoint}${separator}api_token=${this.apiKey}`,
        headers: { 'Content-Type': 'application/json' },
        data
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getDeal(dealId) {
    return await this.request('GET', `/deals/${dealId}`);
  }

  async getDealParticipants(dealId) {
    const result = await this.request('GET', `/deals/${dealId}/participants`);
    
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      participants: result.data?.data || []
    };
  }

  mapPipedriveDataToHubSpot(pipedriveData) {
    return {
      dealName: pipedriveData.title,
      amount: pipedriveData.value,
      stage: pipedriveData.stage_id,
      contacts: pipedriveData.participants?.map(p => ({
        email: p.person?.email?.[0]?.value,
        name: p.person?.name,
        role: 'OTHER' // Pipedrive doesn't have built-in roles
      })) || []
    };
  }
}

/**
 * Aggregate meeting intelligence from multiple sources
 * @param {Object} integrations - Configured integration clients
 * @param {string} dealId - Deal identifier
 * @returns {Object} Aggregated meeting intelligence
 */
async function aggregateMeetingIntelligence(integrations, dealId) {
  const intelligence = {
    calls: [],
    transcripts: [],
    insights: [],
    roleIndicators: [],
    sentiment: null
  };

  // Gong data
  if (integrations.gong) {
    const gongResult = await integrations.gong.getCallsForDeal(dealId);
    if (gongResult.success) {
      intelligence.calls.push(...gongResult.calls);
      intelligence.insights.push(...integrations.gong.extractStakeholderInsights(gongResult.calls));
    }
  }

  // Fireflies data
  if (integrations.fireflies) {
    const ffResult = await integrations.fireflies.getTranscripts({ limit: 20 });
    if (ffResult.success) {
      ffResult.transcripts.forEach(transcript => {
        intelligence.transcripts.push(transcript);
        intelligence.roleIndicators.push(...integrations.fireflies.analyzeTranscriptForRoles(transcript));
      });
    }
  }

  // Calculate aggregate sentiment
  const sentiments = intelligence.calls
    .filter(c => c.sentiment)
    .map(c => c.sentiment);
  
  if (sentiments.length > 0) {
    intelligence.sentiment = {
      avgPositive: sentiments.reduce((sum, s) => sum + (s.positive || 0), 0) / sentiments.length,
      avgNegative: sentiments.reduce((sum, s) => sum + (s.negative || 0), 0) / sentiments.length,
      avgNeutral: sentiments.reduce((sum, s) => sum + (s.neutral || 0), 0) / sentiments.length
    };
  }

  return intelligence;
}

/**
 * Create integration clients from configuration
 * @param {Object} config - Integration configurations
 * @returns {Object} Integration clients
 */
function createIntegrationClients(config) {
  const clients = {};

  if (config.gong?.accessToken) {
    clients.gong = new GongIntegration(config.gong);
  }

  if (config.fireflies?.accessToken) {
    clients.fireflies = new FirefliesIntegration(config.fireflies);
  }

  if (config.linkedin?.accessToken) {
    clients.linkedin = new LinkedInIntegration(config.linkedin);
  }

  if (config.salesforce?.accessToken && config.salesforce?.instanceUrl) {
    clients.salesforce = new SalesforceIntegration(config.salesforce);
  }

  if (config.pipedrive?.apiKey) {
    clients.pipedrive = new PipedriveIntegration(config.pipedrive);
  }

  return clients;
}

module.exports = {
  GongIntegration,
  FirefliesIntegration,
  LinkedInIntegration,
  SalesforceIntegration,
  PipedriveIntegration,
  IntegrationClient,
  aggregateMeetingIntelligence,
  createIntegrationClients,
  INTEGRATION_CONFIGS
};
