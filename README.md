# HubSpot Multi-Threading Score App

A comprehensive HubSpot app that evaluates deal contact engagement, participation frequency, and buying roles to generate a multi-threading stakeholder-coverage score. The app surfaces clear, real-time recommendations directly on each deal record, helping sales teams identify single-thread exposure, engage overlooked decision-makers, strengthen multi-stakeholder alignment, and accelerate complex deal cycles with greater predictability and confidence.

## Features

### Core Features
- **Multi-Threading Score Calculation**: Automatically calculates a comprehensive stakeholder coverage score for each deal
- **Contact Engagement Analysis**: Measures engagement levels across emails, meetings, and calls
- **Participation Frequency Tracking**: Identifies active vs. passive stakeholders
- **Buying Role Coverage**: Evaluates representation of key decision-making roles (Decision Maker, Budget Holder, Champion)
- **Risk Assessment**: Provides clear risk levels (High/Medium/Low) based on multi-threading health
- **Actionable Recommendations**: Surfaces real-time suggestions to improve deal outcomes
- **CRM Card Integration**: Displays scores and insights directly on HubSpot deal records

### Advanced Intelligence Features

#### 1. Automatic Role Inference (AI-Based)
When roles aren't explicitly set on contacts, the app infers them from:
- Job titles (CEO → Decision Maker, CFO → Budget Holder, etc.)
- Email signatures and language patterns
- Behavior patterns (engagement timing and frequency)
- Meeting participation patterns

#### 2. Coverage Depth vs. Breadth Analysis
The scoring system differentiates between:
- **Breadth**: Number of roles represented (Decision Maker, Champion, Influencer)
- **Depth**: How strongly each role is engaged (frequency + recency)

#### 3. Stakeholder Lifecycle Tracking
Track how stakeholder engagement changes over time:
- "Champion is cooling off"
- "Budget Holder engagement just increased"
- "DM hasn't engaged in 14 days"

This creates a dynamic heat map of deal health.

#### 4. Real-Time Threading Alerts
Configurable alerts via Slack or email:
- "This deal is single-threaded again"
- "Deal has gone 14 days without new contact involvement"
- "Champion dropped below engagement threshold"

#### 5. Champion Reliability Scoring
Calculate "Champion Strength" based on:
- Responsiveness
- Advocacy language in communications
- Meeting attendance
- Influence role inferred from job title

#### 6. Engagement Risk Predictors
ML-pattern based predictions:
- "Champion likely to churn"
- "Economic buyer not involved by Stage X → high risk"
- "Too many meetings without progression"

#### 7. Custom Workflow Actions
Enable HubSpot workflow integration:
- "If Multi-Thread Score < 40 → Create Task"
- "If Decision Maker not engaged → Notify rep"
- "If new stakeholder added → Recalculate score"

#### 8. Deal Stage-Specific Thresholds
Different stages require different stakeholder coverage:
- Early stages: Champion + Influencer
- Mid stages: DM + Finance
- Late stages: Legal + Procurement

#### 9. "What's Missing?" Checklist
A simple UI panel showing:
- "Missing Decision Maker"
- "Not enough seniority"
- "No finance involvement"
- "Champion inactive 9 days"

#### 10. Inline Playbooks
Clickable recommendations with:
- Email templates for re-engaging stakeholders
- Playbooks for building multi-threaded deals
- Role-specific engagement checklists

#### 11. Exportable Deal Health Reports
Generate:
- PDF-ready deal health reports
- Manager coaching packets
- Pipeline-wide multi-threading dashboards

## Score Components

The multi-threading score is calculated from four key components:

| Component | Weight | Description |
|-----------|--------|-------------|
| Engagement Score | 30% | Average engagement level across all contacts |
| Participation Score | 25% | Rate and volume of actively engaged contacts |
| Role Coverage Score | 35% | Coverage of key buying roles |
| Thread Depth Bonus | 10% | Number of engaged stakeholders |

### Risk Levels

- **LOW (70-100)**: Strong multi-threading with diverse stakeholder engagement
- **MEDIUM (40-69)**: Moderate coverage with opportunities for improvement
- **HIGH (0-39)**: Critical single-thread exposure or missing key stakeholders

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- A HubSpot developer account
- A HubSpot app with the required scopes

### Setup

