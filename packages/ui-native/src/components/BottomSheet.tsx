import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Animated,
  Easing,
  PanResponder,
  Dimensions,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('screen').height;
const DEFAULT_PARTIAL_HEIGHT_RATIO = 0.58;
const OPEN_CLOSE_DURATION_MS = 240;
const SPRING_CONFIG = {
  stiffness: 260,
  damping: 32,
  mass: 1,
  useNativeDriver: true,
};

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
  partialOverlayTopInset?: number;
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
  partialOverlayTopInset = 0,
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

  const settleTo = useCallback(
    (toValue: number, velocity = 0) => {
      Animated.spring(translateY, {
        ...SPRING_CONFIG,
        toValue,
        velocity,
      }).start();
    },
    [translateY],
  );

  const close = useCallback(() => {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: OPEN_CLOSE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
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
    settleTo(0);
  }, [allowExpand, settleTo]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    isExpandedRef.current = false;
    setIsExpanded(false);
    translateY.setValue(SCREEN_HEIGHT);
    settleTo(partialTranslateY);
  }, [partialTranslateY, settleTo, translateY, visible]);

  const handlePanRelease = useCallback(
    (dy: number, vy: number) => {
      const expanded = isExpandedRef.current;
      const currentY = Math.max(0, Math.min(SCREEN_HEIGHT, panStartRef.current + dy));
      const projectedY = currentY + vy * 120;

      if (allowExpand && projectedY < partialTranslateY * 0.55) {
        isExpandedRef.current = true;
        setIsExpanded(true);
        settleTo(0, vy);
        return;
      }

      if (dy > 80 || vy > 0.6 || projectedY > partialTranslateY + 120) {
        if (allowExpand && expanded) {
          isExpandedRef.current = false;
          setIsExpanded(false);
          settleTo(partialTranslateY, vy);
          return;
        }

        close();
        return;
      }

      settleTo(allowExpand && expanded ? 0 : partialTranslateY, vy);
    },
    [allowExpand, close, partialTranslateY, settleTo],
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
          const next = Math.max(0, Math.min(SCREEN_HEIGHT, panStartRef.current + dy));
          translateY.setValue(next);
        },
        onPanResponderRelease: (_, { dy, vy }) => {
          const currentY = Math.max(0, Math.min(SCREEN_HEIGHT, panStartRef.current + dy));
          const projectedY = currentY + vy * 120;

          if (Math.abs(dy) < 8) {
            if (allowExpand) {
              expand();
            } else {
              close();
            }
            return;
          }

          if (dy > 60 || vy > 0.5 || projectedY > partialTranslateY + 100) {
            close();
            return;
          }

          if (allowExpand && projectedY < partialTranslateY * 0.65) {
            isExpandedRef.current = true;
            setIsExpanded(true);
            settleTo(0, vy);
            return;
          }

          settleTo(partialTranslateY, vy);
        },
      }),
    [allowExpand, close, expand, partialTranslateY, settleTo, translateY],
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
            style={[StyleSheet.absoluteFill, { top: partialOverlayTopInset }]}
            {...partialOverlayPanResponder.panHandlers}
          />
        ) : null}
      </Animated.View>
    </Modal>
  );
};
