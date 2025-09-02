const express = require('express');
const { checkLightdashAuth, optionalLightdashAuth } = require('~/server/middleware/lightdashAuth');
const { logger } = require('~/config');

const router = express.Router();

/**
 * GET /api/lightdash/auth-status
 * Check if user is authenticated with Lightdash
 */
router.get('/auth-status', optionalLightdashAuth, async (req, res) => {
  try {
    if (req.user && req.lightdashUser) {
      const axios = require('axios');
      const lightdashUrl = process.env.LIGHTDASH_URL || 'http://localhost:8080';
      
      // Parse all cookies
      const cookies = req.headers.cookie || '';
      const parsedCookies = require('cookie').parse(cookies);
      const allCookies = Object.entries(parsedCookies).map(([name, value]) => `${name}=${value}`).join('; ');
      
      // Get all credentials in parallel
      const [mcpResponse, credentialsResponse] = await Promise.all([
        axios.get(`${lightdashUrl}/api/v1/user/mcp-credentials`, {
          headers: {
            'Cookie': allCookies,
            'Content-Type': 'application/json'
          },
          timeout: 5000,
          validateStatus: (status) => status < 500
        }),
        axios.get(`${lightdashUrl}/api/v1/user/get-credentials`, {
          headers: {
            'Cookie': allCookies,
            'Content-Type': 'application/json'
          },
          timeout: 5000,
          validateStatus: (status) => status < 500
        })
      ]);

      // Construct mcpCredentials after getting all responses
      const mcpCredentials = {};

      if (mcpResponse.status === 200 && mcpResponse.data?.results && credentialsResponse.data?.results && credentialsResponse.data?.results) {
        Object.assign(mcpCredentials, {
          lightdashApiKey: mcpResponse.data.results.apiKey,
          projectId: mcpResponse.data.results.projectId,
          defaultSpaceId: mcpResponse.data.results.defaultSpaceId,
          facebook: {
            accountIds: credentialsResponse.data?.results["Facebook"].accounts_data.map((account) => account.account_id).join(','),
            token: credentialsResponse.data?.results["Facebook"].long_lived_fb_token
          },
          google: {
            accountIds: credentialsResponse.data?.results["Google"].accounts_data.map((account) => {
              if (account.customer_manager_id) {
                return `${account.account_id}-${account.customer_manager_id}`;
              } else {
                return account.account_id;
              }
            }).join(','),
            token: credentialsResponse.data?.results["Google"].refresh_token
          }
        });
      }

      return res.json({
        authenticated: true,
        user: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          lightdashUuid: req.user.lightdashUuid
        },
        lightdashUser: {
          userUuid: req.lightdashUser.userUuid,
          firstName: req.lightdashUser.firstName,
          lastName: req.lightdashUser.lastName,
          email: req.lightdashUser.email,
          organizationName: req.lightdashUser.organizationName,
          organizationUuid: req.lightdashUser.organizationUuid
        },
        mcpCredentials: mcpCredentials
      });
    } else {
      return res.json({
        authenticated: false,
        redirectUrl: `${process.env.LIGHTDASH_URL || 'http://localhost:8080'}/login`
      });
    }
  } catch (error) {
    logger.error('[lightdash/auth-status] Error:', error);
    return res.status(500).json({
      error: 'Failed to retrieve authentication status and credentials'
    });
  }
});

/**
 * POST /api/lightdash/sync-user
 * Sync user data between Lightdash and LibreChat
 */
router.post('/sync-user', checkLightdashAuth, async (req, res) => {
  try {
    const { updateUser } = require('~/models');
    
    if (req.user && req.lightdashUser) {
      // Update LibreChat user with latest Lightdash data
      const updatedData = {
        name: `${req.lightdashUser.firstName} ${req.lightdashUser.lastName}`.trim(),
        email: req.lightdashUser.email,
        lightdashUuid: req.lightdashUser.userUuid
      };

      await updateUser(req.user.id, updatedData);
      
      return res.json({
        success: true,
        message: 'User data synced successfully'
      });
    } else {
      return res.status(401).json({
        error: 'User not authenticated'
      });
    }
  } catch (error) {
    logger.error('[lightdash/sync-user] Error:', error);
    return res.status(500).json({
      error: 'Failed to sync user data'
    });
  }
});

/**
 * POST /api/lightdash/sync-user-from-lightdash
 * Receive user sync from Lightdash (called by Lightdash when new user registers)
 */
router.post('/sync-user-from-lightdash', async (req, res) => {
  try {
    const { createUser, getUserById } = require('~/models');
    const { getBalanceConfig } = require('~/server/services/Config/getCustomConfig'); // Fixed import
    
    const userData = req.body;
    
    // Validate required fields
    if (!userData.lightdashUuid || !userData.email) {
      return res.status(400).json({
        error: 'Missing required fields: lightdashUuid and email'
      });
    }

    // Check if user already exists
    const { findUser } = require('~/models');
    const existingUser = await findUser({ 
      $or: [
        { lightdashUuid: userData.lightdashUuid },
        { email: userData.email }
      ]
    });

    if (existingUser) {
      // User already exists, update their data
      const { updateUser } = require('~/models');
      await updateUser(existingUser.id, {
        lightdashUuid: userData.lightdashUuid,
        name: userData.name,
        email: userData.email
      });

      return res.status(200).json({
        success: true,
        message: 'User updated successfully',
        userId: existingUser.id
      });
    }

    // Create new user
    const balanceConfig = await getBalanceConfig();
    const newUserId = await createUser(userData, balanceConfig);
    
    logger.info(`[lightdash/sync-user-from-lightdash] Created user ${newUserId} from Lightdash sync`);
    
    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      userId: newUserId
    });
  } catch (error) {
    logger.error('[lightdash/sync-user-from-lightdash] Error:', error);
    return res.status(500).json({
      error: 'Failed to sync user from Lightdash'
    });
  }
});

/**
 * GET /api/lightdash/config
 * Get Lightdash integration configuration
 */
router.get('/config', (req, res) => {
  try {
    const lightdashIntegrationEnabled = process.env.LIGHTDASH_INTEGRATION_ENABLED === 'true';
    const lightdashUrl = process.env.LIGHTDASH_URL || 'http://localhost:8080';
    
    return res.json({
      integrationEnabled: lightdashIntegrationEnabled,
      lightdashUrl: lightdashUrl
    });
  } catch (error) {
    logger.error('[lightdash/config] Error:', error);
    return res.status(500).json({
      error: 'Failed to get configuration'
    });
  }
});

module.exports = router; 