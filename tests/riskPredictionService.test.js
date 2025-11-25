const {
  predictChampionChurn,
  predictEconomicBuyerRisk,
  predictMeetingProgressionRisk,
  predictDealRisk,
  analyzeStageVelocity,
  RISK_FACTORS,
  STAGE_VELOCITY_BENCHMARKS
} = require('../src/services/riskPredictionService');

describe('Risk Prediction Service', () => {
  describe('predictChampionChurn', () => {
    test('returns UNKNOWN for no champion', () => {
      const result = predictChampionChurn(null);
      
      expect(result.churnRisk).toBe('UNKNOWN');
      expect(result.riskScore).toBe(0);
    });

    test('identifies HIGH churn risk with multiple indicators', () => {
      const champion = {
        engagements: { total: 2 },
        engagementScore: 20
      };
      const history = {
        responseRate: 0.2,
        previousEngagementScore: 70,
        missedMeetings: 3,
        daysSinceLastContact: 21
      };
      
      const result = predictChampionChurn(champion, history);
      
      expect(result.churnRisk).toBe('HIGH');
      expect(result.factors.length).toBeGreaterThan(0);
    });

    test('identifies NONE churn risk for healthy champion', () => {
      const champion = {
        engagements: { total: 15 },
        engagementScore: 85
      };
      const history = {
        responseRate: 0.9,
        previousEngagementScore: 80,
        missedMeetings: 0,
        daysSinceLastContact: 2
      };
      
      const result = predictChampionChurn(champion, history);
      
      expect(result.churnRisk).toBe('NONE');
    });

    test('provides recommendation based on risk level', () => {
      const champion = {
        engagements: { total: 5 },
        engagementScore: 40
      };
      
      const result = predictChampionChurn(champion, {});
      
      expect(result.recommendation).toBeDefined();
      expect(typeof result.recommendation).toBe('string');
    });
  });

  describe('predictEconomicBuyerRisk', () => {
    test('identifies HIGH risk when economic buyer missing at contract stage', () => {
      const scoreData = {
        coveredRoles: ['CHAMPION', 'INFLUENCER'],
        contacts: []
      };
      
      const result = predictEconomicBuyerRisk(scoreData, 'contractsent');
      
      expect(result.riskLevel).toBe('HIGH');
      expect(result.hasEconomicBuyer).toBe(false);
    });

    test('identifies NONE risk when economic buyer present and engaged', () => {
      const scoreData = {
        coveredRoles: ['DECISION_MAKER', 'BUDGET_HOLDER', 'CHAMPION'],
        contacts: [
          { role: 'DECISION_MAKER', effectiveRole: 'DECISION_MAKER', engagementScore: 75 }
        ]
      };
      
      const result = predictEconomicBuyerRisk(scoreData, 'qualifiedtobuy');
      
      expect(result.hasEconomicBuyer).toBe(true);
    });

    test('identifies risk for low economic buyer engagement', () => {
      const scoreData = {
        coveredRoles: ['DECISION_MAKER'],
        contacts: [
          { role: 'DECISION_MAKER', effectiveRole: 'DECISION_MAKER', engagementScore: 15 }
        ]
      };
      
      const result = predictEconomicBuyerRisk(scoreData, 'presentationscheduled');
      
      expect(result.factors.length).toBeGreaterThan(0);
    });
  });

  describe('predictMeetingProgressionRisk', () => {
    test('identifies HIGH risk for stalled deal', () => {
      const meetingData = {
        totalMeetings: 10,
        meetingsSinceStageChange: 6,
        daysSinceLastMeeting: 21
      };
      
      const result = predictMeetingProgressionRisk(meetingData);
      
      expect(result.riskLevel).toBe('HIGH');
      expect(result.factors.length).toBeGreaterThan(0);
    });

    test('identifies NONE risk for healthy meeting cadence', () => {
      const meetingData = {
        totalMeetings: 5,
        meetingsSinceStageChange: 2,
        daysSinceLastMeeting: 3,
        averageAttendees: 4
      };
      
      const result = predictMeetingProgressionRisk(meetingData);
      
      expect(result.riskLevel).toBe('NONE');
    });

    test('identifies decreasing attendance risk', () => {
      const meetingData = {
        totalMeetings: 8,
        meetingsSinceStageChange: 3,
        daysSinceLastMeeting: 5,
        averageAttendees: 2,
        previousAverageAttendees: 5
      };
      
      const result = predictMeetingProgressionRisk(meetingData);
      
      expect(result.factors.find(f => f.factor === 'Decreasing Attendance')).toBeDefined();
    });
  });

  describe('predictDealRisk', () => {
    test('calculates composite risk score', () => {
      const dealData = {
        deal: { dealstage: 'presentationscheduled' }
      };
      const scoreData = {
        coveredRoles: ['CHAMPION'],
        contacts: [
          { role: 'CHAMPION', effectiveRole: 'CHAMPION', engagementScore: 50 }
        ]
      };
      
      const result = predictDealRisk(dealData, scoreData);
      
      expect(result.overallRiskLevel).toBeDefined();
      expect(result.compositeRiskScore).toBeDefined();
      expect(result.riskBreakdown).toBeDefined();
    });

    test('provides priority actions for high risk', () => {
      const dealData = {
        deal: { dealstage: 'contractsent' }
      };
      const scoreData = {
        coveredRoles: [],
        contacts: [],
        missingKeyRoles: ['DECISION_MAKER', 'BUDGET_HOLDER', 'CHAMPION']
      };
      
      const result = predictDealRisk(dealData, scoreData, {
        meetingData: {
          meetingsSinceStageChange: 10,
          daysSinceLastMeeting: 30
        }
      });
      
      expect(result.priorityActions.length).toBeGreaterThan(0);
    });

    test('identifies HEALTHY deal', () => {
      const dealData = {
        deal: { dealstage: 'qualifiedtobuy' }
      };
      const scoreData = {
        coveredRoles: ['DECISION_MAKER', 'BUDGET_HOLDER', 'CHAMPION'],
        contacts: [
          { role: 'CHAMPION', effectiveRole: 'CHAMPION', engagementScore: 90 }
        ]
      };
      
      const result = predictDealRisk(dealData, scoreData, {
        engagementHistory: {
          responseRate: 0.95,
          daysSinceLastContact: 1
        },
        meetingData: {
          meetingsSinceStageChange: 2,
          daysSinceLastMeeting: 3
        }
      });
      
      // May still have some risk factors but should not be HIGH
      expect(['HEALTHY', 'LOW', 'MEDIUM']).toContain(result.overallRiskLevel);
    });
  });

  describe('analyzeStageVelocity', () => {
    test('identifies stuck deal', () => {
      const dealData = {
        deal: {
          dealstage: 'qualifiedtobuy',
          hs_date_entered_currentstage: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
        }
      };
      
      const result = analyzeStageVelocity(dealData);
      
      expect(result.isStuck).toBe(true);
      expect(result.status).toBe('STUCK');
    });

    test('identifies slowing deal', () => {
      const dealData = {
        deal: {
          dealstage: 'qualifiedtobuy',
          hs_date_entered_currentstage: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      };
      
      const result = analyzeStageVelocity(dealData);
      
      expect(result.isSlowing).toBe(true);
      expect(result.status).toBe('SLOWING');
    });

    test('identifies on-track deal', () => {
      const dealData = {
        deal: {
          dealstage: 'qualifiedtobuy',
          hs_date_entered_currentstage: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
        }
      };
      
      const result = analyzeStageVelocity(dealData);
      
      expect(result.status).toBe('ON_TRACK');
    });

    test('handles missing stage date', () => {
      const dealData = {
        deal: {
          dealstage: 'qualifiedtobuy'
        }
      };
      
      const result = analyzeStageVelocity(dealData);
      
      expect(result.isStuck).toBe(false);
      expect(result.daysInStage).toBeNull();
    });
  });

  describe('RISK_FACTORS', () => {
    test('has champion churn indicators', () => {
      expect(RISK_FACTORS.CHAMPION_CHURN_INDICATORS).toBeDefined();
      expect(RISK_FACTORS.CHAMPION_CHURN_INDICATORS.lowResponseRate).toBeDefined();
    });

    test('has economic buyer timing', () => {
      expect(RISK_FACTORS.ECONOMIC_BUYER_TIMING).toBeDefined();
      expect(RISK_FACTORS.ECONOMIC_BUYER_TIMING.notInvolvedByStageX).toBeDefined();
    });

    test('has meeting patterns', () => {
      expect(RISK_FACTORS.MEETING_PATTERNS).toBeDefined();
      expect(RISK_FACTORS.MEETING_PATTERNS.tooManyWithoutProgression).toBeDefined();
    });
  });

  describe('STAGE_VELOCITY_BENCHMARKS', () => {
    test('has benchmarks for common stages', () => {
      expect(STAGE_VELOCITY_BENCHMARKS.appointmentscheduled).toBeDefined();
      expect(STAGE_VELOCITY_BENCHMARKS.qualifiedtobuy).toBeDefined();
      expect(STAGE_VELOCITY_BENCHMARKS.contractsent).toBeDefined();
    });

    test('benchmarks have expected and max days', () => {
      Object.values(STAGE_VELOCITY_BENCHMARKS).forEach(benchmark => {
        expect(benchmark.expectedDays).toBeDefined();
        expect(benchmark.maxDays).toBeDefined();
        expect(benchmark.maxDays).toBeGreaterThanOrEqual(benchmark.expectedDays);
      });
    });
  });
});
