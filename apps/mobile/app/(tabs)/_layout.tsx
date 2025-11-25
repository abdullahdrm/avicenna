import { Tabs } from 'expo-router';
import { BookOpen, FileText, Home, Upload, User } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ 
      tabBarActiveTintColor: '#2563EB',
      tabBarInactiveTintColor: '#9CA3AF',
      headerShown: false,
      tabBarStyle: {
        height: 70,
        paddingBottom: 10,
        paddingTop: 10,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        elevation: 0,
      },
      tabBarLabelStyle: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 4,
      }
    }}>
      
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color }) => <FileText size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: '', 
          tabBarIcon: ({ focused }) => (
            <View style={{
              width: 60,
              height: 60,
              borderRadius: 35,
              backgroundColor: '#2563EB',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Upload size={24} color="white" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Learn',
          tabBarIcon: ({ color }) => <BookOpen size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User size={24} color={color} />,
        }}
      />

    </Tabs>
  );
}