import { Tabs } from "expo-router";
import Entypo from "@expo/vector-icons/Entypo";
import { Colors } from "../../constants/Colors";

export default function _layout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.PRIMARY,
      }}
    >
      {/* Home Tab */}
      <Tabs.Screen
        name="Home"
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color }) => (
            <Entypo name="home" size={24} color={ Colors.BLUE} />
          ),
          tabBarLabelStyle: {
            color: Colors.BLUE,  // Change this to your desired color
          },
        }}
      />
      
      {/* History Tab */}
      <Tabs.Screen
        name="History"
        options={{
          tabBarLabel: "History",
          tabBarIcon: ({ color }) => (
            <Entypo name="back-in-time" size={24} color={Colors.BLUE} />
          ),
          tabBarLabelStyle: {
            color: Colors.BLUE,  // Change this to your desired color
          },
        }}
      />
    </Tabs>
  );
}
