const express = require("express");
const path = require("path");
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

// Database setup
let db;

// Initialize database
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database('./music.db', (err) => {
            if (err) {
                reject(err);
                return;
            }
            
            // Create table
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
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    });
}

// Scrape Billboard Top 100 from Wikipedia
async function scrapeTopSongsFromWikipedia() {
    try {
        console.log('🌐 Scraping Billboard Top 100 from Wikipedia...');
        
        const url = 'https://en.wikipedia.org/wiki/Billboard_Year-End_Hot_100_singles_of_2023';
        
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        });
        
        const $ = cheerio.load(data);
        const songs = [];
        
        console.log('📊 Parsing Wikipedia table...');
        
        // Find the table with song data
        $('table.wikitable tbody tr').each((index, element) => {
            if (index === 0) return; // Skip header
            
            const columns = $(element).find('td');
            if (columns.length >= 3) {
                const rank = parseInt($(columns[0]).text().trim()) || (index);
                const title = $(columns[1]).text().trim().replace(/^"|"$/g, '');
                const artist = $(columns[2]).text().trim();
                
                if (title && artist && title !== 'Title' && artist !== 'Artist(s)') {
                    let cleanArtist = artist.split(' featuring ')[0];
                    cleanArtist = cleanArtist.split(' ft. ')[0];
                    cleanArtist = cleanArtist.split(' feat. ')[0];
                    cleanArtist = cleanArtist.split(' with ')[0];
                    cleanArtist = cleanArtist.split(' & ')[0];
                    
                    let genre = 'Pop';
                    const artistLower = cleanArtist.toLowerCase();
                    
                    if (artistLower.includes('morgan wallen') || 
                        artistLower.includes('luke combs') || 
                        artistLower.includes('zach bryan')) {
                        genre = 'Country';
                    } else if (artistLower.includes('sza') || 
                               artistLower.includes('the weeknd') || 
                               artistLower.includes('beyoncé') ||
                               artistLower.includes('chris brown')) {
                        genre = 'R&B';
                    } else if (artistLower.includes('metro boomin') || 
                               artistLower.includes('drake') || 
                               artistLower.includes('travis scott') ||
                               artistLower.includes('lil') || 
                               artistLower.includes('21 savage')) {
                        genre = 'Hip-Hop';
                    } else if (artistLower.includes('rema') || 
                               artistLower.includes('karol g') || 
                               artistLower.includes('bad bunny')) {
                        genre = 'Latin';
                    } else if (artistLower.includes('david guetta') || 
                               artistLower.includes('tiësto')) {
                        genre = 'Dance';
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
        
        if (songs.length === 0) {
            throw new Error('No songs found in Wikipedia table');
        }
        
        console.log(`✅ Successfully scraped ${songs.length} songs from Wikipedia`);
        return songs;
        
    } catch (error) {
        console.error('❌ Wikipedia scraping failed:', error.message);
        throw new Error(`Failed to scrape Wikipedia: ${error.message}`);
    }
}

// API Routes

app.post('/api/insert-top-songs', async (req, res) => {
    try {
        console.log('🔄 Starting Wikipedia scrape for top songs...');
        
        // Clear existing data
        db.run('DELETE FROM top_songs', async (err) => {
            if (err) {
                console.error('❌ Error clearing table:', err.message);
                return res.status(500).json({ error: 'Database error' });
            }
            
            try {
                const songs = await scrapeTopSongsFromWikipedia();
                console.log(`📊 Got ${songs.length} songs to insert`);
                
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
                    message: `Successfully scraped and inserted ${insertedCount} songs from Wikipedia`,
                    total: songs.length,
                    source: 'Wikipedia (Billboard 2023)'
                });
                
            } catch (scrapeError) {
                console.error('❌ Scraping failed:', scrapeError.message);
                res.status(500).json({ 
                    error: scrapeError.message,
                    suggestion: 'Make sure you have internet connection and Wikipedia is accessible'
                });
            }
        });
        
    } catch (error) {
        console.error('❌ Error in insert-top-songs:', error);
        res.status(500).json({ 
            error: error.message
        });
    }
});

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

app.get('/api/test-wikipedia', async (req, res) => {
    try {
        console.log('🔍 Testing Wikipedia connection...');
        
        const url = 'https://en.wikipedia.org/wiki/Billboard_Year-End_Hot_100_singles_of_2023';
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 5000
        });
        
        const $ = cheerio.load(response.data);
        const pageTitle = $('h1#firstHeading').text();
        const tableCount = $('table.wikitable').length;
        
        res.json({
            success: true,
            message: 'Wikipedia is accessible',
            details: {
                pageTitle: pageTitle,
                tablesFound: tableCount,
                status: 'READY'
            }
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: error.message,
            suggestion: 'Check internet connection and try again'
        });
    }
});

// Page routes
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/upload", (req, res) => {
    res.sendFile(path.join(__dirname, "upload.html"));
});

app.get("/playlists", (req, res) => {
    res.sendFile(path.join(__dirname, "playlists.html"));
});

app.get("/top-songs", (req, res) => {
    res.sendFile(path.join(__dirname, "top-songs.html"));
});

app.get('/manifest.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'manifest.json'));
});

app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'sw.js'));
});

// Start server
async function startServer() {
    try {
        await initializeDatabase();
        console.log('✅ Database initialized successfully');
        
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
            console.log(`• Insert Songs: POST http://localhost:${PORT}/api/insert-top-songs`);
            console.log(`• Test Wikipedia: GET http://localhost:${PORT}/api/test-wikipedia`);
            console.log(`• Get Songs: GET http://localhost:${PORT}/api/top-songs`);
            console.log(`• Search: GET http://localhost:${PORT}/api/search-songs?q=search_term`);
            console.log(`• Get Count: GET http://localhost:${PORT}/api/song-count`);
            console.log(`• Clear Songs: DELETE http://localhost:${PORT}/api/clear-songs`);
            console.log("");
            console.log("🌐 Wikipedia scraping is enabled");
            console.log("All data comes directly from Wikipedia");
            console.log("=".repeat(60));
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
}

startServer();