import React, { useEffect } from 'react';
import { FaSpinner } from 'react-icons/fa';

const GoogleCallback = () => {
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const next = urlParams.get('next');
    const safeNext = next && next.startsWith('/') ? next : '/student/dashboard';
    window.location.replace(safeNext);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <FaSpinner className="animate-spin mx-auto text-4xl text-green-600 mb-4" />
        <p className="text-gray-600">Processing Google authentication...</p>
      </div>
    </div>
  );
};

export default GoogleCallback;
