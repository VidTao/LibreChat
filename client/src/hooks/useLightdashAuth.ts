import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuthContext } from './AuthContext'; // ← Add this import

export const useLightdashAuth = () => {
  const [isLightdashEnabled, setIsLightdashEnabled] = useState(false);
  const [authStatus, setAuthStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasChecked, setHasChecked] = useState(false);
  const mountedRef = useRef(true);
  
  const { isAuthenticated, token } = useAuthContext(); // ← Get LibreChat auth state

  useEffect(() => {
    let isCancelled = false;

    const checkAuthentication = async () => {
      // Prevent multiple calls
      if (hasChecked || isCancelled) return;

      try {
        // Check if integration is enabled
        const configResponse = await axios.get('/api/lightdash/config');
        
        if (isCancelled) return; // Component unmounted

        if (configResponse.data.integrationEnabled) {
          if (mountedRef.current) {
            setIsLightdashEnabled(true);
          }
          
          // Check auth status
          const authResponse = await axios.get('/api/lightdash/auth-status');
          
          if (isCancelled) return; // Component unmounted

          if (mountedRef.current) {
            setAuthStatus(authResponse.data);
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
  }, []); // Empty dependency array - only run once on mount

  // ✅ NEW: Save MCP credentials after LibreChat authentication is complete
  useEffect(() => {
    const saveMcpCredentials = async () => {
      // Wait for both Lightdash and LibreChat to be authenticated
      if (!isAuthenticated || !token || !authStatus?.authenticated || !authStatus?.mcpCredentials) {
        return;
      }

      const { mcpCredentials } = authStatus;
      
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
          pluginKey: 'mcp_fb-ads-mcp-server',
          action: 'install',
          auth: {
            MCP_FB_TOKEN: mcpCredentials.fbToken,
          }
        })]);
        console.log('✅ MCP credentials saved after LibreChat authentication');
      } catch (error) {
        console.warn('Failed to save MCP credentials:', error);
      }
    };

    saveMcpCredentials();
  }, [isAuthenticated, token, authStatus]); // ← Run when LibreChat auth or Lightdash auth changes

  return {
    isLightdashEnabled,
    authStatus,
    loading,
    hasChecked
  };
}; 