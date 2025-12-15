import Icon from '@expo/vector-icons/Feather';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import { CameraView } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
    Alert,
    Image,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../components/common/Header';
import { colors, radius } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { contactStore } from '../../store/contactStore';

// Icon Components
const UserIcon = ({ color = colors.icon, size = 18 }) => (
  <Icon name="user" size={size} color={color} />
);

const MailIcon = ({ color = colors.icon, size = 18 }) => (
  <Icon name="mail" size={size} color={color} />
);

const PhoneIcon = ({ color = colors.icon, size = 18 }) => (
  <Icon name="phone" size={size} color={color} />
);

const CameraIcon = ({ color = colors.white, size = 16 }) => (
  <FontAwesome name="camera" size={size} color={color} />
);

const BellIcon = ({ color = colors.white, size = 18 }) => (
  <Icon name="bell" size={size} color={color} />
);

const ArrowRightIcon = ({ color = '#EF4444', size = 18 }) => (
  <Icon name="chevron-right" size={size} color={color} />
);

const ScannerIcon = ({ color = colors.white, size = 16 }) => (
  <Icon name="maximize" size={size} color={color} />
);

// FormField Component
const FormField = ({
  label,
  value,
  onChangeText,
  placeholder,
  icon: IconComponent,
  styles,
  iconSize,
  keyboardType = 'default',
}) => (
  <View style={styles.fieldContainer}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={styles.inputContainer}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textPlaceholder}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
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

// Notification Settings Card
const NotificationCard = ({ isEnabled, onToggle, styles, SIZES }) => (
  <View style={styles.notificationCard}>
    <View style={styles.notificationIconContainer}>
      <BellIcon size={SIZES.notificationIconSize} />
    </View>
    <View style={styles.notificationContent}>
      <Text style={styles.notificationTitle}>Notifications</Text>
      <Text style={styles.notificationSubtitle}>App Updates</Text>
      <Text style={styles.notificationDescription}>
        Receive notifications about app updates and new features
      </Text>
    </View>
    <Switch
      value={isEnabled}
      onValueChange={onToggle}
      trackColor={{ false: colors.gray300, true: colors.primary }}
      thumbColor={colors.white}
      ios_backgroundColor={colors.gray300}
    />
  </View>
);

