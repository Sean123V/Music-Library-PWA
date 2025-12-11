const express = require("express");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");  // ADD THIS

// KILL existing Node processes on port 8000 before starting
try {
    console.log("🔪 Killing existing processes on port 8000...");
    execSync("pkill -f 'node.*8000' || true", { stdio: 'inherit' });
    execSync("kill -9 $(lsof -t -i:8000) 2>/dev/null || true", { stdio: 'inherit' });
} catch (e) {
    // Ignore errors if no processes to kill
}

const app = express();

// Serve static files from CURRENT DIRECTORY
app.use(express.static(__dirname));

// Basic routes
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/upload", (req, res) => {
    res.sendFile(path.join(__dirname, "upload.html"));
});

app.get("/playlists", (req, res) => {
    res.sendFile(path.join(__dirname, "playlists.html"));
});

// PWA routes
app.get('/manifest.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'manifest.json'));
});

app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'sw.js'));
});

// Use port 3000 to avoid conflicts
const PORT = 3000;

app.listen(PORT, () => {
    console.log("=".repeat(60));
    console.log(`✅ Server is running on http://localhost:${PORT}`);
    console.log("");
    console.log("🔗 Available Pages:");
    console.log(`• Home: http://localhost:${PORT}/`);
    console.log(`• Upload: http://localhost:${PORT}/upload`);
    console.log(`• Playlists: http://localhost:${PORT}/playlists`);
    console.log("=".repeat(60));
});