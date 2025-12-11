const express = require("express");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const cheerio = require('cheerio');

// KILL existing Node processes on port 8000 before starting
try {
    console.log("🔪 Killing existing processes on port 8000...");
    execSync("pkill -f 'node.*8000' || true", { stdio: 'inherit' });
    execSync("kill -9 $(lsof -t -i:8000) 2>/dev/null || true", { stdio: 'inherit' });
} catch (e) {
    // Ignore errors if no processes to kill
}

const app = express();

// Middleware to parse JSON
app.use(express.json());

// Serve static files from CURRENT DIRECTORY
app.use(express.static(__dirname));


// Create tables function
function createTables() {
    db.run(`CREATE TABLE IF NOT EXISTS top_songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rank INTEGER NOT NULL,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        year INTEGER,
        genre TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('❌ Error creating table:', err.message);
        } else {
            console.log('✅ top_songs table ready');
        }
    });
}

// REAL WEB SCRAPING FUNCTION
async function scrapeTopSongsFromWikipedia() {
    try {
        console.log('🌐 Scraping Billboard Top 100 from Wikipedia...');
        
        // We'll use Billboard Year-End Hot 100 for 2023
        const url = 'https://en.wikipedia.org/wiki/Billboard_Year-End_Hot_100_singles_of_2023';
        
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        const songs = [];
        
        console.log('📊 Parsing Wikipedia table...');
        
        // Find the main table with song rankings
        $('table.wikitable.sortable tbody tr').each((index, element) => {
            // Skip header row (index 0) and any rows without enough columns
            if (index === 0) return;
            
            const columns = $(element).find('td');
            if (columns.length >= 3) {
                const rank = parseInt($(columns[0]).text().trim()) || index;
                const title = $(columns[1]).text().trim().replace(/^"|"$/g, ''); // Remove quotes
                const artist = $(columns[2]).text().trim();
                
                if (title && artist && title !== 'Title' && artist !== 'Artist(s)') {
                    // Clean up artist names (remove featured artists in parentheses)
                    let cleanArtist = artist.split(' featuring ')[0];
                    cleanArtist = cleanArtist.split(' ft. ')[0];
                    cleanArtist = cleanArtist.split(' feat. ')[0];
                    cleanArtist = cleanArtist.split(' with ')[0];
                    cleanArtist = cleanArtist.split(' & ')[0];
                    
                    // Determine genre based on artist/song characteristics
                    let genre = 'Pop'; // Default
                    const artistLower = cleanArtist.toLowerCase();
                    const titleLower = title.toLowerCase();
                    
                    if (artistLower.includes('morgan wallen') || artistLower.includes('luke combs')) {
                        genre = 'Country';
                    } else if (artistLower.includes('sza') || artistLower.includes('the weeknd') || artistLower.includes('beyoncé')) {
                        genre = 'R&B';
                    } else if (artistLower.includes('metro boomin') || artistLower.includes('drake') || artistLower.includes('travis scott')) {
                        genre = 'Hip-Hop';
                    } else if (artistLower.includes('rema') || artistLower.includes('karol g')) {
                        genre = 'Afrobeats/Latin';
                    } else if (artistLower.includes('taylor swift') || artistLower.includes('harry styles') || artistLower.includes('miley cyrus')) {
                        genre = 'Pop';
                    }
                    
                    songs.push({
                        rank: rank,
                        title: title,
                        artist: cleanArtist,
                        year: 2023,
                        genre: genre,
                        description: `Billboard Year-End Hot 100 #${rank} of 2023`
                    });
                    
                    // Stop at 50 songs
                    if (songs.length >= 50) return false;
                }
            }
        });
        
        console.log(`✅ Successfully scraped ${songs.length} songs from Wikipedia`);
        return songs;
        
    } catch (error) {
        console.error('❌ Wikipedia scraping failed:', error.message);
        console.log('🔄 Falling back to Billboard 2023 data...');
        return getBillboard2023Data();
    }
}


