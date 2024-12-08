import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import React, { useEffect, useState } from "react";
import { useNavigation, useRouter } from "expo-router";
import { Colors } from "./../../../constants/Colors";
import Ionicons from "@expo/vector-icons/Ionicons";
import { auth } from "./../../../configs/FirebaseConfig";
import { signInWithEmailAndPassword } from "firebase/auth";
import { ToastAndroid } from "react-native";

export default function Index() {
  const navigation = useNavigation();
  const router = useRouter();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);

  const [email, setEmail] = useState();
  const [password, setPassword] = useState();

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, []);

  const onSignIn = () => {
    if (!email && !password) {
      ToastAndroid.show("Please enter Email and Password", ToastAndroid.LONG);
      return;
    }

    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        // Signed in
        const user = userCredential.user;
        console.log(user);
        router.push("./../../(tabs)/faceRecog");  
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        console.log(errorMessage, errorCode);
      });
  };

  return (
    <View
      style={{
        padding: 25,
        paddingTop: 50,
        backgroundColor: Colors.WHITE,
        height: "100%",
      }}
    >
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons
            style={{
              marginTop: 20,
            }}
            name="arrow-back"
            size={24}
            color={Colors.BLUE}
          />
        </TouchableOpacity>
        <Text
          style={{
            fontFamily: "outfit-bold",
            fontSize: 23,
            textAlign: "center",
            marginRight:27,
            flex: 1, 
            color:Colors.BLUE
          }}
        >
          Welcome back
        </Text>
      </View>

      <Text
        style={{
          fontFamily: "outfit",
          fontSize: 14,
          textAlign: "center",
          color:Colors.BLUE
        }}
      >
        Login to your account
      </Text>

      <View style={{ marginTop: 80 }}>
        <TextInput
          style={styles.input}
          placeholder="Email Address"
          onChangeText={(value) => setEmail(value)}
        />
      </View>

      <View style={{ marginTop: 20 }}>
        <View style={styles.passwordContainer}>
          <TextInput
            secureTextEntry={!passwordVisible}
            style={styles.passwordInput}
            placeholder="Password"
            onChangeText={(value) => setPassword(value)}
          />
          <TouchableOpacity
            onPress={() => setPasswordVisible(!passwordVisible)}
          >
            <Ionicons
              name={passwordVisible ? "eye" : "eye-off"}
              size={24}
              color={Colors.BLUE}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Remember Me and Forgot Password Section */}
      <View style={styles.rememberForgotContainer}>
        <TouchableOpacity
          style={styles.rememberMeContainer}
          onPress={() => setRememberPassword(!rememberPassword)}
        >
          <Ionicons
            name={rememberPassword ? "checkbox-sharp" : "square-outline"}
            size={24}
            color={Colors.BLUE}
          />
          <Text style={styles.rememberText}>Remember Me</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("auth/forgot-password")}>
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={{
          marginTop: 180,
          padding: 15,
          backgroundColor: Colors.BLUE,
          borderRadius: 99,

        }}
      >
        <Text
          onPress={onSignIn}
          style={{
            color: Colors.WHITE,
            textAlign: "center",
            fontFamily: "outfit",
            fontSize: 17,
          }}
        >
          Sign In
        </Text>
      </TouchableOpacity>

      <View style={styles.footerContainer}>
        <Text style={styles.footerText}>Don't have an account?</Text>
        <TouchableOpacity onPress={() => router.replace("auth/sign-up")}>
          <Text style={styles.signInText}> Sign up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 30,
    borderColor: Colors.BLUE,
    fontFamily: "outfit",
    paddingLeft: 30,
   
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 30,
    borderColor: Colors.BLUE,
    paddingHorizontal: 10,
    paddingRight: 30,
   
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 10,
    fontFamily: "outfit",
    paddingLeft: 20,
    color:Colors.BLUE
  },
  rememberForgotContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  rememberMeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  rememberText: {
    fontFamily: "outfit",
    fontSize: 14,
    color: Colors.BLUE,
    marginLeft: 8,
  },
  forgotText: {
    fontFamily: "outfit",
    fontSize: 15,
    color: Colors.BLUE,
  },
  footerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 35,
  },
  footerText: {
    color: Colors.GRAY,
    fontFamily: "outfit",
    fontSize: 17,
  },
  signInText: {
    color: Colors.BLUE,
    fontFamily: "outfit",
    fontSize: 17,
    marginLeft: 5,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20, 
  },
});
