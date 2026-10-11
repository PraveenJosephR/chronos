
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFonts } from 'expo-font';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer } from 'expo-audio';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';



const STORAGE_KEY = '@gym_rest_timer_default_seconds';

const INITIAL_TIME = 2 * 60;

// Your sound file:
const TIMER_SOUND = require('../../assets/timer-end.mp3');

export default function Index() {
  const [fontsLoaded,fontError] = useFonts({
  SpaceNova: require('../../assets/SpaceNova-6Rpd1.otf'),
});



  /*
   * ---------------------------------------------------------
   * STATE
   * ---------------------------------------------------------
   */

  const [dimensions, setDimensions] = useState(
    Dimensions.get('window')
  );

  const [defaultTime, setDefaultTime] = useState(INITIAL_TIME);

  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME);

  const [running, setRunning] = useState(false);

  const [settingsVisible, setSettingsVisible] = useState(false);

  const [minutesInput, setMinutesInput] = useState('2');

  const [secondsInput, setSecondsInput] = useState('0');

  /*
   * ---------------------------------------------------------
   * REFS
   * ---------------------------------------------------------
   */

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const tapCountRef = useRef(0);

  /*
   * ---------------------------------------------------------
   * AUDIO
   * ---------------------------------------------------------
   */

  const endSound = useAudioPlayer(TIMER_SOUND);

  /*
   * ---------------------------------------------------------
   * SCREEN SETUP
   * ---------------------------------------------------------
   */

  useEffect(() => {
    const configureScreen = async () => {
      try {
        // Allow portrait + landscape.
        await ScreenOrientation.unlockAsync();

        // Hide Android navigation bar.
       
      } catch (error) {
        console.log('System UI configuration:', error);
      }
    };

    configureScreen();

    const subscription = Dimensions.addEventListener(
      'change',
      ({ window }) => {
        setDimensions(window);
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  /*
   * ---------------------------------------------------------
   * LOAD SAVED DEFAULT TIMER
   * ---------------------------------------------------------
   */

  useEffect(() => {
    const loadSavedTime = async () => {
      try {
        const storedValue = await AsyncStorage.getItem(
          STORAGE_KEY
        );

        if (!storedValue) {
          return;
        }

        const storedSeconds = Number(storedValue);

        if (
          Number.isFinite(storedSeconds) &&
          storedSeconds > 0
        ) {
          setDefaultTime(storedSeconds);
          setTimeLeft(storedSeconds);

          setMinutesInput(
            String(Math.floor(storedSeconds / 60))
          );

          setSecondsInput(
            String(storedSeconds % 60)
          );
        }
      } catch (error) {
        console.log('Could not load saved timer:', error);
      }
    };

    loadSavedTime();
  }, []);

  /*
   * ---------------------------------------------------------
   * TIMER
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((currentTime) => {
        /*
         * Timer finished.
         */
        if (currentTime <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          setRunning(false);

          /*
           * Play sound exactly once.
           */
          try {
            endSound.seekTo(0);
            endSound.play();
          } catch (error) {
            console.log('Could not play timer sound:', error);
          }

          /*
           * Automatically reset to saved default.
           */
          return defaultTime;
        }

        return currentTime - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running, defaultTime, endSound]);

  /*
   * ---------------------------------------------------------
   * CLEANUP
   * ---------------------------------------------------------
   */

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

  /*
   * ---------------------------------------------------------
   * TIMER CONTROLS
   * ---------------------------------------------------------
   */

  const toggleTimer = useCallback(() => {
    if (timeLeft <= 0) {
      setTimeLeft(defaultTime);
    }

    setRunning((current) => !current);
  }, [timeLeft, defaultTime]);

  const resetTimer = useCallback(() => {
    setRunning(false);
    setTimeLeft(defaultTime);
  }, [defaultTime]);

  /*
   * ---------------------------------------------------------
   * SETTINGS
   * ---------------------------------------------------------
   */

  const openSettings = useCallback(() => {
    setRunning(false);

    setMinutesInput(
      String(Math.floor(timeLeft / 60))
    );

    setSecondsInput(
      String(timeLeft % 60)
    );

    setSettingsVisible(true);
  }, [timeLeft]);

  const saveSettings = async () => {
    let minutes = parseInt(minutesInput, 10);

    let seconds = parseInt(secondsInput, 10);

    if (!Number.isFinite(minutes)) {
      minutes = 0;
    }

    if (!Number.isFinite(seconds)) {
      seconds = 0;
    }

    minutes = Math.max(0, minutes);

    seconds = Math.max(0, Math.min(59, seconds));

    const totalSeconds =
      minutes * 60 + seconds;

    if (totalSeconds <= 0) {
      Alert.alert(
        'INVALID TIME',
        'Set a time greater than zero.'
      );

      return;
    }

    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        String(totalSeconds)
      );

      setDefaultTime(totalSeconds);

      setTimeLeft(totalSeconds);

      setMinutesInput(String(minutes));

      setSecondsInput(String(seconds));

      setSettingsVisible(false);
    } catch (error) {
      console.log('Could not save timer:', error);
    }
  };

  /*
   * ---------------------------------------------------------
   * TAP GESTURES
   *
   * 1 tap = start / pause
   * 2 taps = settings
   * 3 taps = reset
   * ---------------------------------------------------------
   */

  const handleScreenTap = useCallback(() => {
    tapCountRef.current += 1;

    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    tapTimeoutRef.current = setTimeout(() => {
      const numberOfTaps = tapCountRef.current;

      tapCountRef.current = 0;

      if (numberOfTaps === 1) {
        toggleTimer();
      } else if (numberOfTaps === 2) {
        resetTimer();
      } 
    }, 280);
  }, [toggleTimer, openSettings, resetTimer]);

  /*
   * ---------------------------------------------------------
   * DISPLAY
   * ---------------------------------------------------------
   */

  const isLandscape =
    dimensions.width > dimensions.height;

  const minutes = Math.floor(timeLeft / 60);

  const seconds = timeLeft % 60;

  const minuteText =
    String(minutes).padStart(2, '0');

  const secondText =
    String(seconds).padStart(2, '0');

  const landscapeFontSize = Math.min(
    dimensions.width * 0.34,
    dimensions.height * 0.85
  );

  const portraitFontSize = Math.min(
    dimensions.width * 0.78,
    dimensions.height * 0.34
  );

  /*
   * ---------------------------------------------------------
   * UI
   * ---------------------------------------------------------
   */

  return (
    <View style={styles.root}>

      <StatusBar hidden />

      {/*
       * EVERYTHING on the main screen is one giant
       * touch surface.
       *
       * There are no buttons.
       */}

      <Pressable
        style={styles.touchSurface}
        onPress={handleScreenTap}
        onLongPress={openSettings}
      >
        <View
          style={[
            styles.timerScreen,
            isLandscape
              ? styles.landscape
              : styles.portrait,
          ]}
        >

          {/*
           * LANDSCAPE
           *
           *              02:00
           */}

          {isLandscape ? (
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              minimumFontScale={0.35}
              style={[
                styles.timerText,
                {
                  fontSize: landscapeFontSize,
                },
              ]}
            >
              {minuteText}:{secondText}
            </Text>
          ) : (

            /*
             * PORTRAIT
             *
             *              02
             *
             *          ▬ ▬ ▬ ▬ ▬
             *
             *              00
             */

            <View style={styles.portraitTimer}>

              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                minimumFontScale={0.35}
                style={[
                  styles.timerText,
                  {
                    fontSize: portraitFontSize,
                  },
                ]}
              >
                {minuteText}
              </Text>

              {/* <View style={styles.cyberDivider}>
                <View style={styles.dividerPiece} />
                <View style={styles.dividerPiece} />
                <View style={styles.dividerPiece} />
                <View style={styles.dividerPiece} />
                <View style={styles.dividerPiece} />
              </View> */}

              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                minimumFontScale={0.35}
                style={[
                  styles.timerText,
                  {
                    fontSize: portraitFontSize,
                  },
                ]}
              >
                {secondText}
              </Text>

            </View>
          )}

        </View>
      </Pressable>

      {/*
       * -----------------------------------------------------
       * SETTINGS DIALOG
       *
       * Only appears after double tap.
       * -----------------------------------------------------
       */}

      <Modal
        visible={settingsVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          setSettingsVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>

          <View style={styles.modalCard}>

            <Text style={styles.modalTitle}>
              REST TIME
            </Text>

            <View style={styles.timeInputs}>

              <View style={styles.inputContainer}>

                <Text style={styles.inputLabel}>
                  MINUTES
                </Text>

                <TextInput
                  value={minutesInput}
                  onChangeText={setMinutesInput}
                  keyboardType="number-pad"
                  maxLength={3}
                  selectTextOnFocus
                  style={styles.timeInput}
                />

              </View>

              <Text style={styles.inputColon}>
                :
              </Text>

              <View style={styles.inputContainer}>

                <Text style={styles.inputLabel}>
                  SECONDS
                </Text>

                <TextInput
                  value={secondsInput}
                  onChangeText={setSecondsInput}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  style={styles.timeInput}
                />

              </View>

            </View>

            <View style={styles.modalActions}>

              <Pressable
                style={styles.cancelButton}
                onPress={() => {
                  setSettingsVisible(false);
                }}
              >
                <Text style={styles.cancelText}>
                  CANCEL
                </Text>
              </Pressable>

              <Pressable
                style={styles.setButton}
                onPress={saveSettings}
              >
                <Text style={styles.setText}>
                  SET
                </Text>
              </Pressable>

            </View>

          </View>

        </View>
      </Modal>

    </View>
  );
}