// API Route to insert top songs FROM WIKIPEDIA
app.post('/api/insert-top-songs', async (req, res) => {
    try {
        console.log('🔄 Starting Wikipedia scrape for top songs...');
        
        // Clear existing data
        db.run('DELETE FROM top_songs', async (err) => {
            if (err) {
                console.error('❌ Error clearing table:', err.message);
                return res.status(500).json({ error: 'Database error' });
            }
            
            console.log('🗑️ Cleared existing songs from database');
            
            // Scrape songs from Wikipedia (with fallback)
            const songs = await scrapeTopSongsFromWikipedia();
            console.log(`📊 Got ${songs.length} songs to insert`);
            
            // Insert songs one by one
            let insertedCount = 0;
            const insertPromises = songs.map(song => {
                return new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO top_songs (rank, title, artist, year, genre, description) 
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [song.rank, song.title, song.artist, song.year, song.genre, song.description],
                        function(err) {
                            if (err) {
                                console.error('❌ Error inserting song:', err.message);
                                reject(err);
                            } else {
                                insertedCount++;
                                resolve();
                            }
                        }
                    );
                });
            });
            
            await Promise.all(insertPromises);
            
            res.json({
                success: true,
                message: `Inserted ${insertedCount} songs from Wikipedia into database`,
                total: songs.length,
                source: songs.length > 0 ? 'Wikipedia (Billboard 2023)' : 'Fallback Billboard Data'
            });
            
        });
        
    } catch (error) {
        console.error('❌ Error in insert-top-songs:', error);
        res.status(500).json({ error: error.message });
    }
});

// API Route to get all top songs
app.get('/api/top-songs', (req, res) => {
    db.all('SELECT * FROM top_songs ORDER BY rank ASC', (err, rows) => {
        if (err) {
            console.error('❌ Error fetching songs:', err.message);
            res.status(500).json({ error: 'Database error' });
        } else {
            res.json(rows);
        }
    });
});

// API Route to get song count
app.get('/api/song-count', (req, res) => {
    db.get('SELECT COUNT(*) as count FROM top_songs', (err, row) => {
        if (err) {
            console.error('❌ Error counting songs:', err.message);
            res.status(500).json({ error: 'Database error' });
        } else {
            res.json(row);
        }
    });
});

// API Route to clear all songs
app.delete('/api/clear-songs', (req, res) => {
    db.run('DELETE FROM top_songs', (err) => {
        if (err) {
            console.error('❌ Error clearing songs:', err.message);
            res.status(500).json({ error: 'Database error' });
        } else {
            res.json({ success: true, message: 'All songs cleared' });
        }
    });
});

// API Route to search songs
app.get('/api/search-songs', (req, res) => {
    const query = req.query.q || '';
    const sql = query ? 
        `SELECT * FROM top_songs 
         WHERE title LIKE ? OR artist LIKE ? OR genre LIKE ?
         ORDER BY rank ASC` 
        : 'SELECT * FROM top_songs ORDER BY rank ASC';
    
    const searchTerm = `%${query}%`;
    const params = query ? [searchTerm, searchTerm, searchTerm] : [];
    
    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('❌ Error searching songs:', err.message);
            res.status(500).json({ error: 'Database error' });
        } else {
            res.json(rows);
        }
    });
});

// Basic routes (existing)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/upload", (req, res) => {
    res.sendFile(path.join(__dirname, "upload.html"));
});

app.get("/playlists", (req, res) => {
    res.sendFile(path.join(__dirname, "playlists.html"));
});

// Add new route for top songs page
app.get("/top-songs", (req, res) => {
    res.sendFile(path.join(__dirname, "top-songs.html"));
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
    console.log(`• Top Songs: http://localhost:${PORT}/top-songs`);
    console.log("");
    console.log("🔗 Database API Endpoints:");
    console.log(`• Insert Songs (from Wikipedia): POST http://localhost:${PORT}/api/insert-top-songs`);
    console.log(`• Get Songs: GET http://localhost:${PORT}/api/top-songs`);
    console.log(`• Search: GET http://localhost:${PORT}/api/search-songs?q=search_term`);
    console.log(`• Get Count: GET http://localhost:${PORT}/api/song-count`);
    console.log(`• Clear Songs: DELETE http://localhost:${PORT}/api/clear-songs`);
    console.log("");
    console.log("=".repeat(60));
});