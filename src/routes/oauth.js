const express = require('express');
const router = express.Router();

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

// Required scopes for the app
const SCOPES = [
  'crm.objects.deals.read',
  'crm.objects.deals.write',
  'crm.objects.contacts.read',
  'crm.objects.contacts.write'
].join(' ');

// In-memory token storage (use a database in production)
const tokenStore = new Map();

/**
 * OAuth initiation endpoint
 * Redirects user to HubSpot authorization page
 */
router.get('/authorize', (req, res) => {
  const authUrl = `https://app.hubspot.com/oauth/authorize?` +
    `client_id=${HUBSPOT_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(APP_BASE_URL + '/oauth/callback')}` +
    `&scope=${encodeURIComponent(SCOPES)}`;
  
  res.redirect(authUrl);
});

/**
 * OAuth callback endpoint
 * Exchanges authorization code for access token
 */
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }
  
  try {
    const axios = require('axios');
    const tokenResponse = await axios.post(
      'https://api.hubapi.com/oauth/v1/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: HUBSPOT_CLIENT_ID,
        client_secret: HUBSPOT_CLIENT_SECRET,
        redirect_uri: APP_BASE_URL + '/oauth/callback',
        code
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    
    // Store tokens (use portal ID as key in production)
    const portalId = 'default';
    tokenStore.set(portalId, {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + (expires_in * 1000)
    });
    
    res.json({
      success: true,
      message: 'Authorization successful! You can now use the Multi-Threading Score app.'
    });
  } catch (error) {
    console.error('OAuth error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to complete authorization',
      details: error.response?.data?.message || error.message
    });
  }
});

/**
 * Get stored access token (refreshing if needed)
 */
async function getAccessToken(portalId = 'default') {
  const tokens = tokenStore.get(portalId);
  
  if (!tokens) {
    throw new Error('No tokens found. Please authorize the app first.');
  }
  
  // Refresh token if expired or about to expire
  if (tokens.expiresAt < Date.now() + 60000) {
    try {
      const axios = require('axios');
      const refreshResponse = await axios.post(
        'https://api.hubapi.com/oauth/v1/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: HUBSPOT_CLIENT_ID,
          client_secret: HUBSPOT_CLIENT_SECRET,
          refresh_token: tokens.refreshToken
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      const { access_token, refresh_token, expires_in } = refreshResponse.data;
      
      tokenStore.set(portalId, {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: Date.now() + (expires_in * 1000)
      });
      
      return access_token;
    } catch (error) {
      console.error('Token refresh error:', error.response?.data || error.message);
      throw new Error('Failed to refresh access token');
    }
  }
  
  return tokens.accessToken;
}

// Export token getter for use in other modules
router.getAccessToken = getAccessToken;

module.exports = router;
