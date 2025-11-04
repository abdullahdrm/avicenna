import React from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../_layout";

export default function ProfileScreen() {
  const { setIsLoggedIn } = useAuth();

  const user = {
    name: "Zeynep Demirbaş",
    email: "zeynep@example.com",
    skinType: "Combination",
    city: "Ankara, Türkiye",
    joined: "April 2025",
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>

      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Skin Type</Text>
          <Text style={styles.value}>{user.skinType}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Location</Text>
          <Text style={styles.value}>{user.city}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Member Since</Text>
          <Text style={styles.value}>{user.joined}</Text>
        </View>
      </View>

      <View style={styles.logoutContainer}>
        <Button title="Logout" color="#d9534f" onPress={() => setIsLoggedIn(false)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    alignItems: "center",
    paddingTop: 50,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0077b6",
  },
  email: {
    fontSize: 14,
    color: "#6c757d",
    marginTop: 4,
  },
  infoSection: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 8,
  },
  label: {
    color: "#6c757d",
    fontWeight: "600",
  },
  value: {
    color: "#212529",
    fontWeight: "500",
  },
  logoutContainer: {
    position: "absolute",
    bottom: 40,
    width: "80%",
  },
});