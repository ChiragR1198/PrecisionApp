import Icon from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '../../constants/theme';

// Icon Components
const ArrowLeftIcon = ({ color = colors.textSecondary, size = 18 }) => (
  <Icon name="arrow-left" size={size} color={color} />
);

const MailIcon = ({ color = colors.icon, size = 18 }) => (
  <Icon name="mail" size={size} color={color} />
);

const CheckIcon = ({ color = colors.primary, size = 18 }) => (
  <Icon name="check" size={size} color={color} />
);

// FormField reusable field
const FormField = ({
  field,
  value,
  onChangeText,
  styles,
  iconSize,
}) => {
  const IconComponent = field.icon;

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{field.label}</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={field.placeholder}
          placeholderTextColor={colors.textPlaceholder}
          value={value}
          onChangeText={onChangeText}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          allowFontScaling={false}
          maxFontSizeMultiplier={1}
        />
        <View style={styles.inputIcon}>
          <IconComponent size={iconSize} />
        </View>
      </View>
    </View>
  );
};

// Success Message Component
const SuccessMessage = ({ styles }) => (
  <View style={styles.successContainer}>
    <View style={styles.successIcon}>
      <CheckIcon size={24} />
    </View>
    <Text style={styles.successTitle}>Check Your Email</Text>
    <Text style={styles.successText}>
      We've sent a password reset link to your email address. Please check your inbox and follow the instructions to reset your password.
    </Text>
    <Text style={styles.successSubtext}>
      If you don't receive an email within a few minutes, check your spam folder or contact support.
    </Text>
  </View>
);

// Support Link Component
const SupportLink = ({ onPress, styles }) => (
  <View style={styles.supportContainer}>
    <Text style={styles.supportText}>
      Need help?{' '}
      <Text style={styles.supportLink} onPress={onPress}>
        Contact Support
      </Text>
    </Text>
  </View>
);

// Form configuration for fields
const formFields = [
  {
    id: 'email',
    label: 'Email',
    placeholder: 'Enter your email',
    icon: MailIcon,
    type: 'email',
  },
];

