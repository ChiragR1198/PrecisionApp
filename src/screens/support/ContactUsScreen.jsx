import Icon from '@expo/vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSubmitContactFormMutation } from '../../store/api';
import { Header } from '../../components/common/Header';
import { colors, radius } from '../../constants/theme';

export const ContactUsScreen = () => {
  const navigation = useNavigation();
  const params = useLocalSearchParams?.() || {};
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const [submitContactForm, { isLoading: isSubmitting }] = useSubmitContactFormMutation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const { SIZES, isTablet } = useMemo(() => {
    const isTabletDevice = SCREEN_WIDTH >= 768;
    const getResponsiveValue = ({ tablet, default: defaultValue }) => {
      if (isTabletDevice && tablet !== undefined) return tablet;
      return defaultValue;
    };
    return {
      SIZES: {
        contentMaxWidth: getResponsiveValue({ tablet: 640, default: '100%' }),
        paddingHorizontal: getResponsiveValue({ tablet: 24, default: 18 }),
        sectionSpacing: getResponsiveValue({ tablet: 24, default: 20 }),
        inputHeight: getResponsiveValue({ tablet: 48, default: 46 }),
        title: getResponsiveValue({ tablet: 20, default: 18 }),
        body: getResponsiveValue({ tablet: 15, default: 14 }),
        buttonHeight: getResponsiveValue({ tablet: 48, default: 46 }),
      },
      isTablet: isTabletDevice,
    };
  }, [SCREEN_WIDTH]);

  const styles = useMemo(() => createStyles(SIZES, isTablet), [SIZES, isTablet]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName || !trimmedEmail || !trimmedMessage) {
      Alert.alert('Missing information', 'Please fill in your name, email and message.');
      return;
    }

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    try {
      const result = await submitContactForm({
        full_name: trimmedName,
        email: trimmedEmail,
        message: trimmedMessage,
      }).unwrap();
      if (result?.success) {
        setName('');
        setEmail('');
        setMessage('');
        setShowSuccessModal(true);
      } else {
        Alert.alert('Error', result?.message || 'Failed to send. Please try again.');
      }
    } catch (err) {
      const msg = err?.data?.message || err?.message || 'Unable to send. Please try again later.';
      Alert.alert('Error', msg);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header
        title="Contact Us"
        leftIcon={params?.from ? 'arrow-left' : 'menu'}
        onLeftPress={() => {
          if (params?.from) {
            try {
              router.back();
            } catch {
              navigation.goBack?.();
            }
          } else {
            navigation.openDrawer?.();
          }
        }}
        iconSize={20}
      />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Text style={styles.title}>We’re here to help</Text>
            <Text style={styles.subtitle}>
              Have a question or feedback about the app? Fill out the form below and we’ll get back
              to you at your email address.
            </Text>

            <View style={styles.card}>
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Full Name *</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Your name"
                    placeholderTextColor={colors.textPlaceholder}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                  <View style={styles.inputIcon}>
                    <Icon name="user" size={18} color={colors.icon} />
                  </View>
                </View>
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Email Address *</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.textPlaceholder}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <View style={styles.inputIcon}>
                    <Icon name="mail" size={18} color={colors.icon} />
                  </View>
                </View>
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Message *</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    placeholder="How can we help?"
                    placeholderTextColor={colors.textPlaceholder}
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.button}
                activeOpacity={0.9}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                <LinearGradient
                  colors={colors.gradient}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.buttonText}>Send Message</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success popup (same style as profile update) */}
      <Modal
        transparent
        animationType="fade"
        visible={showSuccessModal}
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.successModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowSuccessModal(false)} />
          <View style={styles.successModalCard}>
            <View style={styles.successIconContainer}>
              <Icon name="check-circle" size={64} color={colors.primary} />
            </View>
            <Text style={styles.successTitle}>Message Sent</Text>
            <Text style={styles.successMessage}>
              Thank you. We will get back to you at your email address.
            </Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => setShowSuccessModal(false)}
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
    </SafeAreaView>
  );
};

const createStyles = (SIZES, isTablet) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboard: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 24,
    },
    content: {
      width: '100%',
      maxWidth: SIZES.contentMaxWidth,
      alignSelf: 'center',
      paddingHorizontal: SIZES.paddingHorizontal,
      paddingTop: SIZES.sectionSpacing,
    },
    title: {
      fontSize: SIZES.title,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: SIZES.body,
      color: colors.textMuted,
      marginBottom: SIZES.sectionSpacing,
      lineHeight: SIZES.body * 1.6,
    },
    card: {
      backgroundColor: colors.white,
      borderRadius: radius.lg,
      padding: SIZES.paddingHorizontal,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    },
    fieldContainer: {
      marginBottom: SIZES.sectionSpacing - 4,
    },
    label: {
      fontSize: SIZES.body - 1,
      fontWeight: '500',
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
      paddingHorizontal: 14,
      paddingRight: 44,
      fontSize: SIZES.body,
      color: colors.text,
    },
    inputMultiline: {
      height: isTablet ? 140 : 120,
      paddingTop: 10,
      paddingBottom: 10,
      paddingRight: 14,
    },
    inputIcon: {
      position: 'absolute',
      right: 14,
      top: '50%',
      transform: [{ translateY: -10 }],
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    button: {
      marginTop: SIZES.sectionSpacing,
      borderRadius: radius.md,
      overflow: 'hidden',
    },
    buttonGradient: {
      height: SIZES.buttonHeight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      fontSize: SIZES.body,
      fontWeight: '700',
      color: colors.white,
    },
    // Success popup (profile update style)
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
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    successButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.white,
    },
  });

export default ContactUsScreen;

