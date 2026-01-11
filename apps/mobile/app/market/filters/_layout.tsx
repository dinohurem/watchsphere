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
      <Stack.Screen name="[type]" />
    </Stack>
  );
}