// Main ForgotPassword Component
export const ForgotPasswordScreen = () => {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();

  const scrollViewRef = useRef(null);

  const [formData, setFormData] = useState({
    email: '',
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 100);
    });
    return () => {
      keyboardDidHideListener?.remove();
    };
  }, []);

  // Platform-aware Responsive SIZES
  const { SIZES, isTablet } = useMemo(() => {
    const isAndroid = Platform.OS === 'android';
    const isIOS = Platform.OS === 'ios';
    const isTabletDevice = SCREEN_WIDTH >= 768;
    
    const getResponsiveValue = ({ android, ios, tablet, default: defaultValue }) => {
      if (isTabletDevice && tablet !== undefined) return tablet;
      if (isAndroid && android !== undefined) return android;
      if (isIOS && ios !== undefined) return ios;
      return defaultValue;
    };
    
    return {
      SIZES: {
        iconSize:               getResponsiveValue({ android: 15, ios: 15, tablet: 17, default: 15 }),
        inputHeight:            getResponsiveValue({ android: 44, ios: 44, tablet: 46, default: 44 }),
        buttonHeight:           getResponsiveValue({ android: 50, ios: 50, tablet: 46, default: 50 }),
        backButtonSize:         getResponsiveValue({ android: 34, ios: 34, tablet: 38, default: 34 }),
        checkboxSize:           getResponsiveValue({ android: 17, ios: 17, tablet: 19, default: 17 }),
        contentMaxWidth:        getResponsiveValue({ android: 420, ios: 420, tablet: 460, default: 420 }),
        paddingHorizontal:      getResponsiveValue({ android: 16, ios: 18, tablet: 32, default: 16 }),
        paddingVertical:        getResponsiveValue({ android: 20, ios: 22, tablet: 30, default: 20 }),
        logoWidth:              getResponsiveValue({ android: 150, ios: 150, tablet: 200, default: 150 }),
        logoHeight:             getResponsiveValue({ android: 100, ios: 100, tablet: 145, default: 100 }),
        logoMarginBottom:       getResponsiveValue({ android: 20, ios: 22, tablet: 24, default: 20 }),
        fieldSpacing:           getResponsiveValue({ android: 16, ios: 18, tablet: 16, default: 16 }),
        labelSize:              getResponsiveValue({ android: 13, ios: 13, tablet: 15, default: 13 }),
        formTopMargin:          getResponsiveValue({ android: 12, ios: 14, tablet: 18, default: 12 }),
        titleMarginTop:         getResponsiveValue({ android: 24, ios: 26, tablet: 24, default: 24 }),
        titleMarginBottom:      getResponsiveValue({ android: 18, ios: 20, tablet: 24, default: 18 }),
        titleSize:              getResponsiveValue({ android: 20, ios: 21, tablet: 22, default: 20 }),
        subtitleSize:           getResponsiveValue({ android: 14, ios: 15, tablet: 15, default: 14 }),
        inputFontSize:          getResponsiveValue({ android: 11, ios: 12, tablet: 13, default: 11 }),
        buttonFontSize:         getResponsiveValue({ android: 14, ios: 14, tablet: 15, default: 14 }),
        termsSize:              getResponsiveValue({ android: 12, ios: 12, tablet: 14, default: 12 }),
        backButtonMargin:       0,
        formBottomMargin:       getResponsiveValue({ android: 14, ios: 16, tablet: 18, default: 14 }),
        notificationSize:       getResponsiveValue({ android: 12, ios: 12, tablet: 13, default: 12 }),
        supportSize:            getResponsiveValue({ android: 12, ios: 12, tablet: 14, default: 12 }),
        successIconSize:        getResponsiveValue({ android: 48, ios: 50, tablet: 58, default: 48 }),
        notificationPadding:    getResponsiveValue({ android: 14, ios: 14, tablet: 16, default: 14 }),
        notificationMargin:     getResponsiveValue({ android: 18, ios: 20, tablet: 24, default: 18 }),
        headerPaddingTop:       getResponsiveValue({ android: 35, ios: 40, tablet: 35, default: 35 }),
      },
      isTablet: isTabletDevice,
    };
  }, [SCREEN_WIDTH]);

  // Memoized styles for performance
  const styles = useMemo(() => createStyles(SIZES, isTablet, SCREEN_HEIGHT, Platform.OS), [
    SIZES,
    isTablet,
    SCREEN_HEIGHT,
  ]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // "Send Reset Link" button should always be ON (enabled and not greyed out)
  // So: do NOT disable it, and do NOT add the disabled style
  // Also: allow pressing it even if email is blank

  const handleSendResetLink = async () => {
    // We do NOT check for formData.email.trim() anymore!
    setIsLoading(true);
    try {
      // Implement actual password reset logic here
      console.log('Sending reset link to:', formData.email);

      router.push('/email-verification');
    } catch (error) {
      console.error('Error sending reset link:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleBackToLogin = () => {
    router.push('/login');
  };

  const handleContactSupport = () => {
    // Implement contact support logic
    console.log('Contact support pressed');
  };

  // Render
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Back Button */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeftIcon size={SIZES.iconSize} />
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollViewRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/images/Logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            {!isSubmitted ? (
              <>
                {/* Title Section */}
                <View style={styles.titleContainer}>
                  <Text style={styles.title}>Forgot Password?</Text>
                  <Text style={styles.subtitle}>
                    Don't worry! Enter your email address and we'll send you a link to reset your password.
                  </Text>
                </View>

                {/* Form Fields */}
                <View style={styles.formContainer}>
                  {formFields.map((field) => (
                    <FormField
                      key={field.id}
                      field={field}
                      value={formData[field.id]}
                      onChangeText={(value) => handleInputChange(field.id, value)}
                      styles={styles}
                      iconSize={SIZES.iconSize}
                    />
                  ))}
                </View>

                {/* Button & Footer */}
                <View style={styles.footer}>
                  <LinearGradient
                    colors={colors.gradient}
                    style={[
                      styles.resetButton,
                      // The button should never be disabled or faded now
                      // (!formData.email.trim() || isLoading) && styles.buttonDisabled,
                      isLoading && styles.buttonDisabled, // Only fade if loading for feedback
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <TouchableOpacity
                      onPress={handleSendResetLink}
                      // Don't disable even if email is blank, only disable if loading
                      disabled={isLoading}
                      activeOpacity={0.9}
                      style={styles.buttonTouchable}
                    >
                      <Text style={styles.resetButtonText}>
                        {isLoading ? 'Sending...' : 'Send Reset Link'}
                      </Text>
                    </TouchableOpacity>
                  </LinearGradient>

                  <View style={styles.loginContainer}>
                    <Text style={styles.loginText}>
                      Remember your password?{' '}
                      <Text style={styles.loginLink} onPress={handleBackToLogin}>
                        Back to Login
                      </Text>
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                {/* Success State */}
                <SuccessMessage styles={styles} />
                
                <View style={styles.footer}>
                  <LinearGradient
                    colors={colors.gradient}
                    style={styles.backToLoginButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <TouchableOpacity
                      onPress={handleBackToLogin}
                      activeOpacity={0.9}
                      style={styles.buttonTouchable}
                    >
                      <Text style={styles.backToLoginButtonText}>Back to Login</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
              </>
            )}
            
            <View style={styles.notificationBox}>
                <View style={styles.notificationIcon}>
                    <Icon name="info" size={SIZES.iconSize} color={colors.primary} />
                </View>
                <Text style={styles.notificationText}>
                    If you don't receive an email within a few minutes, check your spam folder or contact support.
                </Text>
            </View>

            {/* Support Link */}
            <SupportLink onPress={handleContactSupport} styles={styles} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Responsive Styles Factory
const createStyles = (SIZES, isTablet, SCREEN_HEIGHT, platform) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerContainer: {
    width: '100%',
    paddingHorizontal: SIZES.paddingHorizontal,
    backgroundColor: colors.background,
    zIndex: 10,
    paddingTop: SIZES.headerPaddingTop,
    paddingBottom: 8,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SIZES.paddingHorizontal,
    paddingBottom: platform === 'ios' ? 80 : 100,
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: SIZES.contentMaxWidth,
    alignSelf: 'center',
    paddingTop: isTablet ? 12 : 8,
  },
  backButton: {
    width: SIZES.backButtonSize,
    height: SIZES.backButtonSize,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: SIZES.logoMarginBottom,
    paddingTop: isTablet ? 12 : 8,
  },
  logoImage: {
    width: SIZES.logoWidth,
    height: SIZES.logoHeight,
  },
  titleContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: SIZES.titleMarginBottom,
    marginTop: SIZES.titleMarginTop,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: SIZES.titleSize,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: SIZES.subtitleSize,
    paddingHorizontal: 12,
    fontWeight: '400',
    textAlign: 'center',
    color: colors.textMuted,
    lineHeight: SIZES.subtitleSize * 1.3,
  },
  formContainer: {
    width: '100%',
    marginTop: SIZES.formTopMargin,
    paddingHorizontal: 4,
    paddingTop: 20,
  },
  fieldContainer: {
    width: '100%',
    marginBottom: SIZES.fieldSpacing,
  },
  label: {
    fontSize: SIZES.labelSize,
    fontWeight: '500',
    lineHeight: SIZES.labelSize * 1.2,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  inputContainer: {
    position: 'relative',
    width: '100%',
  },
  input: {
    height: SIZES.inputHeight,
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingRight: 48,
    fontSize: SIZES.inputFontSize,
    color: colors.text,
    textAlignVertical: 'center',
  },
  inputIcon: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -12 }],
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    zIndex: 1,
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    marginTop: SIZES.formBottomMargin,
    paddingTop: 8,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  resetButton: {
    width: '100%',
    height: SIZES.buttonHeight,
    borderRadius: radius.md,
    marginBottom: 16,
  },
  buttonTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  resetButtonText: {
    fontSize: SIZES.buttonFontSize,
    fontWeight: '600',
    color: colors.white,
  },
  loginContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  loginText: {
    fontSize: SIZES.subtitleSize,
    fontWeight: '400',
    color: colors.textMuted,
    textAlign: 'center',
  },
  loginLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  // Success State Styles
  successContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: SIZES.formTopMargin,
    paddingHorizontal: 20,
  },
  successIcon: {
    width: SIZES.successIconSize,
    height: SIZES.successIconSize,
    borderRadius: SIZES.successIconSize / 2,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: SIZES.titleSize,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  successText: {
    fontSize: SIZES.subtitleSize,
    fontWeight: '400',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: SIZES.subtitleSize * 1.4,
    marginBottom: 16,
  },
  successSubtext: {
    fontSize: SIZES.subtitleSize - 2,
    fontWeight: '400',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: (SIZES.subtitleSize - 2) * 1.4,
    fontStyle: 'italic',
  },
  backToLoginButton: {
    width: '100%',
    height: SIZES.buttonHeight,
    borderRadius: radius.md,
    marginBottom: 16,
  },
  backToLoginButtonText: {
    fontSize: SIZES.buttonFontSize,
    fontWeight: '600',
    color: colors.white,
  },
  // Support Link Styles
  supportContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: SIZES.notificationMargin,
    paddingHorizontal: 20,
  },
  supportText: {
    fontSize: SIZES.supportSize,
    fontWeight: '400',
    color: colors.textMuted,
    textAlign: 'center',
  },
  supportLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  // Notification Box Styles - Made responsive
  notificationBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: SIZES.notificationPadding,
    paddingHorizontal: SIZES.notificationPadding,
    marginTop: SIZES.notificationMargin * 2,
    alignSelf: 'center',
  },
  notificationIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationText: {
    fontSize: SIZES.notificationSize,
    fontWeight: '400',
    color: colors.textMuted,
    flexShrink: 1,
    lineHeight: SIZES.notificationSize * 1.4,
  },
});