// Main ProfileScreen Component
export const ProfileScreen = () => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const navigation = useNavigation();
  const { logout } = useAuth();
  
  const [formData, setFormData] = useState({
    fullName: 'John Doe',
    email: 'john.doe@email.com',
    phoneNumber: '+1 (555) 123-4567',
  });
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [profileImage, setProfileImage] = useState(null); // Can be set to image URI
  const [isQRModalVisible, setIsQRModalVisible] = useState(false);
  const [qrMode, setQrMode] = useState('code');
  const [scanResult, setScanResult] = useState(null);
  const [hasScanPermission, setHasScanPermission] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

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
        headerIconSize: getResponsiveValue({ android: 22, ios: 23, tablet: 25, default: 22 }),
        contentMaxWidth: getResponsiveValue({ android: '100%', ios: '100%', tablet: 600, default: '100%' }),
        paddingHorizontal: getResponsiveValue({ android: 16, ios: 18, tablet: 20, default: 16 }),
        sectionSpacing: getResponsiveValue({ android: 22, ios: 24, tablet: 26, default: 22 }),
        cardSpacing: getResponsiveValue({ android: 12, ios: 14, tablet: 18, default: 12 }),
        title: getResponsiveValue({ android: 18, ios: 19, tablet: 21, default: 18 }),
        body: getResponsiveValue({ android: 14, ios: 15, tablet: 15, default: 14 }),
        inputHeight: getResponsiveValue({ android: 44, ios: 44, tablet: 46, default: 44 }),
        iconSize: getResponsiveValue({ android: 18, ios: 18, tablet: 20, default: 18 }),
        profilePictureSize: getResponsiveValue({ android: 100, ios: 100, tablet: 120, default: 100 }),
        cameraIconSize: getResponsiveValue({ android: 16, ios: 16, tablet: 18, default: 16 }),
        cameraButtonSize: getResponsiveValue({ android: 32, ios: 32, tablet: 36, default: 32 }),
        bannerMinHeight: getResponsiveValue({ android: 180, ios: 180, tablet: 200, default: 180 }),
        notificationIconSize: getResponsiveValue({ android: 18, ios: 18, tablet: 20, default: 18 }),
      },
      isTablet: isTabletDevice,
    };
  }, [SCREEN_WIDTH]);

  const styles = useMemo(() => createStyles(SIZES, isTablet), [SIZES, isTablet]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveChanges = () => {
    // Implement save logic here
    console.log('Saving changes:', formData);
  };

  const handleChangePhoto = () => {
    // Implement photo change logic here
    console.log('Change photo pressed');
  };

  const handleOpenQRModal = () => {
    setIsQRModalVisible(true);
    setQrMode('code');
    setScanResult(null);
    setHasScanPermission(null);
    setIsScanning(false);
  };

  const handleCloseQRModal = () => {
    setIsQRModalVisible(false);
  };

  const handleAddScannedContact = () => {
    if (!scanResult) return;
    const savedContact = contactStore.addContact({
      name: scanResult.name,
      phone: scanResult.phone,
      email: scanResult.email,
      initials: scanResult.initials,
    });
    setIsScanning(false);
    setIsQRModalVisible(false);
    Alert.alert('Contact saved', `${savedContact.name} was added to Contacts.`, [
      { text: 'OK' },
      { text: 'View Contacts', onPress: () => router.push('/contacts') },
    ]);
  };

  const requestScannerPermission = async () => {
    const { status } = await CameraView.requestCameraPermissionsAsync();
    setHasScanPermission(status === 'granted');
    setIsScanning(status === 'granted');
    setScanResult(null);
  };

  const handleBarCodeScanned = ({ data }) => {
    setIsScanning(false);
    try {
      const parsed = JSON.parse(data);
      setScanResult({
        initials: parsed.initials || 'SJ',
        name: parsed.name || 'Sarah Johnson',
        role: parsed.role || 'Marketing Manager',
        company: parsed.company || 'Tech Solutions Inc.',
        email: parsed.email || 'sarah.johnson@techsolutions.com',
        phone: parsed.phone || '+1 (555) 123-4567',
      });
    } catch (error) {
      setScanResult({
        initials: 'QR',
        name: 'Unknown Contact',
        role: 'Scanned via QR',
        company: data,
        email: 'N/A',
        phone: 'N/A',
      });
    }
  };

  React.useEffect(() => {
    if (qrMode === 'scan' && isQRModalVisible && hasScanPermission === null) {
      requestScannerPermission();
    }
    if (qrMode !== 'scan') {
      setIsScanning(false);
    }
  }, [qrMode, isQRModalVisible]);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              // Navigation will be handled by AuthContext and _layout.js
              router.replace('/login');
            } catch (error) {
              console.error('Logout error:', error);
              // Even if API call fails, navigate to login
              router.replace('/login');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header 
        title="Profile" 
        leftIcon="menu" 
        onLeftPress={() => navigation.openDrawer?.()} 
        iconSize={SIZES.headerIconSize} 
      />

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false} 
        bounces={false}
      >
        <View style={styles.content}>
          {/* Profile Picture Section */}
          <LinearGradient
            colors={colors.gradient2}
            style={styles.profileBanner}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.profilePictureContainer}>
              <View style={[styles.profilePicture, { width: SIZES.profilePictureSize, height: SIZES.profilePictureSize, borderRadius: SIZES.profilePictureSize / 2 }]}>
                {profileImage ? (
                  <Image
                    source={{ uri: profileImage }}
                    style={[styles.profileImage, { width: SIZES.profilePictureSize, height: SIZES.profilePictureSize, borderRadius: SIZES.profilePictureSize / 2 }]}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.profileImagePlaceholder}>
                    <UserIcon color={colors.primary} size={SIZES.profilePictureSize * 0.4} />
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={[styles.cameraButton]}
                onPress={handleChangePhoto}
                activeOpacity={0.8}
              >
                <CameraIcon size={SIZES.cameraIconSize} color={colors.primary}/>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={handleChangePhoto} activeOpacity={0.8}>
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
            
            {/* QR Code Section */}
            <TouchableOpacity 
              style={styles.qrCodeContainer}
              onPress={handleOpenQRModal}
              activeOpacity={0.8}
            >
              <ScannerIcon size={SIZES.cameraIconSize} />
              <Text style={styles.qrCodeText}>QR Code</Text>
            </TouchableOpacity>
          </LinearGradient>

          {/* My Profile Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Profile</Text>
            
            <View style={styles.profileCard}>
              <FormField
                label="Full Name"
                value={formData.fullName}
                onChangeText={(value) => handleInputChange('fullName', value)}
                placeholder="John Doe"
                icon={UserIcon}
                styles={styles}
                iconSize={SIZES.iconSize}
              />
              
              <FormField
                label="Email"
                value={formData.email}
                onChangeText={(value) => handleInputChange('email', value)}
                placeholder="john.doe@email.com"
                icon={MailIcon}
                styles={styles}
                iconSize={SIZES.iconSize}
                keyboardType="email-address"
              />
              
              <FormField
                label="Phone Number"
                value={formData.phoneNumber}
                onChangeText={(value) => handleInputChange('phoneNumber', value)}
                placeholder="+1 (555) 123-4567"
                icon={PhoneIcon}
                styles={styles}
                iconSize={SIZES.iconSize}
                keyboardType="phone-pad"
              />

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveChanges}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={colors.gradient}
                  style={styles.saveButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Settings Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settings</Text>
            
            <NotificationCard
              isEnabled={notificationsEnabled}
              onToggle={setNotificationsEnabled}
              styles={styles}
              SIZES={SIZES}
            />
          </View>

          {/* Logout Button */}
          <View style={styles.section}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <ArrowRightIcon size={SIZES.iconSize} />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <Modal
        transparent
        animationType="fade"
        visible={isQRModalVisible}
        onRequestClose={handleCloseQRModal}
      >
        <View style={styles.qrModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseQRModal} />
          <View style={styles.qrModalCard}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>QR Code</Text>
              <TouchableOpacity onPress={handleCloseQRModal}>
                <Icon name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.qrToggleRow}>
              {['code', 'scan'].map((mode) => {
                const isActive = qrMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.qrToggle, isActive && styles.qrToggleActive]}
                    onPress={() => {
                      setQrMode(mode);
                      if (mode === 'code') setScanResult(null);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.qrToggleText, isActive && styles.qrToggleTextActive]}>
                      {mode === 'code' ? 'QR Code' : 'Scanner'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {qrMode === 'code' ? (
              <View style={styles.qrCodePreview}>
                <View style={styles.qrSquare}>
                  <Icon name="grid" size={48} color={colors.text} />
                  <Text style={styles.qrCodeLabel}>QR CODE</Text>
                </View>
                <Text style={styles.qrHint}>Show to attendees to share your contact</Text>
              </View>
            ) : (
              <>
                <View style={styles.qrScanArea}>
                  {hasScanPermission === null && (
                    <Text style={styles.qrScanText}>Requesting camera permission...</Text>
                  )}
                  {hasScanPermission === false && (
                    <View style={styles.permissionWrap}>
                      <Text style={styles.permissionText}>Camera permission required</Text>
                      <TouchableOpacity style={styles.scanButton} onPress={requestScannerPermission} activeOpacity={0.85}>
                        <Text style={styles.scanButtonText}>Allow Camera</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {hasScanPermission && isScanning && !scanResult && (
                    <CameraView
                      style={StyleSheet.absoluteFillObject}
                      barcodeScannerSettings={{
                        barcodeTypes: ["qr"],
                      }}
                      onBarcodeScanned={handleBarCodeScanned}
                    />
                  )}
                  {hasScanPermission && !isScanning && !scanResult && (
                    <>
                      <Icon name="maximize" size={28} color={colors.text} />
                      <Text style={styles.qrScanText}>Align QR code within frame</Text>
                      <TouchableOpacity style={styles.scanButtonOverlay} onPress={() => setIsScanning(true)} activeOpacity={0.85}>
                        <Text style={styles.scanButtonText}>Start Scan</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
                {scanResult && (
                  <View style={styles.scanResultCard}>
                    <View style={styles.scanProfileRow}>
                      <View style={styles.scanAvatar}>
                        <Text style={styles.scanAvatarText}>{scanResult.initials}</Text>
                      </View>
                      <View style={styles.scanInfo}>
                        <Text style={styles.scanName}>{scanResult.name}</Text>
                        <Text style={styles.scanRole}>{scanResult.role}</Text>
                        <Text style={styles.scanCompany}>{scanResult.company}</Text>
                      </View>
                    </View>
                    <View style={styles.scanContactRow}>
                      <Icon name="mail" size={16} color={colors.primary} />
                      <Text style={styles.scanContactText}>{scanResult.email}</Text>
                    </View>
                    <View style={styles.scanContactRow}>
                      <Icon name="phone" size={16} color={colors.primary} />
                      <Text style={styles.scanContactText}>{scanResult.phone}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.addContactButton}
                      activeOpacity={0.85}
                      onPress={handleAddScannedContact}
                    >
                      <Text style={styles.addContactText}>Add to Contacts</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (SIZES, isTablet) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  content: {
    width: '100%',
    maxWidth: SIZES.contentMaxWidth,
    alignSelf: 'center',
    // paddingHorizontal: SIZES.paddingHorizontal,
  },
  profileBanner: {
    minHeight: SIZES.bannerMinHeight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZES.sectionSpacing,
    marginTop: SIZES.sectionSpacing - 10,
    marginBottom: SIZES.sectionSpacing,
    borderRadius: 0,
  },
  profilePictureContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  profilePicture: {
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.white,
  },
  profileImagePlaceholder: {
   height: SIZES.profilePictureSize,
   width: SIZES.profilePictureSize,
   borderRadius: SIZES.profilePictureSize / 2,
   alignItems: 'center',
   justifyContent: 'center',
   borderWidth: 4,
   borderColor: colors.white,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    width: SIZES.cameraButtonSize,
    height: SIZES.cameraButtonSize,
    borderRadius: SIZES.cameraButtonSize / 2,
    shadowColor: "black",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: SIZES.cameraButtonSize,
    elevation: 4,
  },
  changePhotoText: {
    color: colors.white,
    fontSize: SIZES.body,
    fontWeight: '500',
  },
  qrCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  qrCodeText: {
    color: colors.white,
    fontSize: SIZES.body,
    fontWeight: '500',
    marginLeft: 6,
  },
  qrModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  qrModalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  qrModalTitle: {
    fontWeight: '700',
    fontSize: 18,
    color: colors.text,
  },
  qrToggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.gray100,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: 16,
  },
  qrToggle: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: 6,
    alignItems: 'center',
  },
  qrToggleActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  qrToggleText: {
    fontWeight: '600',
    color: colors.textMuted,
  },
  qrToggleTextActive: {
    color: colors.text,
  },
  qrCodePreview: {
    alignItems: 'center',
    gap: 10,
  },
  qrSquare: {
    width: 190,
    height: 190,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  qrCodeLabel: {
    marginTop: 8,
    fontWeight: '600',
    color: colors.text,
  },
  qrHint: {
    color: colors.textMuted,
  },
  qrScanArea: {
    height: 220,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: colors.gray50,
  },
  scanButtonOverlay: {
    marginTop: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  qrScanText: {
    marginTop: 10,
    color: colors.textMuted,
  },
  scanButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  scanButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  scanResultCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  scanProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scanAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanAvatarText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 18,
  },
  scanInfo: {
    flex: 1,
  },
  scanName: {
    fontWeight: '700',
    color: colors.text,
  },
  scanRole: {
    color: colors.textMuted,
  },
  scanCompany: {
    color: colors.textMuted,
    fontSize: 12,
  },
  scanContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanContactText: {
    color: colors.text,
  },
  addContactButton: {
    marginTop: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addContactText: {
    color: colors.white,
    fontWeight: '700',
  },
  permissionWrap: {
    alignItems: 'center',
  },
  permissionText: {
    color: colors.textMuted,
    marginBottom: 8,
  },
  section: {
    marginBottom: SIZES.sectionSpacing,
    paddingHorizontal: SIZES.paddingHorizontal,
  },
  sectionTitle: {
    fontSize: SIZES.title,
    fontWeight: '700',
    color: colors.text,
    marginBottom: SIZES.cardSpacing,
  },
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
  },
  fieldContainer: {
    marginBottom: SIZES.sectionSpacing,
  },
  fieldLabel: {
    fontSize: SIZES.body - 1,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 8,
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
    fontSize: SIZES.body - 1,
    color: colors.text,
    textAlignVertical: 'center',
  },
  inputIcon: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -SIZES.iconSize / 2 }],
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    zIndex: 1,
  },
  saveButton: {
    width: '100%',
    marginTop: SIZES.cardSpacing,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    height: SIZES.inputHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.white,
  },
  notificationCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: SIZES.paddingHorizontal,
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: SIZES.body,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  notificationSubtitle: {
    fontSize: SIZES.body - 2,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  notificationDescription: {
    fontSize: SIZES.body - 3,
    fontWeight: '400',
    color: colors.textMuted,
    lineHeight: (SIZES.body - 3) * 1.4,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: radius.md,
    paddingVertical: SIZES.paddingHorizontal,
    marginTop: SIZES.sectionSpacing,
    marginBottom: SIZES.sectionSpacing,
  },
  logoutButtonText: {
    fontSize: SIZES.body + 2 ,
    fontWeight: '700',
    color: '#EF4444',
    marginLeft: 8,
  },
});

export default ProfileScreen;

