import { Tabs, router } from 'expo-router';
import { BookOpen, FileText, Home, MessageCircle, Upload, User } from 'lucide-react-native';
import React, { useRef } from 'react';
import { Animated, PanResponder, Pressable, View } from 'react-native';
import { usePatientTheme } from '../../lib/PatientThemeContext';

export default function TabLayout() {
  const { colors } = usePatientTheme();
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const lastPosition = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5,
      onPanResponderGrant: () => {
        isDragging.current = true;
        pan.setOffset({
          x: lastPosition.current.x,
          y: lastPosition.current.y,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();

        lastPosition.current = {
          x: lastPosition.current.x + gestureState.dx,
          y: lastPosition.current.y + gestureState.dy,
        };

        setTimeout(() => {
          isDragging.current = false;
        }, 100);
      },
    }),
  ).current;

  const handleChatPress = () => {
    if (!isDragging.current) {
      router.push('/chat');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.faintText,
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 45,
          left: 20,
          right: 20,
          backgroundColor: colors.surface,
          borderRadius: 15,
          height: 65,
          elevation: 5,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.1,
          shadowRadius: 5,
          paddingBottom: 0,
          paddingTop: 0,
          borderTopWidth: 0,
          borderWidth: colors.isDark ? 1 : 0,
          borderColor: colors.border,
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
            tabBarIcon: () => (
              <View style={{
                width: 70,
                height: 70,
                borderRadius: 50,
                backgroundColor: colors.primary,
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

      <Animated.View
        {...panResponder.panHandlers}
        style={{
          position: 'absolute',
          bottom: 125,
          right: 30,
          zIndex: 1000,
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
        }}
      >
        <Pressable
          onPress={handleChatPress}
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
            elevation: 8,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
          }}
        >
          <MessageCircle size={28} color="white" />
        </Pressable>
      </Animated.View>
    </View>
  );
}
