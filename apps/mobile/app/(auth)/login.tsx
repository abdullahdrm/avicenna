import { useRouter } from 'expo-router';
import { ArrowRight, Lock, Mail, User } from 'lucide-react-native';
import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const router = useRouter();
  const [isRegistering, setIsRegistering] = useState(false);

  const handleAuth = () => {
    router.replace('/questionnaire' as any);
  };
  const handleLogin = () => {
    router.replace('/(tabs)' as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
        
        <View style={styles.header}>
          <Image
            source={require("../../assets/images/logo1.png")}
           style={styles.logoBox}
          />
          <Text style={styles.subtitle}>Your personal skin health companion</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>{isRegistering ? 'Create Account' : 'Welcome Back'}</Text>

          {isRegistering && (
            <View style={styles.inputContainer}>
              <User size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput placeholder="Full Name" style={styles.input} placeholderTextColor="#9CA3AF" />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Mail size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput placeholder="Email Address" style={styles.input} keyboardType="email-address" placeholderTextColor="#9CA3AF" />
          </View>

          <View style={styles.inputContainer}>
            <Lock size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput placeholder="Password" style={styles.input} secureTextEntry placeholderTextColor="#9CA3AF" />
          </View>

          {!isRegistering && (
            <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>{'Log In'}</Text>
            <ArrowRight size={20} color="white" />
          </TouchableOpacity>
          )}
          {isRegistering && (
            <TouchableOpacity style={styles.button} onPress={handleAuth}>
            <Text style={styles.buttonText}>{'Sign Up'}</Text>
            <ArrowRight size={20} color="white" />
          </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)} style={styles.switchBtn}>
            <Text style={styles.switchText}>
              {isRegistering ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={styles.switchTextBold}>{isRegistering ? 'Log In' : 'Sign Up'}</Text>
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
  switchTextBold: { color: '#478bd8ff', fontWeight: 'bold' }
});