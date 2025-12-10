function openPlayer(title, artist) {
    localStorage.setItem("title", title);
    localStorage.setItem("artist", artist);
    location.href = "player.html";
}

window.onload = () => {
    if (location.pathname.includes("player.html")) {
        document.getElementById("playerTitle").innerText = localStorage.getItem("title");
        document.getElementById("playerArtist").innerText = localStorage.getItem("artist");
    }
};
