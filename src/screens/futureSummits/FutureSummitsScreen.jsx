import Icon from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import {
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../components/common/Header';
import { colors, radius } from '../../constants/theme';
import { getFutureSummitsPartnerFilenames } from '../../utils/futureSummitsPartnerImages';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

const PARTNER_BASE_PATH = '/assets/front/images/logos/partners/';

export const FutureSummitsScreen = () => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const params = useLocalSearchParams();
  const categoryId = params?.categoryId ?? params?.category_id;

  const items = useMemo(() => {
    const names = getFutureSummitsPartnerFilenames(categoryId);
    return names.map((name) => ({
      key: name,
      uri: resolveMediaUrl(`${PARTNER_BASE_PATH}${name}`),
    }));
  }, [categoryId]);

  const { padding, gap, numColumns, cardMinHeight, imageMaxHeight } = useMemo(() => {
    const isTablet = SCREEN_WIDTH >= 768;
    const pad = isTablet ? 20 : 16;
    const g = isTablet ? 14 : 12;
    const cols = isTablet ? 3 : 2;
    // Slightly larger than sponsor list rows (~78px card / ~56px logo): taller logo box
    const imgH = isTablet ? 80 : 72;
    const cardH = isTablet ? 108 : 100;
    return { padding: pad, gap: g, numColumns: cols, cardMinHeight: cardH, imageMaxHeight: imgH };
  }, [SCREEN_WIDTH]);

  const colWidth = useMemo(() => {
    const totalGaps = gap * (numColumns - 1);
    return (SCREEN_WIDTH - padding * 2 - totalGaps) / numColumns;
  }, [SCREEN_WIDTH, padding, gap, numColumns]);

  const styles = useMemo(
    () =>
      createStyles({
        padding,
        gap,
        cardMinHeight,
        imageMaxHeight,
      }),
    [padding, gap, cardMinHeight, imageMaxHeight]
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header
        title="Future Summits"
        leftIcon="back"
        onLeftPress={() => router.back()}
        iconSize={22}
      />
      <FlatList
        data={items}
        key={numColumns}
        numColumns={numColumns}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrap : undefined}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.card, { width: colWidth, minHeight: cardMinHeight }]}>
            {item.uri ? (
              <Image source={{ uri: item.uri }} style={[styles.image, { maxHeight: imageMaxHeight }]} resizeMode="contain" />
            ) : (
              <View style={styles.placeholder}>
                <Icon name="image" size={28} color={colors.textMuted} />
              </View>
            )}
          </View>
        )}
        ListHeaderComponent={
          <Text style={styles.intro}>
            Some of the valuable companies that participate at the conference.
          </Text>
        }
      />
    </SafeAreaView>
  );
};

function createStyles({ padding, gap, cardMinHeight, imageMaxHeight }) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    listContent: {
      paddingHorizontal: padding,
      paddingBottom: 24,
      paddingTop: 8,
    },
    columnWrap: {
      gap,
      marginBottom: gap,
    },
    intro: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 16,
      lineHeight: 20,
    },
    card: {
      backgroundColor: colors.white,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 2,
        },
        android: { elevation: 1 },
      }),
    },
    image: {
      width: '100%',
      height: imageMaxHeight,
    },
    placeholder: {
      minHeight: imageMaxHeight,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
