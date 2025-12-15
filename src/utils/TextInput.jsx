import React from 'react';
import { TextInput as RNTextInput } from 'react-native';

/**
 * TextInput component wrapper that ensures font scaling is disabled
 * Use this component instead of React Native's TextInput for consistent sizing
 * regardless of system font/display size settings
 * 
 * This ensures the app UI remains consistent like Paytm, GooglePay
 */
export const TextInput = React.forwardRef(({ allowFontScaling = false, maxFontSizeMultiplier = 1, ...props }, ref) => {
  return (
    <RNTextInput
      ref={ref}
      allowFontScaling={allowFontScaling}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...props}
    />
  );
});

TextInput.displayName = 'TextInput';

export default TextInput;

