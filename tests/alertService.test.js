const {
  generateThreadingAlerts,
  formatSlackAlert,
  formatEmailAlert,
  shouldThrottle,
  clearAlertHistory,
  ALERT_CONFIGS
} = require('../src/services/alertService');

describe('Alert Service', () => {
  beforeEach(() => {
    clearAlertHistory();
  });

  describe('generateThreadingAlerts', () => {
    test('generates SINGLE_THREADED alert for single contact deal', () => {
      const dealData = {
        dealId: '123',
        deal: { dealname: 'Test Deal' }
      };
      const scoreData = {
        contactCount: 1,
        overallScore: 30,
        contacts: []
      };
      
      const alerts = generateThreadingAlerts(dealData, scoreData);
      
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.find(a => a.type === 'SINGLE_THREADED')).toBeDefined();
    });

    test('generates DM_NOT_ENGAGED alert when decision maker missing', () => {
      const dealData = {
        dealId: '123',
        deal: { dealname: 'Test Deal' }
      };
      const scoreData = {
        contactCount: 3,
        overallScore: 50,
        contacts: [
          { role: 'CHAMPION', effectiveRole: 'CHAMPION', engagementScore: 70 },
          { role: 'INFLUENCER', effectiveRole: 'INFLUENCER', engagementScore: 60 }
        ],
        missingKeyRoles: ['DECISION_MAKER']
      };
      
      const alerts = generateThreadingAlerts(dealData, scoreData);
      
      expect(alerts.find(a => a.type === 'DM_NOT_ENGAGED')).toBeDefined();
    });

    test('generates CHAMPION_DISENGAGED alert for low champion engagement', () => {
      const dealData = {
        dealId: '123',
        deal: { dealname: 'Test Deal' }
      };
      const scoreData = {
        contactCount: 2,
        overallScore: 45,
        contacts: [
          { name: 'John Doe', role: 'CHAMPION', effectiveRole: 'CHAMPION', engagementScore: 20 }
        ]
      };
      
      const alerts = generateThreadingAlerts(dealData, scoreData);
      
      expect(alerts.find(a => a.type === 'CHAMPION_DISENGAGED')).toBeDefined();
    });

    test('generates COVERAGE_GAP alert when stage expectations not met', () => {
      const dealData = {
        dealId: '123',
        deal: { dealname: 'Test Deal' }
      };
      const scoreData = {
        contactCount: 2,
        overallScore: 40,
        contacts: []
      };
      const coverageAnalysis = {
        meetsStageExpectations: false,
        coverageScore: 35,
        adjustedThreshold: 70,
        breadth: {
          stageAnalysis: {
            missingRequired: ['DECISION_MAKER', 'BUDGET_HOLDER']
          }
        }
      };
      
      const alerts = generateThreadingAlerts(dealData, scoreData, coverageAnalysis);
      
      expect(alerts.find(a => a.type === 'COVERAGE_GAP')).toBeDefined();
    });

    test('returns empty alerts for healthy deal', () => {
      const dealData = {
        dealId: '123',
        deal: { dealname: 'Test Deal' }
      };
      const scoreData = {
        contactCount: 5,
        overallScore: 80,
        contacts: [
          { role: 'DECISION_MAKER', effectiveRole: 'DECISION_MAKER', engagementScore: 85 },
          { role: 'CHAMPION', effectiveRole: 'CHAMPION', engagementScore: 90 }
        ],
        missingKeyRoles: []
      };
      const coverageAnalysis = {
        meetsStageExpectations: true,
        coverageScore: 85,
        breadth: { stageAnalysis: { missingRequired: [] } }
      };
      
      const alerts = generateThreadingAlerts(dealData, scoreData, coverageAnalysis);
      
      expect(alerts.length).toBe(0);
    });
  });

  describe('formatSlackAlert', () => {
    test('formats alert for Slack webhook', () => {
      const alert = {
        type: 'SINGLE_THREADED',
        title: 'Single Thread Alert',
        dealId: '123',
        dealName: 'Test Deal',
        severity: 'HIGH',
        message: 'Deal is single-threaded',
        recommendation: 'Add more contacts',
        color: '#f2545b'
      };
      
      const payload = formatSlackAlert(alert);
      
      expect(payload.attachments).toBeDefined();
      expect(payload.attachments[0].blocks).toBeDefined();
      expect(payload.attachments[0].color).toBe('#f2545b');
    });
  });

  describe('formatEmailAlert', () => {
    test('formats alert for email', () => {
      const alert = {
        type: 'SINGLE_THREADED',
        title: 'Single Thread Alert',
        dealId: '123',
        dealName: 'Test Deal',
        severity: 'HIGH',
        message: 'Deal is single-threaded',
        recommendation: 'Add more contacts',
        color: '#f2545b'
      };
      
      const email = formatEmailAlert(alert);
      
      expect(email.subject).toContain('HIGH');
      expect(email.subject).toContain('Test Deal');
      expect(email.html).toContain('Test Deal');
      expect(email.text).toContain('Test Deal');
    });
  });

  describe('shouldThrottle', () => {
    test('returns false for first alert', () => {
      const result = shouldThrottle('deal123', 'SINGLE_THREADED');
      expect(result).toBe(false);
    });
  });

  describe('ALERT_CONFIGS', () => {
    test('has all required alert types', () => {
      expect(ALERT_CONFIGS.SINGLE_THREADED).toBeDefined();
      expect(ALERT_CONFIGS.CHAMPION_DISENGAGED).toBeDefined();
      expect(ALERT_CONFIGS.DM_NOT_ENGAGED).toBeDefined();
      expect(ALERT_CONFIGS.SCORE_DROPPED).toBeDefined();
      expect(ALERT_CONFIGS.COVERAGE_GAP).toBeDefined();
    });

    test('alert configs have required properties', () => {
      Object.values(ALERT_CONFIGS).forEach(config => {
        expect(config.severity).toBeDefined();
        expect(config.title).toBeDefined();
        expect(config.color).toBeDefined();
        expect(config.throttleMinutes).toBeDefined();
      });
    });
  });
});
