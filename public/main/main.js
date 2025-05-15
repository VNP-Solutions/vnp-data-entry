// main.js

// Add functionality for copy icons
document.querySelectorAll('.copy-icon').forEach(icon => {
    icon.addEventListener('click', function() {
        const textToCopy = this.parentElement.textContent.trim();
        navigator.clipboard.writeText(textToCopy);
        
        // Visual feedback
        this.classList.add('fa-check');
        this.classList.remove('fa-copy');
        
        setTimeout(() => {
            this.classList.add('fa-copy');
            this.classList.remove('fa-check');
        }, 1500);
    });
});

// Function to load data on page load
window.onload = async function() {
    // Load vnpWorkId from local storage and display it
    const vnpWorkId = localStorage.getItem('vnpWorkId');
    document.getElementById('user-name').textContent = vnpWorkId;

    // Set the first letter of vnpWorkId in the user avatar
    const userAvatar = document.querySelector('.user-avatar');
    if (vnpWorkId) {
        userAvatar.textContent = vnpWorkId.charAt(0).toUpperCase(); // Set the first letter in uppercase
    }

    // Set rowNumber in local storage
    localStorage.setItem('rowNumber', 2);

    // Get fileName and rowNumber from local storage
    const fileName = localStorage.getItem('fileName');
    let rowNumber = parseInt(localStorage.getItem('rowNumber'), 10);

    // Make API request to get row data
    await fetchRowData(fileName, rowNumber);

    // Add event listeners for Prev and Next buttons after the DOM is fully loaded
    const prevButton = document.querySelector('.nav-btn.prev');
    const nextButton = document.querySelector('.nav-btn.next');

    if (prevButton) {
        prevButton.addEventListener('click', async () => {
            if (rowNumber > 2) {
                rowNumber--;
                localStorage.setItem('rowNumber', rowNumber);
                await fetchRowData(fileName, rowNumber);
            }
        });
    }

    if (nextButton) {
        nextButton.addEventListener('click', async () => {
            const totalRows = parseInt(localStorage.getItem('totalRows'), 10); // Get total rows from local storage
            if (rowNumber < totalRows) { // Check if rowNumber is less than totalRows
                rowNumber++;
                localStorage.setItem('rowNumber', rowNumber);
                await fetchRowData(fileName, rowNumber);
            }
        });
    }

    // Add event listener for the download button
    const downloadButton = document.querySelector('.nav-btn.download');
    downloadButton.addEventListener('click', () => {
        const fileName = localStorage.getItem('fileName'); // Get the file name from local storage
        const filePath = `../files/${fileName}`; // Construct the file path

        // Create a temporary link element
        const link = document.createElement('a');
        link.href = filePath; // Set the href to the file path
        link.download = fileName; // Set the download attribute with the file name

        // Append the link to the body (not visible)
        document.body.appendChild(link);
        link.click(); // Programmatically click the link to trigger the download
        document.body.removeChild(link); // Remove the link after triggering the download
    });

    // Add event listener for the Done button
    const doneButton = document.querySelector('#doneBtn');
    doneButton.addEventListener('click', () => {
        window.location.href = '/start'; // Navigate to the /start page
    });
};

// Function to show a toast message
function showToast(message) {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    // Append the toast to the container
    toastContainer.appendChild(toast);

    // Remove the toast after a few seconds
    setTimeout(() => {
        toastContainer.removeChild(toast);
    }, 3000); // Adjust duration as needed
}

