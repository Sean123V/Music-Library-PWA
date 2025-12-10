// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker registration successful:', registration);
      })
      .catch(error => {
        console.log('ServiceWorker registration failed:', error);
      });
  });
}

// Install prompt handling
let deferredPrompt;
const installButton = document.createElement('button');

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  
  // Show install button (optional)
  installButton.textContent = 'Install App';
  installButton.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    padding: 10px 20px;
    background: #00fff7;
    color: #000;
    border: none;
    border-radius: 10px;
    font-weight: bold;
    z-index: 1000;
    cursor: pointer;
  `;
  installButton.onclick = installApp;
  document.body.appendChild(installButton);
});

function installApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted install');
      }
      deferredPrompt = null;
      installButton.remove();
    });
  }
}