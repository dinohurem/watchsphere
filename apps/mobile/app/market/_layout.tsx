import { Stack } from 'expo-router';

export default function MarketLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* Static routes must come before dynamic [id] route */}
      <Stack.Screen
        name="filters"
        options={{
          presentation: 'modal',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
      <Stack.Screen
        name="order-book"
        options={{
          presentation: 'modal',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
      <Stack.Screen
        name="watch-details"
        options={{
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="mark-sold"
        options={{
          presentation: 'modal',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
