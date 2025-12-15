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

const EyeIcon = ({ color = colors.icon, size = 18 }) => (
  <Icon name="eye" size={size} color={color} />
);

const EyeOffIcon = ({ color = colors.icon, size = 18 }) => (
  <Icon name="eye-off" size={size} color={color} />
);

const LockIcon = ({ color = colors.icon, size = 18 }) => (
  <Icon name="lock" size={size} color={color} />
);

const CheckIcon = ({ color = colors.primary, size = 16 }) => (
  <Icon name="check" size={size} color={color} />
);

// Password Requirements Component
const PasswordRequirements = ({ password, styles }) => {
  const requirements = [
    {
      text: 'At least 8 characters',
      isValid: password.length >= 8,
    },
    {
      text: 'One uppercase letter',
      isValid: /[A-Z]/.test(password),
    },
    {
      text: 'One number',
      isValid: /\d/.test(password),
    },
    {
      text: 'One special character',
      isValid: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    },
  ];

  return (
    <View style={styles.requirementsContainer}>
      <Text style={styles.requirementsTitle}>Password must contain:</Text>
      <View style={styles.requirementsList}>
        {requirements.map((req, index) => (
          <View key={index} style={styles.requirementItem}>
            <View style={[styles.checkbox, req.isValid && styles.checkboxValid]}>
              {req.isValid && <CheckIcon size={12} color={colors.white} />}
            </View>
            <Text style={[styles.requirementText, req.isValid && styles.requirementTextValid]}>
              {req.text}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// FormField reusable field
const FormField = ({
  field,
  value,
  onChangeText,
  showPassword,
  onTogglePassword,
  styles,
  iconSize,
}) => {
  const IconComponent = field.icon;
  const isPassword = field.type === 'password';
  const isVisible = isPassword ? showPassword : true;
  const canToggle = isPassword;

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
          secureTextEntry={isPassword && !isVisible}
          keyboardType={field.type === 'email' ? 'email-address' : 'default'}
          autoCapitalize={field.type === 'email' ? 'none' : 'words'}
          autoCorrect={false}
          allowFontScaling={false}
          maxFontSizeMultiplier={1}
        />
        {canToggle ? (
          <TouchableOpacity
            style={styles.inputIcon}
            onPress={onTogglePassword}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {isVisible ? <EyeOffIcon size={iconSize} /> : <EyeIcon size={iconSize} />}
          </TouchableOpacity>
        ) : (
          <View style={styles.inputIcon}>
            <IconComponent size={iconSize} />
          </View>
        )}
      </View>
      {field.id === 'password' && (
        <Text style={styles.helperText}>Must be at least 8 characters.</Text>
      )}
    </View>
  );
};

// Form configuration for fields
const formFields = [
  {
    id: 'password',
    label: 'Password',
    placeholder: 'Create a password',
    icon: LockIcon,
    type: 'password',
  },
  {
    id: 'confirmPassword',
    label: 'Confirm Password',
    placeholder: 'Confirm your password',
    icon: LockIcon,
    type: 'password',
  },
];

// Main ResetPasswordScreen Component
export const ResetPasswordScreen = () => {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();

  const scrollViewRef = useRef(null);

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
        helperTextSize:         getResponsiveValue({ android: 10, ios: 11, tablet: 12, default: 10 }),
        requirementsPadding:    getResponsiveValue({ android: 14, ios: 14, tablet: 16, default: 14 }),
        requirementsMargin:     getResponsiveValue({ android: 16, ios: 18, tablet: 24, default: 16 }),
        headerPaddingTop:       getResponsiveValue({ android: 35, ios: 40, tablet: 35, default: 35 }),
        formBottomMargin:       getResponsiveValue({ android: 14, ios: 16, tablet: 18, default: 14 }),
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

  const handleResetPassword = async () => {
    if (!formData.password.trim() || !formData.confirmPassword.trim()) return;
    if (formData.password !== formData.confirmPassword) return;

    setIsLoading(true);
    try {
      // Implement actual password reset logic here
      console.log('Resetting password:', formData.password);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Navigate to login screen after successful reset
      router.push('/login');
    } catch (error) {
      console.error('Error resetting password:', error);
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

  const isPasswordValid = formData.password.length >= 8 && 
    /[A-Z]/.test(formData.password) && 
    /\d/.test(formData.password) && 
    /[!@#$%^&*(),.?":{}|<>]/.test(formData.password);

  const isFormValid = isPasswordValid && formData.password === formData.confirmPassword;

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

            {/* Title Section */}
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Create New Password</Text>
              <Text style={styles.subtitle}>
                Your new password must be different from previously used passwords.
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
                  showPassword={
                    field.id === 'password' ? showPassword : showConfirmPassword
                  }
                  onTogglePassword={() => {
                    if (field.id === 'password') {
                      setShowPassword((prev) => !prev);
                    } else if (field.id === 'confirmPassword') {
                      setShowConfirmPassword((prev) => !prev);
                    }
                  }}
                  styles={styles}
                  iconSize={SIZES.iconSize}
                />
              ))}
            </View>

            {/* Password Requirements */}
            <PasswordRequirements password={formData.password} styles={styles} />

            {/* Button & Footer */}
            <View style={styles.footer}>
              <LinearGradient
                colors={colors.gradient}
                style={[
                  styles.resetButton,
                  (!isFormValid || isLoading) && styles.buttonDisabled,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <TouchableOpacity
                  onPress={handleResetPassword}
                  disabled={!isFormValid || isLoading}
                  activeOpacity={0.9}
                  style={styles.buttonTouchable}
                >
                  <Text style={styles.resetButtonText}>
                    {isLoading ? 'Resetting...' : 'Reset Password'}
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
    paddingBottom: platform === 'ios' ? 20 : 16,
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
    fontWeight: '400',
    textAlign: 'center',
    color: colors.textMuted,
    lineHeight: SIZES.subtitleSize * 1.3,
    paddingHorizontal: 12,
  },
  formContainer: {
    width: '100%',
    marginTop: SIZES.formTopMargin,
    paddingHorizontal: 4,
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
  helperText: {
    fontSize: SIZES.helperTextSize,
    fontWeight: '400',
    color: colors.textMuted,
    marginTop: 4,
  },
  requirementsContainer: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: SIZES.requirementsPadding,
    marginTop: SIZES.requirementsMargin,
    alignSelf: 'center',
  },
  requirementsTitle: {
    fontSize: SIZES.labelSize,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 16,
  },
  requirementsList: {
    width: '100%',
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxValid: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  requirementText: {
    fontSize: SIZES.labelSize - 2,
    fontWeight: '400',
    color: colors.textMuted,
    flex: 1,
  },
  requirementTextValid: {
    color: colors.text,
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
});
