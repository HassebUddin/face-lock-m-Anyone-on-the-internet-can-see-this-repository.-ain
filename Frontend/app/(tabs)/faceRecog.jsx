import React, { useState, useEffect,useRef } from "react";
import { getDatabase, ref, set, onValue, get } from "firebase/database";
import * as faceapi from "face-api.js";
import { storage, database } from "./../../configs/FirebaseConfig";
import {
  getDownloadURL,
  listAll,
  getStorage,
  uploadBytes,
  ref as storageRef,
} from "firebase/storage";
import { FaClock } from "react-icons/fa";
import { Colors } from "./../../constants/Colors";
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
  // const [timeLimit, setTimeLimit] = useState(null);  // State for storing the time limit

  const fileInputRef = useRef(null); 
  useEffect(() => {

    const loadModels = async () => {
      await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
      await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
      await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
    };
    loadModels();
  }, []);

  const handleImageUpload = (e) => {
 
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setImage1(imageUrl);
      setImageFile(file); // Store file for upload       IS
    
    }
  };

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
    // && facultyImages.length > 0
    if (image1 && firebaseImages.length > 0 ) {
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
        callback(Object.values(data)); // Convert object to array
      } else {
        console.log("No data available.");
      }
    });
  };

  const compareFaces = async () => {
   console.log("ajsjkadh") 
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

          // POST Request to backend for face match
          await fetch("http://localhost:5000/api/face-match", {
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

            await fetch("http://localhost:5000/api/face-match", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                match: true,
                matchedImageName: firebaseImage.name,
              }),
            });
            await saveMatchToDatabase({
              matchedImageName:  firebaseImage.name.split(".")[0],
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
        await fetch("http://localhost:5000/api/face-match", {
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

    await fetch("http://localhost:5000/api/face-match-decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: response }),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! Status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        console.log("Response from server:", data);
      })
      .catch((error) => {
        console.error("Error during fetch:", error);
      });
    setShowPopup(false);
  };

  // Timer Logic

  useEffect(() => {
    const db = getDatabase();
    const timeLimitRef = ref(db, "quizTimeLimits/timeLimit");

    // Get the time limit value from Firebase
    get(timeLimitRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const savedTimeLimit = snapshot.val();
          setTimeLimit(savedTimeLimit);

          const [time, period] = savedTimeLimit.split(" "); // Split into "HH:MM" and "AM/PM"
          const [hour, minute] = time.split(":"); // Split into hour and minute

          // Set state values based on parsed time limit
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

    // Set time limit in state and Firebase
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
    <div
      style={{
        padding: "20px",
        textAlign: "center",
        backgroundColor: Colors.WHITE,
        paddingTop: "60px",
        opacity: isDimmed ? 0.5 : 1,
      }}
    >
      <h1
        style={{
          fontSize: "24px",
          fontFamily: "outfit-bold",
          color: Colors.BLUE,
        }}
      >
        CAMERA VIEW
      </h1>
      <div>
        <label>
          Upload Image:
          <input
      type="file"
      accept="image/*"
      onChange={(e) => handleImageUpload(e)}
      ref={fileInputRef} // Use a ref to reset the input value
    />

        </label>
      </div>
      <div
        style={{
          padding: "5px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginTop: "30px",
          backgroundColor: Colors.WHITE,
          width: "230px",
          height: "160px",
          borderRadius: "10px",
          boxShadow: `0 2px 14px ${Colors.BLUE}`,
          elevation: 5,
        }}
      >
        {image1 && (
          <img
            src={image1}
            alt="Captured"
            style={{ width: "220px", height: "150px", borderRadius: "10px" }}
          />
        )}
      </div>

      {/* Timer Setup */}
      <div style={{ marginVertical: "30px" }}>
        <button
          onClick={toggleTimerPopup}
          style={{
            display: "flex",
            alignItems: "center",
            marginLeft: "auto",
            marginRight: "auto",
            border: "none",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          <FaClock style={{ fontSize: "24px", color: Colors.GRAY }} />
          <span style={{ color: Colors.GRAY, marginLeft: "10px" }}>
            Set Time Limit
          </span>
        </button>

        {isTimerPopupVisible && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              padding: "20px",
              backgroundColor: Colors.GRAY,
              borderRadius: "10px",
              boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <Entypo
              name="cross"
              size={30}
              color="#fff"
              onClick={() => setIsTimerPopupVisible(false)}
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                zIndex: 1,
                cursor: "pointer",
              }}
            />
            <div
              style={{ display: "flex", alignItems: "center", padding: "0" }}
            >
              <input
                value={selectedHour.toString()}
                onChange={(e) => setSelectedHour(Number(e.target.value))}
                type="number"
                style={inputStyle}
              />
              <span style={{ color: Colors.WHITE, marginTop: "18px" }}>: </span>
              <input
                value={selectedMinute.toString()}
                onChange={(e) => setSelectedMinute(Number(e.target.value))}
                type="number"
                style={inputStyle}
              />
              <input
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ marginTop: "20px" }}>
              <button
                onClick={handleSetTimeLimit}
                style={{
                  backgroundColor: Colors.BLUE,
                  paddingVertical: "10px",
                  paddingHorizontal: "20px",
                  borderRadius: "10px",
                  color: "white",
                  fontFamily: "outfit",
                  fontSize: "16px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Set Time Limit
              </button>
            </div>
          </div>
        )}
      </div>

      {matches.map((item, index) => (
        <div
          key={index}
          style={{
            marginTop: "50px",
            backgroundColor: Colors.WHITE,
            width: "320px",
            borderRadius: "8px",
            boxShadow: `0 2px 14px ${Colors.BLUE}`,
          }}
        >
          <div style={{ backgroundColor: "#f2f1ed", padding: "8px" }}>
            <p
              style={{
                fontFamily: "outfit",
                fontSize: "13px",
                marginLeft: "10px",
                marginRight: "19px",
                color: Colors.GRAY,
              }}
            >
              Date:{" "}
              {item.decisionTime
                ? new Date(item.decisionTime).toLocaleDateString()
                : item.comparisonTime
                ? new Date(item.comparisonTime).toLocaleDateString()
                : "N/A"}
            </p>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "20px",
            }}
          >
            <p
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
            </p>
            <p
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
            </p>
            <p
              style={{
                fontFamily: "outfit-bold",
                color:
                  item.popupReason === "Time Exceeded" && item.matchedImageName
                    ? item.decisionMessage === "Allowed"
                      ? "purple" // Green for ALLOW
                      : item.decisionMessage === "Declined" ||
                        item.decisionMessage === "DENY"
                      ? "purple" // Red for DECLINE/DENY
                      : "#000" // Default color (black)
                    : item.popupReason === "Random Person"
                    ? item.decisionMessage === "Allowed"
                      ? "#2e8c35"
                      : item.decisionMessage === "Declined" ||
                        item.decisionMessage === "DENY"
                      ? "#e34b4b"
                      : "#000"
                    : item.matchedImageName
                    ? "#2e8c35" // Green for ALLOW if matchedImageName exists
                    : "#000", // Default color (black for unknown)
              }}
            >
              {
                item.popupReason === "Time Exceeded" && item.matchedImageName
                  ? item.decisionMessage // Show matchedImageName if "Time Exceeded" and it exists
                  : item.popupReason === "Random Person"
                  ? item.decisionMessage // Show decisionMessage if "Random Person"
                  : item.matchedImageName
                  ? "Allowed" // Show "ALLOW" if matchedImageName exists
                  : item.decisionMessage
                  ? item.decisionMessage // Show decisionMessage if none of the above
                  : "N/A" // Default case
              }
            </p>
          </div>
        </div>
      ))}
      {showPopup && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            padding: "20px",
            backgroundColor: "white",
            borderRadius: "10px",
            boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <h2>{popupHeading}</h2>
          {/* <p>{popupReason}</p> */}
          <div
            style={{
              marginTop: "20px",
              display: "flex",
              gap: "10px",
            }}
          >
            <button
              onClick={() => handlePopupResponse("allow")}
              style={{
                backgroundColor: "#2e8c35",
                padding: "10px 20px",
                borderRadius: "5px",
                color: "white",
                border: "none",
                cursor: "pointer",
              }}
            >
              Allow
            </button>
            <button
              onClick={() => handlePopupResponse("decline")}
              style={{
                backgroundColor: "#e34b4b",
                padding: "10px 20px",
                borderRadius: "5px",
                color: "white",
                border: "none",
                cursor: "pointer",
              }}
            >
              Decline
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Styles for input elements
const inputStyle = {
  padding: "10px",
  fontSize: "16px",
  margin: "5px",
  borderRadius: "8px",
  border: `1px solid ${Colors.BLUE}`,
  width: "50px",
};

export default FaceComparison;
