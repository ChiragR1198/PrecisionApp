import Icon from '@expo/vector-icons/Feather';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Camera, CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '../../components/common/Header';
import { Icons } from '../../constants/icons';
import { colors, radius } from '../../constants/theme';
import { useDelegateLogoutMutation, useGetDelegateProfileQuery, useGetSponsorProfileQuery, useSaveDelegateContactMutation, useSaveSponsorContactMutation, useSponsorLogoutMutation, useUpdateDelegateProfileMutation, useUpdateSponsorProfileMutation } from '../../store/api';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout as logoutAction } from '../../store/slices/authSlice';
import { normalizeWebsiteUrl } from '../../utils/normalizeWebsiteUrl';

// Utility to strip HTML tags and return plain text
const stripHtmlTags = (value) => {
  if (!value || typeof value !== 'string') return '';

  // If there are no angle brackets, treat it as plain text
  if (!/[<>]/.test(value)) {
    return value.trim();
  }

  // Remove HTML tags
  let text = value.replace(/<[^>]*>/g, ' ');

  // Decode a few common HTML entities we expect from TinyMCE
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&');

  // Collapse extra whitespace
  return text.replace(/\s+/g, ' ').trim();
};

/** Strip BOM and normalize newlines — Android scanners often prefix UTF-8 BOM so vCard detection breaks. */
function normalizeScannedQrPayload(raw) {
  let s = String(raw ?? '');
  s = s.replace(/^\uFEFF/, '');
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return s.trim();
}

/**
 * Android ML Kit passes shortened `displayValue` as `data` but full payload in `raw` (see expo BarcodeAnalyzer).
 * iOS typically only has `data`. Prefer `raw` when it contains more of the vCard.
 */
function pickQrScanPayload(scanningResult) {
  if (!scanningResult || typeof scanningResult !== 'object') return '';
  const data = String(scanningResult.data ?? '');
  const raw = String(scanningResult.raw ?? '');
  if (!raw) return data;
  if (!data) return raw;
  if (raw.length > data.length) return raw;
  if (raw.length === data.length && /BEGIN:VCARD/i.test(raw)) return raw;
  return data;
}

/** Merge structured contact fields ML Kit exposes on Android when QR is TYPE_CONTACT_INFO. */
function mergeAndroidContactExtra(plain, scanningResult) {
  const out = { ...plain };
  const extra = scanningResult?.extra;
  if (!extra || extra.type !== 'contactInfo') return out;
  const first = String(extra.firstName || '').trim();
  const last = String(extra.lastName || '').trim();
  const mid = String(extra.middleName || '').trim();
  const nameFromExtra = [first, mid, last].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (!out.name?.trim() && nameFromExtra) out.name = nameFromExtra;
  if (!String(out.email || '').trim() && extra.email) out.email = String(extra.email).trim();
  if (!String(out.phone || '').trim() && extra.phone) out.phone = String(extra.phone).trim();
  if (!String(out.company || '').trim() && extra.organization) out.company = String(extra.organization).trim();
  if (!String(out.role || '').trim() && extra.title) out.role = String(extra.title).trim();
  if (!String(out.linkedinUrl || '').trim() && extra.urls?.length) {
    const li = extra.urls.find((u) => String(u || '').toLowerCase().includes('linkedin.com'));
    if (li) out.linkedinUrl = String(li).trim();
  }
  return out;
}

/** MECARD format (common on Android / older contact QRs): MECARD:N:Name;TEL:...;EMAIL:...;; */
function parseMecardPayload(text) {
  const t = String(text || '').trim();
  if (!/^MECARD:/i.test(t)) return null;
  const rest = t.replace(/^MECARD:/i, '').replace(/;+$/, '');
  const segments = rest.split(';').filter(Boolean);
  const out = { name: '', role: '', company: '', email: '', phone: '', image: '' };
  for (const seg of segments) {
    const idx = seg.indexOf(':');
    if (idx < 0) continue;
    const k = seg.slice(0, idx).toUpperCase();
    const v = seg.slice(idx + 1).trim();
    if (k === 'N') out.name = out.name || v;
    else if (k === 'ORG') out.company = out.company || v;
    else if (k === 'EMAIL') out.email = out.email || v;
    else if (k === 'TEL' || /^TEL[-_]/i.test(k)) out.phone = out.phone || v;
    else if (k === 'TITLE' || k === 'NOTE') out.role = out.role || v;
  }
  return out.name || out.email || out.phone ? out : null;
}

// Icon Components
const UserIcon = Icons.User;
const MailIcon = Icons.Mail;
const PhoneIcon = Icons.Phone;
const BriefcaseIcon = ({ color = colors.icon, size = 18 }) => (
  <Icon name="briefcase" size={size} color={color} />
);
const MapPinIcon = ({ color = colors.icon, size = 18 }) => (
  <Icon name="map-pin" size={size} color={color} />
);
const LinkIcon = ({ color = colors.icon, size = 18 }) => (
  <Icon name="link" size={size} color={color} />
);
const FileTextIcon = ({ color = colors.icon, size = 18 }) => (
  <Icon name="file-text" size={size} color={color} />
);
const BuildingIcon = ({ color = colors.icon, size = 18 }) => (
  <Icon name="layers" size={size} color={color} />
);

const MAX_BIO_LENGTH = 500;

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
  multiline = false,
  numberOfLines = 1,
  required = false,
}) => (
  <View style={styles.fieldContainer}>
    <Text style={styles.fieldLabel}>
      {label}
      {required && <Text style={styles.requiredAsterisk}> *</Text>}
    </Text>
    <View style={styles.inputContainer}>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        placeholder={placeholder}
        placeholderTextColor={colors.textPlaceholder}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        allowFontScaling={false}
        maxFontSizeMultiplier={1}
        multiline={multiline}
        numberOfLines={numberOfLines}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
      <View style={styles.inputIcon}>
        <IconComponent size={iconSize} />
      </View>
    </View>
  </View>
);

// SMS Icon
const SmsIcon = ({ color = colors.white, size = 18 }) => (
  <Icon name="message-square" size={size} color={color} />
);

// Email Icon
const EmailNotificationIcon = ({ color = colors.white, size = 18 }) => (
  <Icon name="mail" size={size} color={color} />
);

