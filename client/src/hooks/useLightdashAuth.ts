import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuthContext } from './AuthContext';

export const useLightdashAuth = () => {
  const [isLightdashEnabled, setIsLightdashEnabled] = useState(false);
  const [authStatus, setAuthStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasChecked, setHasChecked] = useState(false);
  const mountedRef = useRef(true);
  
  const { isAuthenticated, token } = useAuthContext();

  useEffect(() => {
    let isCancelled = false;

    const checkAuthentication = async () => {
      // ✅ FIX: Check if we already have valid auth state cached
      const cachedAuthStatus = sessionStorage.getItem('lightdash_auth_status');
      if (cachedAuthStatus && hasChecked) {
        try {
          const parsed = JSON.parse(cachedAuthStatus);
          setAuthStatus(parsed);
          setIsLightdashEnabled(true);
          setLoading(false);
          return;
        } catch (e) {
          // Invalid cache, continue with normal flow
        }
      }

      // Prevent multiple calls
      if (hasChecked || isCancelled) return;

      try {
        // Check if integration is enabled
        const configResponse = await axios.get('/api/lightdash/config');
        
        if (isCancelled) return;

        if (configResponse.data.integrationEnabled) {
          if (mountedRef.current) {
            setIsLightdashEnabled(true);
          }
          
          // Check auth status
          const authResponse = await axios.get('/api/lightdash/auth-status');
          
          if (isCancelled) return;

          if (mountedRef.current) {
            setAuthStatus(authResponse.data);
            // ✅ FIX: Cache the auth status
            if (authResponse.data.authenticated) {
              sessionStorage.setItem('lightdash_auth_status', JSON.stringify(authResponse.data));
            }
          }
          
          // If authenticated, dispatch event ONCE
          if (authResponse.data.authenticated && authResponse.data.user) {
            const event = new CustomEvent('lightdashAuthenticated', {
              detail: { user: authResponse.data.user }
            });
            window.dispatchEvent(event);
          }
        } else {
          if (mountedRef.current) {
            setIsLightdashEnabled(false);
            setAuthStatus({ authenticated: false });
          }
        }
      } catch (error) {
        console.error('Lightdash check failed:', error);
        if (mountedRef.current) {
          setAuthStatus({ authenticated: false });
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setHasChecked(true);
        }
      }
    };

    checkAuthentication();

    return () => {
      isCancelled = true;
      mountedRef.current = false;
    };
  }, []); // Keep empty dependency array

  // ✅ FIX: Save MCP credentials after LibreChat authentication is complete
  useEffect(() => {
    const saveMcpCredentials = async () => {
      // Wait for both Lightdash and LibreChat to be authenticated
      if (!isAuthenticated || !token || !authStatus?.authenticated || !authStatus?.mcpCredentials) {
        return;
      }

      // ✅ FIX: Only save credentials once, not on every auth state change
      if (sessionStorage.getItem('mcp_credentials_saved') === 'true') {
        return;
      }

      const { mcpCredentials } = authStatus;
      const fbAccountIds = mcpCredentials.facebook.accountIds;
      const googleAccountIds = mcpCredentials.google.accountIds;
      try {
        const [dbtMcpResponse, fbAdsMcpResponse] = await Promise.all([
         axios.post('/api/user/plugins', {
          pluginKey: 'mcp_dbt-mcp-lightdash',
          action: 'install',
          auth: {
            MCP_LIGHTDASH_API_KEY: mcpCredentials.lightdashApiKey,
            MCP_LIGHTDASH_PROJECT_ID: mcpCredentials.projectId,
            MCP_LIGHTDASH_DEFAULT_SPACE_ID: mcpCredentials.defaultSpaceId,
          }
        }),
        axios.post('/api/user/plugins', {
          pluginKey: 'mcp_lightdash-analytics',
          action: 'install',
          auth: {
            MCP_LIGHTDASH_API_KEY: mcpCredentials.lightdashApiKey,
            MCP_LIGHTDASH_PROJECT_ID: mcpCredentials.projectId,
          }
        }),
         axios.post('/api/user/plugins', {
          pluginKey: 'mcp_fb-ads-mcp-server',
          action: 'install',
          auth: {
            MCP_FB_TOKEN: mcpCredentials.facebook.token,
            MCP_FB_ACCOUNT_IDS: fbAccountIds,
          }
        }),
        axios.post('/api/user/plugins', {
          pluginKey: 'mcp_google-ads-mcp-server',
          action: 'install',
          auth: {
            MCP_GOOGLE_REFRESH_TOKEN: mcpCredentials.google.token,
            MCP_GOOGLE_ACCOUNT_IDS: googleAccountIds,
          }
        })
      ]);
        console.log('✅ MCP credentials saved after LibreChat authentication');
        sessionStorage.setItem('mcp_credentials_saved', 'true');
      } catch (error) {
        console.warn('Failed to save MCP credentials:', error);
      }
    };

    saveMcpCredentials();
  }, [isAuthenticated, token, authStatus?.authenticated]); // ✅ FIX: Only depend on auth state, not full authStatus object

  return {
    isLightdashEnabled,
    authStatus,
    loading,
    hasChecked
  };
};