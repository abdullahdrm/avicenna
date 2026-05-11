import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Calendar,
  FileText,
  Pill,
  Ruler,
  Save,
  User,
  Weight
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePatientTheme } from '../lib/PatientThemeContext';

const API_URL = 'http://172.20.10.2:8000/api';

export default function EditProfileScreen() {
  const router = useRouter();
  const { colors } = usePatientTheme();
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [age, setAge] = useState('');
  const [skinType, setSkinType] = useState('');
  const [allergies, setAllergies] = useState('');

  const [conditions, setConditions] = useState('');
  const [medications, setMedications] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (!token) {
        router.replace('/login');
        return;
      }

      const userJson = await SecureStore.getItemAsync('user');
      if (userJson) {
        const user = JSON.parse(userJson);
        setName(user.first_name || user.username || '');
      }

      const response = await fetch(`${API_URL}/profile/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setHeight(data.height?.toString() || '');
        setWeight(data.weight?.toString() || '');
        setAge(data.age?.toString() || '');
        setSkinType(data.skin_type || '');
        setAllergies(data.allergies || '');

        setConditions(data.medical_conditions || '');
        setMedications(data.medications || '');
      }
    } catch (error) {
      console.error('Edit profile load error:', error);
      Alert.alert('Error', 'Network connection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync('access_token');
      if (!token) {
        router.replace('/login');
        return;
      }

      const payload = {
        height: parseFloat(height) || null,
        weight: parseFloat(weight) || null,
        age: parseInt(age) || null,

        skin_type: skinType.toLowerCase(),

        allergies: allergies,
        medical_conditions: conditions,
        medications: medications,
      };

      const response = await fetch(`${API_URL}/profile/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        Alert.alert('Success', 'Profile updated', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        const errorData = await response.json();
        Alert.alert('Error', 'Failed to update profile');
        console.log(errorData);
      }
    } catch (error) {
      console.error('Edit profile save error:', error);
      Alert.alert('Error', 'Network error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.mutedText }]}>Full Name</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <User size={20} color={colors.faintText} />
            <TextInput style={[styles.input, { color: colors.text }]} value={name} onChangeText={setName} placeholderTextColor={colors.faintText} />
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={[styles.label, { color: colors.mutedText }]}>Age</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Calendar size={20} color={colors.faintText} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={age}
                onChangeText={setAge}
                keyboardType="numeric"
                placeholder="Years"
                placeholderTextColor={colors.faintText}
              />
            </View>
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={[styles.label, { color: colors.mutedText }]}>Height (cm)</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ruler size={20} color={colors.faintText} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={height}
                onChangeText={setHeight}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={[styles.label, { color: colors.mutedText }]}>Weight (kg)</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Weight size={20} color={colors.faintText} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
              />
            </View>
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={[styles.label, { color: colors.mutedText }]}>Skin Type</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Activity size={20} color={colors.faintText} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={skinType}
                onChangeText={setSkinType}
                placeholder="Oily/Dry"
                placeholderTextColor={colors.faintText}
              />
            </View>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.mutedText }]}>Allergies</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AlertCircle size={20} color={colors.faintText} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={allergies}
              onChangeText={setAllergies}
              placeholder="List any allergies..."
              placeholderTextColor={colors.faintText}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.mutedText }]}>Medical Conditions</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <FileText size={20} color={colors.faintText} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={conditions}
              onChangeText={setConditions}
              placeholder="e.g. Diabetes, Eczema..."
              placeholderTextColor={colors.faintText}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.mutedText }]}>Medications</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pill size={20} color={colors.faintText} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={medications}
              onChangeText={setMedications}
              placeholder="List current medications..."
              placeholderTextColor={colors.faintText}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Save size={20} color="white" />
          <Text style={styles.saveBtnText}>Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  saveText: { color: '#2563EB', fontWeight: '600', fontSize: 16 },
  content: { padding: 24 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, height: 56, gap: 12, backgroundColor: '#F9FAFB' },
  input: { flex: 1, fontSize: 16, color: '#111827' },
  row: { flexDirection: 'row', gap: 16 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563EB', padding: 18, borderRadius: 16, marginTop: 24, marginBottom: 40, gap: 8 },
  saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
