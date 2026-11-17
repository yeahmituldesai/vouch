import * as Haptics from 'expo-haptics';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type AlertPayload = {
  type: 'alert' | 'action-sheet';
  title?: string;
  message?: string;
  buttons: AlertButton[];
};

type AlertContextType = {
  show: (payload: AlertPayload) => void;
  hide: () => void;
};

const AlertContext = createContext<AlertContextType | null>(null);

let globalShow: ((payload: AlertPayload) => void) | null = null;
let globalHide: (() => void) | null = null;

/**
 * Trigger an Apple-style alert confirmation modal.
 */
export function showAlert(title?: string, message?: string, buttons?: AlertButton[]): void {
  const list: AlertButton[] = buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }];
  if (globalShow) {
    globalShow({ type: 'alert', title, message, buttons: list });
  } else {
    Alert.alert(title || '', message, list as any);
  }
}

/**
 * Trigger an Apple-style action sheet (bottom slide-up options).
 */
export function showActionSheet(
  options: {
    title?: string;
    message?: string;
    options: (string | AlertButton)[];
    cancelButtonIndex?: number;
    destructiveButtonIndex?: number;
  },
  callback?: (index: number) => void
): void {
  const buttons: AlertButton[] = options.options.map((opt, idx) => {
    if (typeof opt === 'object' && opt !== null) return opt;
    const isCancel = idx === options.cancelButtonIndex;
    const isDestructive = idx === options.destructiveButtonIndex;
    const style: AlertButton['style'] = isDestructive ? 'destructive' : isCancel ? 'cancel' : 'default';
    return {
      text: String(opt),
      style,
      onPress: () => {
        if (callback) callback(idx);
      },
    };
  });

  if (globalShow) {
    globalShow({
      type: 'action-sheet',
      title: options.title,
      message: options.message,
      buttons,
    });
  } else {
    showAlert(options.title, options.message, buttons);
  }
}

