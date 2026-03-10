import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { AlertCircle, Camera, CheckCircle, ChevronRight, RefreshCw, SwitchCamera, Upload as UploadIcon, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function UploadScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [step, setStep] = useState<'camera' | 'triage' | 'area' | 'scanning' | 'analyzing' | 'dynamic_questions'>('camera');
  const [uploadMode, setUploadMode] = useState<'camera' | 'upload'>('camera');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back'); 
  const [selectedRecord, setSelectedRecord] = useState<number | null>(null);
  
  const [selectedArea, setSelectedArea] = useState('');
  const [painLevel, setPainLevel] = useState(0);
  const [duration, setDuration] = useState('');
  const [comments, setComments] = useState('');
  

  const [recordId, setRecordId] = useState<number | null>(null);
  const [predictionResult, setPredictionResult] = useState<string>('');
  const [serverQuestions, setServerQuestions] = useState<any[]>([]);
  const [userAnswers, setUserAnswers] = useState<{[key: string]: string}>({});

  const BASE_URL = 'http://10.109.124.43:8000'; 
  const API_URL = `${BASE_URL}/api`;


  const [medicalCases, setMedicalCases] = useState<any[]>([]);
  const recentActiveCases = Array.isArray(medicalCases) 
    ? medicalCases.filter(c => c.is_active === true).slice(0, 3) 
    : [];

  useFocusEffect(
    useCallback(() => {
      const fetchCases = async () => {
        try {
          const token = await SecureStore.getItemAsync('access_token');
          if (!token) return;
          const response = await fetch(`${API_URL}/cases/`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const json = await response.json();
            
            if (Array.isArray(json)) {
              setMedicalCases(json);
            } else if (json.results) {
              setMedicalCases(json.results);
            } else {
              setMedicalCases([]);
            }
            
          }
        } catch (error) {
          console.error("Failed to fetch cases:", error);
        }
      };
      fetchCases();
    }, [])
  );

  const bodyAreas = [
    'Forehead', 'Left Cheek', 'Right Cheek', 'Nose', 'Chin',
    'Neck', 'Chest', 'Upper Back', 'Lower Back',
    'Left Shoulder', 'Right Shoulder', 'Left Arm', 'Right Arm', 'Hands',
    'Left Leg', 'Right Leg', 'Feet'
  ];

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (step === 'analyzing' && recordId) {
      interval = setInterval(async () => {
        try {
          const token = await SecureStore.getItemAsync('access_token');
          const response = await fetch(`${API_URL}/skin-analysis/${recordId}/check_status/`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.status === 404) return;

          const data = await response.json();

          if (data.status === 'ready' || data.prediction) {
            setPredictionResult(data.prediction);
            setServerQuestions(data.questions || []);
            setStep('dynamic_questions');
            clearInterval(interval);
          } else if (data.status === 'failed') {
            Alert.alert('Analysis Failed', 'Please try again.');
            setStep('camera');
            clearInterval(interval);
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [step, recordId]);

  const handleCapture = async () => {
    if (uploadMode === 'camera' && cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.5,      
          base64: false,
          skipProcessing: true, 
        });
        if (photo) { 
          setCapturedImage(photo.uri); 
          setStep('triage'); 
        }
      } catch (error) { console.log("Error taking photo:", error); }
    } else {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [3, 4], 
        quality: 0.8,   
      });
      if (!result.canceled) { 
        setCapturedImage(result.assets[0].uri); 
        setStep('triage'); 
      }
    }
  };

  const selectExisting = (id: number, label: string) => {
    setSelectedRecord(id);
    setSelectedArea(label);
    setStep('area'); 
  };
  
  const selectNewArea = (area: string) => { 
    setSelectedArea(area); 
  };

  const handleAnalyze = () => {
    if (!selectedArea) {
      Alert.alert("Missing Info", "Please select a body area.");
      return;
    }
    setStep('scanning');
    setTimeout(() => {
      uploadImageAndStartWaiting(selectedArea);
    }, 1000);
  };

  const uploadImageAndStartWaiting = async (areaName: string) => {
    if (!capturedImage) return;

    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (!token) {
        Alert.alert("Auth Error", "You are not logged in");
        router.replace('/'); 
        return;
      }

      const formData = new FormData();
      const filename = capturedImage.split('/').pop();
      const match = /\.(\w+)$/.exec(filename || '');
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      // @ts-ignore
      formData.append('image', { uri: capturedImage, name: filename, type });
      formData.append('body_part', areaName); 
      formData.append('status', 'review');
      
      formData.append('pain_level', painLevel.toString());
      formData.append('duration', duration);
      formData.append('comments', comments);
      if (selectedRecord) {
        formData.append('medical_case_id', selectedRecord.toString());
      } else {
        formData.append('title', `${areaName} Issue`);
      }
      const response = await fetch(`${API_URL}/skin-analysis/`, { 
        method: 'POST',
        body: formData,
        headers: { 
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const json = await response.json();
      
      if (response.ok) {
        setRecordId(json.id);
        setStep('analyzing'); 
      } else {
        const errorMessage = json.reason || "Upload failed";
        Alert.alert("Upload Failed", errorMessage);
        setStep('camera');
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Connection Error", "Is the server running?");
      setStep('camera');
    }
  };

  const submitAnswers = async () => {
    if (!recordId) return;
    setIsSubmitting(true);

    try {
      const token = await SecureStore.getItemAsync('access_token');
      const url = `${API_URL}/skin-analysis/${recordId}/answer_questions/`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ answers: userAnswers }),
      });

      if(response.ok) {
          Alert.alert("Success", "Analysis complete. A doctor has been assigned.");
          resetForm();
          router.replace('/');
      } else {
          Alert.alert("Error", "Failed to submit answers.");
      }
    } catch (e) {
      Alert.alert("Error", "Could not submit answers");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedRecord(null);
    setCapturedImage(null); 
    setStep('camera'); 
    setUploadMode('camera');
    setFacing('back');
    setServerQuestions([]);
    setUserAnswers({});
    setRecordId(null);
    setPredictionResult('');
    setPainLevel(0);
    setDuration('');
    setComments('');
    setSelectedArea('');
  };

  if (!permission) return <View style={styles.loadingContainer}><ActivityIndicator /></View>;
  if (!permission.granted) {
      return (
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>Camera permission is required.</Text>
          <TouchableOpacity onPress={requestPermission}><Text>Grant Permission</Text></TouchableOpacity>
        </View>
      );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>New Scan</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.cameraContainer}>
          <View style={styles.cameraWrapper}>
            {uploadMode === 'camera' ? (
              capturedImage ? (
                <Image source={{ uri: capturedImage }} style={styles.cameraPreview} resizeMode="cover" />
              ) : (
                <CameraView style={styles.cameraPreview} facing={facing} ref={cameraRef}>
                  <View style={styles.focusFrame} />
                  <TouchableOpacity style={styles.flipBtn} onPress={toggleCameraFacing}>
                    <SwitchCamera size={24} color="white" />
                  </TouchableOpacity>
                </CameraView>
              )
            ) : (
              <TouchableOpacity onPress={handleCapture} style={[styles.cameraPreview, { backgroundColor: '#1F2937' }]}>
                <UploadIcon size={64} color="#4B5563" />
                <Text style={styles.cameraText}>Tap to Select Image</Text>
              </TouchableOpacity>
            )}
             {capturedImage && (
              <TouchableOpacity style={styles.retakeBtn} onPress={() => setCapturedImage(null)}>
                <RefreshCw size={20} color="white" />
                <Text style={styles.retakeText}>Retake</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.toggleRow}>
             <TouchableOpacity 
               style={[styles.toggleBtn, uploadMode === 'camera' && styles.toggleBtnActive]} 
               onPress={() => { setUploadMode('camera'); setCapturedImage(null); }}
             >
               <Camera size={16} color={uploadMode === 'camera' ? '#2563EB' : '#6B7280'} />
               <Text style={[styles.toggleText, uploadMode === 'camera' && styles.textBlue]}>Camera</Text>
             </TouchableOpacity>
             <TouchableOpacity 
               style={[styles.toggleBtn, uploadMode === 'upload' && styles.toggleBtnActive]} 
               onPress={() => setUploadMode('upload')}
             >
               <UploadIcon size={16} color={uploadMode === 'upload' ? '#2563EB' : '#6B7280'} />
               <Text style={[styles.toggleText, uploadMode === 'upload' && styles.textBlue]}>Gallery</Text>
             </TouchableOpacity>
          </View>
        </View>
        {!capturedImage && (
          <View style={styles.actionContainer}>
            <Text style={styles.hintText}>Ensure the area is well-lit and in focus.</Text>
            <TouchableOpacity style={styles.captureBtn} onPress={handleCapture}>
              <View style={styles.captureBtnInner} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal visible={step === 'triage'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Condition Type</Text>
              <TouchableOpacity onPress={() => { setStep('camera'); setCapturedImage(null); }}>
                <X size={24} color="#374151"/>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.optionCard} onPress={() => setStep('area')}>
              <View style={[styles.iconCircle, { backgroundColor: '#DBEAFE' }]}>
                <AlertCircle size={24} color="#2563EB" />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.optionTitle}>New Condition</Text>
                <Text style={styles.optionDesc}>I haven't scanned this before</Text>
              </View>
              <ChevronRight size={20} color="#9CA3AF" />
            </TouchableOpacity>
            {recentActiveCases.length > 0 &&(
              <>
                <Text style={[styles.sectionLabel, {marginTop: 10, marginBottom: 10}]}>Existing Conditions (Follow-up)</Text>
                {recentActiveCases.map((record) => (
                  <TouchableOpacity 
                    key={record.id} 
                    style={styles.optionCard} 
                    onPress={() => selectExisting(record.id, record.title)}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: '#F3F4F6' }]}>
                      <RefreshCw size={24} color="#6B7280" />
                    </View>
                    <View style={{flex: 1}}>
                      <Text style={styles.optionTitle}>{record.title}</Text>
                      <Text style={styles.optionDesc}>Started {new Date(record.created_at).toLocaleDateString()}</Text>
                    </View>
                    <ChevronRight size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={step === 'area'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '85%' }]}>
             <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Skin Details</Text>
              <TouchableOpacity onPress={() => setStep('camera')}>
                <X size={24} color="#374151"/>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
               {!selectedRecord && (
                 <>
                   <Text style={styles.sectionLabel}>Select Body Area</Text>
                   <View style={styles.grid}>
                     {bodyAreas.map((area) => (
                       <TouchableOpacity 
                         key={area} 
                         style={[styles.areaChip, selectedArea === area && styles.areaChipActive]} 
                         onPress={() => selectNewArea(area)}
                       >
                         <Text style={[styles.areaText, selectedArea === area && styles.areaTextActive]}>{area}</Text>
                       </TouchableOpacity>
                     ))}
                   </View>
                 </>
               )}
               {selectedArea ? (
                 <View style={styles.formSection}>
                   <View style={styles.divider} />
                   
                   <Text style={styles.inputLabel}>Pain Level (0-10)</Text>
                   <View style={styles.painRow}>
                     {[0, 2, 4, 6, 8, 10].map((val) => (
                       <TouchableOpacity 
                         key={val} 
                         style={[styles.painBtn, painLevel === val && styles.painBtnActive]}
                         onPress={() => setPainLevel(val)}
                       >
                         <Text style={[styles.painText, painLevel === val && styles.painTextActive]}>{val}</Text>
                       </TouchableOpacity>
                     ))}
                   </View>

                   <Text style={styles.inputLabel}>Duration</Text>
                   <TextInput 
                     style={styles.textInput} 
                     placeholder="e.g. 3 days" 
                     value={duration}
                     onChangeText={setDuration}
                   />

                   <Text style={styles.inputLabel}>Comments</Text>
                   <TextInput 
                     style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]} 
                     placeholder="Itching, bleeding..." 
                     multiline
                     value={comments}
                     onChangeText={setComments}
                   />

                   <TouchableOpacity style={styles.submitBtnMain} onPress={handleAnalyze}>
                     <Text style={styles.submitBtnText}>Analyze Skin</Text>
                   </TouchableOpacity>
                 </View>
               ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={step === 'scanning' || step === 'analyzing'} transparent animationType="fade">
        <View style={styles.loadingContainer}>
          <View style={styles.radarCircle}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
          <Text style={styles.loadingTitle}>
            {step === 'scanning' ? "Uploading Image..." : "Analysis Running..."}
          </Text>
          <Text style={styles.loadingText}>
            {step === 'scanning' ? "Sending data" : "This usually takes 5-10 seconds"}
          </Text>
        </View>
      </Modal>

      <Modal visible={step === 'dynamic_questions'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.formCard}>            
            <View style={styles.successHeader}>
               <CheckCircle size={48} color="#16A34A" />
               <Text style={styles.successTitle}>{predictionResult || "Analysis Complete"}</Text>
               <Text style={styles.successSub}>Please answer these follow-up questions.</Text>
            </View>

            <ScrollView style={styles.formScroll}>
               {serverQuestions.map((q) => (
                <View key={q.id} style={styles.inputGroup}>
                  <Text style={styles.label}>{q.text}</Text>
                  {q.type === 'yes_no' ? (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity 
                          style={[styles.durationChip, userAnswers[q.id] === 'yes' && styles.durationActive]}
                          onPress={() => setUserAnswers({...userAnswers, [q.id]: 'yes'})}
                        >
                          <Text style={[styles.durationText, userAnswers[q.id] === 'yes' && styles.textWhite]}>Yes</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={[styles.durationChip, userAnswers[q.id] === 'no' && styles.durationActive]}
                          onPress={() => setUserAnswers({...userAnswers, [q.id]: 'no'})}
                        >
                          <Text style={[styles.durationText, userAnswers[q.id] === 'no' && styles.textWhite]}>No</Text>
                        </TouchableOpacity>
                    </View>
                  ) : (
                    <TextInput 
                        style={styles.textArea} 
                        placeholder="Type answer here..." 
                        keyboardType={q.type === 'number' ? 'numeric' : 'default'}
                        onChangeText={(text) => setUserAnswers({...userAnswers, [q.id]: text})}
                      />
                  )}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity 
              style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]} 
              onPress={submitAnswers}
              disabled={isSubmitting}
            >
               {isSubmitting ? <ActivityIndicator color="white" /> : <Text style={styles.submitText}>Submit Analysis</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  submitBtnMain: { backgroundColor: '#2563EB', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  container: { flex: 1, backgroundColor: '#111827' },
  header: { padding: 20, paddingTop: 10 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },  
  permissionText: { marginBottom: 20 },
  cameraContainer: { margin: 20, marginTop: 10, borderRadius: 24, overflow: 'hidden', backgroundColor: 'black', aspectRatio: 3/4 },
  cameraWrapper: { flex: 1, position: 'relative' },
  cameraPreview: { flex: 1, width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  cameraText: { color: '#9CA3AF', marginTop: 12 },
  focusFrame: { position: 'absolute', width: 250, height: 250, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 20 },
  flipBtn: { position: 'absolute', top: 20, left: 20, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 20 },
  retakeBtn: { position: 'absolute', top: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 20, gap: 6 },
  retakeText: { color: 'white', fontSize: 12, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', backgroundColor: 'white', padding: 4 },
  toggleBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 12, gap: 8 },
  toggleBtnActive: { backgroundColor: '#EFF6FF', borderRadius: 8 },
  toggleText: { color: '#6B7280', fontWeight: '600' },
  textBlue: { color: '#2563EB' },
  actionContainer: { alignItems: 'center', marginTop: 20 },
  hintText: { color: '#9CA3AF', marginBottom: 20 },
  captureBtn: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: 'white', alignItems: 'center', justifyContent: 'center' },
  captureBtnInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'white' },
  loadingContainer: { flex: 1, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
  radarCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  loadingTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  loadingText: { color: '#6B7280' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  modalSub: { color: '#6B7280', marginBottom: 24 },
  optionCard: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, marginBottom: 12, gap: 16 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  optionDesc: { fontSize: 13, color: '#6B7280' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  areaChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  areaText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  formCard: { backgroundColor: 'white', margin: 20, borderRadius: 24, padding: 24, flex: 1, marginTop: 60, marginBottom: 60 },
  successHeader: { alignItems: 'center', marginBottom: 24 },
  successTitle: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginTop: 4 },
  successSub: { textAlign: 'center', color: '#6B7280', marginTop: 4 },
  formScroll: { flex: 1 },
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 12 },
  textArea: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, minHeight: 80, textAlignVertical: 'top' },
  durationChip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: 'white' },
  durationActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  textWhite: { color: 'white', fontWeight: 'bold' },
  durationText: { color: '#374151' },
  submitBtn: { backgroundColor: '#2563EB', padding: 18, borderRadius: 16, alignItems: 'center' },
  submitText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginBottom: 10 },
  areaChipActive: { backgroundColor: '#2563EB' },
  areaTextActive: { color: 'white', fontWeight: 'bold' },
  formSection: { marginTop: 10 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 12 },
  textInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 12, fontSize: 16, backgroundColor: '#F9FAFB' },
  painRow: { flexDirection: 'row', justifyContent: 'space-between' },
  painBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  painBtnActive: { backgroundColor: '#EF4444' },
  painText: { color: '#6B7280', fontWeight: 'bold' },
  painTextActive: { color: 'white' },
});