// Notification Settings Card
const NotificationCard = ({ 
  title, 
  subtitle, 
  description, 
  isEnabled, 
  onToggle, 
  styles, 
  SIZES,
  icon: IconComponent 
}) => (
  <View style={styles.notificationCard}>
    <View style={styles.notificationIconContainer}>
      <IconComponent size={SIZES.notificationIconSize} />
    </View>
    <View style={styles.notificationContent}>
      <Text style={styles.notificationTitle}>{title}</Text>
      <Text style={styles.notificationSubtitle}>{subtitle}</Text>
      {description && (
        <Text style={styles.notificationDescription}>
          {description}
        </Text>
      )}
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
  const params = useLocalSearchParams();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const loginType = (user?.login_type || user?.user_type || '').toLowerCase();
  const isDelegate = loginType === 'delegate';
  const userId = user?.id; // Track user ID to detect user changes
  const [delegateLogout] = useDelegateLogoutMutation();
  const [sponsorLogout] = useSponsorLogoutMutation();
  const logoutMutation = isDelegate ? delegateLogout : sponsorLogout;
  
  // Only fetch profile if user is authenticated and logged in
  const shouldSkipDelegate = !isAuthenticated || !user || !isDelegate || !userId;
  const shouldSkipSponsor = !isAuthenticated || !user || isDelegate || !userId;
  
  const { data: delegateProfileData, isLoading: isLoadingDelegateProfile, error: delegateProfileError, refetch: refetchDelegateProfile } = useGetDelegateProfileQuery(undefined, { 
    skip: shouldSkipDelegate,
    refetchOnMountOrArgChange: true, // Force refetch when component mounts
  });
  const { data: sponsorProfileData, isLoading: isLoadingSponsorProfile, error: sponsorProfileError, refetch: refetchSponsorProfile } = useGetSponsorProfileQuery(undefined, { 
    skip: shouldSkipSponsor,
    refetchOnMountOrArgChange: true, // Force refetch when component mounts
  });
  
  // Debug logging
  React.useEffect(() => {
    console.log('ProfileScreen - Current userId:', userId);
    console.log('ProfileScreen - isDelegate:', isDelegate);
    console.log('ProfileScreen - delegateProfileData:', delegateProfileData);
    console.log('ProfileScreen - sponsorProfileData:', sponsorProfileData);
  }, [userId, isDelegate, delegateProfileData, sponsorProfileData]);
  
  const profileData = isDelegate ? delegateProfileData : sponsorProfileData;
  const isLoadingProfile = isDelegate ? isLoadingDelegateProfile : isLoadingSponsorProfile;
  const profileError = isDelegate ? delegateProfileError : sponsorProfileError;
  const refetchProfile = isDelegate ? refetchDelegateProfile : refetchSponsorProfile;
  
  // Track previous user ID and refetch when it changes
  const prevUserIdRef = React.useRef(userId);
  React.useEffect(() => {
    if (userId && userId !== prevUserIdRef.current) {
      // User changed - clear form and force refetch profile
      console.log('User changed from', prevUserIdRef.current, 'to', userId, '- forcing refetch');
      prevUserIdRef.current = userId;
      setFormData({
        fullName: '',
        email: '',
        phoneNumber: '',
        jobTitle: '',
        company: '',
        officeNumber: '',
        country: '',
        state: '',
        address: '',
        linkedinUrl: '',
        bio: '',
        companyInformation: '',
        tel: '',
        fax: '',
      });
      setProfileImage(null);
      // Force refetch after a small delay to ensure cache is cleared
      setTimeout(() => {
        refetchProfile();
      }, 100);
    } else if (!prevUserIdRef.current && userId) {
      // First time userId is set
      prevUserIdRef.current = userId;
      refetchProfile();
    }
  }, [userId, refetchProfile]);
  
  const [updateDelegateProfile, { isLoading: isUpdatingDelegateProfile }] = useUpdateDelegateProfileMutation();
  const [updateSponsorProfile, { isLoading: isUpdatingSponsorProfile }] = useUpdateSponsorProfileMutation();
  const updateProfile = isDelegate ? updateDelegateProfile : updateSponsorProfile;
  const isUpdatingProfile = isDelegate ? isUpdatingDelegateProfile : isUpdatingSponsorProfile;
  const [saveDelegateContact, { isLoading: isSavingContact }] = useSaveDelegateContactMutation();
  const [saveSponsorContact] = useSaveSponsorContactMutation();
  
  // Extract profile data from API response
  const profile = useMemo(() => {
    const data = profileData?.data || profileData || null;
    // Only return profile if it matches current user ID
    if (data && userId && data.id && String(data.id) !== String(userId)) {
      console.log('Profile ID mismatch:', data.id, 'vs userId:', userId);
      return null; // Don't use cached profile from different user
    }
    return data;
  }, [profileData, userId]);

  // Single source of truth for displaying profile info in UI
  // - Prefer matched `profile` (API)
  // - Fallback to `user` only when IDs match (avoid showing stale data)
  const displayProfile = useMemo(() => {
    const safeUser =
      userId && user?.id && String(user.id) === String(userId) ? user : null;
    const src = profile || safeUser || null;
    if (!src) return null;

    const name =
      src.name ||
      src.full_name ||
      `${src.fname || ''} ${src.lname || ''}`.trim() ||
      '';

    const jobTitle = src.job_title || '';
    const company = src.company || '';
    const email = src.email || '';
    const phone = src.mobile || src.phone || '';
    const image = src.image || null;

    const linkedinUrl = src.linkedin_url || '';

    return { name, jobTitle, company, email, phone, image, linkedinUrl };
  }, [profile, user, userId]);
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    jobTitle: '',
    company: '',
    officeNumber: '',
    country: '',
    state: '',
    address: '',
    linkedinUrl: '',
    bio: '',
    companyInformation: '',
    tel: '', // Sponsor only
    fax: '', // Sponsor only
  });
  
  // Update form data when profile loads - only if profile matches current user
  React.useEffect(() => {
    if (profile && userId && profile.id && String(profile.id) === String(userId)) {
      console.log('Updating form data for user:', userId, 'Profile ID:', profile.id);
      
      if (isDelegate) {
        // Delegate profile structure
        setFormData({
          fullName: profile.full_name || `${profile.fname || ''} ${profile.lname || ''}`.trim() || '',
          email: profile.email || '',
          phoneNumber: profile.mobile || '',
          jobTitle: profile.job_title || '',
          company: profile.company || '',
          officeNumber: profile.office_number || '',
          country: profile.country || '',
          state: profile.state || '',
          address: profile.address || '',
          linkedinUrl: profile.linkedin_url || '',
          bio: stripHtmlTags(profile.bio || ''),
          companyInformation: stripHtmlTags(profile.company_information || ''),
          tel: '',
          fax: '',
        });
        // Set notification preferences (delegate only)
        setSmsNotification(profile.sms_notification === 1 || profile.sms_notification === true);
        setEmailNotification(profile.email_notification === 1 || profile.email_notification === true);
      } else {
        // Sponsor profile structure
        setFormData({
          fullName: profile.name || '',
          email: profile.email || '',
          phoneNumber: profile.mobile || '',
          jobTitle: profile.job_title || '',
          company: profile.company || '',
          officeNumber: '',
          country: '',
          state: '',
          address: profile.address || '',
          linkedinUrl: profile.linkedin_url || '',
          bio: stripHtmlTags(profile.biography || ''),
          companyInformation: stripHtmlTags(profile.company_information || ''),
          tel: profile.tel || '',
          fax: profile.fax || '',
        });
        // Sponsors don't have notification preferences in API response
        setSmsNotification(true);
        setEmailNotification(true);
      }
      
      if (profile.image) {
        setProfileImage(profile.image);
      } else {
        setProfileImage(null);
      }
    } else if (!profile && userId) {
      // If no profile but we have userId, clear form (waiting for new data)
      console.log('Clearing form - waiting for profile for user:', userId);
      setFormData({
        fullName: '',
        email: '',
        phoneNumber: '',
        jobTitle: '',
        company: '',
        officeNumber: '',
        country: '',
        state: '',
        address: '',
        linkedinUrl: '',
        bio: '',
        companyInformation: '',
        tel: '',
        fax: '',
      });
      setProfileImage(null);
    }
  }, [profile, userId, isDelegate]);
  
  const [smsNotification, setSmsNotification] = useState(true);
  const [emailNotification, setEmailNotification] = useState(true);
  const [profileImage, setProfileImage] = useState(null); // Can be set to image URI
  const [isQRModalVisible, setIsQRModalVisible] = useState(false);
  const [qrMode, setQrMode] = useState('code');
  const [scanResult, setScanResult] = useState(null);
  const [lastScannedText, setLastScannedText] = useState('');
  const [hasScanPermission, setHasScanPermission] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isImagePickerModalVisible, setIsImagePickerModalVisible] = useState(false);
  const [qrImageError, setQrImageError] = useState(false);
  const [qrImageLoading, setQrImageLoading] = useState(false);
  const [qrImageUri, setQrImageUri] = useState(null);
  const qrImageTimeoutRef = React.useRef(null);
  const openQrScanFromRouteHandledRef = React.useRef(false);
  const qrImageLoadStartRef = React.useRef(false);
  const qrImageLoadingRef = React.useRef(false);
  const qrImageRetryCountRef = React.useRef(0);
  const qrScanDebounceRef = React.useRef(null);
  /** Best { payload, scanningResult } in debounce window (Android needs full `raw` + optional `extra`). */
  const qrScanBestRef = React.useRef(null);
  const [isContactSavedModalVisible, setIsContactSavedModalVisible] = useState(false);
  const [savedContactName, setSavedContactName] = useState('');
  const [isProfileUpdateSuccessModalVisible, setIsProfileUpdateSuccessModalVisible] = useState(false);
  const [isLogoutConfirmModalVisible, setIsLogoutConfirmModalVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
        profilePictureSize: getResponsiveValue({ android: 118, ios: 118, tablet: 138, default: 118 }),
        cameraIconSize: getResponsiveValue({ android: 16, ios: 16, tablet: 18, default: 16 }),
        cameraButtonSize: getResponsiveValue({ android: 34, ios: 34, tablet: 38, default: 34 }),
        profileBannerActionIconSize: getResponsiveValue({ android: 14, ios: 14, tablet: 15, default: 14 }),
        bannerMinHeight: getResponsiveValue({ android: 188, ios: 188, tablet: 208, default: 188 }),
        notificationIconSize: getResponsiveValue({ android: 18, ios: 18, tablet: 20, default: 18 }),
      },
      isTablet: isTabletDevice,
    };
  }, [SCREEN_WIDTH]);

  const styles = useMemo(() => createStyles(SIZES, isTablet), [SIZES, isTablet]);

  const handleInputChange = (field, value) => {
    if (field === 'bio' && typeof value === 'string') {
      value = value.slice(0, MAX_BIO_LENGTH);
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleOpenLinkedIn = () => {
    if (!formData.linkedinUrl) return;
    const url = formData.linkedinUrl.startsWith('http')
      ? formData.linkedinUrl
      : `https://${formData.linkedinUrl}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open LinkedIn profile');
    });
  };

  const handleSaveChanges = async () => {
    try {
      if (!formData.fullName.trim() || !formData.email.trim()) {
        Alert.alert('Missing required fields', 'Please fill in your full name and email before saving.');
        return;
      }

      const formDataToSend = new FormData();
      
      if (isDelegate) {
        // Delegate profile update structure
        // Split fullName into fname and lname
        const nameParts = formData.fullName.trim().split(' ');
        const fname = nameParts[0] || '';
        const lname = nameParts.slice(1).join(' ') || '';
        
        // Add delegate fields to FormData
        formDataToSend.append('fname', fname);
        formDataToSend.append('lname', lname);
        formDataToSend.append('job_title', formData.jobTitle || '');
        formDataToSend.append('company', formData.company || '');
        formDataToSend.append('email', formData.email || '');
        formDataToSend.append('mobile', formData.phoneNumber || '');
        formDataToSend.append('bio', formData.bio || '');
        formDataToSend.append('office_number', formData.officeNumber || '');
        formDataToSend.append('country', formData.country || '');
        formDataToSend.append('state', formData.state || '');
        formDataToSend.append('linkedin_url', formData.linkedinUrl || '');
        formDataToSend.append('company_information', formData.companyInformation || '');
        formDataToSend.append('sms_notification', smsNotification ? '1' : '0');
        formDataToSend.append('email_notification', emailNotification ? '1' : '0');
        
        // Add image if selected
        if (profileImage && profileImage.startsWith('file://')) {
          const imageUri = profileImage;
          const filename = imageUri.split('/').pop() || 'profile.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : 'image/jpeg';
          
          formDataToSend.append('image', {
            uri: imageUri,
            name: filename,
            type: type,
          });
        }
      } else {
        // Sponsor profile update structure
        formDataToSend.append('name', formData.fullName || '');
        formDataToSend.append('job_title', formData.jobTitle || '');
        formDataToSend.append('company', formData.company || '');
        formDataToSend.append('email', formData.email || '');
        formDataToSend.append('biography', formData.bio || '');
        formDataToSend.append('mobile', formData.phoneNumber || '');
        formDataToSend.append('linkedin_url', formData.linkedinUrl || '');
        formDataToSend.append('tel', formData.tel || '');
        formDataToSend.append('address', formData.address || '');
        formDataToSend.append('company_information', formData.companyInformation || '');
        formDataToSend.append('sms_notification', '0');
        formDataToSend.append('email_notification', '0');
        
        // Add image if selected
        if (profileImage && profileImage.startsWith('file://')) {
          const imageUri = profileImage;
          const filename = imageUri.split('/').pop() || 'profile.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : 'image/jpeg';
          
          formDataToSend.append('image', {
            uri: imageUri,
            name: filename,
            type: type,
          });
        }
      }
      
      await updateProfile(formDataToSend).unwrap();
      // Show success modal instead of Alert
      setIsProfileUpdateSuccessModalVisible(true);
      refetchProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', error?.data?.message || error?.message || 'Failed to update profile');
    }
  };

  const handleChangePhoto = () => {
    setIsImagePickerModalVisible(true);
  };

  const handleImagePickerClose = () => {
    setIsImagePickerModalVisible(false);
  };

  const handlePickImage = async (source) => {
    setIsImagePickerModalVisible(false);
    
    try {
      let result;
      
      if (source === 'camera') {
        // Request camera permissions
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
          return;
        }
        
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        // Request media library permissions
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Media library permission is required to select photos.');
          return;
        }
        
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0].uri;
        setProfileImage(selectedImage);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleOpenQRModal = async (options = {}) => {
    const initialMode = options.initialMode || 'code';

    if (initialMode === 'code') {
      const emailForQr = profile?.email || user?.email || formData.email;
      if (!emailForQr || !String(emailForQr).trim()) {
        Alert.alert(
          'Email required',
          'Please add your email address to your profile so your QR code includes it.'
        );
        return;
      }
    }

    if (__DEV__ && initialMode === 'code') {
      console.log(
        '[ProfileScreen][QR] profile-for-display',
        JSON.stringify(displayProfile || null)
      );
    }

    setIsQRModalVisible(true);
    setQrMode(initialMode);
    setScanResult(null);
    setLastScannedText('');
    setHasScanPermission(null);
    setIsScanning(false);
    setQrImageError(false); // Reset error state when opening modal
    setQrImageUri(null); // Reset image URI

    // Clear any existing timeout
    if (qrImageTimeoutRef.current) {
      clearTimeout(qrImageTimeoutRef.current);
      qrImageTimeoutRef.current = null;
    }

    if (initialMode === 'scan') {
      setQrImageLoading(false);
      return;
    }

    // Try to get QR image from multiple sources: profile, user (Redux), or AsyncStorage
    let imageUrl = profile?.qr_image || user?.qr_image;

    // If not found in Redux, try loading from AsyncStorage (from login response)
    if (!imageUrl) {
      try {
        const storedUser = await AsyncStorage.getItem('auth_user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          imageUrl = parsedUser?.qr_image;
        }
      } catch (error) {
        console.error('Error loading QR image from AsyncStorage:', error);
      }
    }

    // Set image URI directly from URL
    if (imageUrl) {
      if (__DEV__) {
        console.log('[ProfileScreen][QR] qr-image-url', String(imageUrl));
      }
      setQrImageUri(imageUrl);
      setQrImageLoading(true); // Will be set to false when image loads
    } else {
      setQrImageLoading(false);
    }
  };

  // Dashboard Quick Action: open Profile QR modal directly in scanner mode (same save-contact flow as Profile)
  React.useEffect(() => {
    const raw = params?.openQrScan;
    const flag = Array.isArray(raw) ? raw[0] : raw;
    if (flag !== '1' && flag !== 'true') {
      openQrScanFromRouteHandledRef.current = false;
      return;
    }
    if (!openQrScanFromRouteHandledRef.current) {
      openQrScanFromRouteHandledRef.current = true;
      handleOpenQRModal({ initialMode: 'scan' });
    }
    try {
      router.setParams({ openQrScan: undefined });
    } catch (_) {
      /* ignore */
    }
  }, [params?.openQrScan]);

  const handleCloseQRModal = () => {
    setIsQRModalVisible(false);
    // Clear timeout when closing modal
    if (qrImageTimeoutRef.current) {
      clearTimeout(qrImageTimeoutRef.current);
      qrImageTimeoutRef.current = null;
    }
    if (qrScanDebounceRef.current) {
      clearTimeout(qrScanDebounceRef.current);
      qrScanDebounceRef.current = null;
    }
    qrScanBestRef.current = null;
  };

  const handleAddScannedContact = async () => {
    if (!scanResult) return;

    try {
      console.log('Saving contact to API:', scanResult);
      
      // Prepare contact data for API
      const contactData = {
        name: scanResult.name || '',
        email: scanResult.email || '',
        phone: scanResult.phone || '',
        company: scanResult.company || '',
        role: scanResult.role || '',
        initials: scanResult.initials || '',
        linkedin_url: scanResult.linkedinUrl || '',
      };

      if (!contactData.name.trim()) {
        Alert.alert('Missing name', 'Could not determine the contact name from this QR code.');
        return;
      }

      console.log('Contact data being sent:', contactData);

      // Call the API to save contact
      const response = isDelegate
        ? await saveDelegateContact(contactData).unwrap()
        : await saveSponsorContact(contactData).unwrap();
      
      console.log('Contact saved successfully:', response);

      // Optimistic local cache so the contact appears even if backend returns blank/non-JSON.
      try {
        const loginType = (user?.login_type || user?.user_type || '').toLowerCase();
        const currentUserId = String(user?.id || user?.user_id || user?.delegate_id || user?.sponsor_id || '');
        if (loginType && currentUserId) {
          const cacheKey = `scanned_contacts_cache_${loginType}_${currentUserId}`;
          const stored = await AsyncStorage.getItem(cacheKey);
          const existing = stored ? JSON.parse(stored) : [];
          const nowIso = new Date().toISOString();
          const entry = {
            id: `local-${Date.now()}`,
            name: contactData.name,
            email: contactData.email,
            phone: contactData.phone,
            company: contactData.company,
            role: contactData.role,
            initials: contactData.initials,
            linkedin_url: contactData.linkedin_url || '',
            scanned_at: nowIso,
            _local: true,
          };
          const deduped = Array.isArray(existing) ? existing.filter((c) => String(c?.email || '').toLowerCase() !== String(entry.email || '').toLowerCase()) : [];
          await AsyncStorage.setItem(cacheKey, JSON.stringify([entry, ...deduped]));
        }
      } catch (e) {
        console.warn('⚠️ Failed to cache scanned contact locally:', e?.message || e);
      }
      
      setIsScanning(false);
      setIsQRModalVisible(false);
      
      // Show custom success modal
      setSavedContactName(scanResult.name);
      setIsContactSavedModalVisible(true);
    } catch (error) {
      // Handle 404 errors specifically
      if (error?.status === 'PARSING_ERROR' || error?.status === 404) {
        const is404 = error?.data?.includes?.('404') || error?.data?.includes?.('Page Not Found');
        if (is404) {
          Alert.alert(
            'Endpoint Not Found (404)', 
            'The save contact endpoint is not available on the server.\n\n' +
            'This endpoint may not be deployed to the staging server yet.\n\n' +
            'Please contact your backend team to deploy the endpoint:\n' +
            (isDelegate ? '/delegate/save-contact' : '/sponsor/save-contact'),
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Endpoint Not Found', 
            'The save contact endpoint was not found on the server. Please check the API configuration.'
          );
        }
      } else {
        // Try to extract error message from HTML response
        let errorMessage = 'Failed to save contact. Please try again.';
        if (error?.data?.message) {
          errorMessage = error.data.message;
        } else if (error?.message && !error.message.includes('<!DOCTYPE')) {
          errorMessage = error.message;
        } else if (error?.data && typeof error.data === 'string' && error.data.includes('404')) {
          errorMessage = 'The API endpoint was not found (404). The endpoint may not be deployed to the staging server yet.';
        }
        
        Alert.alert('Error', errorMessage);
      }
    }
  };

  const requestScannerPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasScanPermission(status === 'granted');
    setIsScanning(status === 'granted');
    setScanResult(null);
  };

  const handleBarCodeScanned = (scanningResult) => {
    const picked = normalizeScannedQrPayload(pickQrScanPayload(scanningResult));
    if (!picked) return;

    const prev = qrScanBestRef.current;
    if (!prev || picked.length >= prev.payload.length) {
      qrScanBestRef.current = { payload: picked, scanningResult };
    }

    if (qrScanDebounceRef.current) clearTimeout(qrScanDebounceRef.current);
    qrScanDebounceRef.current = setTimeout(() => {
      qrScanDebounceRef.current = null;
      const pair = qrScanBestRef.current;
      qrScanBestRef.current = null;
      const final = pair?.payload ?? picked;
      const sr = pair?.scanningResult ?? scanningResult;

      setIsScanning(false);
      setLastScannedText(final);

    const maybeEnrichFromSelfProfile = (built) => {
      if (!built || !displayProfile) return built;

      const raw = String(final || '').toLowerCase();
      const name = String(displayProfile?.name || '').trim();
      const email = String(displayProfile?.email || '').trim();

      // If QR payload includes the email, it's strongly likely this is self.
      const rawHasEmail = !!email && raw.includes(email.toLowerCase());

      // If payload is short and contains both first+last name tokens, also likely self.
      const tokens = name.split(/\s+/).filter(Boolean);
      const first = (tokens[0] || '').toLowerCase();
      const last = (tokens[tokens.length - 1] || '').toLowerCase();
      const rawHasNameTokens =
        raw.length <= 80 && !!first && !!last && raw.includes(first) && raw.includes(last);

      // Only enrich when scan result is missing most fields (so we don't overwrite real contact data)
      const missingMost =
        !built.email && !built.phone && !built.company && !built.role && !built.image;

      if ((rawHasEmail || rawHasNameTokens) && missingMost) {
        return {
          ...built,
          name: displayProfile?.name || built.name,
          role: displayProfile?.jobTitle || built.role,
          company: displayProfile?.company || built.company,
          email: displayProfile?.email || built.email,
          phone: displayProfile?.phone || built.phone,
          image: displayProfile?.image || built.image,
          linkedinUrl: built.linkedinUrl || displayProfile?.linkedinUrl || '',
        };
      }

      return built;
    };
    
    const buildScanResult = (rawResult) => {
      const safe = rawResult || {};
      const clean = (v) => (typeof v === 'string' ? v.trim() : '');

      let name = clean(safe.name);
      const role = clean(safe.role);
      const company = clean(safe.company);
      const email = clean(safe.email);
      const phone = clean(safe.phone);
      const image = clean(safe.image || safe.photo || safe.avatar);
      const linkedinUrl = clean(safe.linkedinUrl || safe.linkedin_url || safe.linkedin);

      if (!name) {
        // Derive a reasonable name fallback (never show "Unknown Contact")
        if (company) name = company;
        else if (email) name = email.split('@')[0];
        else if (phone) name = phone;
        else name = 'Scanned Contact';
      }

      const initialsSource = name || company || email || 'SC';
      const initials =
        initialsSource
          .split(' ')
          .filter(Boolean)
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2) || 'SC';

      return { initials, name, role, company, email, phone, image, linkedinUrl };
    };

    const parseStructuredText = (text) => {
      const t = String(text || '').trim();
      if (!t) return null;

      const isEmail = (v) => /\S+@\S+\.\S+/.test(String(v || '').trim());
      const isPhone = (v) => /^\+?[\d ()-]{7,}$/.test(String(v || '').trim());

      const parseUrlPayload = (raw) => {
        const s = String(raw || '').trim();
        if (!/^https?:\/\//i.test(s)) return null;
        try {
          const url = new URL(s);
          const qp = url.searchParams;
          return buildScanResult({
            name: qp.get('name') || qp.get('full_name') || qp.get('fullName'),
            role: qp.get('title') || qp.get('job_title') || qp.get('role'),
            company: qp.get('company') || qp.get('org') || qp.get('organization'),
            email: qp.get('email'),
            phone: qp.get('phone') || qp.get('mobile') || qp.get('tel'),
            image: qp.get('image') || qp.get('avatar') || qp.get('photo'),
            linkedinUrl: qp.get('linkedin') || qp.get('linkedin_url'),
          });
        } catch {
          return null;
        }
      };

      // Parentheses payload support, commonly seen in generated QR strings:
      // "Name(Email)(Phone) Company", "Name(Company)(Email) Role", "Ronak()() Ronak"
      const parseParensPayload = (raw) => {
        const s = String(raw || '').trim();
        if (!s.includes('(') || !s.includes(')')) return null;

        const isLikelyEventText = (v) => {
          const x = String(v || '').trim();
          if (!x) return false;
          return /\b(summit|conference|congress|expo|event|symposium|meetup|meeting|trials)\b/i.test(x);
        };

        const groups = [...s.matchAll(/\(([^)]*)\)/g)].map((m) => String(m[1] || '').trim());
        if (groups.length === 0) return null;

        const before = s.split('(')[0].trim();
        const after = s.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();

        let email = '';
        let phone = '';
        const rest = [];

        for (const g of groups) {
          if (!g) continue;
          if (!email && isEmail(g)) {
            email = g;
            continue;
          }
          if (!phone && isPhone(g)) {
            phone = g;
            continue;
          }
          rest.push(g);
        }

        // Heuristics for remaining fields
        let company = rest[0] || '';
        let role = rest[1] || '';

        // Ignore event-like bracket text (often embedded in FN)
        if (company && isLikelyEventText(company)) company = '';
        if (role && isLikelyEventText(role)) role = '';

        // Prefer the "after" string as the full name (it already includes suffix tokens like last name)
        // Example: "Jim(Precision Summit) Pang" => after = "Jim Pang"
        let name = after || before;
        if (name && before && name.toLowerCase().startsWith(before.toLowerCase())) {
          name = name.trim();
        }

        // If trailing string is email/phone, capture it instead
        if (after) {
          if (isEmail(after) && !email) email = after;
          if (isPhone(after) && !phone) phone = after;
        }

        // If company looks like a title and role is empty, swap.
        if (!role && company && /\b(manager|developer|engineer|director|vp|ceo|cto|cfo|founder|lead|head)\b/i.test(company)) {
          role = company;
          company = '';
        }

        return buildScanResult({ name, email, phone, company, role });
      };

      // JSON payload support
      if (t.startsWith('{') || t.startsWith('[')) {
        try {
          const obj = JSON.parse(t);
          const o = Array.isArray(obj) ? obj[0] : obj;
          if (o && typeof o === 'object') {
            return buildScanResult({
              name: o.name || o.full_name || o.fullName,
              role: o.title || o.job_title || o.role,
              company: o.company || o.org || o.organization,
              email: o.email,
              phone: o.phone || o.mobile || o.tel,
              image: o.image || o.avatar || o.photo,
              linkedinUrl: o.linkedin_url || o.linkedinUrl || o.linkedin,
            });
          }
        } catch {
          // ignore
        }
      }

      // URL payload support (non-VCARD)
      const urlParsed = parseUrlPayload(t);
      if (urlParsed) return urlParsed;

      // Parentheses payload (non-VCARD)
      const parensParsed = parseParensPayload(t);
      if (parensParsed) return parensParsed;

      // Key-value lines support (e.g. Name:..., Email:...)
      const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const kv = {};
      for (const line of lines) {
        const m = line.match(/^([A-Za-z _-]+)\s*:\s*(.+)$/);
        if (!m) continue;
        kv[m[1].toLowerCase()] = m[2];
      }
      if (Object.keys(kv).length > 0) {
        return buildScanResult({
          name: kv['name'] || kv['full name'] || kv['fullname'],
          role: kv['title'] || kv['job title'] || kv['role'],
          company: kv['company'] || kv['organisation'] || kv['organization'] || kv['org'],
          email: kv['email'],
          phone: kv['phone'] || kv['mobile'] || kv['tel'],
          linkedinUrl: kv['linkedin'] || kv['linkedin url'] || kv['linkedin_url'],
        });
      }

      // mailto / email-only
      const mailtoMatch = t.match(/^mailto:(.+)$/i);
      const possibleEmail = mailtoMatch ? mailtoMatch[1] : t;
      if (isEmail(possibleEmail)) {
        return buildScanResult({ email: possibleEmail });
      }

      // phone-ish
      if (isPhone(t)) {
        return buildScanResult({ phone: t });
      }

      // otherwise treat as name/company
      // also strip summit/event text if it's inside parentheses
      const cleanedName = t.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
      return buildScanResult({ name: cleanedName || t });
    };

    const finalizeBuilt = (built) =>
      buildScanResult(
        mergeAndroidContactExtra(
          {
            name: built.name,
            email: built.email,
            phone: built.phone,
            company: built.company,
            role: built.role,
            image: built.image,
            linkedinUrl: built.linkedinUrl,
          },
          sr
        )
      );

    if (/^MECARD:/i.test(final)) {
      const me = parseMecardPayload(final);
      const built = maybeEnrichFromSelfProfile(
        me ? buildScanResult(me) : buildScanResult({ name: 'Scanned Contact' })
      );
      if (__DEV__) {
        console.log(
          '[ProfileScreen][SCAN] result',
          JSON.stringify({ raw: final, parsed: built, format: 'MECARD' })
        );
      }
      setScanResult(finalizeBuilt(built));
    } else if (/^BEGIN:VCARD/i.test(final)) {
      const parsed = parseVCard(final);
      const built = maybeEnrichFromSelfProfile(buildScanResult(parsed));
      if (__DEV__) {
        console.log(
          '[ProfileScreen][SCAN] result',
          JSON.stringify({ raw: final, parsed: built, format: 'VCARD' })
        );
      }
      setScanResult(finalizeBuilt(built));
    } else {
      const parsed = parseStructuredText(final);
      const built = maybeEnrichFromSelfProfile(parsed || buildScanResult({ name: 'Scanned Contact' }));
      if (__DEV__) {
        console.log(
          '[ProfileScreen][SCAN] result',
          JSON.stringify({ raw: final, parsed: built, format: 'other' })
        );
      }
      setScanResult(finalizeBuilt(built));
    }
    }, 120);
  };

  const parseVCard = (vcard) => {
    // Unfold folded lines (vCard allows CRLF + space/tab continuation)
    const unfolded = String(vcard || '').replace(/\r?\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/);
  
    let contact = {
      name: '',
      phone: '',
      email: '',
      company: '',
      role: '',
      image: '',
      linkedin: '',
    };
  
    lines.forEach((line) => {
      if (!line) return;
      const colonIdx = line.indexOf(':');
      if (colonIdx < 0) return;
      const left = line.slice(0, colonIdx);
      const value = line.slice(colonIdx + 1).trim();

      let key = left.split(';')[0].trim();
      key = key.replace(/^item\d+\./i, ''); // handle item1.EMAIL etc
      key = key.toUpperCase();

      // ✅ Use FN first (formatted name)
      if (key === 'FN') {
        let rawName = value;
  
        // remove content in round brackets (e.g., "(Precision in Clinical Trials Summit Boston)")
        rawName = rawName.replace(/\([^)]*\)/g, '');
  
        // remove empty brackets
        rawName = rawName.replace(/\(\)/g, '');
  
        // normalize spaces
        rawName = rawName.replace(/\s+/g, ' ').trim();
  
        contact.name = rawName;
      }
  
      // fallback only if FN missing
      if (!contact.name && key === 'N') {
        const nameParts = value.split(';');
        let fallbackName = `${nameParts[1] || ''} ${nameParts[0] || ''}`.trim();
        
        // remove content in round brackets (e.g., "(Precision in Clinical Trials Summit Boston)")
        fallbackName = fallbackName.replace(/\([^)]*\)/g, '');
        
        // remove empty brackets
        fallbackName = fallbackName.replace(/\(\)/g, '');
        
        // normalize spaces
        fallbackName = fallbackName.replace(/\s+/g, ' ').trim();
        
        contact.name = fallbackName;
      }
  
      if (key === 'TEL') {
        let phoneValue = String(value || '').replace(/^tel:/i, '').trim();
        if (!contact.phone || contact.phone === '') {
          contact.phone = phoneValue || '';
        }
      }
  
      if (key === 'EMAIL') {
        let emailValue = String(value || '').trim();
        if (/^mailto:/i.test(emailValue)) {
          emailValue = emailValue.replace(/^mailto:/i, '').trim();
        }
        if (!contact.email) contact.email = emailValue;
      }
  
      if (key === 'ORG') {
        const companyValue = value;
        if (!contact.company) contact.company = companyValue;
      }
  
      if (key === 'TITLE' || key === 'ROLE') {
        const roleValue = value;
        if (!contact.role) contact.role = roleValue;
      }

      if (key === 'PHOTO') {
        const photoValue = value;
        if (!contact.image) contact.image = photoValue;
      }

      if (key === 'URL') {
        const u = String(value || '').trim();
        if (!u) {
          /* skip */
        } else if (/linkedin\.com/i.test(u)) {
          contact.linkedin = u;
        } else if (/TYPE=URL/i.test(left) && !contact.linkedin) {
          contact.linkedin = u;
        }
      }
    });
  
    const initials = contact.name
      ? contact.name.split(' ').map(n => n[0]).join('').toUpperCase()
      : 'VC';
  
    const result = {
      initials,
      name: contact.name || '',
      role: contact.role || '',
      company: contact.company || '',
      email: contact.email || '',
      phone: contact.phone || '',
      image: contact.image || '',
      linkedinUrl: contact.linkedin || '',
    };
    
    return result;
  };

  React.useEffect(() => {
    if (qrMode === 'scan' && isQRModalVisible && hasScanPermission === null) {
      requestScannerPermission();
    }
    if (qrMode !== 'scan') {
      setIsScanning(false);
    }
  }, [qrMode, isQRModalVisible]);

  // Reset QR image error when profile or user data changes
  React.useEffect(() => {
    if (profile?.qr_image || user?.qr_image) {
      setQrImageError(false);
      setQrImageLoading(false);
    }
  }, [profile?.qr_image, user?.qr_image]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (qrImageTimeoutRef.current) {
        clearTimeout(qrImageTimeoutRef.current);
        qrImageTimeoutRef.current = null;
      }
      qrImageLoadStartRef.current = false;
      qrImageLoadingRef.current = false;
      qrImageRetryCountRef.current = 0;
    };
  }, []);

  const handleLogout = () => {
    setIsLogoutConfirmModalVisible(true);
  };

  const confirmLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logoutMutation().unwrap();
    } catch (error) {
      console.error('Logout error:', error);
      // Even if API call fails, clear auth and navigate to login
    } finally {
      setIsLoggingOut(false);
      setIsLogoutConfirmModalVisible(false);
      dispatch(logoutAction());
      router.replace('/login');
    }
  };

  // Show loading state
  if (isLoadingProfile) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Header 
          title="Profile" 
          leftIcon="menu" 
          onLeftPress={() => navigation.openDrawer?.()} 
          iconSize={SIZES.headerIconSize} 
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error state
  if (profileError && !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Header 
          title="Profile" 
          leftIcon="menu" 
          onLeftPress={() => navigation.openDrawer?.()} 
          iconSize={SIZES.headerIconSize} 
        />
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color={colors.textMuted} />
          <Text style={styles.errorText}>
            {profileError?.data?.message || profileError?.message || 'Failed to load profile'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={refetchProfile}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
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
                    style={[styles.profileImage, { width: SIZES.profilePictureSize, height: SIZES.profilePictureSize, borderRadius: SIZES.profilePictureSize / 2, }]}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.profileImagePlaceholder}>
                    <UserIcon color={colors.primary} size={SIZES.profilePictureSize * 0.4} />
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.cameraButton}
                onPress={handleChangePhoto}
                activeOpacity={0.8}
              >
                <CameraIcon size={SIZES.cameraIconSize} color={colors.primary}/>
              </TouchableOpacity>
            </View>

            <View style={styles.changePhotoQrRow}>
              <TouchableOpacity
                style={styles.changePhotoButton}
                onPress={handleChangePhoto}
                activeOpacity={0.8}
              >
                <CameraIcon size={SIZES.profileBannerActionIconSize} color={colors.white} />
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.qrCodeButton}
                onPress={handleOpenQRModal}
                activeOpacity={0.8}
              >
                <ScannerIcon size={SIZES.profileBannerActionIconSize} />
                <Text style={styles.qrCodeText}>QR Code</Text>
              </TouchableOpacity>
            </View>
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
                required
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
                required
              />
              
              {/* Hide phone number field for delegate users */}
              {/* {!isDelegate && ( */}
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
              {/* )} */}
              
              <FormField
                label="Job Title"
                value={formData.jobTitle}
                onChangeText={(value) => handleInputChange('jobTitle', value)}
                placeholder="e.g., Software Engineer"
                icon={BriefcaseIcon}
                styles={styles}
                iconSize={SIZES.iconSize}
              />
              
              <FormField
                label="Company"
                value={formData.company}
                onChangeText={(value) => handleInputChange('company', value)}
                placeholder="Company Name"
                icon={BuildingIcon}
                styles={styles}
                iconSize={SIZES.iconSize}
              />
              
              {/* Delegate-only fields */}
              {isDelegate && (
                <>
                  <FormField
                    label="Office Number"
                    value={formData.officeNumber}
                    onChangeText={(value) => handleInputChange('officeNumber', value)}
                    placeholder="Office Phone Number"
                    icon={PhoneIcon}
                    styles={styles}
                    iconSize={SIZES.iconSize}
                    keyboardType="phone-pad"
                  />
                  
                  <FormField
                    label="Country"
                    value={formData.country}
                    onChangeText={(value) => handleInputChange('country', value)}
                    placeholder="Country"
                    icon={MapPinIcon}
                    styles={styles}
                    iconSize={SIZES.iconSize}
                  />
                  
                  <FormField
                    label="State"
                    value={formData.state}
                    onChangeText={(value) => handleInputChange('state', value)}
                    placeholder="State/Province"
                    icon={MapPinIcon}
                    styles={styles}
                    iconSize={SIZES.iconSize}
                  />
                </>
              )}
              
              {/* LinkedIn URL - both delegate and sponsor */}
              <FormField
                label="LinkedIn URL"
                value={formData.linkedinUrl}
                onChangeText={(value) => handleInputChange('linkedinUrl', value)}
                placeholder="https://linkedin.com/in/yourprofile"
                icon={LinkIcon}
                styles={styles}
                iconSize={SIZES.iconSize}
                keyboardType="url"
              />
              {formData.linkedinUrl ? (
                <TouchableOpacity
                  style={styles.linkedinPreviewRow}
                  onPress={handleOpenLinkedIn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.helperText}>
                    Preview:{' '}
                    <Text style={styles.linkedinPreviewText}>
                      {formData.linkedinUrl.replace(/^https?:\/\//, '')}
                    </Text>
                  </Text>
                </TouchableOpacity>
              ) : null}
              
              {/* <FormField
                label="Address"
                value={formData.address}
                onChangeText={(value) => handleInputChange('address', value)}
                placeholder="Street Address"
                icon={MapPinIcon}
                styles={styles}
                iconSize={SIZES.iconSize}
              /> */}
              
              {/* Sponsor-only fields */}
              {/* {!isDelegate && ( */}
                <>
                  <FormField
                    label="Tel"
                    value={formData.tel}
                    onChangeText={(value) => handleInputChange('tel', value)}
                    placeholder="Telephone Number"
                    icon={PhoneIcon}
                    styles={styles}
                    iconSize={SIZES.iconSize}
                    keyboardType="phone-pad"
                  />
                  
                  <FormField
                    label="Fax"
                    value={formData.fax}
                    onChangeText={(value) => handleInputChange('fax', value)}
                    placeholder="Fax Number"
                    icon={PhoneIcon}
                    styles={styles}
                    iconSize={SIZES.iconSize}
                    keyboardType="phone-pad"
                  />
                </>
              {/* )} */}
              
              <FormField
                label={isDelegate ? "Bio" : "Biography"}
                value={formData.bio}
                onChangeText={(value) => handleInputChange('bio', value)}
                placeholder={isDelegate ? "Tell us about yourself..." : "Biography"}
                icon={FileTextIcon}
                styles={styles}
                iconSize={SIZES.iconSize}
                multiline={true}
                numberOfLines={4}
              />
              <View style={styles.bioCounterRow}>
                <Text style={styles.bioCounterText}>
                  {formData.bio.length}/{MAX_BIO_LENGTH} characters
                </Text>
              </View>
              
              <FormField
                label="Company Information"
                value={formData.companyInformation}
                onChangeText={(value) => handleInputChange('companyInformation', value)}
                placeholder="Company details and information..."
                icon={FileTextIcon}
                styles={styles}
                iconSize={SIZES.iconSize}
                multiline={true}
                numberOfLines={4}
              />
            </View>

            {/* Settings Section - Delegate only */}
            {/* {isDelegate && ( */}
              <View style={styles.notificationSection}>
                <Text style={styles.sectionTitle}>Notification Settings</Text>
                
                <View style={styles.profileCard}>
                  <NotificationCard
                    title="SMS Notifications"
                    subtitle="Text Messages"
                    description="Receive important updates via SMS"
                    isEnabled={smsNotification}
                    onToggle={setSmsNotification}
                    styles={styles}
                    SIZES={SIZES}
                    icon={SmsIcon}
                  />
                  
                  <View style={styles.notificationDivider} />
                  
                  <NotificationCard
                    title="Email Notifications"
                    subtitle="Email Updates"
                    description="Receive notifications via email"
                    isEnabled={emailNotification}
                    onToggle={setEmailNotification}
                    styles={styles}
                    SIZES={SIZES}
                    icon={EmailNotificationIcon}
                  />
                </View>
              </View>
            {/* )} */}

            {/* Save Changes Button */}
            <View style={styles.saveButtonSection}>
              <TouchableOpacity
                style={[styles.saveButton, isUpdatingProfile && styles.saveButtonDisabled]}
                onPress={handleSaveChanges}
                activeOpacity={0.9}
                disabled={isUpdatingProfile}
              >
                <LinearGradient
                  colors={colors.gradient}
                  style={styles.saveButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {isUpdatingProfile ? (
                    <View style={styles.saveButtonLoadingContainer}>
                      <ActivityIndicator size="small" color={colors.white} />
                      <Text style={styles.saveButtonText}>Saving...</Text>
                    </View>
                  ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
            
            {/* Events Section */}
            {/* {profile?.events && profile.events.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>My Events</Text>
                <View style={styles.profileCard}>
                  {profile.events.map((event, index) => (
                    <View 
                      key={event.id || index} 
                      style={[
                        styles.eventItem,
                        index === profile.events.length - 1 && styles.eventItemLast
                      ]}
                    >
                      <View style={styles.eventIconContainer}>
                        <Icon name="calendar" size={SIZES.iconSize} color={colors.primary} />
                      </View>
                      <View style={styles.eventContent}>
                        <Text style={styles.eventTitle}>{event.title}</Text>
                        <Text style={styles.eventId}>Event ID: {event.id}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )} */}
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

            <ScrollView
              style={styles.qrModalBody}
              contentContainerStyle={styles.qrModalBodyContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {qrMode === 'code' ? (
                <View style={styles.qrCodePreview}>
                  <View style={styles.qrSquare}>
                    {(qrImageUri || profile?.qr_image || user?.qr_image) && !qrImageError ? (
                      <>
                        <Image
                          key={`qr-${qrImageUri || profile?.qr_image || user?.qr_image}`}
                          source={{
                            uri: qrImageUri || profile?.qr_image || user?.qr_image || '',
                          }}
                          style={styles.qrCodeImage}
                          resizeMode="contain"
                          onLoad={() => {
                            if (qrImageTimeoutRef.current) {
                              clearTimeout(qrImageTimeoutRef.current);
                              qrImageTimeoutRef.current = null;
                            }
                            setQrImageLoading(false);
                            setQrImageError(false);
                          }}
                          onError={(error) => {
                            console.error('QR code image failed to load:', error);
                            if (qrImageTimeoutRef.current) {
                              clearTimeout(qrImageTimeoutRef.current);
                              qrImageTimeoutRef.current = null;
                            }
                            setQrImageError(true);
                            setQrImageLoading(false);
                          }}
                        />
                        {qrImageLoading && (
                          <View style={styles.qrLoadingOverlay}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={styles.qrLoadingText}>Loading QR code...</Text>
                          </View>
                        )}
                      </>
                    ) : (
                      <>
                        <Icon name="grid" size={48} color={colors.text} />
                        <Text style={styles.qrCodeLabel}>QR CODE</Text>
                      </>
                    )}
                  </View>
                  <Text style={styles.qrHint}>
                    {isDelegate
                      ? 'Show to sponsors to share your contact'
                      : 'Show to delegates to share your contact'}
                  </Text>

                  {/* Profile info under QR */}
                  <View style={styles.qrProfileCard}>
                    <View style={styles.qrProfileRow}>
                      <View style={styles.qrProfileAvatar}>
                        {displayProfile?.image ? (
                          <Image
                            source={{ uri: displayProfile.image }}
                            style={styles.qrProfileAvatarImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <Text style={styles.qrProfileAvatarText}>
                            {String(displayProfile?.name || 'U')
                              .split(' ')
                              .filter(Boolean)
                              .map((p) => p[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </Text>
                        )}
                      </View>
                      <View style={styles.qrProfileInfo}>
                        <Text style={styles.qrProfileName} numberOfLines={1}>
                          {displayProfile?.name || '—'}
                        </Text>
                        <Text style={styles.qrProfileMeta} numberOfLines={1}>
                          {displayProfile?.jobTitle || '—'}
                        </Text>
                        <Text style={styles.qrProfileMeta} numberOfLines={1}>
                          {displayProfile?.company || '—'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.qrProfileContactRow}>
                      <Icon name="mail" size={14} color={colors.primary} />
                      <Text style={styles.qrProfileContactText} numberOfLines={1}>
                        {displayProfile?.email || '—'}
                      </Text>
                    </View>
                    <View style={styles.qrProfileContactRow}>
                      <Icon name="phone" size={14} color={colors.primary} />
                      <Text style={styles.qrProfileContactText} numberOfLines={1}>
                        {displayProfile?.phone || '—'}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.qrScanAreaContainer}>
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
                      {hasScanPermission && !!scanResult && (
                        <TouchableOpacity
                          style={styles.scanRetryInBox}
                          activeOpacity={0.85}
                          onPress={() => {
                            setScanResult(null);
                            setIsScanning(true);
                          }}
                        >
                          <Icon name="rotate-ccw" size={18} color={colors.primary} />
                          <Text style={styles.scanRetryInBoxText}>Scan again</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.qrHint}>Scan QR code to add contact</Text>
                  </View>
                  {scanResult && (
                    <View style={styles.scanResultCard}>
                      <View style={styles.scanProfileRow}>
                        <View style={styles.scanAvatar}>
                          {scanResult.image ? (
                            <Image
                              source={{ uri: scanResult.image }}
                              style={styles.scanAvatarImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <Text style={styles.scanAvatarText}>{scanResult.initials}</Text>
                          )}
                        </View>
                        <View style={styles.scanInfo}>
                          <Text style={styles.scanName} numberOfLines={1}>
                            {scanResult.name || '—'}
                          </Text>
                          <Text style={styles.scanMeta} numberOfLines={1}>
                            {scanResult.role || '—'}
                          </Text>
                          <Text style={styles.scanMeta} numberOfLines={1}>
                            {scanResult.company || '—'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.scanContactLine}>
                        <Icon name="mail" size={14} color={colors.primary} />
                        <Text style={styles.scanContactLineText} numberOfLines={1}>
                          {scanResult.email || '—'}
                        </Text>
                      </View>
                      <View style={styles.scanContactLine}>
                        <Icon name="phone" size={14} color={colors.primary} />
                        <Text style={styles.scanContactLineText} numberOfLines={1}>
                          {scanResult.phone || '—'}
                        </Text>
                      </View>
                      {!!scanResult.linkedinUrl?.trim() && (
                        <TouchableOpacity
                          style={styles.scanContactLine}
                          activeOpacity={0.75}
                          onPress={() => {
                            const url = normalizeWebsiteUrl(scanResult.linkedinUrl);
                            if (url) Linking.openURL(url);
                          }}
                        >
                          <Icon name="link" size={14} color={colors.primary} />
                          <Text style={[styles.scanContactLineText, styles.scanLinkedinText]} numberOfLines={2}>
                            {String(scanResult.linkedinUrl).replace(/^https?:\/\//, '')}
                          </Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.addContactButton, isSavingContact && styles.addContactButtonDisabled]}
                        activeOpacity={0.85}
                        onPress={handleAddScannedContact}
                        disabled={isSavingContact}
                      >
                        {isSavingContact ? (
                          <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                          <Text style={styles.addContactText}>Add to Contacts</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Image Picker Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isImagePickerModalVisible}
        onRequestClose={handleImagePickerClose}
      >
        <Pressable style={styles.imagePickerBackdrop} onPress={handleImagePickerClose}>
          <View style={styles.imagePickerContainer}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.imagePickerCard}>
                <Text style={styles.imagePickerTitle}>Select Photo</Text>
                
                <TouchableOpacity
                  style={styles.imagePickerOption}
                  onPress={() => handlePickImage('camera')}
                  activeOpacity={0.7}
                >
                  <Icon name="camera" size={24} color={colors.primary} />
                  <Text style={styles.imagePickerOptionText}>Take Photo</Text>
                </TouchableOpacity>
                
                <View style={styles.imagePickerDivider} />
                
                <TouchableOpacity
                  style={styles.imagePickerOption}
                  onPress={() => handlePickImage('gallery')}
                  activeOpacity={0.7}
                >
                  <Icon name="image" size={24} color={colors.primary} />
                  <Text style={styles.imagePickerOptionText}>Choose from Gallery</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.imagePickerCancel}
                  onPress={handleImagePickerClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.imagePickerCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Contact Saved Success Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isContactSavedModalVisible}
        onRequestClose={() => setIsContactSavedModalVisible(false)}
      >
        <View style={styles.contactSavedModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsContactSavedModalVisible(false)} />
          <View style={styles.contactSavedModalCard}>
            <View style={styles.contactSavedIconContainer}>
              <Icon name="check-circle" size={64} color={colors.primary} />
            </View>
            <Text style={styles.contactSavedTitle}>Contact Saved</Text>
            <Text style={styles.contactSavedMessage}>
              {savedContactName} was added to Contacts.
            </Text>
            <View style={styles.contactSavedButtonRow}>
              <TouchableOpacity
                style={styles.contactSavedButtonSecondary}
                onPress={() => setIsContactSavedModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.contactSavedButtonSecondaryText}>OK</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.contactSavedButtonPrimary}
                onPress={() => {
                  setIsContactSavedModalVisible(false);
                  router.push('/contacts');
                }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={colors.gradient}
                  style={styles.contactSavedButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.contactSavedButtonPrimaryText}>View Contacts</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Profile Update Success Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isProfileUpdateSuccessModalVisible}
        onRequestClose={() => setIsProfileUpdateSuccessModalVisible(false)}
      >
        <View style={styles.contactSavedModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsProfileUpdateSuccessModalVisible(false)} />
          <View style={styles.contactSavedModalCard}>
            <View style={styles.contactSavedIconContainer}>
              <Icon name="check-circle" size={64} color={colors.primary} />
            </View>
            <Text style={styles.contactSavedTitle}>Profile Updated</Text>
            <Text style={styles.contactSavedMessage}>
              Your profile has been updated successfully!
            </Text>
            <TouchableOpacity
              style={styles.profileUpdateSuccessButton}
              onPress={() => setIsProfileUpdateSuccessModalVisible(false)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={colors.gradient}
                style={styles.contactSavedButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.contactSavedButtonPrimaryText}>OK</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Logout Confirm Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isLogoutConfirmModalVisible}
        onRequestClose={() => setIsLogoutConfirmModalVisible(false)}
      >
        <View style={styles.contactSavedModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsLogoutConfirmModalVisible(false)} />
          <View style={styles.contactSavedModalCard}>
            <View style={styles.contactSavedIconContainer}>
              <Icon name="log-out" size={56} color={colors.primary} />
            </View>
            <Text style={styles.contactSavedTitle}>Logout</Text>
            <Text style={styles.contactSavedMessage}>
              Are you sure you want to logout?
            </Text>
            <View style={styles.contactSavedButtonRow}>
              <TouchableOpacity
                style={styles.contactSavedButtonSecondary}
                onPress={() => setIsLogoutConfirmModalVisible(false)}
                activeOpacity={0.8}
                disabled={isLoggingOut}
              >
                <Text style={styles.contactSavedButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contactSavedButtonPrimary, { opacity: isLoggingOut ? 0.7 : 1 }]}
                onPress={confirmLogout}
                activeOpacity={0.8}
                disabled={isLoggingOut}
              >
                <LinearGradient
                  colors={colors.gradient}
                  style={styles.contactSavedButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {isLoggingOut ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.contactSavedButtonPrimaryText}>Logout</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
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
    marginBottom: 8,
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
  profileImage: {
    width: '100%',
    height: '100%',
  },
  cameraButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
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
  changePhotoQrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    width: '100%',
    paddingHorizontal: 20,
  },
  changePhotoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  changePhotoText: {
    color: colors.white,
    fontSize: Math.max(12, SIZES.body - 2),
    fontWeight: '500',
  },
  qrCodeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  qrCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  qrCodeText: {
    color: colors.white,
    fontSize: Math.max(12, SIZES.body - 2),
    fontWeight: '500',
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
    maxHeight: '88%',
  },
  qrModalBody: {
    flexGrow: 0,
  },
  qrModalBodyContent: {
    paddingBottom: 8,
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
    minHeight: 220,
    justifyContent: 'center',
  },
  qrSquare: {
    width: 220,
    height: 220,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  qrCodeImage: {
    width: '100%',
    height: '100%',
  },
  qrLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  qrLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  qrLoadingText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
  },
  qrCodeLabel: {
    marginTop: 8,
    fontWeight: '600',
    color: colors.text,
  },
  qrHint: {
    color: colors.textMuted,
  },
  qrProfileCard: {
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
  },
  qrProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  qrProfileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  qrProfileAvatarImage: {
    width: '100%',
    height: '100%',
  },
  qrProfileAvatarText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 16,
  },
  qrProfileInfo: {
    flex: 1,
  },
  qrProfileName: {
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  qrProfileMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  qrProfileContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  qrProfileContactText: {
    flex: 1,
    color: colors.text,
    fontWeight: '600',
    fontSize: 12,
  },
  qrScanAreaContainer: {
    alignItems: 'center',
    gap: 10,
    minHeight: 220,
    justifyContent: 'center',
  },
  qrScanArea: {
    width: 220,
    height: 220,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray50,
    overflow: 'hidden',
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
  scanRetryInBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scanRetryInBoxText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
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
    overflow: 'hidden',
  },
  scanAvatarImage: {
    width: '100%',
    height: '100%',
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
  scanMeta: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '500',
    color: colors.textMuted,
  },
  scanContactLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanContactLineText: {
    flex: 1,
    color: colors.text,
  },
  scanLinkedinText: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  scanRawText: {
    marginTop: 10,
    fontSize: 11,
    color: colors.textMuted,
  },
  scanDetailRow: {
    marginTop: 10,
  },
  scanDetailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
  },
  scanDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  scanContactStack: {
    gap: 6,
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
  addContactButtonDisabled: {
    opacity: 0.6,
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
    paddingHorizontal: SIZES.paddingHorizontal + 5,
  },
  notificationSection: {
    marginBottom: SIZES.sectionSpacing,
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
  requiredAsterisk: {
    color: '#EF4444',
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
  inputMultiline: {
    height: 100,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
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
  helperText: {
    fontSize: SIZES.body - 3,
    color: colors.textMuted,
  },
  linkedinPreviewRow: {
    marginTop: -8,
    marginBottom: SIZES.cardSpacing,
  },
  linkedinPreviewText: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  bioCounterRow: {
    alignItems: 'flex-end',
    marginTop: -8,
    marginBottom: SIZES.cardSpacing,
  },
  bioCounterText: {
    fontSize: SIZES.body - 3,
    color: colors.textMuted,
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
  saveButtonLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  notificationCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: SIZES.paddingHorizontal,
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
    marginHorizontal: SIZES.paddingHorizontal,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: colors.textMuted,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  errorText: {
    marginTop: 16,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  retryButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  eventIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(138, 52, 144, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  eventId: {
    fontSize: SIZES.body - 2,
    color: colors.textMuted,
  },
  eventItemLast: {
    borderBottomWidth: 0,
  },
  imagePickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  imagePickerContainer: {
    width: '100%',
  },
  imagePickerCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    paddingHorizontal: 20,
  },
  imagePickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  imagePickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  imagePickerOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginLeft: 16,
  },
  imagePickerDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  imagePickerCancel: {
    marginTop: 8,
    paddingVertical: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  imagePickerCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  contactSavedModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  contactSavedModalCard: {
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
  contactSavedIconContainer: {
    marginBottom: 16,
  },
  contactSavedTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  contactSavedMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  contactSavedButtonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  contactSavedButtonSecondary: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  contactSavedButtonSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  contactSavedButtonPrimary: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  contactSavedButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactSavedButtonPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
  profileUpdateSuccessButton: {
    width: '100%',
    height: 48,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
});

export default ProfileScreen;

