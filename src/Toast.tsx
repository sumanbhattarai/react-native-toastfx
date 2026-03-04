import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  type TextStyle,
  View,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { toastEmitter, TOAST_EVENT } from './toastEmitter';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MAX_TOASTS = 3;

// ─── AnimatedView alias ───────────────────────────────────────────────────────
// Animated.View's JSX type is a deeply recursive generic that causes TS2589
// under strict mode when combined with useAnimatedStyle return types.
// This alias accepts any props, permanently cutting off the recursive check.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AnimatedView = Animated.View as React.ComponentType<any>;

// ─── Constants ────────────────────────────────────────────────────────────────

const STACK_OPACITY = [1, 0.55, 0.25] as const;
const STACK_SCALE = [1, 0.95, 0.9] as const;

type StackIndex = 0 | 1 | 2;

const clampStackIndex = (i: number): StackIndex =>
  Math.min(i, STACK_OPACITY.length - 1) as StackIndex;

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'warning' | 'error';

export interface ToastOptions {
  /** Custom title — falls back to the type label ("Success", "Error", "Warning") */
  title?: string;
  /** Body message text */
  message: string;
  /** Auto-dismiss duration in ms (default: 2000) */
  duration?: number;
}

interface ToastData {
  type: ToastType;
  title: string;
  message: string;
  duration: number;
}

interface ToastEntry extends ToastData {
  id: number;
}

// ─── Emitter helpers ──────────────────────────────────────────────────────────

const emit = (type: ToastType, options: ToastOptions): void => {
  const data: ToastData = {
    type,
    title: options.title ?? '',
    message: options.message,
    duration: options.duration ?? 2000,
  };
  toastEmitter.emit(TOAST_EVENT, data);
};

export const showSuccess = (options: ToastOptions): void =>
  emit('success', options);
export const showError = (options: ToastOptions): void =>
  emit('error', options);
export const showWarning = (options: ToastOptions): void =>
  emit('warning', options);

// ─── Config ───────────────────────────────────────────────────────────────────

interface TypeConfig {
  defaultTitle: string;
  accent: string;
  bg: string;
  icon: string;
}

const TOAST_CONFIG: Record<ToastType, TypeConfig> = {
  success: {
    defaultTitle: 'Success',
    accent: '#22c55e',
    bg: '#0f1a13',
    icon: '✓',
  },
  error: { defaultTitle: 'Error', accent: '#ef4444', bg: '#1a0f0f', icon: '✕' },
  warning: {
    defaultTitle: 'Warning',
    accent: '#f59e0b',
    bg: '#1a160a',
    icon: '!',
  },
};

// ─── ToastItem ────────────────────────────────────────────────────────────────

interface ToastItemProps {
  toast: ToastEntry;
  stackIndex: number;
  onHide: (id: number) => void;
  exiting: boolean;
  titleStyle?: TextStyle;
  messageStyle?: TextStyle;
}

