const express = require('express');
const {
  refreshController,
  registrationController,
  resetPasswordController,
  resetPasswordRequestController,
} = require('~/server/controllers/AuthController');
const { loginController } = require('~/server/controllers/auth/LoginController');
const { logoutController } = require('~/server/controllers/auth/LogoutController');
const { verify2FAWithTempToken } = require('~/server/controllers/auth/TwoFactorAuthController');
const {
  enable2FA,
  verify2FA,
  disable2FA,
  regenerateBackupCodes,
  confirm2FA,
} = require('~/server/controllers/TwoFactorController');
const {
  checkBan,
  logHeaders,
  loginLimiter,
  requireJwtAuth,
  checkInviteUser,
  registerLimiter,
  requireLdapAuth,
  setBalanceConfig,
  requireLocalAuth,
  resetPasswordLimiter,
  validateRegistration,
  validatePasswordReset,
} = require('~/server/middleware');
const lightdashLogin = require('./lightdash-login');

const router = express.Router();

const ldapAuth = !!process.env.LDAP_URL && !!process.env.LDAP_USER_SEARCH_BASE;
const lightdashIntegrationEnabled = process.env.LIGHTDASH_INTEGRATION_ENABLED === 'true';

//Local
router.post('/logout', requireJwtAuth, logoutController);

// Lightdash integration routes
if (lightdashIntegrationEnabled) {
  router.post('/login', (req, res) => {
    const lightdashUrl = process.env.LIGHTDASH_URL || 'http://localhost:8080';
    return res.status(200).json({
      redirectUrl: `${lightdashUrl}/login`,
      message: 'Please login through Lightdash'
    });
  });

  router.post('/register', (req, res) => {
    const lightdashUrl = process.env.LIGHTDASH_URL || 'http://localhost:8080';
    return res.status(200).json({
      redirectUrl: `${lightdashUrl}/register`,
      message: 'Please register through Lightdash'
    });
  });
} else {
  // Original LibreChat authentication
  router.post(
    '/login',
    logHeaders,
    loginLimiter,
    checkBan,
    ldapAuth ? requireLdapAuth : requireLocalAuth,
    setBalanceConfig,
    loginController,
  );
  router.post(
    '/register',
    registerLimiter,
    checkBan,
    checkInviteUser,
    validateRegistration,
    registrationController,
  );
}
router.post('/refresh', refreshController);
router.post(
  '/requestPasswordReset',
  resetPasswordLimiter,
  checkBan,
  validatePasswordReset,
  resetPasswordRequestController,
);
router.post('/resetPassword', checkBan, validatePasswordReset, resetPasswordController);

router.get('/2fa/enable', requireJwtAuth, enable2FA);
router.post('/2fa/verify', requireJwtAuth, verify2FA);
router.post('/2fa/verify-temp', checkBan, verify2FAWithTempToken);
router.post('/2fa/confirm', requireJwtAuth, confirm2FA);
router.post('/2fa/disable', requireJwtAuth, disable2FA);
router.post('/2fa/backup/regenerate', requireJwtAuth, regenerateBackupCodes);

router.use('/', lightdashLogin);

module.exports = router;
