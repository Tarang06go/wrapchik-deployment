import React, { useState } from 'react';
import { View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { ShoppingBag } from 'lucide-react-native';
import COLORS from '../../constants/colors';

export default function ProductImage({ uri, style, fallbackIconSize = 24, accessibilityLabel }) {
  const [failedUri, setFailedUri] = useState('');
  const showImage = typeof uri === 'string' && uri.trim() && failedUri !== uri;

  if (!showImage) {
    return (
      <View style={[style, { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceMuted }]} pointerEvents="none">
        <ShoppingBag size={fallbackIconSize} color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ExpoImage
      source={{ uri }}
      style={style}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={120}
      accessibilityLabel={accessibilityLabel}
      onError={() => setFailedUri(uri)}
    />
  );
}