const ToastItem: React.FC<ToastItemProps> = ({
  toast,
  stackIndex,
  onHide,
  exiting,
  titleStyle,
  messageStyle,
}) => {
  const config = TOAST_CONFIG[toast.type];
  const resolvedTitle = toast.title || config.defaultTitle;
  const idx = clampStackIndex(stackIndex);

  const translateY = useSharedValue<number>(-120);
  const opacity = useSharedValue<number>(0);
  const scale = useSharedValue<number>(0.85);
  const progressWidth = useSharedValue<number>(100);
  const iconScale = useSharedValue<number>(0);
  const iconRotate = useSharedValue<number>(-30);
  const stackOpacity = useSharedValue<number>(STACK_OPACITY[idx]);
  const stackScale = useSharedValue<number>(STACK_SCALE[idx]);

  const hide = useCallback((): void => {
    translateY.value = withSpring(-120, { damping: 18, stiffness: 200 });
    opacity.value = withTiming(0, { duration: 280 });
    scale.value = withTiming(0.88, { duration: 280 });
  }, [opacity, scale, translateY]);

  // Entry — runs once on mount
  useEffect(() => {
    translateY.value = withSpring(0, {
      damping: 16,
      stiffness: 180,
      mass: 0.8,
    });
    opacity.value = withTiming(STACK_OPACITY[0], {
      duration: 250,
      easing: Easing.out(Easing.quad),
    });
    scale.value = withSpring(STACK_SCALE[0], { damping: 14, stiffness: 200 });

    iconScale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withSpring(1.3, { damping: 8, stiffness: 300 }),
      withSpring(1, { damping: 12, stiffness: 250 })
    );
    iconRotate.value = withSpring(0, { damping: 10, stiffness: 200 });

    progressWidth.value = withTiming(0, {
      duration: toast.duration,
      easing: Easing.linear,
    });

    const timer = setTimeout(() => {
      hide();
      setTimeout(() => runOnJS(onHide)(toast.id), 320);
    }, toast.duration);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stack position shift
  useEffect(() => {
    if (exiting) return;
    const cIdx = clampStackIndex(stackIndex);
    stackOpacity.value = withTiming(STACK_OPACITY[cIdx], { duration: 300 });
    stackScale.value = withSpring(STACK_SCALE[cIdx], {
      damping: 14,
      stiffness: 180,
    });
  }, [stackIndex, exiting, stackOpacity, stackScale]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value * stackScale.value },
    ],
    opacity: opacity.value * stackOpacity.value,
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: iconScale.value },
      { rotate: `${iconRotate.value}deg` },
    ],
  }));

  return (
    <AnimatedView
      style={[styles.toastContainer, containerStyle]}
      pointerEvents={stackIndex === 0 ? 'auto' : 'none'}
    >
      {/* Glow border */}
      <View
        style={[styles.glowBorder, { borderColor: `${config.accent}55` }]}
      />

      {/* Card body */}
      <View style={[styles.card, { backgroundColor: config.bg }]}>
        {/* Left accent bar */}
        <View style={[styles.accentBar, { backgroundColor: config.accent }]} />

        {/* Icon */}
        <AnimatedView
          style={[
            styles.iconWrapper,
            { backgroundColor: `${config.accent}22` },
            iconStyle,
          ]}
        >
          <Text style={[styles.iconText, { color: config.accent }]}>
            {config.icon}
          </Text>
        </AnimatedView>

        {/* Text */}
        <View style={styles.textContent}>
          <Text
            style={[styles.toastTitle, { color: config.accent }, titleStyle]}
            numberOfLines={1}
          >
            {resolvedTitle}
          </Text>
          <Text style={[styles.toastMessage, messageStyle]} numberOfLines={2}>
            {toast.message}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <AnimatedView
          style={[
            styles.progressBar,
            { backgroundColor: config.accent },
            progressStyle,
          ]}
        />
      </View>
    </AnimatedView>
  );
};

// ─── Toast (provider) ─────────────────────────────────────────────────────────

export interface ToastProps {
  /** Override style for the title text across all toasts */
  titleStyle?: TextStyle;
  /** Override style for the message text across all toasts */
  messageStyle?: TextStyle;
}

const Toast: React.FC<ToastProps> = ({ titleStyle, messageStyle }) => {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const exitingIds = useRef<Set<number>>(new Set());
  const idRef = useRef(0);

  useEffect(() => {
    const handler = (data: ToastData): void => {
      const id = ++idRef.current;
      setToasts((prev) => {
        const next: ToastEntry[] = [{ ...data, id }, ...prev];
        if (next.length > MAX_TOASTS) {
          const removed = next[MAX_TOASTS];
          if (removed !== undefined) {
            exitingIds.current.add(removed.id);
          }
          return next.slice(0, MAX_TOASTS);
        }
        return next;
      });
    };

    toastEmitter.on(TOAST_EVENT, handler);
    return (): void => {
      toastEmitter.off(TOAST_EVENT, handler);
    };
  }, []);

  const removeToast = useCallback((id: number): void => {
    exitingIds.current.add(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      {toasts.map((toast, index) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          stackIndex={index}
          onHide={removeToast}
          exiting={exitingIds.current.has(toast.id)}
          titleStyle={titleStyle}
          messageStyle={messageStyle}
        />
      ))}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    gap: 10,
  },
  toastContainer: {
    width: SCREEN_WIDTH - 32,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 20,
      },
      android: { elevation: 12 },
    }),
  },
  glowBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    gap: 12,
  },
  accentBar: {
    width: 3,
    height: 36,
    borderRadius: 99,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 16,
    fontWeight: '700',
  },
  textContent: {
    flex: 1,
    gap: 2,
  },
  toastTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  toastMessage: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: '400',
    lineHeight: 19,
  },
  progressTrack: {
    height: 3,
    backgroundColor: '#ffffff12',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    borderRadius: 99,
  },
});

export default Toast;
