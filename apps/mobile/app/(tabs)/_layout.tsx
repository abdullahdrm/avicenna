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
        position: 'absolute', 
        bottom: 45,            
        left: 20,              
        right: 20,             
        backgroundColor: 'white',
        borderRadius: 15,      
        height: 65,          
        elevation: 5,        
        shadowColor: '#fffcfcff',  
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        paddingBottom: 0,     
        paddingTop: 0,
        borderTopWidth: 0,    
      },
      tabBarLabelStyle: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 1,
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
              width: 70,
              height: 70,
              borderRadius: 50,
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