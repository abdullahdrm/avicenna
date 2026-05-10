import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Calendar, ChevronLeft, Plus, Trash2 } from "lucide-react-native";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const API_URL = "http://10.136.227.43:8000/api";

type Medication = {
  name: string;
  frequency: string;
};

const formatDateForApi = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export default function WriteReport() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [diagnosis, setDiagnosis] = useState("");
  const [hospitalVisit, setHospitalVisit] = useState<"yes" | "no" | null>(null);
  const [comment, setComment] = useState("");

  const [medications, setMedications] = useState<Medication[]>([
    { name: "", frequency: "" },
  ]);

  const [nextDate, setNextDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const addMedication = () => {
    setMedications([...medications, { name: "", frequency: "" }]);
  };

  const removeMedication = (index: number) => {
    const updated = medications.filter((_, i) => i !== index);
    setMedications(updated);
  };

  const updateMedication = (
    index: number,
    field: keyof Medication,
    value: string
  ) => {
    const updated = [...medications];
    updated[index][field] = value;
    setMedications(updated);
  };

  const submitReport = async () => {
    if (!diagnosis.trim()) {
      Alert.alert("Validation", "Diagnosis is required.");
      return;
    }

    if (!hospitalVisit) {
      Alert.alert("Validation", "Please select hospital visit.");
      return;
    }

    try {
      setSubmitting(true);
      const token = await SecureStore.getItemAsync("access_token");
      if (!token) return;

      const payload = {
        diagnosis,
        hospital_visit: hospitalVisit === "yes",
        comment,
        next_submission_date: nextDate ? formatDateForApi(nextDate) : null,
        medications: medications.filter(
          (m) => m.name.trim() || m.frequency.trim()
        ),
      };

      const res = await fetch(`${API_URL}/submissions/${id}/report/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed");

      router.replace({
        pathname: "/report/view/[id]",
        params: { id: String(id) },
      });
    } catch {
      Alert.alert("Error", "Could not submit report.");
    } finally {
      setSubmitting(false);
    }
  };
  const today = new Date();
  today.setHours(0, 0, 0, 0);


  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()}>
              <ChevronLeft size={26} />
            </TouchableOpacity>
            <Text style={styles.title}>Write Report</Text>
            <View style={{ width: 26 }} />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Diagnosis *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter diagnosis"
              value={diagnosis}
              onChangeText={setDiagnosis}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Hospital Visit *</Text>

            <View style={styles.toggleRow}>
              {["yes", "no"].map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[
                    styles.toggleBtn,
                    hospitalVisit === v && styles.toggleActive,
                  ]}
                  onPress={() => setHospitalVisit(v as "yes" | "no")}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      hospitalVisit === v && styles.toggleTextActive,
                    ]}
                  >
                    {v.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>


          <View style={styles.card}>
            <Text style={styles.label}>Medications</Text>

            {medications.map((med, index) => (
              <View key={index} style={styles.medRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Medication name"
                  value={med.name}
                  onChangeText={(t) =>
                    updateMedication(index, "name", t)
                  }
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="How often"
                  value={med.frequency}
                  onChangeText={(t) =>
                    updateMedication(index, "frequency", t)
                  }
                />
                {medications.length > 1 && (
                  <TouchableOpacity onPress={() => removeMedication(index)}>
                    <Trash2 size={20} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            <TouchableOpacity style={styles.addBtn} onPress={addMedication}>
              <Plus size={18} />
              <Text style={styles.addText}>Add medication</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Next Submission Date</Text>

            <TouchableOpacity
              style={styles.dateBtn}
              onPress={() => setShowDatePicker(true)}
            >
              <Calendar size={18} />
              <Text style={styles.dateText}>
                {nextDate ? nextDate.toLocaleDateString() : "Select date"}
              </Text>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <View
              style={
                Platform.OS === "ios" ? styles.datePickerWrapper : undefined
              }
            >
              <DateTimePicker
                value={nextDate || today}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                minimumDate={today}
                onChange={(event, date) => {
                  if (Platform.OS !== "ios" || event.type !== "set") {
                    setShowDatePicker(false);
                  }

                  if (date) setNextDate(date);
                }}
              />
            </View>
          )}


          <View style={styles.card}>
            <Text style={styles.label}>Comment</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Write comment..."
              value={comment}
              onChangeText={setComment}
              multiline
            />
          </View>

          <TouchableOpacity
            style={styles.submitBtn}
            onPress={submitReport}
            disabled={submitting}
          >
            <Text style={styles.submitText}>
              {submitting ? "Submitting..." : "Submit Report"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
  },

  title: { fontSize: 18, fontWeight: "700" },

  card: {
    backgroundColor: "#FFF",
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 14,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#111827",
  },

  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },

  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },

  toggleRow: {
    flexDirection: "row",
    gap: 10,
  },

  toggleBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
  },

  toggleActive: {
    backgroundColor: "#2563EB",
  },

  toggleText: { fontWeight: "600" },
  toggleTextActive: { color: "white" },

  medRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },

  addText: {
    fontWeight: "600",
    color: "#2563EB",
  },

  dateBtn: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    padding: 12,
    borderRadius: 10,
  },

  dateText: { fontWeight: "600" },

  submitBtn: {
    backgroundColor: "#2563EB",
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },

  submitText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
    datePickerWrapper: {
    alignItems: "center",    
    justifyContent: "center", 
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: "#FFF",
    borderRadius: 14,
    paddingVertical: 10,
  },
});
