import Icon from '@expo/vector-icons/Feather';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppConfirmModal } from '../../components/common/AppConfirmModal';
import { Header } from '../../components/common/Header';
import { colors, radius } from '../../constants/theme';
import {
  useDeleteContactNoteMutation,
  useGetContactNotesQuery,
  useSaveContactNoteMutation,
} from '../../store/api';
import { useAppSelector } from '../../store/hooks';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const ContactNotesScreen = () => {
  const params = useLocalSearchParams();
  const contactId = params?.contactId ? String(params.contactId) : '';
  const contactName = params?.contactName ? String(params.contactName) : '';

  const { user } = useAppSelector((state) => state.auth);
  const loginType = String(user?.login_type || user?.user_type || '').toLowerCase();
  const notesRole = loginType === 'sponsor' ? 'sponsor' : 'delegate';

  const [draftNotes, setDraftNotes] = useState('');
  const [pickedImage, setPickedImage] = useState(null);
  const [isImagePickerModalVisible, setIsImagePickerModalVisible] = useState(false);
  const pendingPickerSourceRef = useRef(null);

  const queryArg = useMemo(
    () => ({ contactId, role: notesRole }),
    [contactId, notesRole]
  );

  const { data, isLoading, isFetching, refetch } = useGetContactNotesQuery(queryArg, {
    skip: !contactId,
  });
  const [saveNote, { isLoading: isSaving }] = useSaveContactNoteMutation();
  const [deleteNote] = useDeleteContactNoteMutation();
  const [deletingNoteId, setDeletingNoteId] = useState(null);
  const [noteToDelete, setNoteToDelete] = useState(null);
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);

  const items = useMemo(() => {
    const raw = data?.data;
    if (Array.isArray(raw)) return raw;
    return [];
  }, [data]);

  const handleBack = useCallback(() => {
    try {
      router.back();
    } catch {
      router.push('/(drawer)/contacts');
    }
  }, []);

  const openImagePickerModal = useCallback(() => {
    setIsImagePickerModalVisible(true);
  }, []);

  const closeImagePickerModal = useCallback(() => {
    setIsImagePickerModalVisible(false);
  }, []);

  const launchPicker = useCallback(async (source) => {
    try {
      let result;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Camera access is required to take a photo.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.85,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Allow photo library access to attach images.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.85,
        });
      }
      if (!result || result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
        Alert.alert('File too large', 'Maximum size is 8 MB.');
        return;
      }
      const ext = asset.mimeType?.includes('png')
        ? 'png'
        : asset.mimeType?.includes('webp')
          ? 'webp'
          : 'jpg';
      setPickedImage({
        uri: asset.uri,
        name: `note.${ext}`,
        mimeType: asset.mimeType || 'image/jpeg',
      });
    } catch (e) {
      console.warn('ContactNotes pickImage error', e);
      Alert.alert('Error', e?.message || 'Could not pick image. Please try again.');
    }
  }, []);

  const handleModalDismissed = useCallback(() => {
    const pending = pendingPickerSourceRef.current;
    pendingPickerSourceRef.current = null;
    if (pending) {
      launchPicker(pending);
    }
  }, [launchPicker]);

  const handlePickImage = useCallback(
    (source) => {
      pendingPickerSourceRef.current = source;
      setIsImagePickerModalVisible(false);
      if (Platform.OS !== 'ios') {
        setTimeout(() => {
          const pending = pendingPickerSourceRef.current;
          pendingPickerSourceRef.current = null;
          if (pending) launchPicker(pending);
        }, 250);
      }
    },
    [launchPicker]
  );

  const clearPickedImage = useCallback(() => setPickedImage(null), []);

  const performDelete = useCallback(
    async (noteId) => {
      setDeletingNoteId(noteId);
      try {
        const res = await deleteNote({ id: noteId, contactId, role: notesRole }).unwrap();
        if (res?.success === false) {
          Alert.alert('Could not delete', res?.message || 'Please try again.');
          return;
        }
        refetch();
      } catch (e) {
        const msg = e?.data?.message || e?.message || 'Delete failed';
        Alert.alert('Error', msg);
      } finally {
        setDeletingNoteId(null);
      }
    },
    [contactId, deleteNote, notesRole, refetch]
  );

  const handleDelete = useCallback((note) => {
    if (!note?.id) return;
    setNoteToDelete(note);
    setIsDeleteConfirmVisible(true);
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    if (deletingNoteId != null) return;
    setIsDeleteConfirmVisible(false);
    setNoteToDelete(null);
  }, [deletingNoteId]);

  const handleConfirmDelete = useCallback(() => {
    if (!noteToDelete?.id) return;
    const id = Number(noteToDelete.id);
    setIsDeleteConfirmVisible(false);
    setNoteToDelete(null);
    performDelete(id);
  }, [noteToDelete, performDelete]);

  const onSave = useCallback(async () => {
    const text = draftNotes.trim();
    if (!contactId) {
      Alert.alert('Error', 'Missing contact.');
      return;
    }
    if (!text && !pickedImage) {
      Alert.alert('Add something', 'Enter a note or upload an image before saving.');
      return;
    }
    try {
      const res = await saveNote({
        contactId,
        role: notesRole,
        notes: text,
        image: pickedImage,
      }).unwrap();
      if (res?.success === false) {
        Alert.alert('Could not save', res?.message || 'Please try again.');
        return;
      }
      setDraftNotes('');
      setPickedImage(null);
      refetch();
    } catch (e) {
      const msg = e?.data?.message || e?.message || 'Save failed';
      Alert.alert('Error', msg);
    }
  }, [contactId, draftNotes, notesRole, pickedImage, refetch, saveNote]);

  const listHeader = (
    <View style={styles.formBlock}>
      <Text style={styles.label}>Add notes</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Write notes for this contact…"
        placeholderTextColor={colors.textMuted}
        multiline
        value={draftNotes}
        onChangeText={setDraftNotes}
        textAlignVertical="top"
      />

      <TouchableOpacity style={styles.uploadBtn} onPress={openImagePickerModal} activeOpacity={0.85}>
        <View style={styles.uploadIconWrap}>
          <Icon name="image" size={18} color={colors.primary} />
        </View>
        <Text style={styles.uploadBtnText}>{pickedImage ? 'Change image' : 'Upload image'}</Text>
      </TouchableOpacity>

      {pickedImage ? (
        <View style={styles.previewWrap}>
          <ExpoImage source={{ uri: pickedImage.uri }} style={styles.preview} contentFit="cover" />
          <TouchableOpacity style={styles.removeImg} onPress={clearPickedImage} hitSlop={12}>
            <Icon name="x" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.saveBtn, (isSaving || !contactId) && styles.saveBtnDisabled]}
        onPress={onSave}
        disabled={isSaving || !contactId}
        activeOpacity={0.9}
      >
        {isSaving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.saveBtnText}>Save</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.listSectionTitle}>Your saved notes</Text>
      {isLoading && items.length === 0 ? (
        <View style={styles.inlineLoader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
    </View>
  );

  const renderItem = useCallback(
    ({ item }) => {
      const imgUrl = resolveMediaUrl(item.image_url);
      const hasText = item.notes && String(item.notes).trim() !== '';
      const isDeleting = deletingNoteId === Number(item.id);
      return (
        <View style={styles.noteCard}>
          {imgUrl ? (
            <ExpoImage source={{ uri: imgUrl }} style={styles.noteImage} contentFit="cover" />
          ) : null}
          {hasText ? <Text style={styles.noteText}>{String(item.notes)}</Text> : null}
          <View style={styles.noteFooter}>
            {item.created_at ? (
              <Text style={styles.noteMeta}>{String(item.created_at)}</Text>
            ) : (
              <View />
            )}
            <TouchableOpacity
              style={[styles.deleteBtn, isDeleting && styles.deleteBtnDisabled]}
              onPress={() => handleDelete(item)}
              disabled={isDeleting}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Delete note"
              hitSlop={8}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={colors.danger || '#DC2626'} />
              ) : (
                <>
                  <Icon name="trash-2" size={16} color={colors.danger || '#DC2626'} />
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [deletingNoteId, handleDelete]
  );

  if (!contactId) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Header title="Contact notes" leftIcon="back" onLeftPress={handleBack} />
        <View style={styles.centerMsg}>
          <Text style={styles.muted}>No contact selected.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Header
        title="Contact notes"
        subtitle={contactName ? contactName.slice(0, 80) : undefined}
        leftIcon="back"
        onLeftPress={handleBack}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          refreshing={isFetching && !isLoading}
          onRefresh={refetch}
          ListEmptyComponent={
            !isLoading ? (
              <Text style={styles.empty}>No notes yet. Add one above.</Text>
            ) : null
          }
        />
      </KeyboardAvoidingView>

      <Modal
        transparent
        animationType="fade"
        visible={isImagePickerModalVisible}
        onRequestClose={closeImagePickerModal}
        onDismiss={handleModalDismissed}
      >
        <Pressable style={styles.imagePickerBackdrop} onPress={closeImagePickerModal}>
          <View style={styles.imagePickerContainer}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.imagePickerCard}>
                <Text style={styles.imagePickerTitle}>Add image</Text>

                <TouchableOpacity
                  style={styles.imagePickerOption}
                  onPress={() => handlePickImage('camera')}
                  activeOpacity={0.7}
                >
                  <Icon name="camera" size={22} color={colors.primary} />
                  <Text style={styles.imagePickerOptionText}>Take photo</Text>
                </TouchableOpacity>

                <View style={styles.imagePickerDivider} />

                <TouchableOpacity
                  style={styles.imagePickerOption}
                  onPress={() => handlePickImage('gallery')}
                  activeOpacity={0.7}
                >
                  <Icon name="image" size={22} color={colors.primary} />
                  <Text style={styles.imagePickerOptionText}>Choose from device</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.imagePickerCancel}
                  onPress={closeImagePickerModal}
                  activeOpacity={0.7}
                >
                  <Text style={styles.imagePickerCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <AppConfirmModal
        visible={isDeleteConfirmVisible}
        title="Delete note?"
        message="This note and any attached image will be permanently removed."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        confirmVariant="danger"
        iconName="alert-triangle"
        onClose={closeDeleteConfirm}
        onConfirm={handleConfirmDelete}
        isLoading={deletingNoteId != null}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: { flex: 1 },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  formBlock: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.white,
    marginBottom: 12,
  },
  uploadIconWrap: {
    marginRight: 8,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: 12,
  },
  uploadBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  previewWrap: {
    width: '100%',
    maxWidth: 280,
    marginBottom: 12,
    position: 'relative',
  },
  preview: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
  },
  removeImg: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: 24,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  listSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  inlineLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  noteCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  noteImage: {
    width: '100%',
    height: 200,
    borderRadius: radius.sm,
    backgroundColor: colors.gray100,
    marginBottom: 10,
  },
  noteText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  noteFooter: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  noteMeta: {
    fontSize: 12,
    color: colors.textMuted,
    flexShrink: 1,
    marginRight: 12,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.danger || '#DC2626',
    backgroundColor: 'rgba(220, 38, 38, 0.06)',
  },
  deleteBtnDisabled: {
    opacity: 0.6,
  },
  deleteBtnText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '700',
    color: colors.danger || '#DC2626',
  },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 8,
    marginBottom: 24,
  },
  centerMsg: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 15,
  },
  imagePickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  imagePickerContainer: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
  },
  imagePickerCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingVertical: 8,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  imagePickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  imagePickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  imagePickerOptionText: {
    marginLeft: 14,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  imagePickerDivider: {
    height: 1,
    backgroundColor: colors.gray200,
    marginHorizontal: 12,
  },
  imagePickerCancel: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  imagePickerCancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
});

export default ContactNotesScreen;
