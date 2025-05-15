// Clear local storage
localStorage.clear();

document.getElementById('getStartedBtn').addEventListener('click', async () => {
    const vnpWorkId = document.getElementById('vnpWorkId').value;
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    // Check if the VNP Work ID is present
    if (!vnpWorkId) {
        showToast('This is not a valid VNP work ID.');
        return;
    }

    // Check if a file is selected
    if (!file) {
        showToast('Please select a file to upload.');
        return;
    }

    // Check if the ID exists in ids.json
    const response = await fetch('./ids.json');
    const data = await response.json(); // Get the entire JSON object
    const ids = data.ids; // Access the ids array

    if (!ids.includes(vnpWorkId)) {
        showToast('This is not a valid VNP work ID.');
        return;
    }

    // Prepare the form data for the file upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('vnpWorkId', vnpWorkId); // Add the VNP Work ID to the form data

    // Make the POST request to upload the file
    const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData
    });

    const uploadResult = await uploadResponse.json();

    // Handle the response
    if (uploadResult.status === 'error') {
        showToast(uploadResult.message);
    } else if (uploadResult.status === 'success') {
        showToast(uploadResult.message);
        // Save the file name and ID in local storage
        localStorage.setItem('fileName', uploadResult.fileName);
        localStorage.setItem('vnpWorkId', vnpWorkId);
        // Navigate to the main page
        window.location.href = '/main';
    }
});

// Function to show toast notifications
function showToast(message) {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    toastContainer.appendChild(toast);

    // Remove the toast after a delay
    setTimeout(() => {
        toastContainer.removeChild(toast);
    }, 3000); // Adjust the duration as needed
}