// Function to fetch row data from the API
async function fetchRowData(fileName, rowNumber) {
    const filePath = `./public/files/${fileName}`;
    
    try {
        const response = await fetch(`/api/get-row-data?filePath=${filePath}&rowNumber=${rowNumber}`);
        const data = await response.json();

        if (data.status === 'success') {
            // Display the relevant data
            displayRowData(data.currentRow);
            // Update total count and current row number
            document.querySelector('.entry-counter').textContent = `Entry ${data.currentRowNumber - 1}/${data.totalCount - 1}`;
            localStorage.setItem('totalRows', data.totalCount); // Store total rows in local storage
            
            // Display current status above the dropdown
            const currentStatusContainer = document.querySelector('.status-value');
            currentStatusContainer.textContent = data.currentRow.Status;

            // Add event listener for status dropdown
          
        } else {
            showToast(data.message); // Show error message as toast
            console.error(data.message);
        }
    } catch (error) {
        showToast('Error fetching row data.'); // Show generic error message
        console.error('Error fetching row data:', error);
    }
}

// Function to display row data in the UI
function displayRowData(rowData) {
    for (const [key, value] of Object.entries(rowData)) {
        // Update the selector to match the label with a colon
        const infoRow = Array.from(document.querySelectorAll('.info-row')).find(row => 
            row.querySelector('.info-label').textContent.trim() === `${key}:`
        );
        if (infoRow) {
            const infoValueDiv = infoRow.querySelector('.info-value');
            // Update only the text part, preserving the icon
            const icon = infoValueDiv.querySelector('.copy-icon'); // Get the icon
            infoValueDiv.childNodes[0].textContent = value; // Update the text node
            infoValueDiv.appendChild(icon); // Re-append the icon to keep it
        }
    }

    // Update card view data
    const cardHolderName = rowData['Name']; // Assuming 'Name' corresponds to the card holder
    const cardAmount = rowData['Amount to charge']; // Assuming this is the amount to charge
    const cardExpireDate = rowData['Card Expire']; // Assuming this is the expiration date
    const cardFirst4 = rowData['Card first 4']; // Assuming this is the first 4 digits
    const cardLast12 = rowData['Card last 12']; // Assuming this is the last 12 digits

    // Ensure cardLast12 is a string
    const formattedCardNumber = formatCardNumber(cardFirst4, String(cardLast12)); // Convert to string

    // Update the card view elements
    document.querySelector('.card-holder-name').textContent = cardHolderName;
    document.querySelector('.card-amount').textContent = `$${cardAmount.toFixed(2)}`; // Format as currency
    document.querySelector('.card-expires-date').textContent = cardExpireDate;
    document.querySelector('.card-number').textContent = formattedCardNumber; // Update the card number
}

// Function to format the card number
function formatCardNumber(first4, last12) {
    return `${first4} ${last12.substring(0, 4)} ${last12.substring(4, 8)} ${last12.substring(8)}`;
};


//updating status on sheet
console.log('status trigger');
const statusDropdown = document.querySelector('.status-dropdown');
statusDropdown.addEventListener('change', async () => {
    const statusSelectValue = statusDropdown.value;
    console.log(statusSelectValue);
    const vnpWorkId = localStorage.getItem('vnpWorkId'); // Get VNP Work ID from local storage
    const fileName = localStorage.getItem('fileName');
    const filePath = `./public/files/${fileName}`;
    const rowNumber = localStorage.getItem('rowNumber');

    // Call the updateStatus function
    await updateStatus(fileName, filePath, rowNumber, statusSelectValue, vnpWorkId);
});

// Function to update the status
async function updateStatus(fileName, filePath, rowNumber, statusSelectValue, vnpWorkId) {
    // Prepare the request body
    const body = {
        filePath: filePath,
        rowNumber: rowNumber,
        status: statusSelectValue,
        vnpWorkId: vnpWorkId
    };

    // Make the API request to update the sheet
    try {
        const updateResponse = await fetch('/api/update-sheet', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const updateData = await updateResponse.json();
        if (updateData.status === 'success') {
            showToast('Status updated successfully!'); // Show success toast
            statusDropdown.value = '';
            await fetchRowData(fileName, rowNumber);
        } else {
            showToast('Failed to update status: ' + updateData.message); // Show error toast
        }
    } catch (error) {
        showToast('Error updating status.'); // Show generic error toast
        console.error('Error updating status:', error);
    }
}