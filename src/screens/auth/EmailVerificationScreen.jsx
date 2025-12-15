import Icon from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const ZapIcon = ({ color = colors.primary, size = 24 }) => (
  <Icon name="zap" size={size} color={color} />
);

const ClockIcon = ({ color = colors.primary, size = 16 }) => (
  <Icon name="clock" size={size} color={color} />
);

const InfoIcon = ({ color = colors.primary, size = 16 }) => (
  <Icon name="info" size={size} color={color} />
);

// Verification Code Input Component
const VerificationCodeInput = ({ 
  code, 
  setCode, 
  styles, 
  inputSize 
}) => {
  const inputRefs = useRef([]);

  const handleCodeChange = (value, index) => {
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key, index) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.codeInputContainer}>
      {code.map((digit, index) => (
        <TextInput
          key={index}
          ref={(ref) => (inputRefs.current[index] = ref)}
          style={[styles.codeInput, { width: inputSize, height: inputSize }]}
          value={digit}
          onChangeText={(value) => handleCodeChange(value, index)}
          onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
          keyboardType="numeric"
          maxLength={1}
          textAlign="center"
          selectTextOnFocus
          allowFontScaling={false}
          maxFontSizeMultiplier={1}
        />
      ))}
    </View>
  );
};

// Timer Component
const Timer = ({ timeLeft, styles }) => {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.timerContainer}>
      <ClockIcon size={16} />
      <Text style={styles.timerText}>Code expires in {formatTime(timeLeft)}</Text>
    </View>
  );
};

// Main EmailVerificationScreen Component
export const EmailVerificationScreen = () => {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const scrollViewRef = useRef(null);

  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [isLoading, setIsLoading] = useState(false);
  const [canResend, setCanResend] = useState(false);

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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
        codeInputSize:          getResponsiveValue({ android: 46, ios: 46, tablet: 52, default: 46 }),
        emailBoxPadding:        getResponsiveValue({ android: 14, ios: 14, tablet: 16, default: 14 }),
        infoBoxPadding:         getResponsiveValue({ android: 14, ios: 14, tablet: 16, default: 14 }),
        infoBoxMargin:          getResponsiveValue({ android: 18, ios: 20, tablet: 24, default: 18 }),
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

  const handleVerifyCode = async () => {
    setIsLoading(true);
    try {
      console.log('Verifying code:', verificationCode.join(''));
      
      router.push('/reset-password');
    } catch (error) {
      console.error('Error verifying code:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    try {
      // Implement resend logic here
      console.log('Resending verification code');
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reset timer
      setTimeLeft(300);
      setCanResend(false);
      setVerificationCode(['', '', '', '', '', '']);
    } catch (error) {
      console.error('Error resending code:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

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
              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.subtitle}>
                We've sent a 6-digit verification code to your email address. Please enter the code below to verify your account.
              </Text>
            </View>

            {/* Email Display Box */}
            <View style={styles.emailBox}>
              <Text style={styles.emailLabel}>Code sent to:</Text>
              <Text style={styles.emailAddress}>user@example.com</Text>
            </View>

            {/* Verification Code Input */}
            <View style={styles.verificationContainer}>
              <Text style={styles.verificationLabel}>Enter verification code</Text>
              <VerificationCodeInput
                code={verificationCode}
                setCode={setVerificationCode}
                styles={styles}
                inputSize={SIZES.codeInputSize}
              />
            </View>

            {/* Timer */}
            {timeLeft > 0 && (
              <Timer timeLeft={timeLeft} styles={styles} />
            )}

            {/* Verify Button */}
            <View style={styles.footer}>
              <LinearGradient
                colors={colors.gradient}
                style={[
                  styles.verifyButton,
                  isLoading && styles.buttonDisabled,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <TouchableOpacity
                  onPress={handleVerifyCode}
                  disabled={isLoading}
                  activeOpacity={0.9}
                  style={styles.buttonTouchable}
                >
                  <Text style={styles.verifyButtonText}>
                    {isLoading ? 'Verifying...' : 'Verify Code'}
                  </Text>
                </TouchableOpacity>
              </LinearGradient>

              {/* Resend Code */}
              <View style={styles.resendContainer}>
                <Text style={styles.resendText}>
                  Didn't receive the code?{' '}
                  <Text 
                    style={[styles.resendLink, !canResend && styles.resendLinkDisabled]} 
                    onPress={canResend ? handleResendCode : undefined}
                  >
                    Resend Code
                  </Text>
                </Text>
              </View>
            </View>

            {/* Information Box */}
            <View style={styles.infoBox}>
              <InfoIcon size={16} />
              <Text style={styles.infoText}>
                Check your spam folder if you don't see the email. The verification code is valid for 5 minutes.
              </Text>
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
  iconContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconBackground: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: SIZES.titleMarginTop,
    marginBottom: SIZES.titleMarginBottom,
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
  emailBox: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: SIZES.emailBoxPadding,
    marginBottom: SIZES.fieldSpacing * 1.5,
    marginTop: SIZES.formTopMargin,
    alignSelf: 'center',
  },
  emailLabel: {
    fontSize: SIZES.labelSize - 2,
    fontWeight: '400',
    color: colors.textMuted,
    marginBottom: 4,
  },
  emailAddress: {
    fontSize: SIZES.labelSize,
    fontWeight: '600',
    color: colors.text,
  },
  verificationContainer: {
    width: '100%',
    marginTop: SIZES.formTopMargin,
    marginBottom: SIZES.fieldSpacing,
    paddingHorizontal: 4,
  },
  verificationLabel: {
    fontSize: SIZES.labelSize,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  codeInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  codeInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    fontSize: SIZES.inputFontSize + 2,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginHorizontal: 6, // thoda zyada gap
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 6,
    marginBottom: 20,
    alignSelf: 'center',
  },
  timerText: {
    fontSize: SIZES.labelSize - 2,
    fontWeight: '500',
    color: '#D97706',
    marginLeft: 6,
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    marginTop: SIZES.fieldSpacing,
    paddingTop: 10,
    paddingHorizontal: 5,
  },
  verifyButton: {
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
  verifyButtonText: {
    fontSize: SIZES.buttonFontSize,
    fontWeight: '600',
    color: colors.white,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  resendText: {
    fontSize: SIZES.subtitleSize,
    fontWeight: '400',
    color: colors.textMuted,
    textAlign: 'center',
  },
  resendLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  resendLinkDisabled: {
    color: colors.textMuted,
    opacity: 0.5,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SIZES.infoBoxPadding,
    marginTop: SIZES.infoBoxMargin,
    alignSelf: 'center',
  },
  infoText: {
    fontSize: SIZES.labelSize - 2,
    fontWeight: '400',
    color: colors.textMuted,
    flex: 1,
    marginLeft: 12,
    lineHeight: (SIZES.labelSize - 2) * 1.4,
  },
});
