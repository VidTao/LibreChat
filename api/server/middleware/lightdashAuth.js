const axios = require('axios');
const { logger } = require('~/config');
const { findUser } = require('~/models');

/**
 * Middleware to check Lightdash authentication
 * If user is authenticated in Lightdash, skip LibreChat auth
 * If not authenticated, redirect to Lightdash login
 */
const checkLightdashAuth = async (req, res, next) => {
  try {
    // Get the Lightdash base URL from environment variable
    const lightdashUrl = process.env.LIGHTDASH_URL || 'http://localhost:8080';
    
    // Forward the cookies from the request to Lightdash
    const cookies = req.headers.cookie || '';
    
    // Check authentication status with Lightdash
    const response = await axios.get(`${lightdashUrl}/api/v1/user`, {
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json'
      },
      timeout: 5000,
      validateStatus: (status) => status < 500 // Don't throw on 4xx errors
    });

    if (response.status === 200 && response.data?.results) {
      const lightdashUser = response.data.results;
      
      // Check if user exists in LibreChat database
      let librechatUser = await findUser({ 
        lightdashUuid: lightdashUser.userUuid 
      });

      if (!librechatUser) {
        // Create user in LibreChat if they don't exist
        librechatUser = await createLibrechatUserFromLightdash(lightdashUser);
      }

      // Set user on request object for downstream middleware
      req.user = librechatUser;
      req.lightdashUser = lightdashUser;
      return next();
    } else {
      // User not authenticated in Lightdash
      return res.status(401).json({
        message: 'Authentication required',
        redirectUrl: `${lightdashUrl}/login`
      });
    }
  } catch (error) {
    logger.error('[checkLightdashAuth] Error checking Lightdash authentication:', error);
    
    // If Lightdash is unavailable, fall back to LibreChat auth
    if (error.code === 'ECONNREFUSED' || error.code === 'TIMEOUT') {
      logger.warn('[checkLightdashAuth] Lightdash unavailable, falling back to LibreChat auth');
      return next();
    }
    
    return res.status(500).json({
      message: 'Authentication service error'
    });
  }
};

/**
 * Create a LibreChat user from Lightdash user data
 */
const createLibrechatUserFromLightdash = async (lightdashUser) => {
  const { createUser } = require('~/models');
  
  try {
    // Get balance config - using correct import path
    let balanceConfig = {};
    try {
      const { getBalanceConfig } = require('~/server/services/Config/getCustomConfig');
      balanceConfig = await getBalanceConfig();
    } catch (configError) {
      console.log('Could not get balance config, using defaults:', configError.message);
      balanceConfig = {}; // Use empty config as fallback
    }
    
    const userData = {
      name: `${lightdashUser.firstName} ${lightdashUser.lastName}`.trim(),
      username: lightdashUser.email.split('@')[0],
      email: lightdashUser.email,
      emailVerified: true, // Assume verified if they're in Lightdash
      provider: 'lightdash',
      role: 'USER',
      lightdashUuid: lightdashUser.userUuid,
      termsAccepted: true // Assume accepted if they're using Lightdash
    };

    const newUserId = await createUser(userData, balanceConfig);
    const { getUserById } = require('~/models');
    return await getUserById(newUserId);
  } catch (error) {
    console.error('[createLibrechatUserFromLightdash] Error creating user:', error);
    throw error;
  }
};

/**
 * Optional Lightdash authentication middleware
 * Sets req.user and req.lightdashUser if authenticated, but continues regardless
 */
const optionalLightdashAuth = async (req, res, next) => {
  try {
    // Read from environment variable (not hardcoded!)
    const lightdashUrl = process.env.LIGHTDASH_URL || 'http://localhost:3000';
    
    // Forward the cookies from the request to Lightdash
    const cookies = req.headers.cookie || '';
    
    console.log('Calling Lightdash at:', `${lightdashUrl}/api/v1/user`);
    console.log('Forwarding cookies:', cookies);
    
    // Check authentication status with Lightdash
    const response = await axios.get(`${lightdashUrl}/api/v1/user`, {
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json'
      },
      timeout: 5000,
      validateStatus: (status) => status < 500 // Don't throw on 4xx errors
    });

    console.log('Lightdash response status:', response.status);
    console.log('Lightdash response data:', response.data);

    // Use consistent response parsing (same as checkLightdashAuth)
    if (response.status === 200 && response.data?.results) {
      const lightdashUser = response.data.results;
      
      // Check if user exists in LibreChat database
      let librechatUser = await findUser({ 
        lightdashUuid: lightdashUser.userUuid 
      });

      if (!librechatUser) {
        // Create user in LibreChat if they don't exist
        librechatUser = await createLibrechatUserFromLightdash(lightdashUser);
      }

      // Set user on request object for downstream middleware
      req.user = librechatUser;
      req.lightdashUser = lightdashUser;
    }
    
    // Always continue, regardless of auth status
    return next();
    
  } catch (error) {
    // Continue regardless of error - this is "optional" auth
    console.log('[optionalLightdashAuth] Error:', error.message);
    return next();
  }
};

module.exports = {
  checkLightdashAuth,
  optionalLightdashAuth,
  createLibrechatUserFromLightdash
}; 