// Hook Alert.alert globally so existing or unexpected Alert.alert calls
// automatically render with the polished Apple-style UI instead of Android's stock AlertDialog.
if (typeof Alert !== 'undefined' && Alert.alert) {
  const originalAlert = Alert.alert.bind(Alert);
  Alert.alert = (title: string, message?: string, buttons?: any, options?: any) => {
    if (globalShow) {
      const list: AlertButton[] = Array.isArray(buttons) && buttons.length > 0
        ? buttons
        : [{ text: 'OK', style: 'default' }];
      // If 3+ buttons without message or menu-like, show as action-sheet
      const hasDestructive = list.some((b) => b.style === 'destructive');
      const isMenu = list.length >= 3;
      globalShow({
        type: isMenu ? 'action-sheet' : 'alert',
        title: title || undefined,
        message: message || undefined,
        buttons: list,
      });
    } else {
      originalAlert(title, message, buttons, options);
    }
  };
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<AlertPayload | null>(null);
  const insets = useSafeAreaInsets();

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    globalShow = (payload: AlertPayload) => {
      setCurrent(payload);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      anim.setValue(0);
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 36,
        bounciness: 4,
      }).start();
    };

    globalHide = () => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        setCurrent(null);
      });
    };

    return () => {
      globalShow = null;
      globalHide = null;
    };
  }, [anim]);

  // Handle hardware back on Android
  useEffect(() => {
    if (!current) return;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      dismiss(null);
      return true;
    });
    return () => backHandler.remove();
  }, [current]);

  const dismiss = (button: AlertButton | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.timing(anim, {
      toValue: 0,
      duration: 160,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setCurrent(null);
      if (button?.onPress) {
        button.onPress();
      }
    });
  };

  const isAlert = current?.type === 'alert';
  const isSheet = current?.type === 'action-sheet';

  // Backdrop fade
  const backdropOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // Alert card spring scale
  const alertScale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });

  // Action sheet slide up
  const sheetTranslateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  // Partition buttons for Action Sheet (regular/destructive vs cancel)
  const cancelBtn = current?.buttons.find((b) => b.style === 'cancel');
  const actionBtns = current?.buttons.filter((b) => b.style !== 'cancel') ?? [];

  return (
    <AlertContext.Provider value={{ show: globalShow || (() => {}), hide: globalHide || (() => {}) }}>
      {children}
      {current ? (
        <Modal transparent visible onRequestClose={() => dismiss(cancelBtn ?? null)} animationType="none" statusBarTranslucent>
          <View style={styles.modalRoot}>
            <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => dismiss(cancelBtn ?? null)}
                accessibilityLabel="Dismiss dialog"
              />
            </Animated.View>

            {isAlert && (
              <Animated.View
                style={[
                  styles.alertCard,
                  {
                    opacity: anim,
                    transform: [{ scale: alertScale }],
                  },
                ]}
              >
                {current.title ? (
                  <Text style={styles.alertTitle}>{current.title}</Text>
                ) : null}
                {current.message ? (
                  <Text style={styles.alertMessage}>{current.message}</Text>
                ) : null}

                {/* 2 Buttons: Clean side-by-side row */}
                {current.buttons.length === 2 ? (
                  <View style={styles.alertRow}>
                    {current.buttons.map((btn, idx) => {
                      const isCancel = btn.style === 'cancel';
                      const isDestructive = btn.style === 'destructive';
                      return (
                        <Pressable
                          key={idx}
                          onPress={() => dismiss(btn)}
                          style={({ pressed }) => [
                            styles.alertBtn,
                            isCancel ? styles.alertBtnCancel : isDestructive ? styles.alertBtnDestructive : styles.alertBtnPrimary,
                            pressed && { opacity: 0.8 },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={btn.text}
                        >
                          <Text
                            style={[
                              styles.alertBtnText,
                              isCancel ? styles.alertBtnTextCancel : isDestructive ? styles.alertBtnTextDestructive : styles.alertBtnTextPrimary,
                            ]}
                          >
                            {btn.text}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  /* 1 or 3+ Buttons: Stacked column */
                  <View style={styles.alertColumn}>
                    {current.buttons.map((btn, idx) => {
                      const isCancel = btn.style === 'cancel';
                      const isDestructive = btn.style === 'destructive';
                      return (
                        <Pressable
                          key={idx}
                          onPress={() => dismiss(btn)}
                          style={({ pressed }) => [
                            styles.alertBtnStacked,
                            isCancel ? styles.alertBtnCancel : isDestructive ? styles.alertBtnDestructive : styles.alertBtnPrimary,
                            pressed && { opacity: 0.8 },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={btn.text}
                        >
                          <Text
                            style={[
                              styles.alertBtnText,
                              isCancel ? styles.alertBtnTextCancel : isDestructive ? styles.alertBtnTextDestructive : styles.alertBtnTextPrimary,
                            ]}
                          >
                            {btn.text}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </Animated.View>
            )}

            {isSheet && (
              <Animated.View
                style={[
                  styles.sheetContainer,
                  {
                    paddingBottom: Math.max(insets.bottom, 16),
                    transform: [{ translateY: sheetTranslateY }],
                  },
                ]}
              >
                <View style={styles.sheetCard}>
                  {current.title || current.message ? (
                    <View style={styles.sheetHeader}>
                      {current.title ? <Text style={styles.sheetTitle}>{current.title}</Text> : null}
                      {current.message ? <Text style={styles.sheetMessage}>{current.message}</Text> : null}
                    </View>
                  ) : null}

                  {actionBtns.map((btn, idx) => {
                    const isDestructive = btn.style === 'destructive';
                    const isLast = idx === actionBtns.length - 1;
                    return (
                      <Pressable
                        key={idx}
                        onPress={() => dismiss(btn)}
                        style={({ pressed }) => [
                          styles.sheetRow,
                          !isLast && styles.sheetRowBorder,
                          pressed && { backgroundColor: '#28282b' },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={btn.text}
                      >
                        <Text
                          style={[
                            styles.sheetRowText,
                            isDestructive ? styles.sheetTextDestructive : styles.sheetTextNormal,
                          ]}
                        >
                          {btn.text}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Separate Cancel Button */}
                <Pressable
                  onPress={() => dismiss(cancelBtn ?? null)}
                  style={({ pressed }) => [
                    styles.sheetCancelBtn,
                    pressed && { backgroundColor: '#38383a' },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={cancelBtn?.text || 'Cancel'}
                >
                  <Text style={styles.sheetCancelText}>{cancelBtn?.text || 'Cancel'}</Text>
                </Pressable>
              </Animated.View>
            )}
          </View>
        </Modal>
      ) : null}
    </AlertContext.Provider>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  // --- Alert Card ---
  alertCard: {
    width: '85%',
    maxWidth: 320,
    borderRadius: 22,
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 24,
  },
  alertTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  alertMessage: {
    color: '#8e8e93',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  alertRow: {
    flexDirection: 'row',
    marginTop: 22,
    gap: 10,
    width: '100%',
  },
  alertColumn: {
    width: '100%',
    marginTop: 20,
    gap: 8,
  },
  alertBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBtnStacked: {
    width: '100%',
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBtnPrimary: {
    backgroundColor: '#ffffff',
  },
  alertBtnCancel: {
    backgroundColor: '#2c2c2e',
  },
  alertBtnDestructive: {
    backgroundColor: '#ff453a',
  },
  alertBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  alertBtnTextPrimary: {
    color: '#000000',
    fontWeight: '700',
  },
  alertBtnTextCancel: {
    color: '#ffffff',
  },
  alertBtnTextDestructive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  // --- Action Sheet ---
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
  },
  sheetCard: {
    borderRadius: 18,
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  sheetHeader: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  sheetTitle: {
    color: '#8e8e93',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  sheetMessage: {
    color: '#636366',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
    textAlign: 'center',
  },
  sheetRow: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c1c1e',
  },
  sheetRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  sheetRowText: {
    fontSize: 17,
  },
  sheetTextNormal: {
    color: '#ffffff',
    fontWeight: '500',
  },
  sheetTextDestructive: {
    color: '#ff453a',
    fontWeight: '600',
  },
  sheetCancelBtn: {
    marginTop: 8,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#2c2c2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
});
