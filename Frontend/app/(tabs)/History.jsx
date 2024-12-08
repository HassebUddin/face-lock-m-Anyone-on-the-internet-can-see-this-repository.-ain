import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { ref as storageRef, listAll, getDownloadURL } from "firebase/storage";
import { ref as dbRef, getDatabase, get } from "firebase/database";
import { useRouter } from "expo-router";
import { storage } from "../../configs/FirebaseConfig";
import { Colors } from "../../constants/Colors";
import Ionicons from "@expo/vector-icons/Ionicons";

const FaceComparisonWithDetail = () => {
  const [firebaseImages, setFirebaseImages] = useState([]);
  const [facultyImages, setFacultyImages] = useState([]);
  const [randomPerson, setRandomPerson] = useState([]);
  const [matchedData, setMatchedData] = useState([]);
  const [imageName, setImageName] = useState(null);
  const [imageUrl, setImageUrl] = useState(null); 
  const [viewingDetail, setViewingDetail] = useState(false); 
  const router = useRouter();

  
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

  
  const fetchMatchedDetails = async (image) => {
    try {
      const db = getDatabase();
      const matchesRef = dbRef(db, "matches");
      const snapshot = await get(matchesRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        const filteredData = Object.keys(data)
          .map((key) => ({
            id: key,
            ...data[key],
          }))
          .filter(
            (item) =>
              item.matchedImageName.toLowerCase() === image.toLowerCase()
          );

        setMatchedData(filteredData);
      } else {
        console.log("No data available.");
      }
    } catch (error) {
      console.error("Error fetching matched details:", error);
    }
  };

  useEffect(() => {
    fetchFirebaseImages("images/", setFirebaseImages);
    fetchFirebaseImages("faculty/", setFacultyImages);
    fetchFirebaseImages("randomPerson/", setRandomPerson);
  }, []);


  const removeFileExtension = (filename) => {
    return filename.split(".").slice(0, -1).join(".");
  };


  const renderImageList = (images) => {
    return (
      
      <View
        style={{
         
          marginBottom: 10,
          backgroundColor: Colors.WHITE,
          padding: 10,
          width: "90%",
          alignSelf: "center",
          borderRadius: 8,
          shadowColor: Colors.BLUE,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.3,
          shadowRadius: 14,
          elevation: 5,
        }}
      >
        <View style={{ flexDirection: "column" }}>
          {images.map((image, index) => (
            <TouchableOpacity
              key={index}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 10,
              }}
              onPress={() => {
                const imageName = removeFileExtension(image.name); 
                setImageName(imageName);
                setImageUrl(image.url); 

                
                if (imageName === "Random Person") {
                  fetchMatchedDetails(imageName); 
                  setViewingDetail(true); 
                } else {
                  fetchMatchedDetails(imageName); 
                  setViewingDetail(true); 
                }
              }}
            >
              <Image
                source={{ uri: image.url }}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  borderWidth: 2,
                  borderColor: Colors.BLUE,
                  marginRight: 10,
                }}
              />
              <Text style={{ fontFamily: "outfit-bold", color: Colors.BLUE }}>
                {removeFileExtension(image.name)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderMatchedDetails = () => {
    return (
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: 20,
          backgroundColor: Colors.WHITE,
          paddingTop: 60,
        }}
      >
         <View style={styles.headerDetail}>
         <TouchableOpacity  onPress={() => setViewingDetail(false)}>
          <Ionicons
            style={styles.backIcon}
            name="arrow-back"
            size={24}
            color={Colors.BLUE}
          />
        </TouchableOpacity>
          <Text style={styles.heading}>MEMBER Detail</Text></View>

  
        {imageUrl && (
          <View style={styles.selectedImageContainer}>
            <View>
              <Image source={{ uri: imageUrl }} style={styles.image} />
              <Text style={styles.imageName}>{imageName}</Text>
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
          {matchedData.length > 0 ? (
            matchedData.map((match) => {
              const date = new Date(
                match.decisionTime || match.comparisonTime
              ).toLocaleDateString();
              const time = new Date(
                match.decisionTime || match.comparisonTime
              ).toLocaleTimeString();

           
              const timeColor = match.decisionTime ? "purple" : "green";

              return (
                <View
                  key={match.id} 
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
                    {date}
                  </Text>

               
                  <Text
                    style={{
                      fontFamily: "outfit",
                      color: Colors.GRAY,
                    }}
                  >
                    {time}
                  </Text>

           
                  <Text
                    style={{
                      fontFamily: "outfit-bold",
                      color: timeColor, 
                    }}
                  >
                    {match.decisionMessage}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.text}>
              No matching data found for {imageName}.
            </Text>
          )}
        </View>

      
      </ScrollView>
    );
  };
  const renderRandomPersonDetail = () => {
    return (
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: 20,
          backgroundColor: Colors.WHITE,
          paddingTop: 60,
        }}
      >
         <View style={styles.headerDetail}>
         <TouchableOpacity  onPress={() => setViewingDetail(false)}>
          <Ionicons
            style={styles.backIcon}
            name="arrow-back"
            size={24}
            color={Colors.BLUE}
          />
        </TouchableOpacity>
          <Text style={styles.heading}>Random Person Detail</Text></View>

  
        {imageUrl && (
          <View style={styles.selectedImageContainer}>
            <View>
              <Image source={{ uri: imageUrl }} style={styles.image} />
              <Text style={styles.imageName}>{imageName}</Text>
            </View>
          </View>
        )}

        <View
          style={{
            marginLeft:-18,
            marginTop: 60,
            backgroundColor: Colors.WHITE,
            width: 360,
            borderRadius: 12,
            shadowColor: Colors.BLUE,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 14,
            elevation: 5,
          }}
        >
          {matchedData.length > 0 ? (
            matchedData.map((matchs) => {
            
              const dated = new Date(
                matchs.decisionTime 
              ).toLocaleDateString();
              const timed = new Date(
                matchs.decisionTime 
              ).toLocaleTimeString();

              const timeColor =
              matchs.decisionMessage.toLowerCase() === "allowed"
                  ? "green"
                  : "red";

              return (
                <View
                  key={matchs.id}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 20,
                  }}
                >
                  <View>
                  <Image source={{ uri: matchs.imageDownloadURL }} style={styles.imageRandom} />

                  </View>
             
                  <Text
                    style={{
                      fontFamily: "outfit",
                      color: Colors.BLUE,
                    }}
                  >
                    {dated}
                  </Text>

              
                  <Text
                    style={{
                      fontFamily: "outfit",
                      color: Colors.GRAY,
                    }}
                  >
                    {timed}
                  </Text>

         
                  <Text
                    style={{
                      fontFamily: "outfit-bold",
                      color: timeColor, 
                    }}
                  >
                    {matchs.decisionMessage}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.text}>
              No matching data found for {imageName}.
            </Text>
          )}
        </View>

       
      </ScrollView>
    );
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
      {!viewingDetail ? (
        <>
        <View style={styles.headerContainer}>
         <TouchableOpacity onPress={() => setViewingDetail(false)}>
          <Ionicons
            style={styles.backIcon}
            name="arrow-back"
            size={24}
            color={Colors.BLUE}
          />
        </TouchableOpacity>
          <Text style={styles.heading}>MEMBERS</Text></View>
          {firebaseImages.length > 0 && renderImageList(firebaseImages)}
          {facultyImages.length > 0 && renderImageList(facultyImages)}
          {randomPerson.length > 0 && renderImageList(randomPerson)}
        </>
      ) : imageName === "Random Person" ? (
        renderRandomPersonDetail() 
      ) : (
        renderMatchedDetails() 
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 80, 
  },
  backIcon: {
    marginRight: 10,
  },
  heading: {
    fontSize: 24,
    fontFamily: "outfit-bold",
    color: Colors.BLUE,
    marginLeft: 5,
  },
  headerDetail: {
    marginLeft:-9,
    marginTop:-57,
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 80,
  },
  imageContainer: {
    alignItems: "center",
    backgroundColor: Colors.WHITE,
    width: 110,
    height: 105,
    padding: 2,
    borderRadius: 8,
    shadowColor: Colors.BLUE,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 5,
  },
  imageRow: {
    flexDirection: "column",
  },
  imageWithName: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  image: {
    width: 105,
    height: 100,
    borderRadius: 8,
    shadowColor: Colors.BLUE,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 5,
  },
  imageRandom: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Colors.BLUE,
    marginRight: 10,
  },
  imageName: {
    fontFamily: "outfit-bold",
    color: Colors.BLUE,
    fontSize: 25,
    padding: 5,
    position: "absolute",
    top: 50,
    marginLeft: 120,
  },
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  selectedImageContainer: {
    alignItems: "center",
    backgroundColor: Colors.WHITE,
    width: 110,
    height: 105,
    padding: 2,
    borderRadius: 8,
    shadowColor: Colors.BLUE,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 5,
  },
  selectedImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  selectedImageName: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.BLUE,
  },
  matchCard: {
    padding: 15,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 10,
  },
  text: {
    fontSize: 16,
    marginBottom: 5,
  },
  backButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: Colors.BLUE,
    borderRadius: 8,
    alignItems: "center",
  },
  backButtonText: {
    color: Colors.WHITE,
    fontSize: 16,
  },
});

export default FaceComparisonWithDetail;
