import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { checkAuthStatus } from '../store/slices/authSlice';

// Custom hook for authentication
export const useAuth = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading, user, error } = useAppSelector((state) => state.auth);

  useEffect(() => {
      dispatch(checkAuthStatus());
  }, [dispatch]);

  return {
    isAuthenticated,
    isLoading,
    user,
    error,
  };
};
