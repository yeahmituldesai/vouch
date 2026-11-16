import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState,
  BackHandler,
  Easing,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { api } from './api';
import { Icon } from './Icon';
import { C, R, T } from './theme';
import { Button, Press, success, tap } from './ui';

export type VersionInfo = {
  versionCode: number;
  versionName: string;
  downloadUrl: string;
  changelog: string;
  forceUpdate: boolean;
};

type UpdateStatus = 'idle' | 'downloading' | 'ready' | 'error';

export function UpdateChecker() {
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [bytesWritten, setBytesWritten] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [contentUri, setContentUri] = useState<string | null>(null);
  const [fileUri, setFileUri] = useState<string | null>(null);

  const downloadTaskRef = useRef<FileSystem.DownloadResumable | null>(null);
  const animatedProgress = useRef(new Animated.Value(0)).current;

  // Animate progress bar smoothly
  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: Math.max(0, Math.min(1, progress)),
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [progress, animatedProgress]);

  // Check for updates against server
  const checkForUpdate = async () => {
    if (Platform.OS !== 'android') return;
    try {
      const v = await api<VersionInfo>('/app-version');
      const current = Number(
        Constants.nativeBuildVersion ??
          Constants.expoConfig?.android?.versionCode ??
          1,
      );
      if (v.versionCode > current) {
        setInfo(v);
        setVisible(true);
      }
    } catch {
      /* offline or server starting up */
    }
  };

  useEffect(() => {
    checkForUpdate();

    // Listen for push notifications while app is in background or foreground
    const sub = Notifications.addNotificationResponseReceivedListener((event) => {
      const data = event.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      if (data?.type === 'app_update') {
        checkForUpdate();
      }
    });

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkForUpdate();
      }
    });

    return () => {
      sub.remove();
      appState.remove();
    };
  }, []);

  // Trap Android hardware back button so the modal cannot be dismissed (compulsory)
  useEffect(() => {
    if (!visible) return;
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true, // Prevents default back behavior
    );
    return () => backHandler.remove();
  }, [visible]);

  // Start downloading the APK directly in the app
  const startDownload = async () => {
    if (!info) return;
    tap();
    setStatus('downloading');
    setProgress(0);
    setBytesWritten(0);
    setTotalBytes(0);
    setErrorMsg(null);

    const targetUri = `${FileSystem.cacheDirectory}vouch-update-${info.versionCode}.apk`;
    setFileUri(targetUri);

    try {
      // Clear any prior download attempt
      const stat = await FileSystem.getInfoAsync(targetUri);
      if (stat.exists) {
        await FileSystem.deleteAsync(targetUri, { idempotent: true });
      }

      const task = FileSystem.createDownloadResumable(
        info.downloadUrl,
        targetUri,
        {},
        (data) => {
          if (data.totalBytesExpectedToWrite > 0) {
            const p = data.totalBytesWritten / data.totalBytesExpectedToWrite;
            setProgress(Math.max(0, Math.min(1, p)));
            setBytesWritten(data.totalBytesWritten);
            setTotalBytes(data.totalBytesExpectedToWrite);
          }
        },
      );

      downloadTaskRef.current = task;
      const result = await task.downloadAsync();

      if (!result?.uri) {
        throw new Error('Download incomplete: no package file saved.');
      }

      // Convert local file URI into content URI for Android PackageInstaller
      const cUri = await FileSystem.getContentUriAsync(result.uri);
      setContentUri(cUri);
      setStatus('ready');
      success();
    } catch (err: any) {
      console.warn('Update download error:', err);
      setStatus('error');
      setErrorMsg(err?.message || 'Failed to download update package.');
    }
  };

  // Launch Android package installer and prompt user to restart
  const handleRestartAndInstall = async () => {
    tap();
    try {
      if (contentUri) {
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 268435457, // FLAG_GRANT_READ_URI_PERMISSION (1) | FLAG_ACTIVITY_NEW_TASK (0x10000000)
          type: 'application/vnd.android.package-archive',
        });
        return;
      }
    } catch (err) {
      console.warn('Direct package install error:', err);
    }

    // Secondary fallback with direct URI
    if (fileUri) {
      try {
        const fallbackUri = await FileSystem.getContentUriAsync(fileUri);
        await Linking.openURL(fallbackUri);
        return;
      } catch {
        /* fallback to browser */
      }
    }

    // Ultimate fallback: open in browser
    if (info?.downloadUrl) {
      Linking.openURL(info.downloadUrl).catch(() => {});
    }
  };

  if (!visible || !info) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        // Compulsory: do not dismiss on Android back press
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header Status & Version Badge */}
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <View
                style={[
                  styles.badgeDot,
                  {
                    backgroundColor:
                      status === 'ready'
                        ? '#30d158'
                        : status === 'downloading'
                        ? '#0a84ff'
                        : '#ff9f0a',
                  },
                ]}
              />
              <Text style={styles.badgeText}>
                {status === 'ready'
                  ? 'UPDATE READY'
                  : status === 'downloading'
                  ? 'DOWNLOADING'
                  : 'COMPULSORY UPDATE'}
              </Text>
            </View>
            <Text style={styles.versionTag}>{info.versionName}</Text>
          </View>

          {/* Icon Badge */}
          <View style={styles.iconContainer}>
            <Icon
              name={status === 'ready' ? 'check' : status === 'downloading' ? 'down' : 'bell'}
              size={24}
              color={C.t}
            />
          </View>

          {/* Heading */}
          <Text style={styles.title}>
            {status === 'ready'
              ? 'Restart & Update'
              : status === 'downloading'
              ? 'Downloading Update'
              : `Update to ${info.versionName}`}
          </Text>

          {/* Subtitle / Description */}
          <Text style={styles.subtitle}>
            {status === 'ready'
              ? 'The update is downloaded and ready. Tap Restart to install the new version.'
              : status === 'downloading'
              ? 'Please keep Vouch open while we download the latest package.'
              : 'A required update is available to continue using Vouch with the latest features.'}
          </Text>

          {/* State Specific Body */}
          {status === 'downloading' && (
            <View style={styles.progressBox}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressPercent}>
                  {Math.round(progress * 100)}%
                </Text>
                {totalBytes > 0 && (
                  <Text style={styles.progressBytes}>
                    {(bytesWritten / (1024 * 1024)).toFixed(1)} /{' '}
                    {(totalBytes / (1024 * 1024)).toFixed(1)} MB
                  </Text>
                )}
              </View>
              <View style={styles.progressBarTrack}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width: animatedProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
            </View>
          )}

          {status === 'idle' && (
            <View style={styles.changelogCard}>
              <Text style={styles.changelogHeader}>WHAT'S NEW</Text>
              <Text style={styles.changelogBody}>{info.changelog}</Text>
            </View>
          )}

          {status === 'ready' && (
            <View style={styles.readyCard}>
              <View style={styles.readyRow}>
                <Icon name="check" size={16} color="#30d158" />
                <Text style={styles.readyRowText}>Package verified & ready</Text>
              </View>
              <Text style={styles.readyNotice}>
                Android Package Installer will launch to finalize the update. After installation, Vouch restarts automatically.
              </Text>
            </View>
          )}

          {status === 'error' && (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Download Interrupted</Text>
              <Text style={styles.errorText}>
                {errorMsg || 'Could not complete the package download. Please check your internet connection.'}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            {status === 'ready' ? (
              <>
                <Button
                  title="Restart & Install"
                  onPress={handleRestartAndInstall}
                  kind="white"
                />
                <Press
                  onPress={() => BackHandler.exitApp()}
                  style={styles.closeAppButton}
                >
                  <Text style={styles.closeAppText}>Close App</Text>
                </Press>
              </>
            ) : status === 'downloading' ? (
              <View style={styles.downloadingPlaceholder}>
                <Text style={styles.downloadingPlaceholderText}>
                  Installing as soon as download finishes…
                </Text>
              </View>
            ) : status === 'error' ? (
              <>
                <Button
                  title="Retry Download"
                  onPress={startDownload}
                  kind="white"
                />
                <Press
                  onPress={() => Linking.openURL(info.downloadUrl).catch(() => {})}
                  style={styles.closeAppButton}
                >
                  <Text style={styles.closeAppText}>Open in Browser</Text>
                </Press>
              </>
            ) : (
              <Button
                title="Update Now"
                onPress={startDownload}
                kind="white"
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Hook export for backward compatibility
export function useUpdateCheck() {
  // Handled inside UpdateChecker component
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: C.s1,
    borderRadius: R.sheet,
    padding: 24,
    borderWidth: 1,
    borderColor: C.s3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.65,
    shadowRadius: 28,
    elevation: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.s2,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: R.pill,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  badgeText: {
    color: C.t,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  versionTag: {
    color: C.g,
    fontSize: 12.5,
    fontWeight: '600',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.s2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: C.t,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: C.g,
    lineHeight: 20,
    marginBottom: 18,
  },
  changelogCard: {
    backgroundColor: C.s2,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.s3,
    marginBottom: 20,
  },
  changelogHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: C.g,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  changelogBody: {
    fontSize: 13.5,
    color: C.t,
    lineHeight: 19,
  },
  progressBox: {
    backgroundColor: C.s2,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.s3,
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressPercent: {
    fontSize: 26,
    fontWeight: '800',
    color: C.t,
    letterSpacing: -0.5,
  },
  progressBytes: {
    fontSize: 13,
    color: C.g,
    fontWeight: '600',
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: C.s3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: C.t,
  },
  readyCard: {
    backgroundColor: C.s2,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.s3,
    marginBottom: 20,
  },
  readyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  readyRowText: {
    color: C.t,
    fontSize: 13.5,
    fontWeight: '600',
    marginLeft: 6,
  },
  readyNotice: {
    color: C.g,
    fontSize: 12.5,
    lineHeight: 18,
  },
  errorCard: {
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.3)',
    marginBottom: 20,
  },
  errorTitle: {
    color: '#ff453a',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  errorText: {
    color: C.t,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    marginTop: 4,
  },
  downloadingPlaceholder: {
    height: 52,
    borderRadius: 26,
    backgroundColor: C.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadingPlaceholderText: {
    color: C.g,
    fontSize: 13.5,
    fontWeight: '600',
  },
  closeAppButton: {
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  closeAppText: {
    color: C.g,
    fontSize: 14,
    fontWeight: '600',
  },
});
