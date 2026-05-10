import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LanguageProvider } from "../lib/LanguageContext";
import { PatientThemeProvider } from "../lib/PatientThemeContext";

const AuthContext = createContext<any>(null);
export const useAuth = () => useContext(AuthContext);

export default function RootLayout() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<"patient" | "doctor" | null>(null);

  React.useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await SecureStore.getItemAsync("access_token");
        const user = await SecureStore.getItemAsync("user");

        if (token && user) {
          const userData = JSON.parse(user);
          setIsLoggedIn(true);
          setUserRole(userData.role);
        }
      } catch (error) {
        console.error("Error checking auth:", error);
      }
    };

    checkAuth();
  }, []);

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <PatientThemeProvider>
          <AuthContext.Provider value={{ isLoggedIn, setIsLoggedIn, userRole, setUserRole }}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(doctor)" />
            </Stack>
          </AuthContext.Provider>
        </PatientThemeProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
