import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

const GoogleCallback = () => {
  const { handleGoogleCallback } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const result = await handleGoogleCallback();
        if (result.success) {
          // Redirect to the appropriate dashboard
          navigate(result.redirect || '/student/dashboard');
        } else {
          // Redirect to login with error
          navigate('/login?error=google_auth_failed');
        }
      } catch (error) {
        console.error('Google callback error:', error);
        toast.error('Google authentication failed. Please try again.');
        navigate('/login');
      }
    };

    handleCallback();
  }, [handleGoogleCallback, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7faf7]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1a7f42] mx-auto"></div>
        <p className="mt-4 text-gray-600">Processing Google authentication...</p>
      </div>
    </div>
  );
};

export default GoogleCallback;