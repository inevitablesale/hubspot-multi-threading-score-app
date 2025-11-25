# HubSpot Multi-Threading Score App

A HubSpot app that evaluates deal contact engagement, participation frequency, and buying roles to generate a multi-threading stakeholder-coverage score. The app surfaces clear, real-time recommendations directly on each deal record, helping sales teams identify single-thread exposure, engage overlooked decision-makers, strengthen multi-stakeholder alignment, and accelerate complex deal cycles with greater predictability and confidence.

## Features

- **Multi-Threading Score Calculation**: Automatically calculates a comprehensive stakeholder coverage score for each deal
- **Contact Engagement Analysis**: Measures engagement levels across emails, meetings, and calls
- **Participation Frequency Tracking**: Identifies active vs. passive stakeholders
- **Buying Role Coverage**: Evaluates representation of key decision-making roles (Decision Maker, Budget Holder, Champion)
- **Risk Assessment**: Provides clear risk levels (High/Medium/Low) based on multi-threading health
- **Actionable Recommendations**: Surfaces real-time suggestions to improve deal outcomes
- **CRM Card Integration**: Displays scores and insights directly on HubSpot deal records

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
│   ├── app.js                    # Express application entry point
│   ├── routes/
│   │   ├── oauth.js              # OAuth authentication routes
│   │   ├── webhook.js            # Webhook handlers
│   │   └── crmCard.js            # CRM Card data endpoints
│   └── services/
│       ├── hubspotService.js     # HubSpot API client wrapper
│       └── scoringService.js     # Multi-threading score calculator
├── tests/
│   ├── app.test.js               # Route tests
│   └── scoringService.test.js    # Scoring logic tests
├── public/                        # Static assets
├── app.json                       # HubSpot app manifest
├── MultiThreadingScoreCard.json  # CRM Card configuration
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

