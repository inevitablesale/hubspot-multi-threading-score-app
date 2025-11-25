const { Client } = require('@hubspot/api-client');

/**
 * HubSpot Service - Handles all HubSpot API interactions
 */
class HubSpotService {
  constructor(accessToken) {
    this.client = new Client({ accessToken });
  }

  /**
   * Get deal by ID with associated contacts
   */
  async getDealWithContacts(dealId) {
    try {
      // Get deal with associations
      const deal = await this.client.crm.deals.basicApi.getById(
        dealId,
        ['dealname', 'amount', 'dealstage', 'closedate'],
        undefined,
        ['contacts']
      );

      // Get associated contacts
      const contactIds = deal.associations?.contacts?.results?.map(c => c.id) || [];
      const contacts = [];

      for (const contactId of contactIds) {
        const contact = await this.getContactWithEngagement(contactId);
        contacts.push(contact);
      }

      return {
        deal: deal.properties,
        dealId: deal.id,
        contacts
      };
    } catch (error) {
      console.error('Error fetching deal with contacts:', error);
      throw error;
    }
  }

  /**
   * Get contact with engagement data
   */
  async getContactWithEngagement(contactId) {
    try {
      const contact = await this.client.crm.contacts.basicApi.getById(
        contactId,
        [
          'firstname',
          'lastname',
          'email',
          'jobtitle',
          'hs_buying_role',
          'hs_lead_status',
          'hs_lifecyclestage'
        ]
      );

      // Get engagement activities for this contact
      const engagements = await this.getContactEngagements(contactId);

      return {
        id: contact.id,
        properties: contact.properties,
        engagements
      };
    } catch (error) {
      console.error('Error fetching contact:', error);
      throw error;
    }
  }

  /**
   * Get engagement activities for a contact
   */
  async getContactEngagements(contactId) {
    try {
      // Get emails
      const emails = await this.client.crm.objects.searchApi.doSearch('emails', {
        filterGroups: [{
          filters: [{
            propertyName: 'associations.contact',
            operator: 'EQ',
            value: contactId
          }]
        }],
        limit: 100
      });

      // Get meetings
      const meetings = await this.client.crm.objects.searchApi.doSearch('meetings', {
        filterGroups: [{
          filters: [{
            propertyName: 'associations.contact',
            operator: 'EQ',
            value: contactId
          }]
        }],
        limit: 100
      });

      // Get calls
      const calls = await this.client.crm.objects.searchApi.doSearch('calls', {
        filterGroups: [{
          filters: [{
            propertyName: 'associations.contact',
            operator: 'EQ',
            value: contactId
          }]
        }],
        limit: 100
      });

      return {
        emails: emails.total || 0,
        meetings: meetings.total || 0,
        calls: calls.total || 0,
        total: (emails.total || 0) + (meetings.total || 0) + (calls.total || 0)
      };
    } catch (error) {
      console.error('Error fetching engagements:', error);
      // Return defaults if engagement fetch fails
      return { emails: 0, meetings: 0, calls: 0, total: 0 };
    }
  }

  /**
   * Update custom properties on a deal
   */
  async updateDealScore(dealId, scoreData) {
    try {
      await this.client.crm.deals.basicApi.update(dealId, {
        properties: {
          multi_thread_score: scoreData.overallScore.toString(),
          stakeholder_count: scoreData.contactCount.toString(),
          engagement_score: scoreData.engagementScore.toString(),
          role_coverage_score: scoreData.roleCoverageScore.toString()
        }
      });
      return true;
    } catch (error) {
      console.error('Error updating deal score:', error);
      throw error;
    }
  }
}

module.exports = HubSpotService;
