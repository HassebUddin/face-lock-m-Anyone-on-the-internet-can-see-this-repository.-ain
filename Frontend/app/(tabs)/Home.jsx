import React, { useState, useEffect } from "react";
import { getDatabase, ref, set, onValue, get } from "firebase/database";
import {
  View,
  Text,
  Button,
  TouchableOpacity,
  Image,
  TextInput,
  Modal,
  ScrollView,
} from "react-native";
import * as faceapi from "face-api.js";
import { storage, database } from "../../configs/FirebaseConfig";
import {
  getDownloadURL,
  listAll,
  getStorage,
  uploadBytes,
  ref as storageRef,
} from "firebase/storage";
import { FaClock } from "react-icons/fa";
import { Colors } from "../../constants/Colors";
import Entypo from "@expo/vector-icons/Entypo";
const FaceComparison = () => {
  const [image1, setImage1] = useState(null);
  const [imageFile, setImageFile] = useState(null);
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
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    const loadModels = async () => {
      await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
      await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
      await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
    };
    loadModels();
  }, []);

  // const handleImageUpload = (e) => {
  //   const file = e.target.files[0];
  //   if (file) {
  //     const imageUrl = URL.createObjectURL(file);
  //     setImage1(imageUrl);
  //     setImageFile(file); // Store file for upload       IS
  //   }
  // };
  const fetchFirebaseImages = async (folderPath, setImageState) => {
    try {
      const imagesRef = storageRef(storage, folderPath);
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
    fetchMatchData(setMatches);
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

  const saveMatchToDatabase = async (matchData) => {
    try {
      const db = getDatabase();
      const matchRef = ref(db, `matches/${Date.now()}`);
      await set(matchRef, matchData);
      console.log("Match data saved successfully!");
    } catch (error) {
      console.error("Error saving match data to Firebase:", error);
    }
  };
  const fetchMatchData = (callback) => {
    const matchRef = ref(database, "matches/");
    onValue(matchRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        callback(Object.values(data));
      } else {
        console.log("No data available.");
      }
    });
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
          const currentTime = new Date().toLocaleString();
          setMatchedImageName(facultyImage.name.split(".")[0]);
          setComparisonTime(currentTime);
          setIsSamePerson(
            "The uploaded image matches a faculty member's image."
          );
          setDecisionMessage("Allowed");

          await fetch("http://192.168.0.102:5000/api/face-match", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              match: true,
              matchedImageName: facultyImage.name,
              isFaculty: true,
            }),
          });
          await saveMatchToDatabase({
            matchedImageName: facultyImage.name.split(".")[0],
            decisionMessage: "Allowed",
            popupReason: null,
            decisionTime: null,
            comparisonTime: currentTime,
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
            setMatchedImageName(firebaseImage.name.split(".")[0]);
            setShowPopup(true);
            setPopupReason("Time Exceeded");
          } else {
            setMatchedImageName(firebaseImage.name.split(".")[0]);
            const currentTime = new Date().toLocaleString();
            setComparisonTime(currentTime);
            setIsSamePerson(
              "The uploaded image matches an image from Firebase."
            );
            setDecisionMessage("Allowed");

            setMatches((prevMatches) => [
              ...prevMatches,
              {
                matchedImageName: firebaseImage.name.split(".")[0],
                decisionMessage: "Allowed",
                comparisonTime: currentTime,
              },
            ]);

            await fetch("http://192.168.0.102:5000/api/face-match", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                match: true,
                matchedImageName: firebaseImage.name,
              }),
            });
            await saveMatchToDatabase({
              matchedImageName: firebaseImage.name.split(".")[0],
              decisionMessage: "Allowed",
              popupReason: null,
              decisionTime: null,
              comparisonTime: currentTime,
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
        setPopupReason("Random Person");
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

    if (popupReason === "Random Person" && imageFile) {
      try {
        const storage = getStorage();
        const storageImageRef = storageRef(
          storage,
          `randomImages/${Date.now()}.jpg`
        );
        const uploadResult = await uploadBytes(storageImageRef, imageFile);
        console.log("Image uploaded to Firebase Storage");

        const imageDownloadURL = await getDownloadURL(uploadResult.ref);
        console.log("Image download URL:", imageDownloadURL);
        const db = getDatabase();
        const matchRef = ref(db, `matches/${Date.now()}`);
        await set(matchRef, {
          matchedImageName: "Random Person",
          decisionMessage: response === "allow" ? "Allowed" : "Declined",
          popupReason,
          decisionTime: currentDateTime,
          comparisonTime,
          imageDownloadURL,
        });

        console.log("Random person image saved successfully to Firebase!");
      } catch (error) {
        console.error("Error uploading image to Firebase Storage:", error);
      }
    } else if (popupReason === "Time Exceeded") {
      console.log("Image not saved because of time exceeded.");
      await saveMatchToDatabase({
        matchedImageName,
        decisionMessage: response === "allow" ? "Allowed" : "Declined",
        popupReason,
        decisionTime: currentDateTime,
        comparisonTime,
      });
    }

    await fetch("http://192.168.0.102:5000/api/face-match-decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: response }),
    });

    setShowPopup(false);
  };

  useEffect(() => {
    const db = getDatabase();
    const timeLimitRef = ref(db, "quizTimeLimits/timeLimit");

    get(timeLimitRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const savedTimeLimit = snapshot.val();
          setTimeLimit(savedTimeLimit);

          const [time, period] = savedTimeLimit.split(" ");
          const [hour, minute] = time.split(":");
          setSelectedHour(Number(hour));
          setSelectedMinute(Number(minute));
          setSelectedPeriod(period);
        } else {
          console.log("No time limit found in the database");
        }
      })
      .catch((error) => {
        console.error("Error fetching time limit:", error);
      });
  }, []);

  const toggleTimerPopup = () => {
    setIsTimerPopupVisible(!isTimerPopupVisible);
    setIsDimmed(!isDimmed);
  };

  const handleSetTimeLimit = () => {
    const formattedTime = `${selectedHour}:${
      selectedMinute < 10 ? `0${selectedMinute}` : selectedMinute
    } ${selectedPeriod}`;

    setTimeLimit(formattedTime);

    const db = getDatabase();
    const timeLimitRef = ref(db, "quizTimeLimits");
    set(timeLimitRef, {
      timeLimit: formattedTime,
      timestamp: new Date().toISOString(),
    })
      .then(() => {
        console.log("Time limit saved to Firebase!");
      })
      .catch((error) => {
        console.error("Error saving time limit to Firebase:", error);
      });

    setIsTimerPopupVisible(false);
    setIsDimmed(false);
  };
  return (
    <ScrollView
      style={{
        flex: 1,
        padding: 20,
        backgroundColor: Colors.WHITE,
        paddingTop: 60,
      }}
      contentContainerStyle={{
        alignItems: "center",
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
      {matches.map((item, index) => (
        <View
          key={index}
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
              Date:{" "}
              {item.decisionTime
                ? new Date(item.decisionTime).toLocaleDateString()
                : item.comparisonTime
                ? new Date(item.comparisonTime).toLocaleDateString()
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
              {item.matchedImageName
                ? item.matchedImageName
                : item.popupReason === "Random Person"
                ? item.popupReason
                : item.popupReason === "Time Exceeded"
                ? item.matchedImageName || "Unknown"
                : "Unknown"}
            </Text>
            <Text
              style={{
                fontFamily: "outfit",
                color: Colors.GRAY,
              }}
            >
              {item.decisionTime
                ? new Date(item.decisionTime).toLocaleTimeString()
                : item.comparisonTime
                ? new Date(item.comparisonTime).toLocaleTimeString()
                : "0:0"}
            </Text>
            <Text
              style={{
                fontFamily: "outfit-bold",
                color:
                  item.popupReason === "Time Exceeded" && item.matchedImageName
                    ? item.decisionMessage === "Allowed"
                      ? "purple" 
                      : item.decisionMessage === "Declined" ||
                        item.decisionMessage === "DENY"
                      ? "purple"
                      : "#000" 
                    : item.popupReason === "Random Person"
                    ? item.decisionMessage === "Allowed"
                      ? "#2e8c35"
                      : item.decisionMessage === "Declined" ||
                        item.decisionMessage === "DENY"
                      ? "#e34b4b"
                      : "#000"
                    : item.matchedImageName
                    ? "#2e8c35" 
                    : "#000", 
              }}
            >
              {item.popupReason === "Time Exceeded" && item.matchedImageName
                ? item.decisionMessage
                : item.popupReason === "Random Person"
                ? item.decisionMessage
                : item.matchedImageName
                ? "Allowed"
                : item.decisionMessage
                ? item.decisionMessage
                : "N/A"}
            </Text>
          </View>
        </View>
      ))}
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
    </ScrollView>
  );
};

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
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  padding: 20,
  backgroundColor: "white",
  borderRadius: 10,
  boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
  zIndex: 1000,
  alignItems: "center",
};
const buttonContainerStyle = {
  marginTop: 20,
  flexDirection: "row",
  justifyContent: "center",
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
