import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Avicenna</Text>
      <Text style={styles.subtitle}>
        AI-assisted dermatology made accessible and easy.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  logo: { width: 140, height: 140, marginBottom: 20, resizeMode: "contain" },
  title: { fontSize: 24, fontWeight: "bold", color: "#0077b6" },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 20,
    marginTop: 10,
  },
});