/*
 * ============================================================
 * STYLES
 * ============================================================
 */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050816',
  },

  touchSurface: {
    flex: 1,
  },

  timerScreen: {
    flex: 1,

    margin: 8,

    backgroundColor: '#10f9f8',

    borderWidth: 4,
    borderColor: '#10f9f8',

    overflow: 'hidden',
  },

  landscape: {
    flexDirection: 'row',

    justifyContent: 'center',
    alignItems: 'center',

    paddingHorizontal: '3%',
  },

  portrait: {
    justifyContent: 'center',
    alignItems: 'center',

    paddingVertical: '4%',
    paddingHorizontal: '5%',
  },

  portraitTimer: {
    flex: 1,

    width: '100%',

    alignItems: 'center',
    justifyContent: 'space-evenly',
  },

  /*
   * GIANT NEON NUMBERS
   */

  timerText: {
    fontFamily: 'SpaceNova',
    color: '#f7ea0d',

    // fontWeight: '900',
     transform: [{ translateY: 18 },{ scaleY: 1.55 }],
     

    // letterSpacing: -4,

    includeFontPadding: false,

    textAlign: 'center',

  },

  /*
   * PORTRAIT DIVIDER
   */

  cyberDivider: {
    flexDirection: 'row',

    alignItems: 'center',
    justifyContent: 'center',

    gap: 7,

    marginVertical: 2,

    opacity: 0.9,
  },

  dividerPiece: {
    width: 18,
    height: 7,

    backgroundColor: '#00D9FF',

    shadowColor: '#00D9FF',

    shadowOffset: {
      width: 0,
      height: 0,
    },

    shadowOpacity: 1,

    shadowRadius: 8,

    elevation: 5,
  },

  /*
   * SETTINGS MODAL
   */

  modalOverlay: {
    flex: 1,

    backgroundColor: 'rgba(1, 3, 12, 0.88)',

    justifyContent: 'center',
    alignItems: 'center',

    padding: 20,
  },

  modalCard: {
    width: '92%',
    maxWidth: 440,

    backgroundColor: '#07112D',

    borderWidth: 3,
    borderColor: '#00D9FF',

    paddingHorizontal: 25,
    paddingVertical: 28,

    shadowColor: '#00D9FF',

    shadowOffset: {
      width: 0,
      height: 0,
    },

    shadowOpacity: 1,

    shadowRadius: 22,

    elevation: 20,
  },

  modalTitle: {
    color: '#F6FF00',

    fontSize: 27,

    fontWeight: '900',

    letterSpacing: 5,

    textAlign: 'center',

    marginBottom: 28,

    textShadowColor: '#00D9FF',

    textShadowOffset: {
      width: 0,
      height: 0,
    },

    textShadowRadius: 8,
  },

  timeInputs: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',
  },

  inputContainer: {
    alignItems: 'center',
  },

  inputLabel: {
    color: '#00D9FF',

    fontSize: 11,

    fontWeight: '900',

    letterSpacing: 2,

    marginBottom: 8,
  },

  timeInput: {
    width: 105,
    height: 76,

    backgroundColor: '#02040C',

    borderWidth: 2,
    borderColor: '#F6FF00',

    color: '#F6FF00',

    fontSize: 40,

    fontWeight: '900',

    textAlign: 'center',

    padding: 0,
  },

  inputColon: {
    color: '#F6FF00',

    fontSize: 43,

    fontWeight: '900',

    marginHorizontal: 10,

    marginTop: 20,
  },

  modalActions: {
    flexDirection: 'row',

    gap: 12,

    marginTop: 30,
  },

  cancelButton: {
    flex: 1,

    height: 55,

    borderWidth: 2,
    borderColor: '#263A6D',

    justifyContent: 'center',
    alignItems: 'center',
  },

  cancelText: {
    color: '#8193C4',

    fontSize: 13,

    fontWeight: '900',

    letterSpacing: 2,
  },

  setButton: {
    flex: 1,

    height: 55,

    backgroundColor: '#F6FF00',

    borderWidth: 2,
    borderColor: '#F6FF00',

    justifyContent: 'center',
    alignItems: 'center',

    shadowColor: '#F6FF00',

    shadowOffset: {
      width: 0,
      height: 0,
    },

    shadowOpacity: 0.8,

    shadowRadius: 12,

    elevation: 8,
  },

  setText: {
    color: '#050816',

    fontSize: 13,

    fontWeight: '900',

    letterSpacing: 2,
  },
});

