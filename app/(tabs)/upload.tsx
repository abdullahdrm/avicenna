import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Alert, Button, Image, StyleSheet, View } from "react-native";

export default function UploadScreen() {
  const [image, setImage] = useState<string | null>(null);

  const requestPermissions = async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    const galleryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (
      cameraPermission.status !== "granted" ||
      galleryPermission.status !== "granted"
    ) {
      Alert.alert("Permission required", "Camera and gallery permissions are needed.");
      return false;
    }
    return true;
  };

  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  return (
    <View style={styles.container}>
      <Button title="📷 Take a Photo" onPress={takePhoto} />
      <View style={{ height: 10 }} />
      <Button title="🖼️ Pick from Gallery" onPress={pickImage} />
      {image && <Image source={{ uri: image }} style={styles.preview} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  preview: { width: 350, height: 250, borderRadius: 10, marginTop: 20 },
});