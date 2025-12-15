import { Drawer } from 'expo-router/drawer';
import React from 'react';
import { colors } from '../../src/constants/theme';
import { CustomDrawerContent } from '../../src/navigation/CustomDrawerContent';

export default function DrawerLayout() {
  return (
    <Drawer
      initialRouteName="dashboard"
      screenOptions={{
        headerShown: false,
        swipeEdgeWidth: 40,
        overlayColor: 'rgba(0,0,0,0.4)',
        sceneStyle: { backgroundColor: colors.background },
      }}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
    >
      <Drawer.Screen name="dashboard" options={{ drawerLabel: 'Dashboard' }} />
      <Drawer.Screen name="my-event" options={{ drawerLabel: 'My Event' }} />
      <Drawer.Screen name="agenda" options={{ drawerLabel: 'Agenda' }} />
      <Drawer.Screen
        name="agenda-detail"
        options={{ drawerItemStyle: { display: 'none' } }}
      />
      <Drawer.Screen name="attendees" options={{ drawerLabel: 'Attendees' }} />
      <Drawer.Screen
        name="delegate-details"
        options={{ drawerItemStyle: { display: 'none' } }}
      />
      <Drawer.Screen name="sponsors" options={{ drawerLabel: 'Sponsors' }} />
      <Drawer.Screen
        name="sponsor-details"
        options={{ drawerItemStyle: { display: 'none' } }}
      />
      <Drawer.Screen
        name="meeting-requests"
        options={{ drawerLabel: 'Meeting Requests' }}
      />
      <Drawer.Screen name="messages" options={{ drawerLabel: 'Messages' }} />
      <Drawer.Screen
        name="message-detail"
        options={{ drawerItemStyle: { display: 'none' } }}
      />
      <Drawer.Screen name="itinerary" options={{ drawerLabel: 'Itinerary' }} />
      <Drawer.Screen name="contacts" options={{ drawerLabel: 'Contacts' }} />
      <Drawer.Screen name="profile" options={{ drawerLabel: 'Profile' }} />
      <Drawer.Screen
        name="change-password"
        options={{ drawerLabel: 'Change Password' }}
      />
    </Drawer>
  );
}

