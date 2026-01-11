import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path, G, Rect } from 'react-native-svg';
import { wp, hp, sp, fp } from '@/utils/responsive';
import { useAuthStore } from '@watchsphere/shared/stores';
import { api } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

// Required for Google auth to work properly
WebBrowser.maybeCompleteAuthSession();

// WatchSphere Logo matching Figma design (77x64)
function WSLogo() {
  return (
    <View style={styles.logoContainer}>
      <Svg width={sp(77)} height={sp(64)} viewBox="0 0 77 64" fill="none">
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M47.6224 29.5414H56.6389L58.6424 18.4562H63.6571L61.6535 29.5414H63.6718C70.6808 29.5416 76.3636 35.2013 76.3636 42.182C76.3635 49.1627 70.6807 54.8225 63.6718 54.8227H57.0851L55.4266 64H48.8347L47.1762 54.8227H30.7972L29.1387 64H22.5468L20.8883 54.8227H0.285159V49.9047H52.9591L55.7502 34.4586H48.5111L50.5146 45.5453H45.4984L40.6027 18.4562H45.6189L47.6224 29.5414ZM57.9738 49.9047H63.6718C67.9545 49.9045 71.4271 46.4475 71.4273 42.182C71.4273 37.9165 67.9546 34.4588 63.6718 34.4586H60.7648L57.9738 49.9047Z"
          fill="#1D1D1F"
        />
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M17.6533 9.17733H34.0322L35.6907 0H42.2826L43.9412 9.17733H60.3201L61.9786 0H66.9933L65.3348 9.17733H76.3636V14.0953H18.542L21.3345 29.5414H30.351L32.3545 18.4562H37.3707L32.4749 45.5453H27.4588L29.4623 34.4586H22.2232L24.2267 45.5453H19.2106L17.2071 34.4586H12.6903C5.68145 34.4583 0 28.7987 0 21.818C9.25611e-05 14.8545 5.65354 9.20536 12.6386 9.17733L10.9801 0H15.9948L17.6533 9.17733ZM13.5273 14.0953C9.02479 14.0953 4.93572 16.969 4.93562 21.818C4.93562 26.0834 8.40768 29.5411 12.6903 29.5414H16.3184L13.5273 14.0953Z"
          fill="#1D1D1F"
        />
      </Svg>
    </View>
  );
}

// Apple Logo SVG
function AppleLogo() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="#1D1D1F">
      <Path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
    </Svg>
  );
}

// Google Logo SVG
function GoogleLogo() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <Path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </Svg>
  );
}

