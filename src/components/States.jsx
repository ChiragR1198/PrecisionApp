import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../constants/theme';

// Loading state component
export const LoadingState = ({ message = 'Loading...', size = 'large', color = colors.primary }) => (
  <View style={styles.container}>
    <ActivityIndicator size={size} color={color} />
    {message && <Text style={styles.message}>{message}</Text>}
  </View>
);

// Empty state component
export const EmptyState = ({ 
  message = 'No data available', 
  icon,
  actionText,
  onAction,
}) => (
  <View style={styles.container}>
    {icon}
    <Text style={styles.emptyMessage}>{message}</Text>
    {actionText && onAction && (
      <TouchableOpacity style={styles.actionButton} onPress={onAction}>
        <Text style={styles.actionText}>{actionText}</Text>
      </TouchableOpacity>
    )}
  </View>
);

// Error state component
export const ErrorState = ({ 
  error = 'Something went wrong', 
  onRetry,
  retryText = 'Try Again',
}) => (
  <View style={styles.container}>
    <Text style={styles.errorMessage}>{error}</Text>
    {onRetry && (
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryText}>{retryText}</Text>
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  actionButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  actionText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
});
