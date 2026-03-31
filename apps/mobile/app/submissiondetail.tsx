import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
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

const API_URL = "http://10.239.178.43:8000/api";

const Card = ({ children, style }: any) => (
  <View style={[styles.card, style]}>{children}</View>
);

export default function SubmissionDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<any>(null);
  const [activeSubmissionId, setActiveSubmissionId] = useState(id);

  const fetchSubmission = async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      const url = `${API_URL}/doctor/submissions/${id}/`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return;

      const textData = await response.text();
      const data = JSON.parse(textData);
      setSubmission(data);
    } catch (error) {
      console.error("Fetch Error:", error);
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

  const displayData = useMemo(() => {
    if (!submission) return null;

    const selectedItem = submission.timeline?.find(
      (item: any) => String(item.submission_id) === String(activeSubmissionId)
    );

    return selectedItem || {
      image: submission.skin_analysis?.image,
      prediction: submission.skin_analysis?.prediction,
      confidence: submission.skin_analysis?.confidence,
      body_part: submission.skin_analysis?.body_part,
      status: submission.status,
      answers: submission.skin_analysis?.answers || {},
      comments: submission.skin_analysis?.comments,
      pain_level: submission.skin_analysis?.pain_level,
      duration: submission.skin_analysis?.duration
    };
  }, [submission, activeSubmissionId]);
  if (loading || !displayData) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }
  const imageUri = displayData?.image;
  const bodyPart = displayData?.body_part;
  const painLevel = displayData?.pain_level;
  const duration = displayData?.duration;
  const prediction = displayData?.prediction;
  const confidence = displayData?.confidence;
  const comments = displayData?.comments;
  const answers = displayData?.answers || {};
  const isReviewed = displayData?.has_report || displayData?.status?.toLowerCase() === "reviewed";

  const patient = submission?.patient;
  const profile = patient?.profile;
  const timeline = submission?.timeline || [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={26} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Submission Details</Text>
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
                {patient ? `${patient.first_name || ""} ${patient.last_name || ""}`.trim() || patient.username : "-"}
              </Text>
              <View style={styles.dateRow}>
                <Calendar size={16} color="#6B7280" />
                <Text style={styles.dateText}>
                  {submission?.created_at ? new Date(submission.created_at).toLocaleDateString() : "-"}
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
                <Text style={styles.infoRight}>
                  {Array.isArray(profile?.allergies) ? profile.allergies.join(', ') : (profile?.allergies || "-")}
                </Text>
              </View>

              <View style={styles.separator} />
              <View style={styles.infoRowLine}>
                <Text style={styles.infoLeft}>Medications</Text>
                <Text style={styles.infoRight}>
                  {Array.isArray(profile?.medications) ? profile.medications.join(', ') : (profile?.medications || "-")}
                </Text>
              </View>
            </>
          )}
        </Card>

        {timeline.length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Progress Timeline (Select to Review)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timelineContainer}>
              {timeline.map((item: any) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => setActiveSubmissionId(item.submission_id)}
                  style={[
                    styles.timelineItem,
                    String(activeSubmissionId) === String(item.submission_id) && styles.activeTimelineItem
                  ]}
                >
                  <Image source={{ uri: item.image }} style={styles.timelineImage} />
                  <Text style={styles.timelineDate}>{item.date}</Text>
                  {item.has_report && (
                    <View style={styles.checkIcon}>
                      <CheckCircle size={16} color="#16a34a" fill="white" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Card>
        )}

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Reviewing Selected Update</Text>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.submittedImage} />
          ) : (
            <View style={[styles.submittedImage, styles.center]}>
              <Text style={{ color: "#9CA3AF" }}>No image provided</Text>
            </View>
          )}
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Clinical Details</Text>
          
          <View style={styles.infoRowLine}>
            <Text style={styles.infoLeft}>AI Prediction</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.infoRight, { color: '#2563EB', fontWeight: 'bold' }]}>
                {prediction || "No prediction"}
              </Text>
              {confidence ? (
                <Text style={{ fontSize: 11, color: '#6B7280' }}>
                  {(confidence * 100).toFixed(0)}% confidence
                </Text>
              ) : null}
            </View>
          </View>
          
          <View style={styles.separator} />
          <View style={styles.infoRowLine}>
            <Text style={styles.infoLeft}>Place</Text>
            <Text style={styles.infoRight}>{bodyPart || "-"}</Text>
          </View>

          <View style={styles.separator} />
          <View style={styles.infoRowLine}>
            <Text style={styles.infoLeft}>Duration</Text>
            <Text style={styles.infoRight}>{duration || "-"}</Text>
          </View>

          <View style={styles.separator} />
          <View style={styles.infoRowLine}>
            <Text style={styles.infoLeft}>Pain Level</Text>
            <Text style={styles.infoRight}>{painLevel || "-"}</Text>
          </View>

          <View style={styles.separator} />
          <View style={{ paddingVertical: 10 }}>
            <Text style={styles.infoLeft}>Patient Comment</Text>
            <Text style={[styles.infoRight, { marginTop: 6, textAlign: "left" }]}>
              {comments || "-"}
            </Text>
          </View>
        </Card>

        {Object.keys(answers).length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Specific Symptoms</Text>
            {Object.entries(answers).map(([key, value], index) => (
              <View key={key}>
                {index > 0 && <View style={styles.separator} />}
                <View style={styles.infoRowLine}>
                  <Text style={[styles.infoLeft, { flex: 1 }]}>
                    {key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                  </Text>
                  <Text style={[styles.infoRight, { maxWidth: '40%' }]}>
                    {String(value)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        <TouchableOpacity
          style={[
            styles.reportBtn,
            (!activeSubmissionId || activeSubmissionId === "null") && { backgroundColor: '#9CA3AF' }
          ]}
          disabled={!activeSubmissionId || activeSubmissionId === "null"}
          onPress={() =>
            router.push({
              pathname: isReviewed ? "/report/view/[id]" : "/report/[id]",
              params: { id: String(activeSubmissionId) },
            })
          }
        >
          <Text style={styles.reportBtnText}>
            {!activeSubmissionId || activeSubmissionId === "null"
              ? "Historical Photo (Read-Only)"
              : isReviewed 
              ? "View Existing Report" 
              : "Write Report for this Update"}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20 },
  pageTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  card: { backgroundColor: "white", padding: 18, marginHorizontal: 20, marginBottom: 16, borderRadius: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  sectionCard: { paddingBottom: 20 },
  patientCard: { paddingTop: 14 },
  expandHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  patientTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: "#E5E7EB" },
  patientName: { fontSize: 20, fontWeight: "700", color: "#2563EB" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  dateText: { fontSize: 13, color: "#6B7280" },
  infoRowLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 4 },
  infoLeft: { fontSize: 14, color: "#6B7280" },
  infoRight: { fontSize: 14, color: "#111827", fontWeight: "600", textAlign: "right", flexShrink: 1 },
  separator: { height: 1, backgroundColor: "#E5E7EB", marginHorizontal: 4 },
  submittedImage: { width: "100%", height: 300, borderRadius: 12, marginTop: 10, backgroundColor: "#E5E7EB" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 12 },
  reportBtn: { backgroundColor: "#2563EB", paddingVertical: 16, marginHorizontal: 20, borderRadius: 12, marginTop: 10, alignItems: "center" },
  reportBtnText: { color: "white", fontSize: 16, fontWeight: "700" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  timelineContainer: { marginTop: 10, flexDirection: 'row' },
  timelineItem: { marginRight: 16, width: 140, alignItems: 'center' },
  timelineImage: { width: 140, height: 180, borderRadius: 12, backgroundColor: '#E5E7EB' },
  dateLabel: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  dateLabelText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  aiPredictionText: { fontSize: 12, fontWeight: 'bold', color: '#111827', marginTop: 6, textAlign: 'center' },
  confidenceText: { fontSize: 10, color: '#6B7280' },
  activeTimelineItem: { borderColor: '#2563EB', borderWidth: 2, padding: 2, borderRadius: 14 },
  timelineDate: { fontSize: 10, color: '#6B7280', marginTop: 4, fontWeight: 'bold' },
  checkIcon: { position: 'absolute', top: -5, right: -5 },
});