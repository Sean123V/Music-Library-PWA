const songs = [
    { title: "Night Drive", artist: "Stellarwave", img: "images/sample1.jpg" },
    { title: "Echoes", artist: "Neon Dreamer", img: "images/sample2.jpg" },
    { title: "Sky Garden", artist: "Aurora Sky", img: "images/sample3.jpg" },
    { title: "Lost Signal", artist: "Ghost Fade", img: "images/sample4.jpg" },
    { title: "Midnight Dreams", artist: "Nova Luna", img: "images/sample5.jpg" }
];

const musicGrid = document.getElementById('musicGrid');
const searchBar = document.getElementById('searchBar');

function displaySongs(list) {
    musicGrid.innerHTML = '';
    if(list.length === 0){
        musicGrid.innerHTML = '<p style="color:#555; text-align:center;">No songs found</p>';
        return;
    }
    list.forEach(song => {
        const card = document.createElement('div');
        card.className = 'song-card';
        card.innerHTML = `
            <img src="${song.img}" alt="${song.title}">
            <h3>${song.title}</h3>
            <p>${song.artist}</p>
        `;
        musicGrid.appendChild(card);
    });
}

displaySongs(songs);

searchBar.addEventListener('input', e => {
    const query = e.target.value.toLowerCase();
    const filtered = songs.filter(song => 
        song.title.toLowerCase().includes(query) || 
        song.artist.toLowerCase().includes(query)
    );
    displaySongs(filtered);
});
