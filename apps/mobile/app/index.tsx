import { Redirect } from "expo-router";
import { useAuth } from "./_layout";

export default function Index() {
  const { isLoggedIn } = useAuth();

  return isLoggedIn
    ? <Redirect href="/(doctor)/main" />
    : <Redirect href="/(auth)/login" />;
}
