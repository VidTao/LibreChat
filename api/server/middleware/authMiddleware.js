const { isEnabled } = require('~/server/utils');
const requireJwtAuth = require('./requireJwtAuth');
const { checkLightdashAuth } = require('./lightdashAuth');

/**
 * Unified authentication middleware
 * Uses Lightdash auth if integration is enabled, otherwise falls back to JWT auth
 */
const unifiedAuth = (req, res, next) => {
  const lightdashIntegrationEnabled = isEnabled(process.env.LIGHTDASH_INTEGRATION_ENABLED);
  
  if (lightdashIntegrationEnabled) {
    return checkLightdashAuth(req, res, next);
  } else {
    return requireJwtAuth(req, res, next);
  }
};

module.exports = unifiedAuth; 