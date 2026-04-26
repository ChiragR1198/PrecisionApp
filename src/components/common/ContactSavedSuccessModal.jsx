import Icon from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '../../constants/theme';

/**
 * Same visual pattern as Profile → scan → save contact (check icon, title, message, actions).
 * @param {object} props
 * @param {boolean} props.visible
 * @param {string} props.title
 * @param {string} props.message
 * @param {() => void} props.onClose — primary dismiss (OK / backdrop)
 * @param {boolean} [props.showViewContactsButton=true] — when false, only one full-width OK (gradient)
 * @param {() => void} [props.onViewContacts] — defaults to `router.push('/contacts')`
 */
export const ContactSavedSuccessModal = ({
  visible,
  title,
  message,
  onClose,
  showViewContactsButton = true,
  onViewContacts,
}) => {
  const handleViewContacts = () => {
    if (onViewContacts) {
      onViewContacts();
    } else {
      onClose();
      router.push('/contacts');
    }
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Icon name="check-circle" size={64} color={colors.primary} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {showViewContactsButton ? (
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.buttonSecondary} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.buttonSecondaryText}>OK</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.buttonPrimaryWrap} onPress={handleViewContacts} activeOpacity={0.8}>
                <LinearGradient
                  colors={colors.gradient}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.buttonPrimaryText}>View Contacts</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.buttonSingleWrap} onPress={onClose} activeOpacity={0.8}>
              <LinearGradient
                colors={colors.gradient}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.buttonPrimaryText}>OK</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
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
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  buttonSecondary: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  buttonSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  buttonPrimaryWrap: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  buttonSingleWrap: {
    width: '100%',
    height: 48,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  buttonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
});
