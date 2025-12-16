import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
} from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  LayoutAnimation,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const API_URL = "http://172.20.10.2:8000/api";

const Card = ({ children, style }: any) => (
  <View style={[styles.card, style]}>{children}</View>
);

export default function SubmissionDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<any>(null);

  const fetchSubmission = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("access_token");
      if (!token) return;

      const response = await fetch(`${API_URL}/submissions/${id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      setSubmission(data);
    } catch (e) {
      console.error(e);
      setSubmission({});
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchSubmission();
    }, [id])
  );

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  const patient = submission?.patient;
  const profile = patient?.profile;
  const isReviewed = submission?.status?.toLowerCase() === "reviewed";


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={26} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Submission #{id}</Text>
          <View style={{ width: 26 }} />
        </View>


        <Card style={[styles.sectionCard, styles.patientCard]}>
          <TouchableOpacity style={styles.expandHeader} onPress={toggleExpand}>
            <Text style={styles.patientTitle}>Patient Information</Text>
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </TouchableOpacity>

          <View style={styles.profileRow}>
            <View style={styles.avatar} />

            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>
                {patient
                  ? `${patient.first_name || ""} ${patient.last_name || ""}`.trim() ||
                    patient.username
                  : "-"}
              </Text>

              <View style={styles.dateRow}>
                <Calendar size={16} color="#6B7280" />
                <Text style={styles.dateText}>
                  {submission?.created_at
                    ? new Date(submission.created_at).toLocaleDateString()
                    : "-"}
                </Text>
              </View>
            </View>
          </View>

          {expanded && (
            <>
              <View style={styles.separator} />

              <View style={styles.infoRowLine}>
                <Text style={styles.infoLeft}>Age</Text>
                <Text style={styles.infoRight}>{profile?.age || "-"}</Text>
              </View>

              <View style={styles.separator} />

              <View style={styles.infoRowLine}>
                <Text style={styles.infoLeft}>Gender</Text>
                <Text style={styles.infoRight}>{profile?.gender || "-"}</Text>
              </View>

              <View style={styles.separator} />

              <View style={styles.infoRowLine}>
                <Text style={styles.infoLeft}>Allergies</Text>
                <Text style={styles.infoRight}>{profile?.allergies || "-"}</Text>
              </View>

              <View style={styles.separator} />

              <View style={styles.infoRowLine}>
                <Text style={styles.infoLeft}>Medications</Text>
                <Text style={styles.infoRight}>{profile?.medications || "-"}</Text>
              </View>
            </>
          )}
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Submitted Photo</Text>

          {submission?.photo ? (
            <Image
              source={{ uri: submission.photo }}
              style={styles.submittedImage}
            />
          ) : (
            <View style={[styles.submittedImage, styles.center]}>
              <Text style={{ color: "#9CA3AF" }}>No image provided</Text>
            </View>
          )}
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Submission Details</Text>

          <View style={styles.infoRowLine}>
            <Text style={styles.infoLeft}>Place</Text>
            <Text style={styles.infoRight}>{submission?.place || "-"}</Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.infoRowLine}>
            <Text style={styles.infoLeft}>Duration</Text>
            <Text style={styles.infoRight}>
              {submission?.duration_days || "-"}
            </Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.infoRowLine}>
            <Text style={styles.infoLeft}>Pain Level</Text>
            <Text style={styles.infoRight}>
              {submission?.pain_level ? `${submission.pain_level} / 5` : "-"}
            </Text>
          </View>

          <View style={styles.separator} />

          <View style={{ paddingVertical: 10 }}>
            <Text style={styles.infoLeft}>Patient Comment</Text>
            <Text style={[styles.infoRight, { marginTop: 6, textAlign: "left" }]}>
              {submission?.comment || "-"}
            </Text>
          </View>
        </Card>

        <TouchableOpacity
        style={[
          styles.reportBtn,
        ]}
        onPress={() =>
          router.push({
            pathname: isReviewed
              ? "/report/view/[id]"
              : "/report/[id]",
            params: { id: String(id) },
          })
        }
      >
        <Text style={styles.reportBtnText}>
          {isReviewed ? "View Report" : "Write a Report"}
        </Text>
      </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { flex: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
  },

  pageTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },

  card: {
    backgroundColor: "white",
    padding: 18,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  sectionCard: { paddingBottom: 20 },
  patientCard: { paddingTop: 14 },

  expandHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  patientTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },

  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#E5E7EB",
  },

  patientName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2563EB",
  },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },

  dateText: { fontSize: 13, color: "#6B7280" },

  infoRowLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 4,
  },

  infoLeft: {
    fontSize: 14,
    color: "#6B7280",
  },

  infoRight: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
    textAlign: "right",
    flexShrink: 1,
  },

  separator: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 4,
  },

  submittedImage: {
    width: "100%",
    height: 300,
    borderRadius: 12,
    marginTop: 10,
    backgroundColor: "#E5E7EB",
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },

  reportBtn: {
    backgroundColor: "#2563EB",
    paddingVertical: 16,
    marginHorizontal: 20,
    borderRadius: 12,
    marginTop: 10,
    alignItems: "center",
  },

  reportBtnText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
  center: {
  justifyContent: "center",
  alignItems: "center",
},

});
