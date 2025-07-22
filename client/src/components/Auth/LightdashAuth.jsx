import React, { useEffect } from 'react';
import { useLightdashAuth } from '~/hooks/useLightdashAuth';

/**
 * Component for handling Lightdash authentication
 * Redirects to Lightdash login if integration is enabled
 */
const LightdashAuth = ({ children, redirectPath = '/login' }) => {
  const { 
    isLightdashEnabled, 
    authStatus, 
    loading, 
    redirectToLightdash,
    checkAuthStatus 
  } = useLightdashAuth();

  useEffect(() => {
    // If Lightdash is enabled and user is not authenticated, redirect
    if (isLightdashEnabled && !loading && authStatus && !authStatus.authenticated) {
      redirectToLightdash(redirectPath);
    }
  }, [isLightdashEnabled, authStatus, loading, redirectPath, redirectToLightdash]);

  // If loading, show spinner
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // If Lightdash is enabled, show message and redirect
  if (isLightdashEnabled) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Redirecting to Lightdash
            </h2>
            <p className="text-gray-600 mb-6">
              This application uses Lightdash for authentication. You will be redirected shortly.
            </p>
            <button
              onClick={() => redirectToLightdash(redirectPath)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition duration-200"
            >
              Go to Lightdash {redirectPath === '/register' ? 'Registration' : 'Login'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If Lightdash is not enabled, render children (original auth components)
  return children;
};

export default LightdashAuth; 