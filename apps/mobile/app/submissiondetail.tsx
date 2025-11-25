import { useLocalSearchParams, useRouter } from "expo-router";
import { Image, ScrollView, StyleSheet, Text, View, LayoutAnimation } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ChevronDown, ChevronUp, Calendar } from "lucide-react-native";
import React, { useState } from "react";
import { TouchableOpacity } from "react-native";


const Card = ({ children, style }: any) => (
  <View style={[styles.card, style]}>{children}</View>
);

export default function SubmissionDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [expanded, setExpanded] = useState(false);

  const submission = {
    id,
    patientName: "Şevval Özay",
    age: 23,
    gender: "Female",
    profileImage: "https://via.placeholder.com/80",
    date: "Nov 23, 2025",
    allergies: "Pollen",
    diseases: "Asthma",
    medications: "Glukofen",
    image: "https://via.placeholder.com/300x300.png?text=Submitted+Photo",

    place: "Left cheek",
    duration: "3 days",
    painLevel: "Mild",
    patientComment: "It started itching yesterday.",

    aiAnalysis: "This will be replaced by our analysis.",
  };

  const history = [
    { id: 1, date: "Nov 12", image: "https://via.placeholder.com/140" },
    { id: 2, date: "Oct 28", image: "https://via.placeholder.com/140" },
    { id: 3, date: "Oct 10", image: "https://via.placeholder.com/140" },
  ];

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>

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
            {expanded ? <ChevronUp size={20} color="#1F2937" /> : <ChevronDown size={20} color="#1F2937" />}
          </TouchableOpacity>

          <View style={styles.profileRow}>
            <Image source={{ uri: submission.profileImage }} style={styles.avatar} />

            <View style={{ flex: 1 }}>
              <TouchableOpacity onPress={() => router.push(`/patients`)}>
                <Text style={styles.patientName}>{submission.patientName}</Text>
              </TouchableOpacity>

              <Text style={styles.subInfoText}>
                {submission.age} • {submission.gender}
              </Text>

              <View style={styles.dateRow}>
                <Calendar size={16} color="#6B7280" />
                <Text style={styles.dateText}>{submission.date}</Text>
              </View>
            </View>
          </View>

          {expanded && (
            <View style={styles.expandedBox}>

              <View style={styles.separator} />

              <View style={styles.infoRowLine}>
                <Text style={styles.infoLeft}>Body</Text>
                <Text style={styles.infoRight}>111cm, 11kg</Text>
              </View>

              <View style={styles.separator} />

              <View style={styles.infoRowLine}>
                <Text style={styles.infoLeft}>Skin</Text>
                <Text style={styles.infoRight}>Normal</Text>
              </View>

              <View style={styles.separator} />

              <View style={styles.infoRowLine}>
                <Text style={styles.infoLeft}>Allergies</Text>
                <Text style={styles.infoRight}>{submission.allergies || "None listed"}</Text>
              </View>

              <View style={styles.separator} />

              <View style={styles.infoRowLine}>
                <Text style={styles.infoLeft}>Conditions</Text>
                <Text style={styles.infoRight}>{submission.diseases || "None listed"}</Text>
              </View>

              <View style={styles.separator} />

              <View style={styles.infoRowLine}>
                <Text style={styles.infoLeft}>Meds</Text>
                <Text style={styles.infoRight}>{submission.medications || "None listed"}</Text>
              </View>

            </View>
          )}
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Submitted Photo</Text>
          <Image source={{ uri: submission.image }} style={styles.submittedImage} />
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Submission Details</Text>

          <View style={styles.infoRowLine}>
            <Text style={styles.infoLeft}>Place</Text>
            <Text style={styles.infoRight}>{submission.place}</Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.infoRowLine}>
            <Text style={styles.infoLeft}>Duration</Text>
            <Text style={styles.infoRight}>{submission.duration}</Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.infoRowLine}>
            <Text style={styles.infoLeft}>Pain Level</Text>
            <Text style={styles.infoRight}>{submission.painLevel}</Text>
          </View>

          <View style={styles.separator} />

          <View style={[styles.infoRowLine, { flexDirection: "column", alignItems: "flex-start" }]}>
            <Text style={styles.infoLeft}>Patient Comment</Text>
            <Text style={[styles.infoRight, { marginTop: 6, textAlign: "left" }]}>
              {submission.patientComment}
            </Text>
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Image Analysis</Text>
          <Text style={styles.analysisText}>{submission.aiAnalysis}</Text>
        </Card>

        {history.length > 0 && (
          <Card style={[styles.sectionCard, { paddingBottom: 12 }]}>
            <Text style={styles.sectionTitle}>Past Submissions</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6, gap: 14 }}>
              {history.map((h) => (
                <TouchableOpacity key={h.id} onPress={() => router.push(`/submissiondetail`)}>
                  <View style={styles.historyCard}>
                    <Image source={{ uri: h.image }} style={styles.historyImage} />
                    <Text style={styles.historyDate}>{h.date}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Card>
        )}

        <TouchableOpacity style={styles.reportBtn}>
          <Text style={styles.reportBtnText}>Write a Report</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// styles
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

  subInfoText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },

  dateText: { fontSize: 13, color: "#6B7280" },

  expandedBox: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 4,
  },

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

  analysisText: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },

  historyCard: {
    width: 110,
    backgroundColor: "white",
    borderRadius: 12,
    overflow: "hidden",
    paddingBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  historyImage: {
    width: "100%",
    height: 100,
    backgroundColor: "#E5E7EB",
  },

  historyDate: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
    marginTop: 6,
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
});
