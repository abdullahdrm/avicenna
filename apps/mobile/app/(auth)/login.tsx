import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { ArrowRight, Lock, Mail, User } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../../lib/LanguageContext';
import { useAuth } from '../_layout';

const API_URL = 'http://172.20.10.2:8000/api'; 

export default function LoginScreen() {
  const router = useRouter();
  const { setIsLoggedIn, setUserRole } = useAuth();
  const { t } = useLanguage();
  const [isRegistering, setIsRegistering] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (fromRegistration = false) => {
    if (!email || !password) {
      Alert.alert(t('loginScreen.error'), t('auth.pleaseEnter'));
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert(t('loginScreen.loginFailed'), data.detail || t('loginScreen.invalidCredentials'));
        return;
      }

      await SecureStore.setItemAsync('access_token', data.access);
      await SecureStore.setItemAsync('refresh_token', data.refresh);
      await SecureStore.setItemAsync('user', JSON.stringify(data.user));

      setIsLoggedIn(true);
      setUserRole(data.user.role);

      if (data.user.role === 'doctor') {
        router.replace('/(doctor)/main');
      } else {
        if (fromRegistration) {
          router.replace('/questionnaire');
        } else {
          router.replace('/(tabs)'); 
        }
      }
    } catch (error) {
      Alert.alert(t('loginScreen.networkError'), t('loginScreen.cannotReachServer'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      Alert.alert(t('loginScreen.error'), t('loginScreen.fillAllFields'));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('loginScreen.error'), t('loginScreen.passwordMismatch'));
      return;
    }

    if (password.length < 6) {
      Alert.alert(t('loginScreen.error'), t('loginScreen.minPassword'));
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/users/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          password: password,
          first_name: firstName, 
          last_name: lastName,   
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        Alert.alert(t('loginScreen.error'), data.email?.[0] || t('loginScreen.registrationFailed'));
        return;
      }

      await handleLogin(true); 

    } catch (error) {
      Alert.alert(t('loginScreen.networkError'), t('loginScreen.registrationFailed'));
    } finally {
      setLoading(false);
    }
  };
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.header}>
          <Image
            source={require('../../assets/images/logo1.png')}
            style={styles.logoBox}
          />
          <Text style={styles.subtitle}>
            {t('loginScreen.skinCompanion')}
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>
            {isRegistering ? t('loginScreen.createAccount') : t('loginScreen.welcomeBack')}
          </Text>

          {isRegistering && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <User size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  placeholder={t('loginScreen.firstName')}
                  style={styles.input}
                  placeholderTextColor="#9CA3AF"
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </View>
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <TextInput
                  placeholder={t('loginScreen.lastName')}
                  style={[styles.input, { paddingLeft: 12 }]}
                  placeholderTextColor="#9CA3AF"
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>
            </View>
          )}

          <View style={styles.inputContainer}>
            <Mail size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              placeholder={t('loginScreen.email')}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputContainer}>
            <Lock size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              placeholder={t('loginScreen.password')}
              style={styles.input}
              secureTextEntry
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {isRegistering && (
            <View style={styles.inputContainer}>
              <Lock size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                placeholder={t('loginScreen.confirmPassword')}
                style={styles.input}
                secureTextEntry
                placeholderTextColor="#9CA3AF"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>
          )}

          {!isRegistering && (
            <TouchableOpacity
              style={styles.button}
              onPress={() => handleLogin(false)}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? t('loginScreen.loggingIn') : t('loginScreen.logIn')}
              </Text>
              <ArrowRight size={20} color="white" />
            </TouchableOpacity>
          )}

          {isRegistering && (
            <TouchableOpacity
              style={styles.button}
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? t('loginScreen.creatingAccount') : t('loginScreen.signUp')}
              </Text>
              <ArrowRight size={20} color="white" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => setIsRegistering(!isRegistering)}
            style={styles.switchBtn}
          >
            <Text style={styles.switchText}>
              {isRegistering
                ? `${t('loginScreen.alreadyHaveAccount')} `
                : `${t('loginScreen.dontHaveAccount')} `}
              <Text style={styles.switchTextBold}>
                {isRegistering ? t('loginScreen.logIn') : t('loginScreen.signUp')}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  logoBox: { width: 300, height: 200, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#3891daff' },
  subtitle: { fontSize: 16, color: '#3891daff', marginTop: 8 },
  
  form: { backgroundColor: 'white', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  formTitle: { fontSize: 24, fontWeight: 'bold', color: '#3680c0ff', marginBottom: 24, textAlign: 'center' },
  
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, marginBottom: 16, paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, paddingVertical: 16, fontSize: 16, color: '#111827' },
  
  button: { backgroundColor: '#2588ebff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 12, marginTop: 8 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold', marginRight: 8 },
  
  switchBtn: { marginTop: 20, alignItems: 'center' },
  switchText: { color: '#323539ff', fontSize: 14 },
  switchTextBold: { color: '#478bd8ff', fontWeight: 'bold' },
});
