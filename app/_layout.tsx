import { Stack } from "expo-router";
import React, { createContext, useContext, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Create a simple Auth context right here (no src folder)
const AuthContext = createContext<any>(null);
export const useAuth = () => useContext(AuthContext);

export default function RootLayout() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <SafeAreaProvider>
      <AuthContext.Provider value={{ isLoggedIn, setIsLoggedIn }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AuthContext.Provider>
    </SafeAreaProvider>
  );
}