'use strict';
const fileInput = document.getElementById('resume-file');
const uploadButton = document.getElementById('upload-button');
const avatarButton = document.getElementById('avatar-button');
const statusBox = document.getElementById('upload-status');
const MAX_FILE_SIZE = 10 * 1024 * 1024;
document.getElementById('year').textContent = new Date().getFullYear();
function showStatus(message, error = false) { statusBox.textContent = message; statusBox.classList.toggle('error', error); }
uploadButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0]; if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['pdf','docx'].includes(ext)) { showStatus('Choose a PDF or DOCX document.', true); fileInput.value = ''; return; }
  if (!file.size || file.size > MAX_FILE_SIZE) { showStatus('File must be between 1 byte and 10 MB.', true); fileInput.value = ''; return; }
  uploadButton.disabled = true;
  showStatus('Reading and organizing your resume…');
  try {
    const data = await WalkThruParser.extractStructured(file);
    sessionStorage.setItem('walkthru.resume', JSON.stringify(data));
    showStatus(`✓ Resume ready! ${data.sections.length} sections detected. Choose an avatar to begin.`);
  } catch (err) {
    sessionStorage.removeItem('walkthru.resume');
    showStatus('Could not read this resume: ' + (err?.message || 'Unknown error'), true);
  } finally { uploadButton.disabled = false; fileInput.value = ''; }
});
avatarButton.addEventListener('click', () => {
  if (!sessionStorage.getItem('walkthru.resume')) { showStatus('Please upload and process a resume first.', true); return; }
  window.location.href = 'avatars.html';
});
// Gentle mouse parallax; does not crop or change the original supplied image.
const art = document.getElementById('hero-art');
if (matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) {
  art.addEventListener('pointermove', event => {
    const r = art.getBoundingClientRect();
    art.style.setProperty('--tilt-x', (((event.clientY-r.top)/r.height)-.5)*-2 + 'deg');
    art.style.setProperty('--tilt-y', (((event.clientX-r.left)/r.width)-.5)*2 + 'deg');
  });
  art.addEventListener('pointerleave', () => { art.style.setProperty('--tilt-x','0deg'); art.style.setProperty('--tilt-y','0deg'); });
}
