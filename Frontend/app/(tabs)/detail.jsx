import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
   Dimensions,
} from "react-native";

import { ref, listAll, getDownloadURL } from "firebase/storage";
import { storage } from "./../../configs/FirebaseConfig";
import { Colors } from "./../../constants/Colors";

const FaceComparison = () => {
  const [firebaseImages, setFirebaseImages] = useState([]);
  const [facultyImages, setFacultyImages] = useState([]);

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
    fetchFirebaseImages("images/", setFirebaseImages);
    fetchFirebaseImages("faculty/", setFacultyImages);
  }, []);

  const removeFileExtension = (filename) => {
    return filename.split(".").slice(0, -1).join(".");
  };

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        padding: 20,
        backgroundColor: Colors.WHITE,
        paddingTop: 60,
      }}
    >
      <Text style={styles.heading}>MEMBERS</Text>

      {/* Firebase Images */}
      {firebaseImages.length > 0 && (
        <View style={styles.imageContainer}>
          <View style={styles.imageRow}>
            {firebaseImages.map((image, index) => (
              <View key={index} style={styles.imageWithName}>
                <Image source={{ uri: image.url }} style={styles.image} />
                <Text style={styles.imageName}>
                  {removeFileExtension(image.name)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
          <View
    style={{
      marginTop: 60,
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
          fontFamily: "outfit",
          color: Colors.BLUE,
        }}
      >
       {/* 11/22/2024 */}
      </Text>
      <Text
        style={{
          fontFamily: "outfit",
          color: Colors.GRAY,
        }}
      >
        {/* 08:45 */}
      </Text>
      <Text
        style={{
          fontFamily: "outfit-bold",
          color: "#2e8c35",
        }}
      >
        {/* ALLOW */}
      </Text>
    </View>
  </View>
    </ScrollView>
  );
};



const styles = StyleSheet.create({
  heading: {
    fontSize: 24,
    fontFamily: "outfit-bold",
    color: Colors.BLUE,
    marginBottom: 50,
    marginLeft: 5,
    marginTop:-10
  },
  imageContainer: {
    
   alignItems:"center",
    backgroundColor: Colors.WHITE,
    width: 110,
    height:105,
    padding:2,
    borderRadius: 8,
    shadowColor: Colors.BLUE,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 5,
  
  },
 
 
  image: {
    width: 105,
    height:100,
    borderRadius: 8,
    shadowColor: Colors.BLUE,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 5,
   
  },
  imageName: {
    fontFamily: "outfit-bold",
    color: Colors.BLUE,
    fontSize: 25,
    padding: 5,
    position: "absolute", 
    top: 50, 
    marginLeft:120
  },
});

export default FaceComparison;
