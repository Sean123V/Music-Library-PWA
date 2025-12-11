const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// Database connection
const db = new sqlite3.Database('./music.db');

// Create table if not exists
db.run(`CREATE TABLE IF NOT EXISTS top_songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rank INTEGER NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    year INTEGER,
    genre TEXT,
    description TEXT
)`);

// Wikipedia scraping function
async function scrapeTopSongsFromWikipedia() {
    try {
        console.log('🌐 Scraping Billboard Top 100 from Wikipedia...');
        
        const url = 'https://en.wikipedia.org/wiki/Billboard_Year-End_Hot_100_singles_of_2023';
        
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 15000
        });
        
        const $ = cheerio.load(data);
        const songs = [];
        
        console.log('📊 Parsing Wikipedia table...');
        
        // Find the table
        $('table.wikitable tbody tr').each((index, element) => {
            if (index === 0) return;
            
            const columns = $(element).find('td');
            if (columns.length >= 3) {
                const rank = parseInt($(columns[0]).text().trim()) || (index);
                const title = $(columns[1]).text().trim().replace(/^"|"$/g, '');
                const artist = $(columns[2]).text().trim();
                
                if (title && artist && title !== 'Title' && artist !== 'Artist(s)') {
                    let cleanArtist = artist
                        .split(' featuring ')[0]
                        .split(' ft. ')[0]
                        .split(' feat. ')[0];
                    
                    let genre = 'Pop';
                    const artistLower = cleanArtist.toLowerCase();
                    
                    if (artistLower.includes('morgan wallen') || artistLower.includes('luke combs')) {
                        genre = 'Country';
                    } else if (artistLower.includes('sza') || artistLower.includes('the weeknd')) {
                        genre = 'R&B';
                    } else if (artistLower.includes('metro boomin') || artistLower.includes('drake')) {
                        genre = 'Hip-Hop';
                    } else if (artistLower.includes('rema') || artistLower.includes('bad bunny')) {
                        genre = 'Latin';
                    }
                    
                    songs.push({
                        rank: rank,
                        title: title,
                        artist: cleanArtist,
                        year: 2023,
                        genre: genre,
                        description: `Billboard Year-End Hot 100 #${rank} of 2023`
                    });
                    
                    if (songs.length >= 50) return false;
                }
            }
        });
        
        console.log(`✅ Found ${songs.length} songs`);
        return songs;
        
    } catch (error) {
        console.error('❌ Wikipedia scraping failed:', error.message);
        throw error;
    }
}

// Insert songs endpoint
app.post('/api/insert-top-songs', async (req, res) => {
    console.log('🔄 INSERT endpoint called');
    
    try {
        // Clear existing data
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM top_songs', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        console.log('🗑️ Cleared old data');
        
        // Scrape new data
        const songs = await scrapeTopSongsFromWikipedia();
        
        // Insert new data
        for (const song of songs) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO top_songs (rank, title, artist, year, genre, description) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [song.rank, song.title, song.artist, song.year, song.genre, song.description],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }
        
        console.log(`✅ Inserted ${songs.length} songs`);
        
        res.json({
            success: true,
            message: `Inserted ${songs.length} songs from Wikipedia`,
            count: songs.length,
            source: 'Wikipedia Billboard 2023'
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({ 
            error: error.message,
            suggestion: 'Check Wikipedia connection'
        });
    }
});

// Get all songs
app.get('/api/top-songs', (req, res) => {
    db.all('SELECT * FROM top_songs ORDER BY rank ASC', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// Other routes...
app.get('/api/song-count', (req, res) => {
    db.get('SELECT COUNT(*) as count FROM top_songs', (err, row) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(row);
    });
});

app.delete('/api/clear-songs', (req, res) => {
    db.run('DELETE FROM top_songs', (err) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ success: true, message: 'Cleared' });
    });
});

// Page routes
app.get("index.html", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("upload.html", (req, res) => res.sendFile(path.join(__dirname, "upload.html")));
app.get("playlists.html", (req, res) => res.sendFile(path.join(__dirname, "playlists.html")));
app.get("top-songs.html", (req, res) => res.sendFile(path.join(__dirname, "top-songs.html")));

app.get('/manifest.json', (req, res) => res.sendFile(path.join(__dirname, 'manifest.json')));
app.get('/sw.js', (req, res) => res.sendFile(path.join(__dirname, 'sw.js')));

const PORT = 3000;
app.listen(PORT, () => {
    console.log("=".repeat(60));
    console.log(`✅ SERVER READY: http://localhost:${PORT}`);
    console.log(`📊 Test insert: http://localhost:${PORT}/top-songs.html`);
    console.log("=".repeat(60));
});
