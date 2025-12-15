import Icon from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useMemo } from 'react';
import {
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { colors } from '../../constants/theme';

// Ensure font scaling is disabled for Header text components
const TextComponent = (props) => <Text {...props} allowFontScaling={false} maxFontSizeMultiplier={1} />;

const getIconElement = (type, size, color) => {
  switch (type) {
    case 'back':
    case 'arrow-left':
      return <Icon name="chevron-left" size={size} color={color} />;
    case 'menu':
    default:
      return <Icon name="menu" size={size} color={color} />;
  }
};

export const Header = memo(({
  title,
  subtitle,
  leftIcon = 'menu',
  onLeftPress,
  right,
  showGradient = true,
  containerStyle,
  titleStyle,
  center,
  iconSize,
}) => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  
  const isTablet = SCREEN_WIDTH >= 768;
  const isAndroid = Platform.OS === 'android';
  const isIOS = Platform.OS === 'ios';
  
  const getValue = ({ android, ios, tablet, default: defaultValue }) => {
    if (isTablet && tablet !== undefined) return tablet;
    if (isAndroid && android !== undefined) return android;
    if (isIOS && ios !== undefined) return ios;
    return defaultValue;
  };
  
  const SIZES = useMemo(() => ({
    iconSize: iconSize || getValue({ android: 22, ios: 23, tablet: 25, default: 22 }),
    titleSize: getValue({ android: 18, ios: 19, tablet: 20, default: 18 }),
    subtitleSize: getValue({ android: 10, ios: 11, tablet: 11, default: 10 }),
    minHeight: getValue({ android: 80, ios: 82, tablet: 85, default: 80 }),
    paddingHorizontal: getValue({ android: 16, ios: 18, tablet: 20, default: 16 }),
  }), [isTablet, iconSize]);
  const Left = () => {
    if (!leftIcon) return <View style={styles.left} />;
    if (React.isValidElement(leftIcon)) {
      return (
        <View style={styles.left}>
          {leftIcon}
        </View>
      );
    }
    return (
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onLeftPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={leftIcon === 'back' || leftIcon === 'arrow-left' ? 'Go back' : 'Open menu'}
      >
        {getIconElement(leftIcon, SIZES.iconSize, colors.white)}
      </TouchableOpacity>
    );
  };

  const TitleArea = () => {
    if (center) return <View style={styles.center}>{center}</View>;
    return (
      <View style={styles.center}>
        {!!title && <TextComponent style={[styles.title, { fontSize: SIZES.titleSize }, titleStyle]} numberOfLines={1}>{title}</TextComponent>}
        {!!subtitle && <TextComponent style={[styles.subtitle, { fontSize: SIZES.subtitleSize }]} numberOfLines={1}>{subtitle}</TextComponent>}
      </View>
    );
  };

  const Right = () => (
    <View style={styles.right}>
      {right}
    </View>
  );

  const Content = (
    <View style={[styles.container, containerStyle]}>
      <Left />
      <TitleArea />
      <Right />
    </View>
  );

  const headerStyles = useMemo(() => ({
    ...styles.gradient,
    minHeight: SIZES.minHeight,
    paddingHorizontal: SIZES.paddingHorizontal,
  }), [SIZES]);

  if (showGradient) {
    return (
      <LinearGradient
        colors={colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={headerStyles}
      >
        {Content}
      </LinearGradient>
    );
  }

  return (
    <View style={[headerStyles, { backgroundColor: colors.primary }]}>
      {Content}
    </View>
  );
});

const styles = StyleSheet.create({
  gradient: {
    justifyContent: 'center',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  left: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  right: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: '600',
    color: colors.white,
  },
  subtitle: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.85)',
  },
});

export default Header;


