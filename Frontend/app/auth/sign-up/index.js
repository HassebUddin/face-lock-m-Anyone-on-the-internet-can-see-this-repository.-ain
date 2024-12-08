import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ToastAndroid,
} from "react-native";
import React, { useEffect, useState } from "react";
import { useNavigation, useRouter } from "expo-router";
import { Colors } from "./../../../constants/Colors";
import Ionicons from "@expo/vector-icons/Ionicons";
import { auth } from "./../../../configs/FirebaseConfig";
import { createUserWithEmailAndPassword } from "firebase/auth";

export default function Index() {
  const navigation = useNavigation();
  const router = useRouter();
  const [passwordVisible, setPasswordVisible] = useState(false);

  const [email, setEmail] = useState();
  const [password, setPassword] = useState();
  const [name, setName] = useState();

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, []);

  const OnCreateAccount = () => {
    if (!email && !password && !name) {
      ToastAndroid.show("Please enter all details", ToastAndroid.LONG);
      return;
    }

    createUserWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        const user = userCredential.user;
        console.log(user);
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
            flex: 1,
            marginRight:19,
            color:Colors.BLUE
          }}
        >
          Let's get started!
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
        Create your new account
      </Text>
      <View style={{ marginTop: 80 }}>
        <TextInput
          style={styles.input}
          placeholder="Name"
          onChangeText={(value) => setName(value)}
        />
      </View>

      <View style={{ marginTop: 20 }}>
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

      <TouchableOpacity
        onPress={OnCreateAccount}
        style={{
          marginTop: 145,
          padding: 15,
          backgroundColor: Colors.BLUE,
          borderRadius: 99,
        }}
      >
        <Text
          style={{
            color: Colors.WHITE,
            textAlign: "center",
            fontFamily: "outfit",
            fontSize: 17,
          }}
        >
          Create Account
        </Text>
      </TouchableOpacity>

      <View style={styles.footerContainer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <TouchableOpacity onPress={() => router.replace("auth/sign-in")}>
          <Text style={styles.signInText}> Sign in</Text>
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
    justifyContent: "flex-start", 
    marginTop: 20,
  },
});