1. Clone this repository:
   ```bash
   git clone https://github.com/inevitablesale/hubspot-multi-threading-score-app.git
   cd hubspot-multi-threading-score-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on the example:
   ```bash
   cp .env.example .env
   ```

4. Configure your HubSpot app credentials in `.env`:
   ```env
   HUBSPOT_CLIENT_ID=your_client_id_here
   HUBSPOT_CLIENT_SECRET=your_client_secret_here
   HUBSPOT_APP_ID=your_app_id_here
   PORT=3000
   APP_BASE_URL=http://localhost:3000
   ```

5. Start the server:
   ```bash
   npm start
   ```

   For development with auto-reload:
   ```bash
   npm run dev
   ```

## HubSpot App Configuration

### Required Scopes

- `crm.objects.deals.read` - Read deal records
- `crm.objects.deals.write` - Update deal properties
- `crm.objects.contacts.read` - Read contact records
- `crm.objects.contacts.write` - Update contact properties

### CRM Card Setup

1. In your HubSpot developer account, create a new app or use an existing one
2. Navigate to **Features** > **CRM Cards**
3. Create a new CRM Card with the following settings:
   - **Data Fetch URL**: `{YOUR_APP_URL}/crm-card/deal`
   - **Object Types**: Deals
   - **Properties to send**: `hs_object_id`, `dealname`, `amount`, `dealstage`

### Webhook Subscriptions (Optional)

For real-time score updates, configure webhooks for:
- `deal.creation`
- `deal.propertyChange`
- `deal.associationChange`

Webhook endpoint: `{YOUR_APP_URL}/webhooks/deal`

## API Endpoints

### Core Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | App information and available endpoints |
| `/health` | GET | Health check endpoint |
| `/oauth/authorize` | GET | Initiates OAuth authorization flow |
| `/oauth/callback` | GET | OAuth callback handler |
| `/crm-card/deal` | GET | CRM Card data endpoint (called by HubSpot) |
| `/crm-card/refresh` | POST | Trigger score refresh |
| `/crm-card/details` | GET | Detailed score view (iframe) |
| `/webhooks/deal` | POST | Deal webhook handler |
| `/webhooks/contact` | POST | Contact webhook handler |

### Analysis Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analysis/coverage/:dealId` | GET | Get breadth vs depth coverage analysis |
| `/api/analysis/champion/:dealId` | GET | Get champion strength analysis |
| `/api/analysis/risk/:dealId` | GET | Get risk prediction for deal |
| `/api/analysis/alerts/:dealId` | POST | Generate threading alerts |
| `/api/analysis/lifecycle/:dealId` | POST | Track stakeholder lifecycle changes |

### Workflow Action Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analysis/workflow/actions` | GET | Get available workflow actions |
| `/api/analysis/workflow/action` | POST | Execute a workflow action |

### Report Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analysis/report/:dealId` | GET | Generate deal health report |
| `/api/analysis/report/coaching` | POST | Generate manager coaching packet |
| `/api/analysis/report/dashboard` | POST | Generate pipeline dashboard |

### Playbook Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analysis/playbooks` | GET | Get all available playbooks |
| `/api/analysis/playbooks/:dealId` | GET | Get contextual recommendations |
| `/api/analysis/playbooks/template` | POST | Render email template |

## Development

### Running Tests

```bash
npm test
```

### Running Tests in Watch Mode

```bash
npm run test:watch
```

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

## Project Structure

```
hubspot-multi-threading-score-app/
├── src/
│   ├── app.js                           # Express application entry point
│   ├── routes/
│   │   ├── oauth.js                     # OAuth authentication routes
│   │   ├── webhook.js                   # Webhook handlers
│   │   ├── crmCard.js                   # CRM Card data endpoints
│   │   └── analysis.js                  # Advanced analysis endpoints
│   └── services/
│       ├── hubspotService.js            # HubSpot API client wrapper
│       ├── scoringService.js            # Multi-threading score calculator
│       ├── roleInferenceService.js      # AI-based role inference
│       ├── coverageAnalysisService.js   # Breadth/depth coverage analysis
│       ├── alertService.js              # Real-time threading alerts
│       ├── riskPredictionService.js     # ML-based risk prediction
│       ├── workflowActionsService.js    # Custom workflow actions
│       ├── reportService.js             # Deal health reports
│       ├── playbookService.js           # Inline playbooks and templates
│       └── integrationService.js        # External integrations
├── tests/
│   ├── app.test.js                      # Route tests
│   ├── scoringService.test.js           # Scoring logic tests
│   ├── roleInferenceService.test.js     # Role inference tests
│   ├── coverageAnalysisService.test.js  # Coverage analysis tests
│   ├── alertService.test.js             # Alert service tests
│   ├── riskPredictionService.test.js    # Risk prediction tests
│   ├── workflowActionsService.test.js   # Workflow actions tests
│   └── playbookService.test.js          # Playbook service tests
├── public/                              # Static assets
├── app.json                             # HubSpot app manifest
├── MultiThreadingScoreCard.json         # CRM Card configuration
├── package.json
└── README.md
```

## Recommendations Engine

The app generates actionable recommendations based on score analysis:

| Type | Priority | Trigger |
|------|----------|---------|
| Single-Thread Risk | HIGH | Only one contact on deal |
| Missing Key Roles | HIGH | Decision Maker, Budget Holder, or Champion not identified |
| Critical Coverage Gap | HIGH | Overall score below 40 |
| Low Engagement | MEDIUM | Contacts with minimal engagement |
| No Champion | MEDIUM | No champion identified |
| Strong Position | LOW | Good multi-threading (score ≥ 70 with 3+ contacts) |

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and add tests
4. Run tests: `npm test`
5. Commit your changes: `git commit -am 'Add my feature'`
6. Push to the branch: `git push origin feature/my-feature`
7. Submit a pull request

## License

ISC

