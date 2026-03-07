import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/context/AuthContext';

export default function TabLayout() {
  const { token, loading } = useAuth();

  if (!loading && !token) {
    return <Redirect href="/auth" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1d4ed8',
        tabBarInactiveTintColor: '#64748b',
        headerShown: false,
        tabBarStyle: {
          height: 62,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Items',
          tabBarIcon: ({ color, size }) => <Ionicons size={size} name="basket-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="rides"
        options={{
          title: 'Ride',
          tabBarIcon: ({ color, size }) => <Ionicons size={size} name="bicycle-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="houses"
        options={{
          title: 'Home Renting',
          tabBarIcon: ({ color, size }) => <Ionicons size={size} name="home-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons size={size} name="person-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}
