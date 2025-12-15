import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '@expo/vector-icons/Feather';
import { Header } from '../../components/common/Header';
import { colors, radius } from '../../constants/theme';

const PasswordField = ({ label, value, onChangeText, placeholder, styles }) => {
  const [isSecure, setIsSecure] = useState(true);
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textPlaceholder}
          secureTextEntry={isSecure}
        />
        <TouchableOpacity style={styles.eyeButton} onPress={() => setIsSecure((prev) => !prev)}>
          <Icon name={isSecure ? 'eye' : 'eye-off'} size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const ChangePasswordScreen = () => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const navigation = useNavigation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { SIZES, isTablet } = useMemo(() => {
    const isTabletDevice = SCREEN_WIDTH >= 768;
    const getValue = ({ tablet, default: defaultValue }) => {
      if (isTabletDevice && tablet !== undefined) return tablet;
      return defaultValue;
    };

    return {
      SIZES: {
        headerIconSize: getValue({ tablet: 25, default: 22 }),
        contentMaxWidth: getValue({ tablet: 600, default: '100%' }),
        paddingHorizontal: getValue({ tablet: 22, default: 16 }),
        sectionSpacing: getValue({ tablet: 26, default: 22 }),
        inputHeight: getValue({ tablet: 50, default: 46 }),
      },
      isTablet: isTabletDevice,
    };
  }, [SCREEN_WIDTH]);

  const styles = useMemo(() => createStyles(SIZES, isTablet), [SIZES, isTablet]);

  const handleUpdatePassword = () => {
    console.log('Update password');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="Change Password"
        leftIcon="menu"
        onLeftPress={() => navigation.openDrawer?.()}
        iconSize={SIZES.headerIconSize}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: SIZES.paddingHorizontal }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.lockIconWrap}>
            <View style={styles.lockIconCircle}>
              <Icon name="lock" size={22} color={colors.primary} />
            </View>
          </View>
          <Text style={styles.cardTitle}>Change Password</Text>
          <Text style={styles.cardSubtitle}>Update your password to keep your account secure</Text>

          <PasswordField
            label="Current Password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
            styles={styles}
          />

          <PasswordField
            label="New Password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password"
            styles={styles}
          />

          <View style={styles.strengthBar}>
            <Text style={styles.strengthText}>Password strength: Weak</Text>
            <View style={styles.strengthTrack}>
              <View style={styles.strengthFill} />
            </View>
          </View>

          <PasswordField
            label="Confirm New Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            styles={styles}
          />

          <View style={styles.requirements}>
            <Text style={styles.requirementsTitle}>Password requirements:</Text>
            {[
              'At least 8 characters',
              'One uppercase letter',
              'One number',
              'One special character',
            ].map((req) => (
              <View key={req} style={styles.reqRow}>
                <View style={styles.reqBullet} />
                <Text style={styles.reqText}>{req}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity activeOpacity={0.85} onPress={handleUpdatePassword} style={styles.updateBtn}>
            <LinearGradient colors={colors.gradient} style={styles.updateGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.updateText}>Update Password</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <TouchableOpacity activeOpacity={0.85} style={styles.logoutBtn}>
          <Icon name="log-out" size={18} color="#EF4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (SIZES) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 32,
    },
    card: {
      backgroundColor: colors.white,
      borderRadius: 16,
      paddingHorizontal: 10,
      marginTop: 20,
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
    fieldContainer: {
      marginBottom: 16,
    },
    fieldLabel: {
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    inputWrapper: {
      position: 'relative',
    },
    input: {
      height: SIZES.inputHeight,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingRight: 44,
      color: colors.text,
    },
    eyeButton: {
      position: 'absolute',
      right: 12,
      top: '50%',
      transform: [{ translateY: -10 }],
    },
    strengthBar: {
      marginBottom: 20,
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
      width: '30%',
      height: '100%',
      backgroundColor: '#FBBF24',
    },
    requirements: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
    },
    requirementsTitle: {
      fontWeight: '600',
      color: colors.text,
      marginBottom: 10,
    },
    reqRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    reqBullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
      marginRight: 8,
    },
    reqText: {
      color: colors.textMuted,
    },
    updateBtn: {
      borderRadius: radius.md,
      overflow: 'hidden',
      marginBottom: 20,
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
    logoutBtn: {
      marginTop: 8,
      borderRadius: radius.md,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
      backgroundColor: 'rgba(239, 68, 68, 0.06)',
    },
    logoutText: {
      color: '#EF4444',
      fontWeight: '700',
    },
  });

export default ChangePasswordScreen;

