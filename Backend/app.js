const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

let face_matchResult = "";
let latestImage = ""; 

// Endpoint to receive image from ESP32-CAM
app.post("/receive-image", (req, res) => {
    latestImage = req.body.image;
    console.log("Image received from ESP32-CAM");
    res.status(200).send("Image received");
});

// Endpoint to fetch the latest received image
app.get("/latest-image", (req, res) => {
    if (latestImage) {
        res.json({ image: latestImage });
    } else {
        console.log("No image found");
        res.status(404).json({ error: "No image found" });
    }
});

// Endpoint to handle face match result
app.post("/api/face-match", (req, res) => {
    console.log("Received request body:", req.body);
    if (req.body.match === undefined) {
        console.error("Missing 'match' field in request body");
        return res.status(400).json({ error: "'match' field is required." });
    }

    const { match, matchedImageName } = req.body;
    console.log(`Match status received: ${match}, Matched Image Name: ${matchedImageName}`);

    // Store the face match result in the face_matchResult variable
    face_matchResult = {
        match,
        matchedImageName,
        status: match ? "allow" : "deny",
        message: match ? "Face match found. Access allowed." : "No match found. Access denied."
    };

    // Send response based on the match status
    if (match && matchedImageName) {
        console.log("Match found, responding with allow...");
        return res.json(face_matchResult);
    }

    console.log("No match found, responding with deny...");
    return res.json(face_matchResult);
});

// Endpoint to handle face match decision by user
app.post("/api/face-match-decision", (req, res) => {
    const { decision } = req.body;
    console.log(`Decision received: ${decision}`);

    // Update face_matchResult based on the user decision
    face_matchResult = {
        decision,
        status: decision === "allow" ? "allow" : "deny",
        message: decision === "allow" ? "Access allowed based on user decision." : "Access denied based on user decision."
    };

    res.json(face_matchResult);
});

// Endpoint to send the latest face_matchResult to ESP32
app.get("/api/send-esp", (req, res) => {
    if (face_matchResult) {
        res.json(face_matchResult);
    } else {
        res.status(404).json({ error: "No face match result available" });
    }
});

// Server setup
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
