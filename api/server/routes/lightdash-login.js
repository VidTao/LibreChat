const express = require('express');
const jwt = require('jsonwebtoken');
const { findUser } = require('~/models');
const { logger } = require('~/config');

const router = express.Router();

/**
 * POST /api/auth/lightdash-login
 * Authenticate user in LibreChat using Lightdash user data
 */
router.post('/lightdash-login', async (req, res) => {
  try {
    const { user } = req.body;
    
    // Find or get the LibreChat user by lightdashUuid
    const librechatUser = await findUser({ lightdashUuid: user.lightdashUuid });
    
    if (!librechatUser) {
      return res.status(404).json({ error: 'User not found in LibreChat' });
    }

    // Generate a real JWT token
    const token = jwt.sign(
      {
        id: librechatUser._id,
        email: librechatUser.email,
        name: librechatUser.name,
        role: librechatUser.role || 'USER'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: process.env.SESSION_EXPIRY ? parseInt(process.env.SESSION_EXPIRY) : '7d' }
    );

    // Return the token and user data
    res.json({
      token: token,
      user: {
        id: librechatUser._id,
        name: librechatUser.name,
        email: librechatUser.email,
        avatar: librechatUser.avatar || '',
        role: librechatUser.role || 'USER',
        provider: 'lightdash',
        lightdashUuid: librechatUser.lightdashUuid
      }
    });

  } catch (error) {
    logger.error('[lightdash-login] Error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

module.exports = router;
