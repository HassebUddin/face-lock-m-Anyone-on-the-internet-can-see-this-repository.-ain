import React, { useState, useEffect } from "react";
import * as faceapi from "face-api.js";
import { getDownloadURL, listAll, ref } from "firebase/storage";
import { storage } from "./../../configs/FirebaseConfig";

const FaceComparison = () => {
  const [image1, setImage1] = useState(null);
  const [facultyImages, setFacultyImages] = useState([]);
  const [firebaseImages, setFirebaseImages] = useState([]);
  const [isSamePerson, setIsSamePerson] = useState(null);
  const [matchedImageName, setMatchedImageName] = useState(null);
  const [comparisonTime, setComparisonTime] = useState(null);
  const [isComparing, setIsComparing] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [randomPersonImage, setRandomPersonImage] = useState(null);
  const [decisionMessage, setDecisionMessage] = useState(null);
  const [decisionTime, setDecisionTime] = useState(null);
  const [timeLimit, setTimeLimit] = useState("");
  const [startTime, setStartTime] = useState(null);
  const [popupHeading, setPopupHeading] = useState("");
  const [isEditingTime, setIsEditingTime] = useState(false);

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
      console.log(`Images fetched from Firebase folder: ${folderPath}`);
    } catch (error) {
      console.error("Error fetching Firebase images:", error);
    }
  };

  useEffect(() => {
    fetchESP32Image();
    fetchFirebaseImages("images/", setFirebaseImages);
    fetchFirebaseImages("faculty/", setFacultyImages);
  }, []);

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

    if (!image1 || (firebaseImages.length === 0 && facultyImages.length === 0)) {
      setIsSamePerson("Upload an image and fetch images from Firebase to compare.");
      console.log("Comparison aborted: missing images.");
      setIsComparing(false);
      return;
    }

    if (!startTime) {
      setStartTime(Date.now());
    }

    try {
      const face1 = await checkForFace(image1);
      if (!face1) {
        setIsSamePerson("No face detected in the uploaded image. Please upload a valid face image.");
        console.log("No face detected in the uploaded image.");
        setIsComparing(false);
        return;
      }

      let matchFound = false;
      for (const facultyImage of facultyImages) {
        const face2 = await checkForFace(facultyImage.url);
        if (!face2) continue;

        const distance = faceapi.euclideanDistance(face1.descriptor, face2.descriptor);
        const threshold = 0.6;
        if (distance < threshold) {
          setMatchedImageName(facultyImage.name.split(".")[0]);
          setComparisonTime(new Date().toLocaleString());
          setIsSamePerson("The uploaded image matches a faculty member's image.");
          setDecisionMessage("Person is allowed (Faculty member).");
          console.log(`Match found with faculty member: ${facultyImage.name}`);
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

        const distance = faceapi.euclideanDistance(face1.descriptor, face2.descriptor);
        const threshold = 0.6;
        if (distance < threshold) {
          const currentTime = new Date();
          const [hours, minutes, period] = timeLimit.split(/[:\s]/);
          const timeLimitDate = new Date();
          timeLimitDate.setHours(period === "AM" ? parseInt(hours) : (parseInt(hours) % 12) + 12);
          timeLimitDate.setMinutes(parseInt(minutes));
          timeLimitDate.setSeconds(0);

          if (currentTime >= timeLimitDate) {
            setPopupHeading("Time Exceeded");
            setRandomPersonImage(firebaseImage.url);
            setShowPopup(true);
            console.log("Time limit exceeded.");
          } else {
            setMatchedImageName(firebaseImage.name.split(".")[0]);
            setComparisonTime(new Date().toLocaleString());
            setIsSamePerson("The uploaded image matches an image from Firebase.");
            console.log(`Match found with Firebase image: ${firebaseImage.name}`);
            await fetch("http://192.168.0.102:5000/api/face-match", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ match: true, matchedImageName: firebaseImage.name }),
            });
          }
          matchFound = true;
          break;
        }
      }

      if (!matchFound) {
        setIsSamePerson("The uploaded image doesn't match any images from Firebase.");
        const randomImage = firebaseImages[Math.floor(Math.random() * firebaseImages.length)];
        setRandomPersonImage(randomImage.url);
        setPopupHeading("Random Person");
        setShowPopup(true);
        console.log("No match found. Showing random image popup.");
        await fetch("http://192.168.0.102:5000/api/face-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ match: false }),
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
      setDecisionMessage("Person is allowed.");
      console.log(`Decision: Allowed at ${currentDateTime}`);
    } else {
      setDecisionMessage("Person is not allowed.");
      console.log(`Decision: Declined at ${currentDateTime}`);
    }
    setDecisionTime(currentDateTime);

    await fetch("http://192.168.43.83:5000/api/face-match-decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: response }),
    });

    setShowPopup(false);
  };

  const handleTimeLimitChange = (e) => {
    if (isEditingTime) {
      setTimeLimit(e.target.value);
      console.log(`Time limit changed to: ${e.target.value}`);
    }
  };

  const handleEditTime = () => {
    setIsEditingTime(true);
    console.log("Editing time limit.");
  };

  const handleSaveTime = () => {
    setIsEditingTime(false);
    console.log("Time limit saved.");
  };

  const handleCancelEdit = () => {
    setIsEditingTime(false);
    setTimeLimit("");
    console.log("Time limit editing cancelled.");
  };

  return (
    <div>
      <h1>Face Comparison</h1>

      <div>
        <label>
          Set Time Limit (hh:mm AM/PM):
          <input
            type="text"
            placeholder="hh:mm AM/PM"
            value={timeLimit}
            onChange={handleTimeLimitChange}
            disabled={!isEditingTime}
          />
        </label>
        {!isEditingTime ? (
          <button onClick={handleEditTime}>Edit</button> 
        ) : (
          <>
            <button onClick={handleSaveTime}>Save</button> 
            <button onClick={handleCancelEdit}>Cancel</button> 
          </>
        )}
      </div>
      <button
        onClick={compareFaces}
        disabled={!image1 || firebaseImages.length === 0}
      >
        Compare Faces
      </button>
      <div>
        {isSamePerson && <p>{isSamePerson}</p>}
        {matchedImageName && <p>Matched Firebase Image: {matchedImageName}</p>}
        {comparisonTime && <p>Comparison Date and Time: {comparisonTime}</p>}
      </div>
      <div>
        {image1 && (
          <img
            src={image1}
            alt="ESP32 Captured Image"
            style={{ width: "150px", height: "auto" }}
          />
        )}
      </div>
      <div>
        {firebaseImages.length > 0 && (
          <div>
            <h3>Images from Firebase</h3>
            {firebaseImages.map((firebaseImage, index) => (
              <img
                key={index}
                src={firebaseImage.url}
                alt={`Firebase Image ${index}`}
                style={{ width: "150px", height: "auto", margin: "10px" }}
              />
            ))}
          </div>
        )}
      </div>
   {/* Display Faculty Images */}
   {facultyImages.length > 0 && (
        <div>
          <h3>Faculty Images</h3>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {facultyImages.map((image, index) => (
              <div key={index} style={{ margin: "10px" }}>
                <img src={image.url} alt={image.name} style={{ maxWidth: "100px", maxHeight: "100px" }} />
                <p>{image.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Popup for Allow/Decline decision */}
      {showPopup && (
        <div style={popupStyles}>
          <h2>{popupHeading}</h2>

          <div style={buttonContainerStyle}>
            <button
              style={buttonStyle}
              onClick={() => handlePopupResponse("allow")}
            >
              Allow
            </button>
            <button
              style={buttonStyle}
              onClick={() => handlePopupResponse("decline")}
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {decisionMessage && (
        <div>
          <p>{decisionMessage}</p>
          <p>Decision Time: {decisionTime}</p>
        </div>
      )}
    </div>
  );
};

const popupStyles = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  padding: "20px",
  backgroundColor: "white",
  borderRadius: "10px",
  boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
  zIndex: 1000,
};

const buttonContainerStyle = {
  marginTop: "20px",
  display: "flex",
  justifyContent: "center",
  gap: "10px",
};

const buttonStyle = {
  padding: "10px 20px",
  backgroundColor: "#007BFF",
  color: "white",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer",
};

export default FaceComparison;
