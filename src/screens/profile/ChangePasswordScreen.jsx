import Icon from '@expo/vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../components/common/Header';
import { colors, radius } from '../../constants/theme';
import { useDelegateChangePasswordMutation, useSponsorChangePasswordMutation } from '../../store/api';
import { useAppSelector } from '../../store/hooks';

// Icon Components
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

// Password Strength Calculation
const calculatePasswordStrength = (password) => {
  if (!password) return { strength: 'Weak', percentage: 0, color: '#EF4444' };
  
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
  
  if (score <= 2) return { strength: 'Weak', percentage: 33, color: '#EF4444' };
  if (score <= 4) return { strength: 'Medium', percentage: 66, color: '#FBBF24' };
  return { strength: 'Strong', percentage: 100, color: '#22C55E' };
};

// FormField reusable field (similar to ResetPasswordScreen)
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
    </View>
  );
};

export const ChangePasswordScreen = () => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const navigation = useNavigation();
  const { user } = useAppSelector((state) => state.auth);
  const loginType = (user?.login_type || user?.user_type || '').toLowerCase();
  const isDelegate = loginType === 'delegate';
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPasswordUpdateSuccessModalVisible, setIsPasswordUpdateSuccessModalVisible] = useState(false);
  const [isPasswordUpdateErrorModalVisible, setIsPasswordUpdateErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const [delegateChangePassword, { isLoading: isUpdatingDelegatePassword }] = useDelegateChangePasswordMutation();
  const [sponsorChangePassword, { isLoading: isUpdatingSponsorPassword }] = useSponsorChangePasswordMutation();
  const changePassword = isDelegate ? delegateChangePassword : sponsorChangePassword;
  const isLoading = isDelegate ? isUpdatingDelegatePassword : isUpdatingSponsorPassword;
  
  // Check if form is valid (for button disable state)
  const isPasswordValid = newPassword.length >= 8 && 
    /[A-Z]/.test(newPassword) && 
    /\d/.test(newPassword) && 
    /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  
  const isFormValid = isPasswordValid && newPassword === confirmPassword && currentPassword.length > 0;

  // Platform-aware Responsive SIZES (similar to ResetPasswordScreen)
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
    
    const getValue = ({ tablet, default: defaultValue }) => {
      if (isTabletDevice && tablet !== undefined) return tablet;
      return defaultValue;
    };
    
    return {
      SIZES: {
        headerIconSize: getValue({ tablet: 25, default: 22 }),
        iconSize: getResponsiveValue({ android: 15, ios: 15, tablet: 17, default: 15 }),
        inputHeight: getResponsiveValue({ android: 44, ios: 44, tablet: 46, default: 44 }),
        contentMaxWidth: getResponsiveValue({ android: 420, ios: 420, tablet: 460, default: 420 }),
        paddingHorizontal: getResponsiveValue({ android: 16, ios: 18, tablet: 32, default: 16 }),
        sectionSpacing: getValue({ tablet: 26, default: 22 }),
        fieldSpacing: getResponsiveValue({ android: 16, ios: 18, tablet: 16, default: 16 }),
        labelSize: getResponsiveValue({ android: 13, ios: 13, tablet: 15, default: 13 }),
        requirementsPadding: getResponsiveValue({ android: 14, ios: 14, tablet: 16, default: 14 }),
        requirementsMargin: getResponsiveValue({ android: 16, ios: 18, tablet: 24, default: 16 }),
      },
      isTablet: isTabletDevice,
    };
  }, [SCREEN_WIDTH]);
  
  // Calculate password strength
  const passwordStrength = useMemo(() => calculatePasswordStrength(newPassword), [newPassword]);

  // Form configuration for fields
  const formFields = [
    {
      id: 'currentPassword',
      label: 'Current Password',
      placeholder: 'Enter current password',
      icon: LockIcon,
      type: 'password',
    },
    {
      id: 'newPassword',
      label: 'New Password',
      placeholder: 'Enter new password',
      icon: LockIcon,
      type: 'password',
    },
    {
      id: 'confirmPassword',
      label: 'Confirm New Password',
      placeholder: 'Confirm new password',
      icon: LockIcon,
      type: 'password',
    },
  ];

  const styles = useMemo(() => createStyles(SIZES, isTablet), [SIZES, isTablet]);

  const handleUpdatePassword = async () => {
    // Validation
    if (!currentPassword.trim()) {
      setErrorMessage('Please enter your current password');
      setIsPasswordUpdateErrorModalVisible(true);
      return;
    }
    
    if (!newPassword.trim()) {
      setErrorMessage('Please enter a new password');
      setIsPasswordUpdateErrorModalVisible(true);
      return;
    }
    
    if (!isPasswordValid) {
      setErrorMessage('New password does not meet the requirements');
      setIsPasswordUpdateErrorModalVisible(true);
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirm password do not match');
      setIsPasswordUpdateErrorModalVisible(true);
      return;
    }
    
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }).unwrap();
      
      // Show success modal instead of Alert
      setIsPasswordUpdateSuccessModalVisible(true);
      // Clear form fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      const errorMsg = error?.data?.message || error?.message || 'Failed to update password. Please try again.';
      setErrorMessage(errorMsg);
      setIsPasswordUpdateErrorModalVisible(true);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header
        title="Change Password"
        leftIcon="menu"
        onLeftPress={() => navigation.openDrawer?.()}
        iconSize={SIZES.headerIconSize}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.card}>
          <View style={styles.lockIconWrap}>
            <View style={styles.lockIconCircle}>
              <Icon name="lock" size={22} color={colors.primary} />
            </View>
          </View>
          <Text style={styles.cardTitle}>Change Password</Text>
          <Text style={styles.cardSubtitle}>Update your password to keep your account secure</Text>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            {formFields.map((field) => (
              <FormField
                key={field.id}
                field={field}
                value={
                  field.id === 'currentPassword' ? currentPassword :
                  field.id === 'newPassword' ? newPassword :
                  confirmPassword
                }
                onChangeText={(value) => {
                  if (field.id === 'currentPassword') setCurrentPassword(value);
                  else if (field.id === 'newPassword') setNewPassword(value);
                  else setConfirmPassword(value);
                }}
                showPassword={
                  field.id === 'currentPassword' ? showCurrentPassword :
                  field.id === 'newPassword' ? showNewPassword :
                  showConfirmPassword
                }
                onTogglePassword={() => {
                  if (field.id === 'currentPassword') {
                    setShowCurrentPassword((prev) => !prev);
                  } else if (field.id === 'newPassword') {
                    setShowNewPassword((prev) => !prev);
                  } else {
                    setShowConfirmPassword((prev) => !prev);
                  }
                }}
                styles={styles}
                iconSize={SIZES.iconSize}
              />
            ))}
          </View>

          {/* Password Strength */}
          {newPassword.length > 0 && (
            <View style={styles.strengthBar}>
              <Text style={styles.strengthText}>Password strength: {passwordStrength.strength}</Text>
              <View style={styles.strengthTrack}>
                <View style={[styles.strengthFill, { width: `${passwordStrength.percentage}%`, backgroundColor: passwordStrength.color }]} />
              </View>
            </View>
          )}

          {/* Password Requirements */}
          <PasswordRequirements password={newPassword} styles={styles} />

          <TouchableOpacity 
            activeOpacity={0.85} 
            onPress={handleUpdatePassword} 
            disabled={!isFormValid || isLoading}
            style={[styles.updateBtn, (!isFormValid || isLoading) && styles.updateBtnDisabled]}
          >
            <LinearGradient 
              colors={(!isFormValid || isLoading) ? [colors.gray100, colors.gray100] : colors.gradient} 
              style={styles.updateGradient} 
              start={{ x: 0, y: 0 }} 
              end={{ x: 1, y: 0 }}
            >
              {isLoading ? (
                <View style={styles.updateButtonLoadingContainer}>
                  <ActivityIndicator size="small" color={colors.white} />
                  <Text style={styles.updateText}>Updating...</Text>
                </View>
              ) : (
                <Text style={styles.updateText}>Update Password</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.85} style={styles.logoutBtn}>
            <Icon name="log-out" size={18} color="#EF4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Password Update Success Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isPasswordUpdateSuccessModalVisible}
        onRequestClose={() => setIsPasswordUpdateSuccessModalVisible(false)}
      >
        <View style={styles.successModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsPasswordUpdateSuccessModalVisible(false)} />
          <View style={styles.successModalCard}>
            <View style={styles.successIconContainer}>
              <Icon name="check-circle" size={64} color={colors.primary} />
            </View>
            <Text style={styles.successTitle}>Password Updated</Text>
            <Text style={styles.successMessage}>
              Your password has been updated successfully!
            </Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => setIsPasswordUpdateSuccessModalVisible(false)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={colors.gradient}
                style={styles.successButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.successButtonText}>OK</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Password Update Error Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isPasswordUpdateErrorModalVisible}
        onRequestClose={() => setIsPasswordUpdateErrorModalVisible(false)}
      >
        <View style={styles.errorModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsPasswordUpdateErrorModalVisible(false)} />
          <View style={styles.errorModalCard}>
            <View style={styles.errorIconContainer}>
              <Icon name="alert-circle" size={64} color="#EF4444" />
            </View>
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorMessage}>
              {errorMessage}
            </Text>
            <TouchableOpacity
              style={styles.errorButton}
              onPress={() => setIsPasswordUpdateErrorModalVisible(false)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                style={styles.errorButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.errorButtonText}>OK</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (SIZES, isTablet) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
    },
    content: {
      width: '100%',
      alignSelf: 'center',
      paddingTop: isTablet ? 12 : 8,
    },
    card: {
      backgroundColor: colors.white,
      paddingHorizontal: 16,
      paddingVertical: 20,
      height: '100%',
    },
    lockIconWrap: {
      alignItems: 'center',
      marginBottom: 12,
    },
    lockIconCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: 'rgba(138, 52, 144, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: {
      textAlign: 'center',
      fontWeight: '700',
      fontSize: 18,
      color: colors.text,
      marginBottom: 6,
    },
    cardSubtitle: {
      textAlign: 'center',
      color: colors.textMuted,
      marginBottom: 20,
    },
    formContainer: {
      width: '100%',
      marginTop: 8,
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
      fontSize: 13,
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
    strengthBar: {
      marginTop: 8,
      marginBottom: 16,
    },
    strengthText: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 6,
    },
    strengthTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.gray100,
      overflow: 'hidden',
    },
    strengthFill: {
      height: '100%',
      borderRadius: 3,
    },
    requirementsContainer: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: SIZES.requirementsPadding,
      marginBottom: SIZES.requirementsMargin,
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
    updateBtn: {
      borderRadius: radius.md,
      overflow: 'hidden',
    },
    updateBtnDisabled: {
      opacity: 0.6,
    },
    updateGradient: {
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    updateText: {
      color: colors.white,
      fontWeight: '700',
    },
    updateButtonLoadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    successModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    successModalCard: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: colors.white,
      borderRadius: 20,
      paddingVertical: 28,
      paddingHorizontal: 24,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    },
    successIconContainer: {
      marginBottom: 16,
    },
    successTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    successMessage: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 22,
      paddingHorizontal: 8,
    },
    successButton: {
      width: '100%',
      height: 48,
      borderRadius: radius.md,
      overflow: 'hidden',
    },
    successButtonGradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    successButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.white,
    },
    errorModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    errorModalCard: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: colors.white,
      borderRadius: 20,
      paddingVertical: 28,
      paddingHorizontal: 24,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    },
    errorIconContainer: {
      marginBottom: 16,
    },
    errorTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    errorMessage: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 22,
      paddingHorizontal: 8,
    },
    errorButton: {
      width: '100%',
      height: 48,
      borderRadius: radius.md,
      overflow: 'hidden',
    },
    errorButtonGradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.white,
    },
    logoutBtn: {
      marginTop: 20,
      borderRadius: radius.md,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
      backgroundColor: 'rgba(239, 68, 68, 0.06)',
      width: '100%',
    },
    logoutText: {
      color: '#EF4444',
      fontWeight: '700',
    },
  });

export default ChangePasswordScreen;

