import React from 'react';
import { Text as RNText } from 'react-native';

/**
 * Text component wrapper that ensures font scaling is disabled
 * Use this component instead of React Native's Text for consistent sizing
 * regardless of system font/display size settings
 * 
 * This ensures the app UI remains consistent like Paytm, GooglePay
 */
export const Text = React.forwardRef(({ allowFontScaling = false, maxFontSizeMultiplier = 1, ...props }, ref) => {
  return (
    <RNText
      ref={ref}
      allowFontScaling={allowFontScaling}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...props}
    />
  );
});

Text.displayName = 'Text';

export default Text;

