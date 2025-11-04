import { StyleSheet, Text, View } from "react-native";

export default function ReportsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reports</Text>
      <Text>No reports yet.</Text>
      <Text style={styles.note}>
        (This is where your dermatology analysis results will appear.)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 10, color: "#0077b6" },
  note: { marginTop: 8, color: "gray", textAlign: "center" },
});