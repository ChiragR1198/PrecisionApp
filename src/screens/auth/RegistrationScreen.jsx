/*
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
import Icon from '@expo/vector-icons/Feather';
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

const MailIcon = ({ color = colors.icon, size = 18 }) => (
  <Icon name="mail" size={size} color={color} />
);

const UserIcon = ({ color = colors.icon, size = 18 }) => (
  <Icon name="user" size={size} color={color} />
);

// FormField reusable field
const FormField = ({
  field,
  value,
  onChangeText,
  showPassword,
  onTogglePassword,
  styles,
  iconSize,
  inputRef,
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
          ref={inputRef}
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
    </View>
  );
};

// Reusable Terms Checkbox
const TermsCheckbox = ({ checked, onPress, styles }) => (
  <View style={styles.termsContainer}>
    <View style={styles.checkboxContainer}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>
      <Text style={styles.termsText}>
        By creating an account, you agree to our{' '}
        <Text style={styles.termsLink}>Terms of Service</Text>
        {' '}and{' '}
        <Text style={styles.termsLink}>Privacy Policy</Text>
      </Text>
    </View>
  </View>
);

// Form configuration for fields
const formFields = [
  {
    id: 'fullName',
    label: 'Full Name',
    placeholder: 'Enter your full name',
    icon: UserIcon,
    type: 'text',
  },
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
    placeholder: 'Create a password',
    icon: EyeIcon,
    type: 'password',
  },
  {
    id: 'confirmPassword',
    label: 'Confirm Password',
    placeholder: 'Confirm your password',
    icon: EyeOffIcon,
    type: 'password',
  },
];

// Main RegistrationScreen Component
export const RegistrationScreen = () => {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();

  const scrollViewRef = useRef(null);
  const inputRefs = useRef({});

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Handle keyboard show/hide to enable/disable scroll
  React.useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      // Blur all inputs when keyboard closes
      Object.values(inputRefs.current).forEach(ref => {
        if (ref && ref.current) {
          ref.current.blur();
        }
      });
      // Reset scroll position immediately when keyboard closes
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      // Then disable scroll after a brief delay
      setTimeout(() => {
        setIsKeyboardVisible(false);
      }, 50);
    });
    
    return () => {
      keyboardDidShowListener?.remove();
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

  const handleSignUp = () => {
    if (!agreeToTerms) return;
    // Implement actual sign-up logic here
    console.log('Sign up pressed', formData);
  };

  const handleBack = () => {
    // Navigation back handler
    console.log('Back pressed');
  };

  const handleLogin = () => {
    router.push('/login');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollViewRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,
            isKeyboardVisible ? { flexGrow: 1 } : { flexGrow: 0 }
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
          scrollEnabled={isKeyboardVisible}
          nestedScrollEnabled={false}
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
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>
                Join us to discover amazing events
              </Text>
            </View>
            <View style={styles.formContainer}>
              {formFields.map((field) => {
                if (!inputRefs.current[field.id]) {
                  inputRefs.current[field.id] = React.createRef();
                }
                return (
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
                    inputRef={inputRefs.current[field.id]}
                  />
                );
              })}
            </View>
            <TermsCheckbox
              checked={agreeToTerms}
              onPress={() => setAgreeToTerms((v) => !v)}
              styles={styles}
            />
            <View style={styles.footer}>
              <LinearGradient
                colors={colors.gradient}
                style={[
                  styles.signUpButton,
                  !agreeToTerms && styles.buttonDisabled,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <TouchableOpacity
                  onPress={handleSignUp}
                  disabled={!agreeToTerms}
                  activeOpacity={0.9}
                  style={styles.buttonTouchable}
                >
                  <Text style={styles.signUpButtonText}>Sign Up</Text>
                </TouchableOpacity>
              </LinearGradient>
              <View style={styles.loginContainer}>
                <Text style={styles.loginText}>
                  Already have an account?{' '}
                  <Text style={styles.loginLink} onPress={handleLogin}>
                    Login
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
    paddingHorizontal: SIZES.paddingHorizontal,
    paddingBottom: isTablet ? 40 : (platform === 'ios' ? 35 : 32),
  },
  content: {
    width: '100%',
    maxWidth: SIZES.contentMaxWidth,
    alignSelf: 'center',
    paddingTop: isTablet ? 35 : 40,
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
    paddingTop: isTablet ? 6 : 2,
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
  },
  formContainer: {
    width: '100%',
    marginTop: SIZES.formTopMargin - 2,
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
  termsContainer: {
    width: '100%',
    marginBottom: 10,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: SIZES.checkboxSize,
    height: SIZES.checkboxSize,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: 10,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  termsText: {
    flex: 1,
    fontSize: SIZES.termsSize,
    lineHeight: SIZES.termsSize * 1.5,
    color: colors.textMuted,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    marginTop: Math.max(SIZES.formBottomMargin - 4, 6),
    paddingTop: 4,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  signUpButton: {
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
  signUpButtonText: {
    fontSize: SIZES.buttonFontSize,
    fontWeight: '600',
    color: colors.white,
  },
  loginContainer: {
    alignItems: 'center',
    marginTop: 6,
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
*/

export const RegistrationScreen = () => {
  return null;
};