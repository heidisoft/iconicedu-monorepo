import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Animated,
  PanResponder,
  Dimensions,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('screen').height;
const DEFAULT_PARTIAL_HEIGHT_RATIO = 0.58;

type BottomSheetRenderProps = {
  isExpanded: boolean;
  close: () => void;
  expand: () => void;
};

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode | ((props: BottomSheetRenderProps) => React.ReactNode);
  partialHeight?: number;
  allowExpand?: boolean;
  enablePartialOverlay?: boolean;
  topInset?: number;
  bottomInset?: number;
  backdropColor?: string;
  sheetStyle?: StyleProp<ViewStyle>;
  dragHandleStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: SCREEN_HEIGHT,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 16,
  },
  dragArea: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
  },
});

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  children,
  partialHeight,
  allowExpand = false,
  enablePartialOverlay = false,
  topInset = 0,
  bottomInset = 0,
  backdropColor = 'rgba(0,0,0,0.45)',
  sheetStyle,
  dragHandleStyle,
  testID,
}) => {
  const resolvedPartialHeight =
    partialHeight ?? SCREEN_HEIGHT * DEFAULT_PARTIAL_HEIGHT_RATIO;
  const partialTranslateY = Math.max(0, SCREEN_HEIGHT - resolvedPartialHeight);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandedRef = useRef(false);
  const panStartRef = useRef(partialTranslateY);

  const close = useCallback(() => {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      isExpandedRef.current = false;
      setIsExpanded(false);
      onClose();
    });
  }, [onClose, translateY]);

  const expand = useCallback(() => {
    if (!allowExpand) {
      return;
    }

    isExpandedRef.current = true;
    setIsExpanded(true);
    Animated.spring(translateY, {
      toValue: 0,
      tension: 85,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [allowExpand, translateY]);

  const collapse = useCallback(() => {
    isExpandedRef.current = false;
    setIsExpanded(false);
    Animated.spring(translateY, {
      toValue: partialTranslateY,
      tension: 80,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [partialTranslateY, translateY]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    isExpandedRef.current = false;
    setIsExpanded(false);
    translateY.setValue(SCREEN_HEIGHT);
    Animated.spring(translateY, {
      toValue: partialTranslateY,
      tension: 80,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [partialTranslateY, translateY, visible]);

  const handlePanRelease = useCallback(
    (dy: number, vy: number) => {
      const expanded = isExpandedRef.current;

      if (allowExpand && (dy < -50 || vy < -0.5)) {
        expand();
        return;
      }

      if (dy > 80 || vy > 0.6) {
        if (allowExpand && expanded) {
          collapse();
          return;
        }

        close();
        return;
      }

      Animated.spring(translateY, {
        toValue: allowExpand && expanded ? 0 : partialTranslateY,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }).start();
    },
    [allowExpand, close, collapse, expand, partialTranslateY, translateY],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 8,
        onPanResponderGrant: () => {
          translateY.stopAnimation((value) => {
            panStartRef.current = value;
          });
        },
        onPanResponderMove: (_, { dy }) => {
          const next = Math.max(0, Math.min(SCREEN_HEIGHT, panStartRef.current + dy));
          translateY.setValue(next);
        },
        onPanResponderRelease: (_, { dy, vy }) => {
          handlePanRelease(dy, vy);
        },
      }),
    [handlePanRelease, translateY],
  );

  const partialOverlayPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, { dy, dx }) =>
          Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx),
        onPanResponderGrant: () => {
          translateY.stopAnimation((value) => {
            panStartRef.current = value;
          });
        },
        onPanResponderMove: (_, { dy }) => {
          if (dy > 0) {
            translateY.setValue(Math.min(SCREEN_HEIGHT, panStartRef.current + dy));
          }
        },
        onPanResponderRelease: (_, { dy, vy }) => {
          if (Math.abs(dy) < 8) {
            if (allowExpand) {
              expand();
            } else {
              close();
            }
            return;
          }

          if (dy > 60 || vy > 0.5) {
            close();
            return;
          }

          if (allowExpand && (dy < -30 || vy < -0.5)) {
            expand();
            return;
          }

          Animated.spring(translateY, {
            toValue: partialTranslateY,
            tension: 80,
            friction: 12,
            useNativeDriver: true,
          }).start();
        },
      }),
    [allowExpand, close, expand, partialTranslateY, translateY],
  );

  const renderedChildren =
    typeof children === 'function' ? children({ isExpanded, close, expand }) : children;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={close}
      statusBarTranslucent
      navigationBarTranslucent
      testID={testID}
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: backdropColor }]}
        onPress={!isExpanded ? close : undefined}
      />

      <Animated.View
        style={[
          styles.sheet,
          sheetStyle,
          { transform: [{ translateY }] },
          isExpanded ? { paddingTop: topInset, paddingBottom: bottomInset } : null,
        ]}
      >
        <View style={styles.dragArea} {...panResponder.panHandlers}>
          <View style={[styles.dragHandle, dragHandleStyle]} />
        </View>
        {renderedChildren}
        {enablePartialOverlay && !isExpanded ? (
          <View
            style={StyleSheet.absoluteFill}
            {...partialOverlayPanResponder.panHandlers}
          />
        ) : null}
      </Animated.View>
    </Modal>
  );
};
