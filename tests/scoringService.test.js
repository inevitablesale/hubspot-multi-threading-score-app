const {
  calculateMultiThreadingScore,
  calculateContactEngagementScore,
  calculateParticipationScore,
  calculateRoleCoverageScore,
  generateRecommendations,
  BUYING_ROLE_WEIGHTS,
  KEY_ROLES
} = require('../src/services/scoringService');

describe('Scoring Service', () => {
  describe('calculateContactEngagementScore', () => {
    test('returns 0 for no engagements', () => {
      const score = calculateContactEngagementScore({ emails: 0, meetings: 0, calls: 0 });
      expect(score).toBe(0);
    });

    test('calculates correct score for typical engagement', () => {
      const score = calculateContactEngagementScore({ emails: 5, meetings: 2, calls: 3 });
      // meetings: 2*20=40, calls: 3*15=45->30 (capped), emails: 5*5=25
      expect(score).toBe(95);
    });

    test('caps maximum score at 100', () => {
      const score = calculateContactEngagementScore({ emails: 20, meetings: 10, calls: 10 });
      expect(score).toBeLessThanOrEqual(100);
    });

    test('prioritizes meetings over calls over emails', () => {
      const meetingScore = calculateContactEngagementScore({ emails: 0, meetings: 2, calls: 0 });
      const callScore = calculateContactEngagementScore({ emails: 0, meetings: 0, calls: 2 });
      const emailScore = calculateContactEngagementScore({ emails: 0, meetings: 0, calls: 2 });
      
      expect(meetingScore).toBeGreaterThanOrEqual(callScore);
    });
  });

  describe('calculateParticipationScore', () => {
    test('returns 0 for empty contacts array', () => {
      const score = calculateParticipationScore([]);
      expect(score).toBe(0);
    });

    test('calculates score based on active contacts', () => {
      const contacts = [
        { engagements: { total: 5 } },
        { engagements: { total: 3 } },
        { engagements: { total: 0 } }
      ];
      const score = calculateParticipationScore(contacts);
      expect(score).toBeGreaterThan(0);
    });

    test('rewards higher participation rates', () => {
      const lowParticipation = [
        { engagements: { total: 5 } },
        { engagements: { total: 0 } },
        { engagements: { total: 0 } },
        { engagements: { total: 0 } }
      ];
      const highParticipation = [
        { engagements: { total: 5 } },
        { engagements: { total: 3 } },
        { engagements: { total: 4 } },
        { engagements: { total: 2 } }
      ];
      
      const lowScore = calculateParticipationScore(lowParticipation);
      const highScore = calculateParticipationScore(highParticipation);
      
      expect(highScore).toBeGreaterThan(lowScore);
    });
  });

  describe('calculateRoleCoverageScore', () => {
    test('returns low score for no roles', () => {
      const result = calculateRoleCoverageScore([
        { properties: {} }
      ]);
      expect(result.score).toBeLessThan(50);
      expect(result.missingKeyRoles).toContain('DECISION_MAKER');
    });

    test('returns high score when key roles are covered', () => {
      const contacts = [
        { properties: { hs_buying_role: 'DECISION_MAKER' } },
        { properties: { hs_buying_role: 'BUDGET_HOLDER' } },
        { properties: { hs_buying_role: 'CHAMPION' } }
      ];
      const result = calculateRoleCoverageScore(contacts);
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.missingKeyRoles).toHaveLength(0);
    });

    test('identifies missing key roles', () => {
      const contacts = [
        { properties: { hs_buying_role: 'INFLUENCER' } }
      ];
      const result = calculateRoleCoverageScore(contacts);
      expect(result.missingKeyRoles).toContain('DECISION_MAKER');
      expect(result.missingKeyRoles).toContain('BUDGET_HOLDER');
      expect(result.missingKeyRoles).toContain('CHAMPION');
    });
  });

  describe('calculateMultiThreadingScore', () => {
    test('returns complete score breakdown', () => {
      const data = {
        contacts: [
          {
            id: '1',
            properties: {
              firstname: 'John',
              lastname: 'Doe',
              email: 'john@test.com',
              hs_buying_role: 'DECISION_MAKER',
              jobtitle: 'CEO'
            },
            engagements: { emails: 5, meetings: 2, calls: 1, total: 8 }
          }
        ]
      };
      
      const result = calculateMultiThreadingScore(data);
      
      expect(result).toHaveProperty('overallScore');
      expect(result).toHaveProperty('engagementScore');
      expect(result).toHaveProperty('participationScore');
      expect(result).toHaveProperty('roleCoverageScore');
      expect(result).toHaveProperty('contactCount');
      expect(result).toHaveProperty('threadDepth');
      expect(result).toHaveProperty('riskLevel');
      expect(result).toHaveProperty('coveredRoles');
      expect(result).toHaveProperty('missingKeyRoles');
      expect(result).toHaveProperty('contacts');
    });

    test('identifies high risk for single contact deals', () => {
      const data = {
        contacts: [
          {
            id: '1',
            properties: { firstname: 'Solo', email: 'solo@test.com' },
            engagements: { emails: 1, meetings: 0, calls: 0, total: 1 }
          }
        ]
      };
      
      const result = calculateMultiThreadingScore(data);
      expect(result.riskLevel).toBe('HIGH');
    });

    test('identifies low risk for well-threaded deals', () => {
      const data = {
        contacts: [
          {
            id: '1',
            properties: { firstname: 'Decision', hs_buying_role: 'DECISION_MAKER' },
            engagements: { emails: 5, meetings: 3, calls: 2, total: 10 }
          },
          {
            id: '2',
            properties: { firstname: 'Budget', hs_buying_role: 'BUDGET_HOLDER' },
            engagements: { emails: 4, meetings: 2, calls: 1, total: 7 }
          },
          {
            id: '3',
            properties: { firstname: 'Champion', hs_buying_role: 'CHAMPION' },
            engagements: { emails: 6, meetings: 4, calls: 3, total: 13 }
          },
          {
            id: '4',
            properties: { firstname: 'User', hs_buying_role: 'END_USER' },
            engagements: { emails: 2, meetings: 1, calls: 0, total: 3 }
          }
        ]
      };
      
      const result = calculateMultiThreadingScore(data);
      expect(result.overallScore).toBeGreaterThanOrEqual(60);
    });

    test('handles empty contacts', () => {
      const result = calculateMultiThreadingScore({ contacts: [] });
      expect(result.overallScore).toBe(0);
      expect(result.contactCount).toBe(0);
      expect(result.riskLevel).toBe('HIGH');
    });
  });

  describe('generateRecommendations', () => {
    test('generates single-thread warning for one contact', () => {
      const scoreData = {
        contactCount: 1,
        missingKeyRoles: ['BUDGET_HOLDER', 'CHAMPION'],
        coveredRoles: ['DECISION_MAKER'],
        contacts: [{ name: 'John', engagementScore: 50 }],
        overallScore: 30
      };
      
      const recommendations = generateRecommendations(scoreData);
      const singleThreadRec = recommendations.find(r => r.type === 'SINGLE_THREAD_RISK');
      
      expect(singleThreadRec).toBeDefined();
      expect(singleThreadRec.priority).toBe('HIGH');
    });

    test('generates missing roles recommendation', () => {
      const scoreData = {
        contactCount: 2,
        missingKeyRoles: ['DECISION_MAKER', 'CHAMPION'],
        coveredRoles: ['BUDGET_HOLDER'],
        contacts: [],
        overallScore: 40
      };
      
      const recommendations = generateRecommendations(scoreData);
      const missingRolesRec = recommendations.find(r => r.type === 'MISSING_ROLES');
      
      expect(missingRolesRec).toBeDefined();
    });

    test('generates positive recommendation for strong multi-threading', () => {
      const scoreData = {
        contactCount: 5,
        missingKeyRoles: [],
        coveredRoles: ['DECISION_MAKER', 'BUDGET_HOLDER', 'CHAMPION'],
        contacts: [
          { name: 'A', engagementScore: 80 },
          { name: 'B', engagementScore: 70 },
          { name: 'C', engagementScore: 60 }
        ],
        overallScore: 75
      };
      
      const recommendations = generateRecommendations(scoreData);
      const strongRec = recommendations.find(r => r.type === 'STRONG_POSITION');
      
      expect(strongRec).toBeDefined();
    });

    test('sorts recommendations by priority', () => {
      const scoreData = {
        contactCount: 1,
        missingKeyRoles: ['DECISION_MAKER'],
        coveredRoles: [],
        contacts: [{ name: 'John', engagementScore: 20 }],
        overallScore: 20
      };
      
      const recommendations = generateRecommendations(scoreData);
      
      // First recommendations should be HIGH priority
      expect(recommendations[0].priority).toBe('HIGH');
    });
  });
});
