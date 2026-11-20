import { Stack } from 'expo-router';

/** Push routes of the Checks tab (CK2 – CK7, CK4 – CK4e). */
export default function ChecksLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="photo" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      <Stack.Screen name="report/submitted" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
