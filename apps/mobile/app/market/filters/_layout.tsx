import { Stack } from 'expo-router';

export default function FiltersLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'card',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="brand" />
      <Stack.Screen name="location" />
      <Stack.Screen name="year" />
      <Stack.Screen name="[type]" />
    </Stack>
  );
}
