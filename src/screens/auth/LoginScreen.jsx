import Icon from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

// Icon Components
const EyeIcon = ({ color = colors.icon, size = 18 }) => (
  <Icon name="eye" size={size} color={color} />
);

const EyeOffIcon = ({ color = colors.icon, size = 18 }) => (
  <Icon name="eye-off" size={size} color={color} />
);

const MailIcon = ({ color = colors.icon, size = 18 }) => (
  <Icon name="mail" size={size} color={color} />
);

const LockIcon = ({ color = colors.icon, size = 18 }) => (
  <Icon name="lock" size={size} color={color} />
);

// FormField reusable field
const FormField = ({
  field,
  value,
  onChangeText,
  isPasswordVisible,
  onTogglePassword,
  styles,
  iconSize,
}) => {
  const IconComponent = field.icon;
  const isPassword = field.type === 'password';
  const isVisible = isPassword ? isPasswordVisible : true;
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
          autoCapitalize={
            field.type === 'email' || field.type === 'password' ? 'none' : 'words'
          }
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
            {isVisible ? <EyeIcon size={iconSize} /> : <EyeOffIcon size={iconSize} />}
          </TouchableOpacity>
        ) : (
          <View style={styles.inputIcon}>
            
            <IconComponent size={iconSize} />
          </View>
        )}
      </View>
    </View>
  );
};

// User Type Selector Component
const UserTypeSelector = ({ value, onValueChange, styles, SIZES }) => {
  const options = [
    { label: 'Sponsor', value: 'sponsor' },
    { label: 'Delegate', value: 'delegate' },
  ];

  return (
    <View style={styles.userTypeContainer}>
      <Text style={styles.label}>User Type</Text>
      <View style={styles.segmentedControl}>
        {options.map((option) => {
          const isSelected = value === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.segmentButton,
                isSelected && styles.segmentButtonActive,
              ]}
              onPress={() => onValueChange(option.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.segmentButtonText,
                  isSelected && styles.segmentButtonTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// Forgot Password Link
const ForgotPasswordLink = ({ onPress, styles }) => (
  <View style={styles.forgotPasswordContainer}>
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
    </TouchableOpacity>
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
  {
    id: 'password',
    label: 'Password',
    placeholder: 'Enter your password',
    icon: LockIcon,
    type: 'password',
  },
];

// Main LoginScreen Component
export const LoginScreen = () => {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const { login } = useAuth();

  const scrollViewRef = useRef(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    userType: 'sponsor', // Default to sponsor
  });
  const [passwordVisibility, setPasswordVisibility] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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

  const togglePasswordVisibility = (fieldId) => {
    setPasswordVisibility((prev) => ({
      ...prev,
      [fieldId]: !prev[fieldId],
    }));
  };

  const handleLogin = async () => {
    // Validate inputs
    if (!formData.email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (!formData.password.trim()) {
      setError('Please enter your password');
      return;
    }
    if (!formData.userType) {
      setError('Please select a user type');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await login(formData.email.trim(), formData.password, formData.userType);
      
      if (result.success) {
        // Navigation will be handled by AuthContext and _layout.js
        // The auth state change will trigger redirect to dashboard
        router.replace('/(drawer)/dashboard');
      } else {
        // Error message is already set by authService (includes user type validation)
        setError(result.error || 'Login failed. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    router.push('/forgot-password');
  };

  // Render
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>
                Sign in to your account
              </Text>
            </View>
            <View style={styles.formContainer}>
              <UserTypeSelector
                value={formData.userType}
                onValueChange={(value) => {
                  handleInputChange('userType', value);
                  if (error) setError('');
                }}
                styles={styles}
                SIZES={SIZES}
              />
              {formFields.map((field) => (
                <FormField
                  key={field.id}
                  field={field}
                  value={formData[field.id]}
                  onChangeText={(value) => {
                    handleInputChange(field.id, value);
                    // Clear error when user starts typing
                    if (error) setError('');
                  }}
                isPasswordVisible={!!passwordVisibility[field.id]}
                onTogglePassword={() => togglePasswordVisibility(field.id)}
                  styles={styles}
                  iconSize={SIZES.iconSize}
                />
              ))}
            </View>
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            <ForgotPasswordLink
              onPress={handleForgotPassword}
              styles={styles}
            />
            <View style={styles.footer}>
              <LinearGradient
                colors={colors.gradient}
                style={styles.loginButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <TouchableOpacity
                  onPress={handleLogin}
                  activeOpacity={0.9}
                  style={styles.buttonTouchable}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.loginButtonText}>Sign In</Text>
                  )}
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (SIZES, isTablet, SCREEN_HEIGHT, platform) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: isTablet ? SIZES.paddingVertical : SIZES.paddingVertical * 0.8,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SIZES.paddingHorizontal,
    paddingBottom: platform === 'ios' ? 20 : 16,
  },
  content: {
    width: '100%',
    maxWidth: SIZES.contentMaxWidth,
    alignSelf: 'center',
  },
  logoContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: SIZES.logoMarginBottom,
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
  forgotPasswordContainer: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 16,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  forgotPasswordText: {
    fontSize: SIZES.subtitleSize,
    fontWeight: '500',
    color: colors.primary,
  },
  userTypeContainer: {
    width: '100%',
    marginBottom: SIZES.fieldSpacing,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentButton: {
    flex: 1,
    height: SIZES.inputHeight - 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md - 2,
    backgroundColor: 'transparent',
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
  },
  segmentButtonText: {
    fontSize: SIZES.inputFontSize + 1,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  segmentButtonTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  errorContainer: {
    width: '100%',
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: SIZES.subtitleSize - 1,
    fontWeight: '400',
    color: '#EF4444',
    textAlign: 'center',
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    marginTop: SIZES.formBottomMargin,
    paddingTop: 8,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  loginButton: {
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
  loginButtonText: {
    fontSize: SIZES.buttonFontSize,
    fontWeight: '600',
    color: colors.white,
  },
});