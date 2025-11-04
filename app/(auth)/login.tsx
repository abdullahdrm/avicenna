import React, { useState } from "react";
import { Alert, Button, Image, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../_layout";

export default function LoginScreen() {
  const { setIsLoggedIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    if (username === "demo" && password === "1234") {
      Alert.alert("Welcome!", "Login successful.");
      setIsLoggedIn(true);
    } else {
      Alert.alert("Error", "Invalid credentials. Try demo / 1234.");
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/images/logo.png")}
        style={styles.logo}
      />
      <Text style={styles.title}>Avicenna Login</Text>

      <TextInput
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        style={styles.input}
      />
      <TextInput
        placeholder="Password"
        value={password}
        secureTextEntry
        onChangeText={setPassword}
        style={styles.input}
      />
      <Button title="Login" onPress={handleLogin} />
      <Text style={styles.hint}>Try: demo / 1234</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f8f9fa",
  },
  logo: {
    width: 90,
    height: 90,
    marginBottom: 20,
    resizeMode: "contain",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 30,
    color: "#0077b6",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    width: "80%",
    backgroundColor: "#fff",
  },
  hint: {
    textAlign: "center",
    marginTop: 10,
    color: "gray",
  },
});