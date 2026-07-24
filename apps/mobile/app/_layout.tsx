import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.cream,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'NexPlay' }} />
        <Stack.Screen name="auth" options={{ title: 'Connexion' }} />
        <Stack.Screen name="play" options={{ title: 'Jouer' }} />
      </Stack>
    </>
  );
}
