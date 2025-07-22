import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export const useLightdashAuth = () => {
  const [isLightdashEnabled, setIsLightdashEnabled] = useState(false);
  const [authStatus, setAuthStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasChecked, setHasChecked] = useState(false);
  const mountedRef = useRef(true);

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

  return {
    isLightdashEnabled,
    authStatus,
    loading,
    hasChecked
  };
}; 