export default function WelcomeScreen() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [isAppleLoginAvailable, setIsAppleLoginAvailable] = useState(false);

  const login = useAuthStore((state) => state.login);

  // Configure Google Sign In with expo-auth-session
  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const [request, response, promptAsync] = Google.useAuthRequest(
    googleClientId ? {
      expoClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    } : undefined as any
  );

  // Check if Apple Sign In is available
  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setIsAppleLoginAvailable);
  }, []);

  // Handle Google auth response
  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.accessToken) {
        handleGoogleAuth(authentication.accessToken);
      }
    }
  }, [response]);

  // Handle OAuth success
  const handleOAuthSuccess = async (user: any, access_token: string, refresh_token: string, isNewUser: boolean) => {
    await AsyncStorage.setItem('auth_token', access_token);
    await AsyncStorage.setItem('refresh_token', refresh_token);
    login(user, access_token);

    // Check if notification prompt has been shown before
    const notificationPromptShown = await AsyncStorage.getItem('notification_prompt_shown');
    if (!notificationPromptShown) {
      router.replace('/(auth)/notifications');
    } else if (isNewUser) {
      router.replace('/(auth)/onboarding');
    } else {
      router.replace('/(tabs)');
    }
  };

  // Handle Google authentication with access token
  const handleGoogleAuth = async (accessToken: string) => {
    setGoogleLoading(true);
    try {
      const response = await api.post('/auth/google', {
        access_token: accessToken,
      });

      const { user, access_token: authToken, refresh_token, is_new_user } = response.data;
      await handleOAuthSuccess(user, authToken, refresh_token, is_new_user);
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Google sign in failed';
      Alert.alert('Error', errorMessage);
    } finally {
      setGoogleLoading(false);
    }
  };

  // Google Sign In handler
  const handleGoogleSignIn = async () => {
    if (!googleClientId) {
      Alert.alert('Configuration Error', 'Google Sign In is not configured. Please set up the Google Client ID.');
      return;
    }
    if (!request) {
      Alert.alert('Error', 'Google Sign In is not ready. Please try again.');
      return;
    }
    setGoogleLoading(true);
    try {
      await promptAsync();
    } catch (error: any) {
      Alert.alert('Error', 'Google sign in failed');
      setGoogleLoading(false);
    }
  };

  // Apple Sign In handler
  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        const userName = credential.fullName
          ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
          : undefined;

        const response = await api.post('/auth/apple', {
          id_token: credential.identityToken,
          user_name: userName,
        });

        const { user, access_token, refresh_token, is_new_user } = response.data;
        await handleOAuthSuccess(user, access_token, refresh_token, is_new_user);
      }
    } catch (error: any) {
      if (error.code !== 'ERR_REQUEST_CANCELED') {
        const errorMessage = error.response?.data?.detail || 'Apple sign in failed';
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Main Content - Centered */}
        <View style={styles.mainContent}>
          {/* Logo */}
          <WSLogo />

          {/* Welcome Text */}
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeTitle}>Welcome to</Text>
            <Text style={styles.welcomeTitle}>WatchSphere</Text>
            <Text style={styles.welcomeSubtitle}>
              Track market prices, manage your inventory, and trade securely with trusted dealers - all in one place.
            </Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            {/* Continue with Apple */}
            {isAppleLoginAvailable && (
              <TouchableOpacity
                style={styles.socialButton}
                activeOpacity={0.7}
                onPress={handleAppleSignIn}
                disabled={appleLoading || googleLoading}
              >
                <AppleLogo />
                <Text style={styles.socialButtonText}>
                  {appleLoading ? 'Signing in...' : 'Continue with Apple'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Continue with Google */}
            <TouchableOpacity
              style={styles.socialButton}
              activeOpacity={0.7}
              onPress={handleGoogleSignIn}
              disabled={googleLoading || appleLoading}
            >
              <GoogleLogo />
              <Text style={styles.socialButtonText}>
                {googleLoading ? 'Signing in...' : 'Continue with Google'}
              </Text>
            </TouchableOpacity>

            {/* Sign Up Button */}
            <TouchableOpacity
              style={styles.signUpButton}
              onPress={() => router.push('/(auth)/register')}
              activeOpacity={0.8}
              disabled={googleLoading || appleLoading}
            >
              <Text style={styles.signUpButtonText}>Sign Up</Text>
            </TouchableOpacity>

            {/* Log In Button */}
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => router.push('/(auth)/login')}
              activeOpacity={0.7}
              disabled={googleLoading || appleLoading}
            >
              <Text style={styles.loginButtonText}>Log in</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer Links - Fixed at bottom */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={() => router.push('/privacy-policy' as any)}>
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/terms-conditions' as any)}>
            <Text style={styles.footerLink}>Terms and Conditions</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/contact' as any)}>
            <Text style={styles.footerLink}>Contact</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: wp(24),
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: hp(40),
  },
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: hp(48),
  },
  welcomeTitle: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(34),
    fontWeight: '700',
    color: '#1D1D1F',
    textAlign: 'center',
    lineHeight: fp(41),
    letterSpacing: -0.4,
  },
  welcomeSubtitle: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(16),
    color: 'rgba(33, 33, 33, 0.8)',
    textAlign: 'center',
    lineHeight: fp(24),
    marginTop: hp(16),
    paddingHorizontal: wp(8),
  },
  buttonsContainer: {
    width: '100%',
    gap: hp(12),
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: sp(999),
    height: hp(48),
    gap: wp(10),
    borderWidth: 1,
    borderColor: 'rgba(29, 29, 31, 0.05)',
  },
  socialButtonText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(16),
    fontWeight: '500',
    color: '#1D1D1F',
  },
  signUpButton: {
    backgroundColor: '#1D1D1F',
    borderRadius: sp(999),
    height: hp(48),
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpButtonText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(16),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loginButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: sp(999),
    height: hp(48),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(29, 29, 31, 0.05)',
  },
  loginButtonText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(16),
    fontWeight: '500',
    color: '#1D1D1F',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: wp(24),
    paddingBottom: hp(16),
  },
  footerLink: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(14),
    fontWeight: '400',
    color: 'rgba(0, 0, 0, 0.7)',
  },
});
