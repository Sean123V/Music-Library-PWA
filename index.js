const express = require("express");
const path = require("path");
const app = express();

// NEW CODE for database
const sqlite3 = require('sqlite3').verbose();

// Connect to SQLite database
const db = new sqlite3.Database('./datasource.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the SQLite database.');
});

// Handle GET request to '/data' endpoint
app.get('/data', (req, res) => {
    const sql = `SELECT * FROM favourite_wiki`;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Serve static files from "public" directory
app.use(express.static(path.join(__dirname, "public")));

// ROUTES FOR YOUR EXISTING HTML PAGES
app.get("/", function (req, res) {
    res.sendFile(path.join(__dirname, "public/index.html"));
});

app.get("/index.html", function (req, res) {
    res.sendFile(path.join(__dirname, "public/index.html"));
});

app.get("/upload.html", function (req, res) {
    res.sendFile(path.join(__dirname, "public/upload.html"));
});

app.get("/playlists.html", function (req, res) {
    res.sendFile(path.join(__dirname, "public/playlists.html"));
});

// Optional: Redirect for any .html request to your existing pages
app.get("/*.html", function (req, res) {
    const requestedFile = req.path.substring(1); // Remove leading slash
    
    // List of your actual HTML files
    const validPages = ["index.html", "upload.html", "playlists.html"];
    
    if (validPages.includes(requestedFile)) {
        res.sendFile(path.join(__dirname, "public", requestedFile));
    } else {
        // Redirect to home if trying to access non-existent page
        res.redirect("/");
    }
});

app.listen(8000, () => console.log("Server is running on Port 8000, visit http://localhost:8000/ or http://127.0.0.1:8000 to access your website"));