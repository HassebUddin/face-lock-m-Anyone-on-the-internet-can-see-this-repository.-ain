import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Login from "./../components/Login";
import { auth } from "./../configs/FirebaseConfig";
import { Redirect } from "expo-router";

export default function App() {
  const user = auth.currentUser;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {user ? <Redirect href={'/faceRecog'}/> : <Login />}
      
    </GestureHandlerRootView>
  );
}
