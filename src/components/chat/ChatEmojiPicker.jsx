import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  CHAT_EMOJI_CATEGORIES,
  CHAT_EMOJI_CATEGORY_IDS,
  CHAT_EMOJI_RECENT_KEY,
  CHAT_EMOJI_RECENT_MAX,
  searchChatEmojis,
} from '../../data/chatEmojis';
import { colors, radius } from '../../constants/theme';

const EMOJI_COLUMNS = 8;
const PANEL_HEIGHT = 280;

export function ChatEmojiPicker({ onSelect, onBackspace }) {
  const { width: screenWidth } = useWindowDimensions();
  const emojiCellSize = Math.floor((screenWidth - 12) / EMOJI_COLUMNS);
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [recentEmojis, setRecentEmojis] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadRecent = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(CHAT_EMOJI_RECENT_KEY);
      if (!raw) {
        setRecentEmojis([]);
        return;
      }
      const parsed = JSON.parse(raw);
      setRecentEmojis(Array.isArray(parsed) ? parsed : []);
    } catch {
      setRecentEmojis([]);
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const persistRecent = useCallback(async (emoji) => {
    setRecentEmojis((prev) => {
      const next = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, CHAT_EMOJI_RECENT_MAX);
      AsyncStorage.setItem(CHAT_EMOJI_RECENT_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (emoji) => {
      persistRecent(emoji);
      onSelect?.(emoji);
    },
    [onSelect, persistRecent]
  );

  const displayEmojis = useMemo(() => {
    const q = searchQuery.trim();
    if (q) {
      const found = searchChatEmojis(q);
      return found && found.length ? found : [];
    }
    if (activeCategory === 'recent') {
      return recentEmojis.length > 0 ? recentEmojis : CHAT_EMOJI_CATEGORIES.smileys.emojis.slice(0, 32);
    }
    return CHAT_EMOJI_CATEGORIES[activeCategory]?.emojis || [];
  }, [activeCategory, recentEmojis, searchQuery]);

  const categoryTabs = useMemo(
    () =>
      CHAT_EMOJI_CATEGORY_IDS.map((id) => {
        if (id === 'recent') {
          return { id, icon: 'clock-outline', label: 'Recent' };
        }
        const cat = CHAT_EMOJI_CATEGORIES[id];
        return { id, icon: cat?.icon || 'emoticon-outline', label: cat?.label || id };
      }),
    []
  );

  const renderEmoji = useCallback(
    ({ item }) => (
      <TouchableOpacity
        style={[styles.emojiCell, { width: emojiCellSize, height: emojiCellSize }]}
        onPress={() => handleSelect(item)}
        activeOpacity={0.65}
      >
        <Text style={styles.emojiText}>{item}</Text>
      </TouchableOpacity>
    ),
    [handleSelect, emojiCellSize]
  );

  return (
    <View style={styles.panel}>
      <View style={styles.searchRow}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search Emoji"
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 ? (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
            <MaterialCommunityIcons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={displayEmojis}
        keyExtractor={(item, index) => `${item}-${index}`}
        renderItem={renderEmoji}
        numColumns={EMOJI_COLUMNS}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        style={styles.emojiList}
        contentContainerStyle={styles.emojiListContent}
        key={activeCategory + searchQuery}
      />

      <View style={styles.categoryBar}>
        {categoryTabs.map((tab) => {
          const selected = !searchQuery && activeCategory === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.categoryTab, selected && styles.categoryTabActive]}
              onPress={() => {
                setSearchQuery('');
                setActiveCategory(tab.id);
              }}
              activeOpacity={0.7}
              accessibilityLabel={tab.label}
            >
              <MaterialCommunityIcons
                name={tab.icon}
                size={22}
                color={selected ? colors.primary : colors.textMuted}
              />
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={styles.backspaceBtn}
          onPress={() => onBackspace?.()}
          activeOpacity={0.7}
          accessibilityLabel="Delete last character"
        >
          <MaterialCommunityIcons name="backspace-outline" size={24} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    height: PANEL_HEIGHT,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.gray100,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  emojiList: {
    flex: 1,
  },
  emojiListContent: {
    paddingHorizontal: 6,
    paddingBottom: 4,
  },
  emojiCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 28,
    lineHeight: 34,
  },
  categoryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  categoryTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 20,
  },
  categoryTabActive: {
    backgroundColor: colors.gray100,
  },
  backspaceBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});

export default ChatEmojiPicker;
