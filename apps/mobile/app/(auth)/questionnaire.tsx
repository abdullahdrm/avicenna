import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { ArrowLeft, ArrowRight, Calendar, Check, FileText, Info, Pill, Ruler, Weight as WeightIcon, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../../lib/LanguageContext';

const API_URL = 'http://172.20.10.2:8000/api'; 

export default function QuestionnaireScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  const totalSteps = 5;
  
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [skinType, setSkinType] = useState('');
  
  const [hasAllergies, setHasAllergies] = useState<boolean | null>(null);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [allergyDetails, setAllergyDetails] = useState(''); 
  
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [medicalConditionsOther, setMedicalConditionsOther] = useState(''); 
  
  const [selectedMedications, setSelectedMedications] = useState<string[]>([]);
  const [medicationsOther, setMedicationsOther] = useState(''); 
  
  const [showSkinHelp, setShowSkinHelp] = useState(false);

  const genderOptions = [t('questionnaireScreen.female'), t('questionnaireScreen.male')];
  const skinTypeOptions = [
    { label: t('questionnaireScreen.normal'), desc: t('questionnaireScreen.normalDesc') },
    { label: t('questionnaireScreen.dry'), desc: t('questionnaireScreen.dryDesc') },
    { label: t('questionnaireScreen.oily'), desc: t('questionnaireScreen.oilyDesc') },
    { label: t('questionnaireScreen.combination'), desc: t('questionnaireScreen.combinationDesc') },
    { label: t('questionnaireScreen.sensitive'), desc: t('questionnaireScreen.sensitiveDesc') },
  ];
  const allergyOptions = [t('questionnaireScreen.penicillin'), t('questionnaireScreen.latex'), t('questionnaireScreen.nickel'), t('questionnaireScreen.fragrances'), t('questionnaireScreen.sunscreen'), t('questionnaireScreen.aspirin'), t('questionnaireScreen.peanuts')];
  const conditionOptions = [t('questionnaireScreen.diabetes'), t('questionnaireScreen.pcos'), t('questionnaireScreen.lupus'), t('questionnaireScreen.herpes'), t('questionnaireScreen.insulinResistance'), t('questionnaireScreen.thyroidDiseases'), t('questionnaireScreen.celiac'), t('questionnaireScreen.ibd'), t('questionnaireScreen.ckd'), t('questionnaireScreen.anemia'), t('questionnaireScreen.sjogren'), t('questionnaireScreen.liverDisease')];
  const medicationOptions = [t('questionnaireScreen.accutane'), t('questionnaireScreen.antibiotics'), t('questionnaireScreen.birthControl'), t('questionnaireScreen.retinoids'), t('questionnaireScreen.corticosteroids'), t('questionnaireScreen.vitamins')];

  const nextStep = () => {
    if (step < totalSteps) setStep(step + 1);
    else handleComplete();
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
    else router.back();
  };

  const handleComplete = async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (!token) {
        Alert.alert("Auth Error", "You are not logged in.");
        return;
      }

      const skinTypeMap: { [key: string]: string } = {
        [t('questionnaireScreen.normal')]: 'normal',
        [t('questionnaireScreen.dry')]: 'dry',
        [t('questionnaireScreen.oily')]: 'oily',
        [t('questionnaireScreen.combination')]: 'combination',
        [t('questionnaireScreen.sensitive')]: 'sensitive',
      };

      const genderMap: { [key: string]: string } = {
        [t('questionnaireScreen.female')]: 'female',
        [t('questionnaireScreen.male')]: 'male',
      };

      const formattedAllergies = hasAllergies ? formatList(selectedAllergies, allergyDetails) : 'None';
      const formattedConditions = formatList(selectedConditions, medicalConditionsOther);
      const formattedMedications = formatList(selectedMedications, medicationsOther);

      const payload = {
        gender: genderMap[gender] || gender.toLowerCase(), 
        age: parseInt(age) || null,
        height: parseFloat(height) || null,
        weight: parseFloat(weight) || null,
        
        skin_type: skinTypeMap[skinType] || skinType.toLowerCase(), 
        
        allergies: formattedAllergies === 'None' ? '' : formattedAllergies,
        medical_conditions: formattedConditions === 'None' ? '' : formattedConditions,
        medications: formattedMedications === 'None' ? '' : formattedMedications,
      };

      const response = await fetch(`${API_URL}/profile/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        router.replace('/(tabs)'); 
      } else {
        const errorData = await response.json();
        console.log("Save Error:", JSON.stringify(errorData));
        Alert.alert("Save Error", JSON.stringify(errorData));
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Network Error", "Is the server running?");
    }
  };

  const selectAndNext = (setter: any, value: any) => {
    setter(value);
    setTimeout(() => {
      if (step < totalSteps) setStep(step + 1);
    }, 200);
  };

  const toggleSelection = (list: string[], setList: Function, item: string) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const formatList = (list: string[], other: string) => {
    const combined = [...list];
    if (other) combined.push(other);
    return combined.length > 0 ? combined.join(', ') : 'None';
  };

  const ProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={[styles.progressBar, { width: `${(step / totalSteps) * 100}%` }]} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={prevStep} style={styles.backButton}>
          <ArrowLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.stepIndicator}>{t('questionnaireScreen.stepOf')} {step} {t('questionnaireScreen.of')} {totalSteps}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ProgressBar />

      <View style={styles.content}>
        
        {/* Step 1: Personal Profile */}
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.question}>{t('questionnaireScreen.personalProfile')}</Text>
            <Text style={styles.subQuestion}>{t('questionnaireScreen.aboutYourself')}</Text>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.sectionLabel}>{t('questionnaireScreen.gender')}</Text>
              <View style={styles.rowGrid}>
                {genderOptions.map((g) => (
                  <TouchableOpacity 
                    key={g}
                    style={[styles.smallBtn, gender === g && styles.smallBtnActive]}
                    onPress={() => setGender(g)}
                  >
                    <Text style={[styles.smallBtnText, gender === g && styles.smallBtnTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.sectionLabel}>{t('questionnaireScreen.age')}</Text>
                <View style={styles.inputWrapper}>
                  <Calendar size={20} color="#9CA3AF" style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input} 
                    placeholder={t('questionnaireScreen.ageExample')} 
                    keyboardType="numeric"
                    value={age}
                    onChangeText={setAge}
                    maxLength={3}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.sectionLabel}>{t('questionnaireScreen.heightCm')}</Text>
                  <View style={styles.inputWrapper}>
                    <Ruler size={20} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput 
                      style={styles.input} 
                      placeholder={t('questionnaireScreen.heightExample')} 
                      keyboardType="numeric"
                      value={height}
                      onChangeText={setHeight}
                      maxLength={3}
                    />
                  </View>
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.sectionLabel}>{t('questionnaireScreen.weightKg')}</Text>
                  <View style={styles.inputWrapper}>
                    <WeightIcon size={20} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput 
                      style={styles.input} 
                      placeholder={t('questionnaireScreen.weightExample')} 
                      keyboardType="numeric"
                      value={weight}
                      onChangeText={setWeight}
                      maxLength={3}
                    />
                  </View>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={[styles.nextButton, (!gender || !age || !height || !weight) && styles.nextButtonDisabled]}
              onPress={nextStep}
              disabled={!gender || !age || !height || !weight}
            >
              <Text style={styles.nextButtonText}>{t('questionnaireScreen.nextStep')}</Text>
              <ArrowRight size={20} color="white" />
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2: Skin Type */}
        {step === 2 && (
          <View style={styles.stepContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.question}>{t('questionnaireScreen.skinType')}</Text>
              <TouchableOpacity onPress={() => setShowSkinHelp(true)} style={styles.helpBtn}>
                <Info size={16} color="#2563EB" />
                <Text style={styles.helpBtnText}>{t('questionnaireScreen.howToCheck')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.subQuestion}>{t('questionnaireScreen.selectSkinType')}</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {skinTypeOptions.map((type) => (
                <TouchableOpacity 
                  key={type.label}
                  style={[styles.cardBtn, skinType === type.label && styles.cardBtnActive]}
                  onPress={() => selectAndNext(setSkinType, type.label)}
                >
                  <View>
                    <Text style={[styles.cardTitle, skinType === type.label && styles.cardTitleActive]}>{type.label}</Text>
                    <Text style={styles.cardDesc}>{type.desc}</Text>
                  </View>
                  <View style={[styles.radio, skinType === type.label && styles.radioActive]}>
                    {skinType === type.label && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Step 3: Allergies */}
        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.question}>{t('questionnaireScreen.allergies')}</Text>
            <Text style={styles.subQuestion}>{t('questionnaireScreen.allergySubtitle')}</Text>

            <View style={{ flex: 1 }}>
              <View style={styles.rowGrid}>
                <TouchableOpacity 
                  style={[styles.smallBtn, hasAllergies === false && styles.smallBtnActive]}
                  onPress={() => { setHasAllergies(false); setSelectedAllergies([]); }}
                >
                  <Text style={[styles.smallBtnText, hasAllergies === false && styles.smallBtnTextActive]}>{t('questionnaireScreen.noAllergies')}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.smallBtn, hasAllergies === true && styles.smallBtnActive]}
                  onPress={() => setHasAllergies(true)}
                >
                  <Text style={[styles.smallBtnText, hasAllergies === true && styles.smallBtnTextActive]}>{t('questionnaireScreen.yesAllergies')}</Text>
                </TouchableOpacity>
              </View>

              {hasAllergies === true && (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                  <Text style={styles.sectionLabel}>{t('questionnaireScreen.commonAllergens')}</Text>
                  <View style={styles.tagContainer}>
                    {allergyOptions.map((allergy) => {
                      const isSelected = selectedAllergies.includes(allergy);
                      return (
                        <TouchableOpacity 
                          key={allergy}
                          style={[styles.tag, isSelected && styles.tagActive]}
                          onPress={() => toggleSelection(selectedAllergies, setSelectedAllergies, allergy)}
                        >
                          <Text style={[styles.tagText, isSelected && styles.tagTextActive]}>{allergy}</Text>
                          {isSelected && <Check size={14} color="#2563EB" style={{ marginLeft: 4 }} />}
                        </TouchableOpacity>
                      )
                    })}
                  </View>

                  <Text style={[styles.sectionLabel, { marginTop: 16 }]}>{t('questionnaireScreen.other')}</Text>
                  <TextInput 
                    style={styles.textArea}
                    placeholder={t('questionnaireScreen.typeOtherAllergies')}
                    value={allergyDetails}
                    onChangeText={setAllergyDetails}
                  />
                </ScrollView>
              )}
            </View>

            <TouchableOpacity 
              style={[styles.nextButton, (hasAllergies === null) && styles.nextButtonDisabled]}
              onPress={nextStep}
              disabled={hasAllergies === null}
            >
              <Text style={styles.nextButtonText}>{t('questionnaireScreen.nextStep')}</Text>
              <ArrowRight size={20} color="white" />
            </TouchableOpacity>
          </View>
        )}

        {/* Step 4: Medical History */}
        {step === 4 && (
          <View style={styles.stepContainer}>
            <Text style={styles.question}>{t('questionnaireScreen.medicalHistory')}</Text>
            <Text style={styles.subQuestion}>{t('questionnaireScreen.medicalHistorySubtitle')}</Text>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={styles.labelRow}>
                <FileText size={16} color="#4B5563" />
                <Text style={styles.sectionLabel}>{t('questionnaireScreen.skinConditions')}</Text>
              </View>
              <View style={styles.tagContainer}>
                {conditionOptions.map((cond) => {
                  const isSelected = selectedConditions.includes(cond);
                  return (
                    <TouchableOpacity 
                      key={cond}
                      style={[styles.tag, isSelected && styles.tagActive]}
                      onPress={() => toggleSelection(selectedConditions, setSelectedConditions, cond)}
                    >
                      <Text style={[styles.tagText, isSelected && styles.tagTextActive]}>{cond}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              <TextInput 
                style={[styles.input, { marginTop: 8 }]}
                placeholder={t('questionnaireScreen.otherConditions')}
                value={medicalConditionsOther}
                onChangeText={setMedicalConditionsOther}
              />
              <View style={[styles.labelRow, { marginTop: 24 }]}>
                <Pill size={16} color="#4B5563" />
                <Text style={styles.sectionLabel}>{t('questionnaireScreen.currentMedications')}</Text>
              </View>
              <View style={styles.tagContainer}>
                {medicationOptions.map((med) => {
                  const isSelected = selectedMedications.includes(med);
                  return (
                    <TouchableOpacity 
                      key={med}
                      style={[styles.tag, isSelected && styles.tagActive]}
                      onPress={() => toggleSelection(selectedMedications, setSelectedMedications, med)}
                    >
                      <Text style={[styles.tagText, isSelected && styles.tagTextActive]}>{med}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              <TextInput 
                style={[styles.input, { marginTop: 8 }]}
                placeholder={t('questionnaireScreen.otherMedications')}
                value={medicationsOther}
                onChangeText={setMedicationsOther}
              />
            </ScrollView>

            <TouchableOpacity style={styles.nextButton} onPress={nextStep}>
              <Text style={styles.nextButtonText}>{t('questionnaireScreen.reviewProfile')}</Text>
              <ArrowRight size={20} color="white" />
            </TouchableOpacity>
          </View>
        )}

        {/* Step 5: Summary & Submit */}
        {step === 5 && (
          <View style={styles.stepContainer}>
            <Text style={styles.question}>{t('questionnaireScreen.allSet')}</Text>
            <Text style={styles.subQuestion}>{t('questionnaireScreen.customizedProfile')}</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('questionnaireScreen.identity')}</Text>
                  <Text style={styles.summaryValue}>{gender}, {age} {t('questionnaireScreen.years')}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('questionnaireScreen.body')}</Text>
                  <Text style={styles.summaryValue}>{height}{t('questionnaireScreen.cm')}, {weight}{t('questionnaireScreen.kg')}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('questionnaireScreen.skin')}</Text>
                  <Text style={styles.summaryValue}>{skinType}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('questionnaireScreen.allergies')}</Text>
                  <Text style={styles.summaryValue} numberOfLines={2}>
                    {hasAllergies ? formatList(selectedAllergies, allergyDetails) : t('questionnaireScreen.noAllergies')}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('questionnaireScreen.conditions')}</Text>
                  <Text style={styles.summaryValue} numberOfLines={2}>
                    {formatList(selectedConditions, medicalConditionsOther)}
                  </Text>
                </View>
                <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.summaryLabel}>{t('questionnaireScreen.meds')}</Text>
                  <Text style={styles.summaryValue} numberOfLines={2}>
                    {formatList(selectedMedications, medicationsOther)}
                  </Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.nextButton} onPress={handleComplete}>
              <Text style={styles.nextButtonText}>{t('questionnaireScreen.goToDashboard')}</Text>
              <ArrowRight size={20} color="white" />
            </TouchableOpacity>
          </View>
        )}

      </View>

      <Modal visible={showSkinHelp} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('questionnaireScreen.identifyingSkinType')}</Text>
              <TouchableOpacity onPress={() => setShowSkinHelp(false)}>
                <X size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <Text style={styles.modalText}><Text style={{fontWeight: 'bold'}}>{t('questionnaireScreen.washYourFace')}</Text> {t('questionnaireScreen.withGentle')}</Text>
              <Text style={styles.modalSubTitle}>{t('questionnaireScreen.checkTZone')}</Text>
              <View style={styles.modalItem}><Text style={styles.modalLabel}>{t('questionnaireScreen.normal')}:</Text><Text style={styles.modalDesc}>{t('questionnaireScreen.comfortable')}</Text></View>
              <View style={styles.modalItem}><Text style={styles.modalLabel}>{t('questionnaireScreen.oily')}:</Text><Text style={styles.modalDesc}>{t('questionnaireScreen.shinyGreasy')}</Text></View>
              <View style={styles.modalItem}><Text style={styles.modalLabel}>{t('questionnaireScreen.dry')}:</Text><Text style={styles.modalDesc}>{t('questionnaireScreen.tightFlaky')}</Text></View>
              <View style={styles.modalItem}><Text style={styles.modalLabel}>{t('questionnaireScreen.combination')}:</Text><Text style={styles.modalDesc}>{t('questionnaireScreen.oilyTZone')}</Text></View>
              <View style={styles.modalItem}><Text style={styles.modalLabel}>{t('questionnaireScreen.sensitive')}:</Text><Text style={styles.modalDesc}>{t('questionnaireScreen.redItchy')}</Text></View>
            </ScrollView>
            <TouchableOpacity style={styles.modalBtn} onPress={() => setShowSkinHelp(false)}>
              <Text style={styles.modalBtnText}>{t('questionnaireScreen.gotIt')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { padding: 8, marginLeft: -8 },
  stepIndicator: { fontSize: 16, fontWeight: '600', color: '#6B7280' },
  progressContainer: { height: 4, backgroundColor: '#E5E7EB', marginHorizontal: 20, borderRadius: 2 },
  progressBar: { height: '100%', backgroundColor: '#2563EB', borderRadius: 2 },
  content: { flex: 1, padding: 24 },
  stepContainer: { flex: 1 },
  question: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  subQuestion: { fontSize: 16, color: '#6B7280', marginBottom: 24 },
  sectionLabel: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 12, textTransform: 'uppercase' },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  helpBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 4 },
  helpBtnText: { color: '#2563EB', fontSize: 12, fontWeight: '600' },
  rowGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  smallBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', backgroundColor: '#F9FAFB' },
  smallBtnActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  smallBtnText: { fontWeight: '500', color: '#374151' },
  smallBtnTextActive: { color: '#2563EB', fontWeight: 'bold' },
  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  tag: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: 'white', flexDirection: 'row', alignItems: 'center' },
  tagActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  tagText: { color: '#374151', fontSize: 14, fontWeight: '500' },
  tagTextActive: { color: '#2563EB', fontWeight: '600' },
  inputGroup: { marginBottom: 20 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 16, backgroundColor: '#F9FAFB' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, paddingVertical: 16, fontSize: 16, color: '#111827' },
  textArea: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 16, fontSize: 16, backgroundColor: '#F9FAFB', minHeight: 60 },
  cardBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: 'white', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: {width:0, height:2}, shadowRadius: 4, elevation: 2 },
  cardBtnActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 4 },
  cardTitleActive: { color: '#2563EB' },
  cardDesc: { fontSize: 14, color: '#6B7280' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: '#2563EB' },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2563EB' },
  summaryCard: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  summaryLabel: { color: '#6B7280', fontSize: 14 },
  summaryValue: { color: '#111827', fontWeight: '600', fontSize: 14, maxWidth: '60%', textAlign: 'right' },
  nextButton: { backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 16, marginTop: 'auto', marginBottom: 20 },
  nextButtonDisabled: { backgroundColor: '#9CA3AF' },
  nextButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold', marginRight: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 24, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  modalScroll: { marginBottom: 20 },
  modalText: { fontSize: 16, color: '#4B5563', lineHeight: 24, marginBottom: 16 },
  modalSubTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  modalItem: { marginBottom: 12 },
  modalLabel: { fontSize: 16, fontWeight: 'bold', color: '#2563EB' },
  modalDesc: { fontSize: 15, color: '#4B5563' },
  modalBtn: { backgroundColor: '#2563EB', padding: 16, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});