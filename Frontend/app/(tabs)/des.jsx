import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Button,
  TouchableOpacity,
  Image,
  TextInput,
  Modal,
} from "react-native";
import * as faceapi from "face-api.js"; // You will need to configure face-api for React Native or find alternatives
import { storage } from "./../../configs/FirebaseConfig"; // Ensure Firebase SDK works with React Native

import { FaClock } from "react-icons/fa";
import { Colors } from "./../../constants/Colors";
import Entypo from "@expo/vector-icons/Entypo";
const FaceComparison = () => {
  const [image1, setImage1] = useState(null);
  const [facultyImages, setFacultyImages] = useState([]);
  const [firebaseImages, setFirebaseImages] = useState([]);
  const [isSamePerson, setIsSamePerson] = useState(null);
  const [matchedImageName, setMatchedImageName] = useState(null);
  const [comparisonTime, setComparisonTime] = useState(null);
  const [isComparing, setIsComparing] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupReason, setPopupReason] = useState("");
  const [randomPersonImage, setRandomPersonImage] = useState(null);
  const [decisionMessage, setDecisionMessage] = useState(null);
  const [decisionTime, setDecisionTime] = useState(null);
  const [timeLimit, setTimeLimit] = useState("");
  const [startTime, setStartTime] = useState(null);
  const [popupHeading, setPopupHeading] = useState("");
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState("AM");
  const [isTimerPopupVisible, setIsTimerPopupVisible] = useState(false);
  const [isDimmed, setIsDimmed] = useState(false);
  
  useEffect(() => {
    const loadModels = async () => {
      await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
      await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
      await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
    };
    loadModels();
  }, []);

  const fetchESP32Image = async () => {
    try {
      const response = await fetch("http://192.168.0.102:5000/latest-image");
      const data = await response.json();
      if (data.image) {
        setImage1(`data:image/jpeg;base64,${data.image}`);
        console.log("ESP32 Image fetched and set.");
      }
    } catch (error) {
      console.error("Error fetching image from ESP32:", error);
    }
  };

  const fetchFirebaseImages = async (folderPath, setImageState) => {
    try {
      const imagesRef = ref(storage, folderPath);
      const result = await listAll(imagesRef);
      const imageUrls = await Promise.all(
        result.items.map(async (itemRef) => {
          const url = await getDownloadURL(itemRef);
          return { url, name: itemRef.name };
        })
      );
      setImageState(imageUrls);
    } catch (error) {
      console.error("Error fetching Firebase images:", error);
    }
  };

  useEffect(() => {
    fetchESP32Image();
    fetchFirebaseImages("images/", setFirebaseImages);
    fetchFirebaseImages("faculty/", setFacultyImages);
  }, []);
  useEffect(() => {
    if (image1 && firebaseImages.length > 0 && facultyImages.length > 0) {
      compareFaces();
    }
  }, [image1, firebaseImages, facultyImages]);
  const checkForFace = async (image) => {
    const img = await faceapi.fetchImage(image);
    const fullFaceDescription = await faceapi
      .detectSingleFace(img)
      .withFaceLandmarks()
      .withFaceDescriptor();
    return fullFaceDescription;
  };

  const compareFaces = async () => {
    if (isComparing) return;
    setIsComparing(true);
    setIsSamePerson(null);
    setMatchedImageName(null);
    setComparisonTime(null);

    if (
      !image1 ||
      (firebaseImages.length === 0 && facultyImages.length === 0)
    ) {
      setIsSamePerson(
        "Upload an image and fetch images from Firebase to compare."
      );
      setIsComparing(false);
      return;
    }

    if (!startTime) {
      setStartTime(Date.now());
    }

    try {
      const face1 = await checkForFace(image1);
      if (!face1) {
        setIsSamePerson(
          "No face detected in the uploaded image.Please upload a valid face image."
        );
        setIsComparing(false);
        return;
      }

      let matchFound = false;
      for (const facultyImage of facultyImages) {
        const face2 = await checkForFace(facultyImage.url);
        if (!face2) continue;

        const distance = faceapi.euclideanDistance(
          face1.descriptor,
          face2.descriptor
        );
        const threshold = 0.6;
        if (distance < threshold) {
          setMatchedImageName(facultyImage.name.split(".")[0]);
          setComparisonTime(new Date().toLocaleString());
          setIsSamePerson(
            "The uploaded image matches a faculty member's image."
          );
          setDecisionMessage("Allowed");

          // POST Request to backend for face match
          await fetch("http://192.168.0.102:5000/api/face-match", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              match: true,
              matchedImageName: facultyImage.name,
              isFaculty: true,
            }),
          });

          setIsComparing(false);
          return;
        }
      }

      for (const firebaseImage of firebaseImages) {
        const face2 = await checkForFace(firebaseImage.url);
        if (!face2) continue;

        const distance = faceapi.euclideanDistance(
          face1.descriptor,
          face2.descriptor
        );
        const threshold = 0.6;
        if (distance < threshold) {
          const currentTime = new Date();
          const [hours, minutes, period] = timeLimit.split(/[:\s]/);
          const timeLimitDate = new Date();
          timeLimitDate.setHours(
            period === "AM" ? parseInt(hours) : (parseInt(hours) % 12) + 12
          );
          timeLimitDate.setMinutes(parseInt(minutes));
          timeLimitDate.setSeconds(0);

          if (currentTime >= timeLimitDate) {
            setPopupHeading("Time Exceeded");
            setRandomPersonImage(firebaseImage.url);
            setShowPopup(true);
            setPopupReason("Time Exceeded"); // Set reason to Time Exceeded
          } else {
            setMatchedImageName(firebaseImage.name.split(".")[0]);
            setComparisonTime(new Date().toLocaleString());
            setIsSamePerson(
              "The uploaded image matches an image from Firebase."
            );

            // POST Request for the successful match
            await fetch("http://192.168.0.102:5000/api/face-match", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                match: true,
                matchedImageName: firebaseImage.name,
              }),
            });
          }
          matchFound = true;
          break;
        }
      }

      if (!matchFound) {
        setIsSamePerson("Decline");
        const randomImage =
          firebaseImages[Math.floor(Math.random() * firebaseImages.length)];
        setRandomPersonImage(randomImage.url);
        setPopupHeading("Random Person");
        setShowPopup(true);
        setPopupReason("Random Person"); // Set reason to Random Person

        // POST Request to backend for declined match
        await fetch("http://192.168.0.102:5000/api/face-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            match: false,
          }),
        });
      }
    } catch (error) {
      console.error("Error during face comparison:", error);
      setIsSamePerson("An error occurred during face comparison.");
    } finally {
      setIsComparing(false);
    }
  };

  const handlePopupResponse = async (response) => {
    const currentDateTime = new Date().toLocaleString();
    if (response === "allow") {
      setDecisionMessage("Allowed");
    } else {
      setDecisionMessage("Declined");
    }
    setDecisionTime(currentDateTime);

    await fetch("http://192.168.0.102:5000/api/face-match-decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: response }),
    });

    setShowPopup(false);
  };

  // Timer Logic
  const toggleTimerPopup = () => {
    setIsTimerPopupVisible(!isTimerPopupVisible);
    setIsDimmed(!isDimmed);
  };

  const handleSetTimeLimit = () => {
    const formattedTime = `${selectedHour}:${
      selectedMinute < 10 ? `0${selectedMinute}` : selectedMinute
    } ${selectedPeriod}`;
    setTimeLimit(formattedTime);
    setIsTimerPopupVisible(false);
    setIsDimmed(false);
  };

  return (
    <View
      style={{
        flex: 1,
        padding: 20,
        alignItems: "center",
        backgroundColor: Colors.WHITE,
        paddingTop: 60,
        opacity: isDimmed ? 0.5 : 1,
      }}
    >
      <Text
        style={{
          fontSize: 24,
          fontFamily: "outfit-bold",
          color: Colors.BLUE,
        }}
      >
        CAMERA VIEW
      </Text>
      <View
        style={{
          padding: 5,
          alignItems: "center",
          marginTop: 30,
          backgroundColor: Colors.WHITE,
          width: 230,
          height: 160,
          borderRadius: 10,
          shadowColor: Colors.BLUE,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 14,
          elevation: 5,
        }}
      >
        {image1 && (
          <Image
            source={{ uri: image1 }}
            style={{ width: 220, height: 150, borderRadius: 10 }}
          />
        )}
      </View>

      {/* Timer Setup */}
      <View style={{ marginVertical: 30 }}>
        <TouchableOpacity
          onPress={toggleTimerPopup}
          style={{ flexDirection: "row", alignItems: "center" }}
        >
          <FaClock
            style={{ fontSize: 24, marginLeft: 177, color: Colors.GRAY }}
          />
          <Text style={{ color: Colors.GRAY, marginLeft: 10 }}>
            Set Time Limit
          </Text>
        </TouchableOpacity>

        {isTimerPopupVisible && (
          <View style={timerPopupStyles}>
            <Entypo
              name="cross"
              size={30}
              color="#fff"
              onPress={() => setIsTimerPopupVisible(false)}
              style={styles.crossIcon}
            />
            <View
              style={{ flexDirection: "row", alignItems: "center", padding: 0 }}
            >
              <TextInput
                value={selectedHour.toString()}
                onChangeText={(text) => setSelectedHour(Number(text))}
                keyboardType="numeric"
                style={inputStyle}
              />
              <Text style={{ color: Colors.WHITE, marginTop: 18 }}>:</Text>
              <TextInput
                value={selectedMinute.toString()}
                onChangeText={(text) => setSelectedMinute(Number(text))}
                keyboardType="numeric"
                style={inputStyle}
              />
              <Text> </Text>
              <TextInput
                value={selectedPeriod}
                onChangeText={setSelectedPeriod}
                style={inputStyle}
              />
            </View>
            <View style={{ marginTop: 20 }}>
              <TouchableOpacity
                onPress={handleSetTimeLimit}
                style={{
                  backgroundColor: Colors.BLUE,
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 10,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: "white",
                    fontFamily: "outfit",
                    fontSize: 16,
                  }}
                >
                  Set Time Limit
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View
        style={{
          marginTop: 50,
          backgroundColor: Colors.WHITE,
          width: 320,
          borderRadius: 8,
          shadowColor: Colors.BLUE,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 14,
          elevation: 5,
        }}
      >
        <View style={{ backgroundColor: "#f2f1ed", padding: 8 }}>
          <Text
            style={{
              fontFamily: "outfit",
              fontSize: 13,
              marginLeft: 10,
              marginRight: 19,
              color: Colors.GRAY,
            }}
          >
             {/* Prioritize decisionTime over comparisonTime */}
        Date:{" "}
        {decisionTime
          ? new Date(decisionTime).toLocaleDateString()
          : comparisonTime
          ? new Date(comparisonTime).toLocaleDateString()
          : "N/A"}
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 20,
          }}
        >
          <Text
            style={{
              fontFamily: "outfit-bold",
              color: Colors.BLUE,
            }}
          >
            {matchedImageName ? matchedImageName : popupReason ? popupReason : "Unknown"}
          </Text>
          <Text
            style={{
              fontFamily: "outfit",
              color: Colors.GRAY,
            }}
          >
            {/* Display the time for either decisionTime or comparisonTime */}
        {decisionTime
          ? new Date(decisionTime).toLocaleTimeString()
          : comparisonTime
          ? new Date(comparisonTime).toLocaleTimeString()
          : "0:0"}
          </Text>
          <Text
            style={{
              fontFamily: "outfit-bold",
              color: "#2e8c35",
            }}
          >
            {matchedImageName 
        ? (matchedImageName ? "ALLOW" : "DENY") 
        : (decisionMessage ? decisionMessage : "N/A")
      }
          </Text>
        </View>
      </View>
      {showPopup && (
        <Modal transparent={true} animationType="fade" visible={showPopup}>
          <View style={popupStyles}>
            <Text style={{ fontSize: 18, fontWeight: "bold" }}>
              {popupHeading}
            </Text>
           
            <Text>{popupReason}</Text>
            <View style={buttonContainerStyle}>
              <Button
                title="Allow"
                onPress={() => handlePopupResponse("allow")}
              />
              <Button
                title="Decline"
                onPress={() => handlePopupResponse("decline")}
              />
            </View>
          </View>
        </Modal>
      )}

     
    </View>
  );
};

// Styles for the timer popup and others
const timerPopupStyles = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  padding: 20,
  backgroundColor: Colors.GRAY,
  borderRadius: 10,
  boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};
const styles = {
  crossIcon: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 1,
  },
};
const popupStyles = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  padding: 20,
  backgroundColor: 'white',
  borderRadius: 10,
  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
  zIndex: 1000,
  alignItems: 'center',
};
const buttonContainerStyle = {
  marginTop: 20,
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 10,
};
const inputStyle = {
  width: 50,
  height: 40,
  textAlign: "center",
  borderWidth: 2,
  borderColor: "#fff",
  marginLeft: 5,
  marginRight: 5,
  marginTop: 27,
  borderRadius: 5,
  color: Colors.WHITE,
};

export default FaceComparison;
