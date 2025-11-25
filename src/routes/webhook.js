const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;

/**
 * Verify HubSpot webhook signature
 */
function verifySignature(req, res, next) {
  const signature = req.headers['x-hubspot-signature-v3'];
  const timestamp = req.headers['x-hubspot-request-timestamp'];
  
  if (!signature || !timestamp) {
    // Skip verification in development or if no secret configured
    if (process.env.NODE_ENV === 'development' || !HUBSPOT_CLIENT_SECRET) {
      return next();
    }
    return res.status(401).json({ error: 'Missing signature headers' });
  }
  
  // Verify timestamp is within 5 minutes
  const requestTime = parseInt(timestamp, 10);
  const currentTime = Date.now();
  if (Math.abs(currentTime - requestTime) > 300000) {
    return res.status(401).json({ error: 'Request timestamp too old' });
  }
  
  // Calculate expected signature
  const sourceString = `${req.method}https://${req.headers.host}${req.originalUrl}${JSON.stringify(req.body)}${timestamp}`;
  const expectedSignature = crypto
    .createHmac('sha256', HUBSPOT_CLIENT_SECRET)
    .update(sourceString)
    .digest('base64');
  
  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  next();
}

/**
 * Webhook endpoint for deal changes
 * Triggered when deals are created or updated
 */
router.post('/deal', verifySignature, async (req, res) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    
    console.log(`Received ${events.length} webhook event(s)`);
    
    for (const event of events) {
      const { objectId, subscriptionType, propertyName, propertyValue } = event;
      
      console.log(`Processing webhook: ${subscriptionType} for deal ${objectId}`);
      
      // Handle different subscription types
      switch (subscriptionType) {
        case 'deal.creation':
          console.log(`New deal created: ${objectId}`);
          // Could trigger initial score calculation here
          break;
        
        case 'deal.propertyChange':
          console.log(`Deal ${objectId} property changed: ${propertyName} = ${propertyValue}`);
          // Could trigger score recalculation based on specific property changes
          break;
        
        case 'deal.associationChange':
          console.log(`Deal ${objectId} associations changed`);
          // Trigger score recalculation when contacts are added/removed
          break;
        
        default:
          console.log(`Unhandled subscription type: ${subscriptionType}`);
      }
    }
    
    // Acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Webhook endpoint for contact changes
 */
router.post('/contact', verifySignature, async (req, res) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    
    console.log(`Received ${events.length} contact webhook event(s)`);
    
    for (const event of events) {
      console.log(`Contact event: ${event.subscriptionType} for contact ${event.objectId}`);
      // Could trigger score recalculation for associated deals
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Contact webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
