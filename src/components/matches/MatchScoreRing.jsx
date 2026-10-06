import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/theme';

/**
 * Circular match score indicator (no extra SVG dependency).
 */
export function MatchScoreRing({ score = 0, size = 64, stroke = 5 }) {
  const pct = Math.min(100, Math.max(0, Number(score) || 0));
  const ringColor = colors.primary;
  const trackColor = '#F3E8FF';

  const top = pct >= 12.5;
  const right = pct >= 37.5;
  const bottom = pct >= 62.5;
  const left = pct >= 87.5;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View
        style={[
          styles.track,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: stroke,
            borderColor: trackColor,
          },
        ]}
      />
      <View
        style={[
          styles.progress,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: stroke,
            borderColor: 'transparent',
            borderTopColor: top ? ringColor : 'transparent',
            borderRightColor: right ? ringColor : 'transparent',
            borderBottomColor: bottom ? ringColor : 'transparent',
            borderLeftColor: left ? ringColor : 'transparent',
            transform: [{ rotate: '-45deg' }],
          },
        ]}
      />
      <Text style={[styles.label, { fontSize: Math.max(12, size * 0.22) }]}>{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
  },
  progress: {
    position: 'absolute',
  },
  label: {
    fontWeight: '700',
    color: colors.primary,
  },
});
