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

const API_URL = 'http://10.239.178.43:8000/api'; 

export default function EditProfileScreen() {
  const router = useRouter();
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
      if (!token) return;

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
      Alert.alert('Error', 'Network connection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync('access_token');
      
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
      Alert.alert('Error', 'Network error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputWrapper}>
            <User size={20} color="#9CA3AF" />
            <TextInput style={styles.input} value={name} onChangeText={setName} />
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Age</Text>
            <View style={styles.inputWrapper}>
              <Calendar size={20} color="#9CA3AF" />
              <TextInput 
                style={styles.input} 
                value={age} 
                onChangeText={setAge} 
                keyboardType="numeric" 
                placeholder="Years"
              />
            </View>
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Height (cm)</Text>
            <View style={styles.inputWrapper}>
              <Ruler size={20} color="#9CA3AF" />
              <TextInput 
                style={styles.input} 
                value={height} 
                onChangeText={setHeight} 
                keyboardType="numeric" 
              />
            </View>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Weight (kg)</Text>
            <View style={styles.inputWrapper}>
              <Weight size={20} color="#9CA3AF" />
              <TextInput 
                style={styles.input} 
                value={weight} 
                onChangeText={setWeight} 
                keyboardType="numeric" 
              />
            </View>
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Skin Type</Text>
            <View style={styles.inputWrapper}>
              <Activity size={20} color="#9CA3AF" />
              <TextInput 
                style={styles.input} 
                value={skinType} 
                onChangeText={setSkinType} 
                placeholder="Oily/Dry"
              />
            </View>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Allergies</Text>
          <View style={styles.inputWrapper}>
            <AlertCircle size={20} color="#9CA3AF" />
            <TextInput 
              style={styles.input} 
              value={allergies} 
              onChangeText={setAllergies} 
              placeholder="List any allergies..."
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Medical Conditions</Text>
          <View style={styles.inputWrapper}>
            <FileText size={20} color="#9CA3AF" />
            <TextInput 
              style={styles.input} 
              value={conditions} 
              onChangeText={setConditions} 
              placeholder="e.g. Diabetes, Eczema..."
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Medications</Text>
          <View style={styles.inputWrapper}>
            <Pill size={20} color="#9CA3AF" />
            <TextInput 
              style={styles.input} 
              value={medications} 
              onChangeText={setMedications} 
              placeholder="List current medications..."
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