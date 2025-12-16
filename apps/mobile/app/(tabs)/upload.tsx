import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { AlertCircle, Camera, CheckCircle, ChevronRight, Clock, RefreshCw, SwitchCamera, Upload as UploadIcon, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
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
  const [serverQuestions, setServerQuestions] = useState<any[]>([]);
  const [userAnswers, setUserAnswers] = useState<{[key: string]: string}>({});
  const [recordId, setRecordId] = useState<number | null>(null);
  const [predictionResult, setPredictionResult] = useState<string>('');

  const BASE_URL = 'http://10.149.24.43:8000';
  const API_URL = `${BASE_URL}/api/skin-analysis/`;

  const existingRecords = [
    { id: 1, label: 'Forehead Acne', date: 'Started Nov 1' },
    { id: 2, label: 'Right Arm Rash', date: 'Started Oct 15' },
  ];

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
          console.log("Checking if server responded...");
          const res = await fetch(`${API_URL}${recordId}/check_status/`);
          const json = await res.json();

          if (json.status === 'ready') {
            clearInterval(interval);
            setPredictionResult(json.prediction);
            setServerQuestions(json.questions);
            setStep('dynamic_questions');
          }
        } catch (e) {
          console.error("Polling error", e);
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
      } catch (error) { 
        console.log("Error taking photo:", error);
      }
      } else {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
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
    startScanning(label); 
  };
  
  const selectNewArea = (area: string) => { 
    setSelectedArea(area); 
    startScanning(area); 
  };

  const startScanning = (areaName: string) => {
    setStep('scanning');
    setTimeout(() => {
      uploadImageAndStartWaiting(areaName);
    }, 1500);
  };

  const uploadImageAndStartWaiting = async (areaName: string) => {
    if (!capturedImage) return;

    try {
      const formData = new FormData();
      const filename = capturedImage.split('/').pop();
      const match = /\.(\w+)$/.exec(filename || '');
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      // @ts-ignore
      formData.append('image', { uri: capturedImage, name: filename, type });
      formData.append('body_part', areaName); 
      formData.append('status', 'review');

      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' },
      });

      const json = await response.json();
      
      if (response.ok) {
        setRecordId(json.id);
        setStep('analyzing');
      } else {
        Alert.alert("Upload Failed", "Please try again.");
        setStep('camera');
      }
    } catch (error) {
      Alert.alert("Connection Error", "Is the server running?");
      setStep('camera');
    }
  };

  const submitAnswers = async () => {
    if (!recordId) return;
    setIsSubmitting(true);

    try {
      const url = `${API_URL}${recordId}/answer_questions/`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: userAnswers }),
      });

      Alert.alert("Analysis Complete");
      resetForm();
      router.replace('/');
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
  };

  if (!permission){ 
    return <View style={styles.loadingContainer}><ActivityIndicator /></View>;
  }
  if (!permission.granted) {
      return (
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>Camera permission is required.</Text>
          <Button onPress={requestPermission} title="Grant Permission" />
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
            <Text style={styles.hintText}>
              Ensure the area is well-lit and in focus.
            </Text>
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

            <Text style={styles.modalSub}>Is this a new issue or a follow-up?</Text>
            
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
            
            <Text style={styles.dividerText}>OR FOLLOW UP ON</Text>
           
            {existingRecords.map((rec) => (
              <TouchableOpacity key={rec.id} style={styles.optionCard} onPress={() => selectExisting(rec.id, rec.label)}>
                <View style={[styles.iconCircle, { backgroundColor: '#F3F4F6' }]}>
                  <Clock size={24} color="#4B5563" />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.optionTitle}>{rec.label}</Text>
                  <Text style={styles.optionDesc}>{rec.date}</Text>
                </View>
                <ChevronRight size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={step === 'area'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '70%' }]}>
             <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Where is it?</Text>
              <TouchableOpacity onPress={() => setStep('triage')}><X size={24} color="#374151"/></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
               <View style={styles.grid}>
                 {bodyAreas.map((area) => (
                   <TouchableOpacity key={area} style={styles.areaChip} onPress={() => selectNewArea(area)}>
                     <Text style={styles.areaText}>{area}</Text>
                   </TouchableOpacity>
                 ))}
               </View>
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
            {step === 'scanning' ? "Uploading Image..." : "Waiting for Server..."}
          </Text>
          <Text style={styles.loadingText}>
            {step === 'scanning' ? "Sending to server" : "Please check your Admin Panel!"}
          </Text>
        </View>
      </Modal>

      <Modal visible={step === 'dynamic_questions'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.formCard}>            
            <View style={styles.successHeader}>
               <CheckCircle size={48} color="#16A34A" />
               
               <Text style={styles.successTitle}>Prediction: {predictionResult}</Text>
               <Text style={styles.successSub}>Please answer these follow-up questions.</Text>
            </View>

            <ScrollView style={styles.formScroll}>
               {serverQuestions.map((q) => (
                <View key={q.id} style={styles.inputGroup}>
                  <Text style={styles.label}>{q.text}</Text>
                  {q.type === 'text' || q.type === 'number' ? (
                      <TextInput 
                        style={styles.textArea} 
                        placeholder="Type answer here..." 
                        keyboardType={q.type === 'number' ? 'numeric' : 'default'}
                        onChangeText={(text) => setUserAnswers({...userAnswers, [q.id]: text})}
                      />
                  ) : (
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
                  )}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity 
              style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]} 
              onPress={submitAnswers}
              disabled={isSubmitting}
            >
               {isSubmitting ? (
                 <ActivityIndicator color="white" />
               ) : (
                 <Text style={styles.submitText}>Submit Analysis</Text>
               )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  header: { padding: 20, paddingTop: 10 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },  

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
  dividerText: { textAlign: 'center', fontSize: 12, fontWeight: 'bold', color: '#9CA3AF', marginVertical: 16 },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  areaChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  areaText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  
  formCard: { backgroundColor: 'white', margin: 20, borderRadius: 24, padding: 24, flex: 1, marginTop: 60, marginBottom: 60 },
  successHeader: { alignItems: 'center', marginBottom: 24 },

  thumbnailContainer: { position: 'relative', marginBottom: 16 },
  thumbnail: { width: 100, height: 100, borderRadius: 16, borderWidth: 2, borderColor: '#F3F4F6', backgroundColor: '#F3F4F6' },
  checkBadge: { position: 'absolute', bottom: -8, right: -8, backgroundColor: '#16A34A', padding: 4, borderRadius: 12, borderWidth: 2, borderColor: 'white' },
  
  successTitle: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginTop: 4 },
  successSub: { textAlign: 'center', color: '#6B7280', marginTop: 4 },
  formScroll: { flex: 1 },
  
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 12 },
  textArea: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, minHeight: 80, textAlignVertical: 'top' },
  
  durationRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  durationChip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: 'white' },
  circleBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  durationActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  textWhite: { color: 'white', fontWeight: 'bold' },
  durationText: { color: '#374151' },
  
  submitBtn: { backgroundColor: '#2563EB', padding: 18, borderRadius: 16, alignItems: 'center' },
  submitText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});