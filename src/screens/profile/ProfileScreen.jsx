import Icon from '@expo/vector-icons/Feather';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Camera, CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '../../components/common/Header';
import { Icons } from '../../constants/icons';
import { colors, radius } from '../../constants/theme';
import { useDelegateLogoutMutation, useGetDelegateProfileQuery, useGetSponsorProfileQuery, useSaveDelegateContactMutation, useSponsorLogoutMutation, useUpdateDelegateProfileMutation, useUpdateSponsorProfileMutation } from '../../store/api';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout as logoutAction } from '../../store/slices/authSlice';

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
}) => (
  <View style={styles.fieldContainer}>
    <Text style={styles.fieldLabel}>{label}</Text>
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
  
  const [updateDelegateProfile] = useUpdateDelegateProfileMutation();
  const [updateSponsorProfile] = useUpdateSponsorProfileMutation();
  const updateProfile = isDelegate ? updateDelegateProfile : updateSponsorProfile;
  const [saveDelegateContact, { isLoading: isSavingContact }] = useSaveDelegateContactMutation();
  
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
          bio: profile.bio || '',
          companyInformation: profile.company_information || '',
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
          linkedinUrl: '',
          bio: profile.biography || '',
          companyInformation: profile.company_information || '',
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
  const [hasScanPermission, setHasScanPermission] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isImagePickerModalVisible, setIsImagePickerModalVisible] = useState(false);
  const [qrImageError, setQrImageError] = useState(false);
  const [qrImageLoading, setQrImageLoading] = useState(false);
  const [qrImageUri, setQrImageUri] = useState(null);
  const qrImageTimeoutRef = React.useRef(null);
  const qrImageLoadStartRef = React.useRef(false);
  const qrImageLoadingRef = React.useRef(false);
  const qrImageRetryCountRef = React.useRef(0);

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

  const handleSaveChanges = async () => {
    try {
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
      Alert.alert('Success', 'Profile updated successfully!');
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

  const handleOpenQRModal = async () => {
    console.log('========================================');
    console.log('📱 QR MODAL OPENING - DATA CHECK');
    console.log('========================================');
    
    setIsQRModalVisible(true);
    setQrMode('code');
    setScanResult(null);
    setHasScanPermission(null);
    setIsScanning(false);
    setQrImageError(false); // Reset error state when opening modal
    setQrImageLoading(false); // Reset loading state
    setQrImageUri(null); // Reset image URI
    qrImageLoadStartRef.current = false; // Reset load start flag
    qrImageLoadingRef.current = false; // Reset loading ref
    qrImageRetryCountRef.current = 0; // Reset retry count
    
    // Clear any existing timeout
    if (qrImageTimeoutRef.current) {
      clearTimeout(qrImageTimeoutRef.current);
      qrImageTimeoutRef.current = null;
    }
    
    // Log all available data sources
    console.log('📊 Profile Data:', JSON.stringify(profile, null, 2));
    console.log('📊 Profile qr_image:', profile?.qr_image);
    console.log('📊 User Data (Redux):', JSON.stringify(user, null, 2));
    console.log('📊 User qr_image (Redux):', user?.qr_image);
    console.log('📊 Current qrImageUri state:', qrImageUri);
    
    // Try to get QR image from multiple sources: profile, user (Redux), or AsyncStorage
    let imageUrl = profile?.qr_image || user?.qr_image;
    
    // If not found in Redux, try loading from AsyncStorage (from login response)
    if (!imageUrl) {
      try {
        const storedUser = await AsyncStorage.getItem('auth_user');
        console.log('📦 AsyncStorage auth_user (raw):', storedUser);
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          console.log('📦 AsyncStorage auth_user (parsed):', JSON.stringify(parsedUser, null, 2));
          imageUrl = parsedUser?.qr_image;
          console.log('📦 AsyncStorage qr_image:', imageUrl);
        } else {
          console.log('⚠️ No auth_user found in AsyncStorage');
        }
      } catch (error) {
        console.error('❌ Error loading QR image from AsyncStorage:', error);
      }
    }
    
    // Final decision
    console.log('✅ Final QR Image URL to use:', imageUrl);
    console.log('========================================');
    
    // Set image URI directly from URL
    if (imageUrl) {
      setQrImageUri(imageUrl);
    } else {
      console.log('⚠️ No QR image URL found from any source!');
    }
  };

  const handleCloseQRModal = () => {
    setIsQRModalVisible(false);
    // Clear timeout when closing modal
    if (qrImageTimeoutRef.current) {
      clearTimeout(qrImageTimeoutRef.current);
      qrImageTimeoutRef.current = null;
    }
  };

  const handleAddScannedContact = async () => {
    if (!scanResult) return;
    
    // Only allow delegate users to save contacts
    if (!isDelegate) {
      Alert.alert('Error', 'Only delegate users can save contacts.');
      return;
    }

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
      };

      console.log('Contact data being sent:', contactData);

      // Call the API to save contact
      const response = await saveDelegateContact(contactData).unwrap();
      
      console.log('Contact saved successfully:', response);
      
      setIsScanning(false);
      setIsQRModalVisible(false);
      
      Alert.alert(
        'Contact Saved', 
        `${scanResult.name} was added to Contacts.`, 
        [
          { text: 'OK' },
          { text: 'View Contacts', onPress: () => router.push('/contacts') },
        ]
      );
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
            '/delegate/save-contact',
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

  const handleBarCodeScanned = ({ data }) => {
    console.log('========================================');
    console.log('📷 QR CODE SCANNED - DATA ANALYSIS');
    console.log('========================================');
    
    setIsScanning(false);
    
    // Console log the raw QR code data
    console.log('📄 Raw QR Data:', data);
    console.log('📄 Data Type:', typeof data);
    console.log('📄 Data Length:', data?.length);
    console.log('📄 Is VCARD:', data?.startsWith('BEGIN:VCARD'));
    console.log('📄 First 100 characters:', data?.substring(0, 100));
    
    if (data.startsWith('BEGIN:VCARD')) {
      console.log('✅ Processing VCARD format...');
      const parsed = parseVCard(data);
      console.log('📋 Parsed VCARD Contact (Full):', JSON.stringify(parsed, null, 2));
      console.log('📋 Parsed Contact Details:', {
        name: parsed.name,
        phone: parsed.phone,
        email: parsed.email,
        company: parsed.company,
        role: parsed.role,
        initials: parsed.initials,
      });
      setScanResult(parsed);
      console.log('✅ Scan result set to state');
    } else {
      // Try to parse plain text QR code
      console.log('⚠️ Processing non-VCARD QR code...');
      const parsedText = parsePlainTextQR(data);
      console.log('📋 Parsed Plain Text Result:', JSON.stringify(parsedText, null, 2));
      console.log('📄 QR Code Content (Full):', data);
      setScanResult(parsedText);
      console.log('✅ Parsed result set to state');
    }
    console.log('========================================');
  };

  // Parse plain text QR code to extract contact information
  const parsePlainTextQR = (text) => {
    console.log('--- Parsing Plain Text QR ---');
    console.log('Text:', text);
    
    // Try to extract name and company/event from patterns like:
    // "Name (Event Name)" or "Name - Company" or just "Name"
    let name = '';
    let company = '';
    let role = '';
    let email = '';
    let phone = '';
    
    // Extract email (pattern: text with @ symbol)
    const emailPattern = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
    const emailMatch = text.match(emailPattern);
    if (emailMatch && emailMatch.length > 0) {
      email = emailMatch[0].trim();
      console.log('✅ Email found:', email);
      // Remove email from text for further parsing
      text = text.replace(emailPattern, '').trim();
    }
    
    // Extract phone number (pattern: + followed by digits, or digits with spaces/dashes)
    const phonePatterns = [
      /\+?[\d\s\-\(\)]{10,}/g, // International format: +1234567890 or (123) 456-7890
      /\d{10,}/g, // Simple 10+ digits
    ];
    
    for (const pattern of phonePatterns) {
      const phoneMatch = text.match(pattern);
      if (phoneMatch && phoneMatch.length > 0) {
        // Take the longest match (most likely to be a phone number)
        const potentialPhone = phoneMatch.sort((a, b) => b.length - a.length)[0];
        // Validate it's likely a phone number (at least 10 digits)
        const digitsOnly = potentialPhone.replace(/\D/g, '');
        if (digitsOnly.length >= 10) {
          phone = potentialPhone.trim();
          console.log('✅ Phone found:', phone);
          // Remove phone from text for further parsing
          text = text.replace(phone, '').trim();
          break;
        }
      }
    }
    
    // Pattern 1: "Name (Event/Company)"
    const pattern1 = /^(.+?)\s*\((.+?)\)\s*$/;
    const match1 = text.match(pattern1);
    if (match1) {
      name = match1[1].trim();
      company = match1[2].trim();
      console.log('✅ Pattern 1 matched - Name:', name, 'Company:', company);
    } else {
      // Pattern 2: "Name - Company" or "Name | Company"
      const pattern2 = /^(.+?)\s*[-|]\s*(.+?)$/;
      const match2 = text.match(pattern2);
      if (match2) {
        name = match2[1].trim();
        company = match2[2].trim();
        console.log('✅ Pattern 2 matched - Name:', name, 'Company:', company);
      } else {
        // Pattern 3: Just use the whole text as name (after removing email/phone)
        name = text.trim();
        company = '';
        console.log('⚠️ No pattern matched - Using full text as name:', name);
      }
    }
    
    // Extract initials from name
    const initials = name
      ? name.split(' ').map(n => n[0]).filter(Boolean).join('').toUpperCase().substring(0, 2)
      : 'QR';
    
    const result = {
      initials,
      name: name || 'Unknown Contact',
      role: role || 'Scanned via QR',
      company: company || 'N/A',
      email: email || 'N/A',
      phone: phone || 'N/A',
    };
    
    console.log('Final Parsed Result:', result);
    console.log('--- End Parsing Plain Text QR ---');
    
    return result;
  };

  const parseVCard = (vcard) => {
    console.log('--- Parsing VCARD ---');
    console.log('VCARD Raw String:', vcard);
    const lines = vcard.split(/\r?\n/);
    console.log('VCARD Lines Count:', lines.length);
    console.log('VCARD Lines:', lines);
  
    let contact = {
      name: '',
      phone: '',
      email: '',
      company: '',
      role: '',
    };
  
    lines.forEach((line, index) => {
      // ✅ Use FN first (formatted name)
      if (line.startsWith('FN:')) {
        let rawName = line.replace('FN:', '').trim();
        console.log(`Line ${index} - Found FN:`, rawName);
  
        // remove ()
        rawName = rawName.replace(/\(\)/g, '');
  
        // normalize spaces
        rawName = rawName.replace(/\s+/g, ' ').trim();
  
        contact.name = rawName;
        console.log(`Line ${index} - Processed Name:`, contact.name);
      }
  
      // fallback only if FN missing
      if (!contact.name && line.startsWith('N:')) {
        const parts = line.replace('N:', '').split(';');
        contact.name = `${parts[1] || ''} ${parts[0] || ''}`.trim();
        console.log(`Line ${index} - Found N (fallback):`, contact.name);
      }
  
      if (line.startsWith('TEL')) {
        const phoneValue = line.split(':')[1]?.trim();
        // Use first phone number found, or if empty, assign the value
        if (!contact.phone || contact.phone === '') {
          contact.phone = phoneValue || '';
        }
        console.log(`Line ${index} - Found TEL:`, phoneValue, '| Assigned phone:', contact.phone);
      }
  
      if (line.startsWith('EMAIL')) {
        const emailValue = line.split(':')[1]?.trim();
        contact.email = emailValue;
        console.log(`Line ${index} - Found EMAIL:`, emailValue);
      }
  
      if (line.startsWith('ORG')) {
        const companyValue = line.split(':')[1]?.trim();
        contact.company = companyValue;
        console.log(`Line ${index} - Found ORG:`, companyValue);
      }
  
      if (line.startsWith('TITLE')) {
        const roleValue = line.split(':')[1]?.trim();
        contact.role = roleValue;
        console.log(`Line ${index} - Found TITLE:`, roleValue);
      }
    });
  
    console.log('Parsed Contact Object:', contact);
  
    const initials = contact.name
      ? contact.name.split(' ').map(n => n[0]).join('').toUpperCase()
      : 'VC';
  
    const result = {
      initials,
      name: contact.name || 'Unknown Contact',
      role: contact.role || '',
      company: contact.company || '',
      email: contact.email || 'N/A',
      phone: contact.phone || 'N/A',
    };
    
    console.log('Final Parsed Result:', result);
    console.log('--- End Parsing VCARD ---');
    
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

  // Load QR image from AsyncStorage on mount or when user changes
  React.useEffect(() => {
    const loadQRImageFromStorage = async () => {
      // Only load if we don't already have it from Redux
      if (!user?.qr_image && !profile?.qr_image) {
        try {
          const storedUser = await AsyncStorage.getItem('auth_user');
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            if (parsedUser?.qr_image && !qrImageUri) {
              console.log('📱 Loading QR image from AsyncStorage on mount:', parsedUser.qr_image);
              setQrImageUri(parsedUser.qr_image);
            }
          }
        } catch (error) {
          console.error('❌ Error loading QR image from AsyncStorage:', error);
        }
      }
    };
    
    loadQRImageFromStorage();
  }, [userId]); // Reload when user changes

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
              await logoutMutation().unwrap();
              dispatch(logoutAction());
              router.replace('/login');
            } catch (error) {
              console.error('Logout error:', error);
              // Even if API call fails, clear auth and navigate to login
              dispatch(logoutAction());
              router.replace('/login');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Show loading state
  if (isLoadingProfile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
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
      <SafeAreaView style={styles.container} edges={['top']}>
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
                style={styles.cameraButton}
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
                </>
              )}
              
              <FormField
                label="Address"
                value={formData.address}
                onChangeText={(value) => handleInputChange('address', value)}
                placeholder="Street Address"
                icon={MapPinIcon}
                styles={styles}
                iconSize={SIZES.iconSize}
              />
              
              {/* Sponsor-only fields */}
              {!isDelegate && (
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
              )}
              
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
            {isDelegate && (
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
            )}

            {/* Save Changes Button */}
            <View style={styles.saveButtonSection}>
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

            {qrMode === 'code' ? (
              <View style={styles.qrCodePreview}>
                <View style={styles.qrSquare}>
                  {qrImageLoading ? (
                    <View style={styles.qrLoadingContainer}>
                      <ActivityIndicator size="large" color={colors.primary} />
                      <Text style={styles.qrLoadingText}>Loading QR code...</Text>
                    </View>
                  ) : (qrImageUri || profile?.qr_image || user?.qr_image) && !qrImageError ? (
                    <Image
                      key={`qr-${qrImageRetryCountRef.current}-${qrImageUri || profile?.qr_image || user?.qr_image}`}
                      source={{ 
                        uri: qrImageUri || profile?.qr_image || user?.qr_image || '',
                      }}
                      style={styles.qrCodeImage}
                      resizeMode="contain"
                      onError={(error) => {
                        console.log('========================================');
                        console.log('❌ QR CODE IMAGE ERROR');
                        console.log('========================================');
                        console.log('❌ Error object:', JSON.stringify(error, null, 2));
                        console.log('❌ QR image URL (qrImageUri):', qrImageUri);
                        console.log('❌ QR image URL (profile):', profile?.qr_image);
                        console.log('❌ QR image URL (user):', user?.qr_image);
                        console.log('❌ Final URL used:', qrImageUri || profile?.qr_image || user?.qr_image);
                        console.log('========================================');
                        if (qrImageTimeoutRef.current) {
                          clearTimeout(qrImageTimeoutRef.current);
                          qrImageTimeoutRef.current = null;
                        }
                        qrImageLoadStartRef.current = false;
                        qrImageLoadingRef.current = false;
                        
                        // Retry once if first attempt fails
                        if (qrImageRetryCountRef.current === 0) {
                          console.log('🔄 Retrying QR code image after error...');
                          qrImageRetryCountRef.current = 1;
                          setTimeout(() => {
                            setQrImageError(false);
                            setQrImageLoading(true);
                          }, 500);
                        } else {
                          console.log('❌ QR code image failed after retry - showing error');
                          setQrImageError(true);
                          setQrImageLoading(false);
                        }
                      }}
                      onLoadStart={() => {
                        console.log('========================================');
                        console.log('🔄 QR CODE IMAGE LOADING START');
                        console.log('========================================');
                        console.log('🔄 QR image URL (qrImageUri):', qrImageUri);
                        console.log('🔄 QR image URL (profile):', profile?.qr_image);
                        console.log('🔄 QR image URL (user):', user?.qr_image);
                        console.log('🔄 Final URL being loaded:', qrImageUri || profile?.qr_image || user?.qr_image);
                        console.log('========================================');
                        qrImageLoadStartRef.current = true;
                        qrImageLoadingRef.current = true;
                        setQrImageError(false);
                        setQrImageLoading(true);
                        
                        // Set timeout for image loading (30 seconds for real device - network can be very slow)
                        if (qrImageTimeoutRef.current) {
                          clearTimeout(qrImageTimeoutRef.current);
                        }
                        qrImageTimeoutRef.current = setTimeout(() => {
                          console.log('========================================');
                          console.log('⏱️ QR CODE IMAGE LOADING TIMEOUT (30s)');
                          console.log('========================================');
                          console.log('⏱️ Image URL:', qrImageUri || profile?.qr_image || user?.qr_image);
                          console.log('⏱️ Load start ref:', qrImageLoadStartRef.current);
                          console.log('⏱️ Loading ref:', qrImageLoadingRef.current);
                          console.log('⏱️ Retry count:', qrImageRetryCountRef.current);
                          if (qrImageLoadStartRef.current && qrImageLoadingRef.current) {
                            // Retry once if first attempt fails
                            if (qrImageRetryCountRef.current === 0) {
                              console.log('🔄 Retrying QR code image load...');
                              qrImageRetryCountRef.current = 1;
                              qrImageLoadStartRef.current = false;
                              qrImageLoadingRef.current = false;
                              setQrImageLoading(false);
                              // Force re-render to retry loading
                              setTimeout(() => {
                                setQrImageError(false);
                                setQrImageLoading(true);
                              }, 100);
                            } else {
                              console.log('⚠️ Image still loading after timeout and retry - showing error');
                              qrImageLoadStartRef.current = false;
                              qrImageLoadingRef.current = false;
                              setQrImageError(true);
                              setQrImageLoading(false);
                            }
                          }
                          qrImageTimeoutRef.current = null;
                          console.log('========================================');
                        }, 30000);
                      }}
                      onLoad={() => {
                        console.log('========================================');
                        console.log('✅ QR CODE IMAGE LOADED SUCCESSFULLY');
                        console.log('========================================');
                        console.log('✅ Image URL:', qrImageUri || profile?.qr_image || user?.qr_image);
                        console.log('✅ Retry count:', qrImageRetryCountRef.current);
                        console.log('========================================');
                        qrImageLoadStartRef.current = false;
                        qrImageLoadingRef.current = false;
                        qrImageRetryCountRef.current = 0; // Reset retry count on success
                        if (qrImageTimeoutRef.current) {
                          clearTimeout(qrImageTimeoutRef.current);
                          qrImageTimeoutRef.current = null;
                        }
                        setQrImageLoading(false);
                      }}
                      onLoadEnd={() => {
                        console.log('========================================');
                        console.log('🏁 QR CODE IMAGE LOAD ENDED');
                        console.log('========================================');
                        console.log('🏁 Image URL:', qrImageUri || profile?.qr_image || user?.qr_image);
                        console.log('🏁 Load start ref:', qrImageLoadStartRef.current);
                        console.log('🏁 Loading ref:', qrImageLoadingRef.current);
                        // If load ended but we're still in loading state, it might have failed
                        if (qrImageLoadStartRef.current && qrImageLoadingRef.current) {
                          // Give a small delay to see if onLoad or onError fires
                          setTimeout(() => {
                            if (qrImageLoadStartRef.current && qrImageLoadingRef.current) {
                              console.log('⚠️ QR code image load ended but still in loading state - marking as error');
                              qrImageLoadStartRef.current = false;
                              qrImageLoadingRef.current = false;
                              setQrImageError(true);
                              setQrImageLoading(false);
                            }
                          }, 300);
                        }
                        if (qrImageTimeoutRef.current) {
                          clearTimeout(qrImageTimeoutRef.current);
                          qrImageTimeoutRef.current = null;
                        }
                        console.log('========================================');
                      }}
                    />
                  ) : (
                    <>
                      <Icon name="grid" size={48} color={colors.text} />
                      <Text style={styles.qrCodeLabel}>QR CODE</Text>
                    </>
                  )}
                </View>
                <Text style={styles.qrHint}>Show to attendees to share your contact</Text>
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
                  </View>
                  <Text style={styles.qrHint}>Scan QR code to add contact</Text>
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
});

export default ProfileScreen;

