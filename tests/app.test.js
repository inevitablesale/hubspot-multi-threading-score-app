const request = require('supertest');
const app = require('../src/app');

describe('App Routes', () => {
  describe('GET /', () => {
    test('returns app information', async () => {
      const response = await request(app).get('/');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('app', 'HubSpot Multi-Threading Score App');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('endpoints');
    });
  });

  describe('GET /health', () => {
    test('returns healthy status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});

describe('OAuth Routes', () => {
  describe('GET /oauth/authorize', () => {
    test('redirects to HubSpot authorization', async () => {
      const response = await request(app).get('/oauth/authorize');
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('app.hubspot.com/oauth/authorize');
    });
  });

  describe('GET /oauth/callback', () => {
    test('returns error when no code provided', async () => {
      const response = await request(app).get('/oauth/callback');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'No authorization code provided');
    });
  });
});

describe('CRM Card Routes', () => {
  describe('GET /crm-card/deal', () => {
    test('returns error when no deal ID provided', async () => {
      const response = await request(app).get('/crm-card/deal');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Missing deal ID');
    });

    test('prompts authorization when not authenticated', async () => {
      const response = await request(app).get('/crm-card/deal?hs_object_id=123');
      
      expect(response.status).toBe(200);
      expect(response.body.results[0].title).toBe('Authorization Required');
    });
  });

  describe('POST /crm-card/refresh', () => {
    test('returns reload card response', async () => {
      const response = await request(app)
        .post('/crm-card/refresh')
        .send({ hs_object_id: '123' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('resultType', 'RELOAD_CARD');
    });
  });

  describe('GET /crm-card/details', () => {
    test('returns error when no deal ID provided', async () => {
      const response = await request(app).get('/crm-card/details');
      
      expect(response.status).toBe(400);
    });

    test('redirects to authorization when not authenticated', async () => {
      const response = await request(app).get('/crm-card/details?dealId=123');
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/oauth/authorize');
    });
  });
});

describe('Webhook Routes', () => {
  describe('POST /webhooks/deal', () => {
    test('accepts deal webhook events', async () => {
      const webhookPayload = {
        objectId: '123',
        subscriptionType: 'deal.creation'
      };
      
      const response = await request(app)
        .post('/webhooks/deal')
        .send(webhookPayload);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('received', true);
    });

    test('handles array of webhook events', async () => {
      const webhookPayload = [
        { objectId: '123', subscriptionType: 'deal.creation' },
        { objectId: '124', subscriptionType: 'deal.propertyChange', propertyName: 'dealstage', propertyValue: 'closed' }
      ];
      
      const response = await request(app)
        .post('/webhooks/deal')
        .send(webhookPayload);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('received', true);
    });
  });

  describe('POST /webhooks/contact', () => {
    test('accepts contact webhook events', async () => {
      const webhookPayload = {
        objectId: '456',
        subscriptionType: 'contact.creation'
      };
      
      const response = await request(app)
        .post('/webhooks/contact')
        .send(webhookPayload);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('received', true);
    });
  });
});
