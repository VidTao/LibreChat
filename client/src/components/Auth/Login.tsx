import { useOutletContext, useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthContext } from '~/hooks/AuthContext';
import type { TLoginLayoutContext } from '~/common';
import { ErrorMessage } from '~/components/Auth/ErrorMessage';
import SocialButton from '~/components/Auth/SocialButton';
import { OpenIDIcon } from '~/components';
import { getLoginError } from '~/utils';
import { useLocalize } from '~/hooks';
import LoginForm from './LoginForm';
import { useLightdashAuth } from '~/hooks/useLightdashAuth';

function Login() {
  // ===== ALL HOOKS MUST BE AT THE TOP =====
  const localize = useLocalize();
  const { error, setError, login, isAuthenticated } = useAuthContext();
  const { startupConfig } = useOutletContext<TLoginLayoutContext>();
  const navigate = useNavigate();
  
  // Lightdash integration
  const { 
    isLightdashEnabled, 
    authStatus, 
    loading: lightdashLoading,
    hasChecked 
  } = useLightdashAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  
  // Determine if auto-redirect should be disabled based on the URL parameter
  const disableAutoRedirect = searchParams.get('redirect') === 'false';
  
  // Persist the disable flag locally so that once detected, auto-redirect stays disabled.
  const [isAutoRedirectDisabled, setIsAutoRedirectDisabled] = useState(disableAutoRedirect);

  // Determine whether we should auto-redirect to OpenID.
  const shouldAutoRedirect =
    startupConfig?.openidLoginEnabled &&
    startupConfig?.openidAutoRedirect &&
    startupConfig?.serverDomain &&
    !isAutoRedirectDisabled;

  // ===== ALL EFFECTS AFTER ALL STATE HOOKS =====
  
  // If user is already authenticated in LibreChat, redirect to chat
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/c/new', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Once the disable flag is detected, update local state and remove the parameter from the URL.
  useEffect(() => {
    if (disableAutoRedirect) {
      setIsAutoRedirectDisabled(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('redirect');
      setSearchParams(newParams, { replace: true });
    }
  }, [disableAutoRedirect, searchParams, setSearchParams]);

  useEffect(() => {
    if (shouldAutoRedirect) {
      console.log('Auto-redirecting to OpenID provider...');
      window.location.href = `${startupConfig.serverDomain}/oauth/openid`;
    }
  }, [shouldAutoRedirect, startupConfig]);

  // ===== CONDITIONAL RENDERS AFTER ALL HOOKS =====

  // Show loading while checking Lightdash
  if (!isAuthenticated && isLightdashEnabled && !hasChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-2">Checking authentication...</span>
      </div>
    );
  }

  // Show Bratrax login required UI
  if (!isAuthenticated && isLightdashEnabled && hasChecked && !authStatus?.authenticated) {
    const handleLoginClick = () => {
      const lightdashUrl = process.env.REACT_APP_LIGHTDASH_URL || 'http://localhost:3000';
      window.open(`${lightdashUrl}/login`, '_blank', 'noopener,noreferrer');
    };

    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-6 rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Authentication Required
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-300">
              You are not authenticated to Bratrax. Please login there in order to use the chat.
            </p>
          </div>
          
          <div className="space-y-4">
            <button
              onClick={handleLoginClick}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
            >
              Login to Bratrax
            </button>
            
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              The login page will open in a new tab. After logging in, refresh this page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ===== MAIN RENDER =====
  return (
    <>
      {error != null && <ErrorMessage>{localize(getLoginError(error))}</ErrorMessage>}
      {startupConfig?.emailLoginEnabled === true && (
        <LoginForm
          onSubmit={login}
          startupConfig={startupConfig}
          error={error}
          setError={setError}
        />
      )}
      {startupConfig?.registrationEnabled === true && (
        <p className="my-4 text-center text-sm font-light text-gray-700 dark:text-white">
          {' '}
          {localize('com_auth_no_account')}{' '}
          <a
            href="/register"
            className="inline-flex p-1 text-sm font-medium text-green-600 transition-colors hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
          >
            {localize('com_auth_sign_up')}
          </a>
        </p>
      )}
    </>
  );
}

export default Login;
