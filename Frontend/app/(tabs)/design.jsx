import React, { useState, useEffect } from 'react';
import { View, Text, Button, TouchableOpacity, Image, TextInput, Modal } from 'react-native';
import * as faceapi from 'face-api.js'; // You will need to configure face-api for React Native or find alternatives
import { storage } from './../../configs/FirebaseConfig'; // Ensure Firebase SDK works with React Native
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { FaClock } from 'react-icons/fa';

const FaceComparison = () => {
  const [image1, setImage1] = useState(null);
  const [facultyImages, setFacultyImages] = useState([]);
  const [firebaseImages, setFirebaseImages] = useState([]);
  const [isSamePerson, setIsSamePerson] = useState(null);
  const [matchedImageName, setMatchedImageName] = useState(null);
  const [comparisonTime, setComparisonTime] = useState(null);
  const [isComparing, setIsComparing] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupReason, setPopupReason] = useState('');
  const [randomPersonImage, setRandomPersonImage] = useState(null);
  const [decisionMessage, setDecisionMessage] = useState(null);
  const [decisionTime, setDecisionTime] = useState(null);
  const [timeLimit, setTimeLimit] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [popupHeading, setPopupHeading] = useState('');
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState('AM');
  const [isTimerPopupVisible, setIsTimerPopupVisible] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
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
      console.error('Error fetching Firebase images:', error);
    }
  };

  useEffect(() => {
    fetchESP32Image();
    fetchFirebaseImages('images/', setFirebaseImages);
    fetchFirebaseImages('faculty/', setFacultyImages);
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

    if (!image1 || (firebaseImages.length === 0 && facultyImages.length === 0)) {
      setIsSamePerson('Upload an image and fetch images from Firebase to compare.');
      setIsComparing(false);
      return;
    }

    if (!startTime) {
      setStartTime(Date.now());
    }

    try {
      const face1 = await checkForFace(image1);
      if (!face1) {
        setIsSamePerson('No face detected in the uploaded image. Please upload a valid face image.');
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
          setMatchedImageName(facultyImage.name.split('.')[0]);
          setComparisonTime(new Date().toLocaleString());
          setIsSamePerson('The uploaded image matches a faculty member\'s image.');
          setDecisionMessage('Person is allowed (Faculty member).');

          // POST Request to backend for face match
          await fetch('http://192.168.0.102:5000/api/face-match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
          timeLimitDate.setHours(period === 'AM' ? parseInt(hours) : (parseInt(hours) % 12) + 12);
          timeLimitDate.setMinutes(parseInt(minutes));
          timeLimitDate.setSeconds(0);

          if (currentTime >= timeLimitDate) {
            setPopupHeading('Time Exceeded');
            setRandomPersonImage(firebaseImage.url);
            setShowPopup(true);
            setPopupReason('Time Exceeded'); // Set reason to Time Exceeded
          } else {
            setMatchedImageName(firebaseImage.name.split('.')[0]);
            setComparisonTime(new Date().toLocaleString());
            setIsSamePerson('The uploaded image matches an image from Firebase.');

            // POST Request for the successful match
            await fetch('http://192.168.0.102:5000/api/face-match', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
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
        setIsSamePerson('Decline');
        const randomImage = firebaseImages[Math.floor(Math.random() * firebaseImages.length)];
        setRandomPersonImage(randomImage.url);
        setPopupHeading('Random Person');
        setShowPopup(true);
        setPopupReason('Random Person'); // Set reason to Random Person

        // POST Request to backend for declined match
        await fetch('http://192.168.0.102:5000/api/face-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            match: false,
          }),
        });
      }
    } catch (error) {
      console.error('Error during face comparison:', error);
      setIsSamePerson('An error occurred during face comparison.');
    } finally {
      setIsComparing(false);
    }
  };

  const handlePopupResponse = async (response) => {
    const currentDateTime = new Date().toLocaleString();
    if (response === 'allow') {
      setDecisionMessage('Allowed');
    } else {
      setDecisionMessage('Declined');
    }
    setDecisionTime(currentDateTime);

    await fetch('http://192.168.0.102:5000/api/face-match-decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: response }),
    });

    setShowPopup(false);
  };

  // Timer Logic
  const toggleTimerPopup = () => {
    setIsTimerPopupVisible(!isTimerPopupVisible);
  };

  const handleSetTimeLimit = () => {
    const formattedTime = `${selectedHour}:${selectedMinute < 10 ? `0${selectedMinute}` : selectedMinute} ${selectedPeriod}`;
    setTimeLimit(formattedTime);
    setIsTimerPopupVisible(false);
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      {/* <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Face Comparison</Text> */}

      {/* Image Upload */}
      {/* <View style={{ marginVertical: 20 }}>
        <Button title="Upload Image" onPress={handleImageUpload} />
      </View> */}

      {/* Timer Setup */}
      <View style={{ marginVertical: 10 }}>
        <TouchableOpacity onPress={toggleTimerPopup} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <FaClock style={{ fontSize: 24, marginRight: 10 }} />
          <Text>Set Time Limit</Text>
        </TouchableOpacity>

        {isTimerPopupVisible && (
          <View style={timerPopupStyles}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                value={selectedHour.toString()}
                onChangeText={(text) => setSelectedHour(Number(text))}
                keyboardType="numeric"
                style={inputStyle}
              />
              <Text>:</Text>
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
            <View style={{ marginTop: 10 }}>
              <Button title="Set Time Limit" onPress={handleSetTimeLimit} />
              <Button title="Cancel" onPress={() => setIsTimerPopupVisible(false)} />
            </View>
          </View>
        )}
      </View>

      {/* Uploaded Image */}
      <View style={{ marginVertical: 10 , alignItems: 'center' }}>
  {image1 && <Image source={{ uri: image1 }} style={{ width: 150, height: 150 }} />}
</View>


      {/* Firebase Images */}
      <View style={{ marginVertical: 20 }}>
        {firebaseImages.length > 0 && (
          <View>
            <Text>Images from Firebase:</Text>
            {firebaseImages.map((firebaseImage, index) => (
              <Image
                key={index}
                source={{ uri: firebaseImage.url }}
                style={{ width: 150, height: 150, margin: 10 }}
              />
            ))}
          </View>
        )}
      </View>

      {/* Faculty Images */}
      {facultyImages.length > 0 && (
        <View style={{ marginVertical: 20 }}>
          <Text>Faculty Images:</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {facultyImages.map((image, index) => (
              <Image
                key={index}
                source={{ uri: image.url }}
                style={{ width: 100, height: 100, margin: 10 }}
              />
            ))}
          </View>
        </View>
      )}

      {/* Result and Popup for Allow/Decline */}
      {isSamePerson && (
        <View style={{ marginVertical: 20 }}>
          <Text>{isSamePerson}</Text>
          {comparisonTime && <Text>{comparisonTime}</Text>}
          {matchedImageName && <Text>Matched Image: {matchedImageName}</Text>}
        </View>
      )}

      {/* Popup for Allow/Decline decision */}
      {showPopup && (
        <Modal transparent={true} animationType="fade" visible={showPopup}>
          <View style={popupStyles}>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{popupHeading}</Text>
            <Image source={{ uri: randomPersonImage }} style={{ width: 150, height: 150, marginVertical: 10 }} />
            <Text>{popupReason}</Text>
            <View style={buttonContainerStyle}>
              <Button title="Allow" onPress={() => handlePopupResponse("allow")} />
              <Button title="Decline" onPress={() => handlePopupResponse("decline")} />
            </View>
          </View>
        </Modal>
      )}

      {/* Decision Message */}
      {decisionMessage && (
        <View style={{ marginVertical: 20 }}>
          <Text>{decisionMessage}</Text>
          <Text>{decisionTime}</Text>
          <Text>{popupReason}</Text>
        </View>
      )}
    </View>
  );
};

// Styles for the timer popup and others
const timerPopupStyles = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  padding: 20,
  backgroundColor: 'white',
  borderRadius: 10,
  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
  zIndex: 1000,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
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
  textAlign: 'center',
  borderWidth: 1,
  margin: 5,
  borderRadius: 5,
};

export default FaceComparison;
