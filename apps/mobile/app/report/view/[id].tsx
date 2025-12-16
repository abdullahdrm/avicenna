import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { ChevronLeft, Calendar } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const API_URL = "http://172.20.10.2:8000/api";

type Medication = {
  name: string;
  frequency: string;
};

export default function ViewReport() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);

  const fetchReport = async () => {
    try {
      const token = await SecureStore.getItemAsync("access_token");
      if (!token) return;

      const res = await fetch(
        `${API_URL}/submissions/${id}/report/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();
      setReport(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!report) {
    return (
      <SafeAreaView style={styles.center}>
        <Text>Report not found</Text>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* TOP BAR */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={26} />
          </TouchableOpacity>
          <Text style={styles.title}>Report</Text>
          <View style={{ width: 26 }} />
        </View>

        {/* DIAGNOSIS */}
        <View style={styles.card}>
          <Text style={styles.label}>Diagnosis</Text>
          <Text style={styles.value}>{report.diagnosis || "-"}</Text>
        </View>

        {/* HOSPITAL VISIT */}
        <View style={styles.card}>
          <Text style={styles.label}>Hospital Visit</Text>
          <View
            style={[
              styles.badge,
              report.hospital_visit ? styles.yes : styles.no,
            ]}
          >
            <Text style={styles.badgeText}>
              {report.hospital_visit ? "YES" : "NO"}
            </Text>
          </View>
        </View>

        {/* MEDICATIONS */}
        <View style={styles.card}>
          <Text style={styles.label}>Medications</Text>

          {report.medications?.length ? (
            report.medications.map((med: Medication, index: number) => (
              <View key={index} style={styles.medRow}>
                <Text style={styles.medName}>{med.name}</Text>
                <Text style={styles.medFreq}>{med.frequency}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No medications</Text>
          )}
        </View>

        {/* NEXT DATE */}
        <View style={styles.card}>
          <Text style={styles.label}>Next Submission Date</Text>

          <View style={styles.dateRow}>
            <Calendar size={18} />
            <Text style={styles.value}>
              {report.next_submission_date
                ? new Date(
                    report.next_submission_date
                  ).toLocaleDateString()
                : "-"}
            </Text>
          </View>
        </View>

        {/* COMMENT */}
        <View style={styles.card}>
          <Text style={styles.label}>Comment</Text>
          <Text style={styles.value}>
            {report.comment || "-"}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

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

  value: {
    fontSize: 15,
    fontWeight: "500",
    color: "#111827",
  },

  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },

  yes: {
    backgroundColor: "#DCFCE7",
  },

  no: {
    backgroundColor: "#FEE2E2",
  },

  badgeText: {
    fontWeight: "700",
  },

  medRow: {
    backgroundColor: "#F3F4F6",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },

  medName: {
    fontWeight: "700",
  },

  medFreq: {
    color: "#6B7280",
    marginTop: 4,
  },

  emptyText: {
    color: "#9CA3AF",
  },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
