// Import required modules
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs-extra');
const XLSX = require('xlsx');

// Create an instance of Express
const app = express();

// Enable CORS
app.use(cors());

// Enable JSON parsing for request bodies
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'public', 'files'));
    },
    filename: (req, file, cb) => {
        // Generate a timestamp
        const timestamp = Date.now();
        // Rename the uploaded file to 'upload-{timestamp}.xlsx'
        cb(null, `upload-${timestamp}.xlsx`);
    }
});
const upload = multer({ storage: storage });

// Upload the file
app.post('/api/upload', upload.single('file'), async (req, res) => {
    // Check if the file is an Excel file
    if (!req.file || !req.file.originalname.endsWith('.xlsx')) {
        return res.status(400).json({ status: 'error', message: 'Invalid file type. Please upload an Excel file.' });
    }

    console.log(`Uploaded file path: ${req.file.path}`); // Debugging line

    // Read the uploaded Excel file
    const workbook = XLSX.readFile(req.file.path);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const cellA1 = firstSheet['A1'] ? firstSheet['A1'].v : null;

    // Validate the content of cell A1
    if (cellA1 === 'Expedia ID') {
        // Get the VNP Work ID from the request body
        const vnpWorkId = req.body.vnpWorkId;

        // Determine the last column in the sheet
        const range = firstSheet['!ref']; // Get the range of the sheet
        const lastCell = range.split(':')[1]; // Get the last cell in the range
        const lastColLetters = lastCell.match(/[A-Z]+/)[0]; // Extract the column letters

        // Helper function to advance a column name
        function nextCol(col) {
            const ords = col.split('').map(c => c.charCodeAt(0) - 65);
            let carry = 1;
            for (let i = ords.length - 1; i >= 0; i--) {
                const v = ords[i] + carry;
                ords[i] = v % 26;
                carry = Math.floor(v / 26);
            }
            if (carry) ords.unshift(carry - 1);
            return ords.map(n => String.fromCharCode(n + 65)).join('');
        }

        // Calculate new column letters
        const idCol = nextCol(lastColLetters);      // e.g. "F"
        const statusCol = nextCol(idCol);           // e.g. "G"

        // Write both headers in row 1
        firstSheet[`${idCol}1`] = { v: 'VNP Work ID', t: 's' }; // Column header for VNP Work ID
        firstSheet[`${statusCol}1`] = { v: 'Status', t: 's' }; // Column header for Status

        // Expand the sheet's !ref to include the new columns
        const oldRange = XLSX.utils.decode_range(firstSheet['!ref']);
        oldRange.e.c += 2; // Make room for our two new columns
        firstSheet['!ref'] = XLSX.utils.encode_range(oldRange); // Update the range

        // Write the updated workbook back to the file
        XLSX.writeFile(workbook, req.file.path);
        console.log(`Workbook written to ${req.file.path}`);

        // Send back the file name in the response
        return res.status(200).json({ status: 'success', message: 'File uploaded successfully.', fileName: req.file.filename });
    } else {
        // Delete the file if validation fails
        await fs.remove(req.file.path);
        return res.status(400).json({ status: 'error', message: 'Invalid VNP Work file' });
    }
});

// Retrieve data from a specific row in an Excel file
app.get('/api/get-row-data', async (req, res) => {
    const { filePath, rowNumber } = req.query;

    if (!filePath || !rowNumber) {
        return res.status(400).json({ status: 'error', message: 'File path and row number are required.' });
    }

    try {
        // Read the Excel file
        const workbook = XLSX.readFile(filePath);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

        // Get headers from the first row
        const headers = {};
        for (let col = 0; col < 26; col++) { // Assuming columns A-Z
            const cell = firstSheet[XLSX.utils.encode_cell({ r: 0, c: col })]; // First row (0 index)
            if (cell) {
                headers[XLSX.utils.encode_col(col)] = cell.v; // Store header value
            }
        }

        // Count total rows
        const range = firstSheet['!ref']; // Get the range of the sheet
        const totalRows = XLSX.utils.decode_range(range).e.r + 1; // Total rows (1-based index)

        // Check if the requested row number is greater than total rows
        if (rowNumber > totalRows) {
            return res.status(400).json({ status: 'error', message: `Requested row number ${rowNumber} exceeds total rows ${totalRows}.` });
        }

        // Get the data from the specified row
        const rowData = {};
        for (let col = 0; col < 26; col++) { // Assuming columns A-Z
            const cell = firstSheet[XLSX.utils.encode_cell({ r: rowNumber - 1, c: col })]; // rowNumber - 1 for zero-based index
            if (cell) {
                const header = headers[XLSX.utils.encode_col(col)]; // Get the corresponding header
                rowData[header] = cell.v; // Store cell value with header as key
            }
        }

        return res.status(200).json({
            status: 'success',
            currentRow: rowData,
            totalCount: totalRows,
            currentRowNumber: parseInt(rowNumber) // Include the current row number for display purposes as integer
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error reading the Excel file.', error: error.message });
    }
});

// Update a specific row in the Excel file
app.post('/api/update-sheet', upload.none(), async (req, res) => {
    const { filePath, rowNumber, status, vnpWorkId } = req.body;

    console.log(filePath, rowNumber, status, vnpWorkId);

    if (!filePath || !rowNumber || !status || !vnpWorkId) {
        return res.status(400).json({ status: 'error', message: 'filePath, rowNumber, status, and vnpWorkId are required.' });
    }

    try {
        // Read the Excel file
        const workbook = XLSX.readFile(filePath);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

        // Get the range of the sheet
        const range = firstSheet['!ref'];
        const totalRows = XLSX.utils.decode_range(range).e.r + 1; // Total rows (1-based index)

        // Check if the requested row number is valid
        if (rowNumber < 1 || rowNumber > totalRows) {
            return res.status(400).json({ status: 'error', message: `Requested row number ${rowNumber} is out of bounds.` });
        }

        // Determine the last column index
        const lastColIndex = XLSX.utils.decode_col('T'); // Assuming Z is the last column (adjust if necessary)
        const vnpWorkIdColIndex = lastColIndex - 1; // VNP Work ID is the column before Status
        const statusColIndex = lastColIndex; // Status is the last column

        // Update the relevant cells in the specified row
        const vnpWorkIdCell = XLSX.utils.encode_cell({ r: rowNumber - 1, c: vnpWorkIdColIndex });
        const statusCell = XLSX.utils.encode_cell({ r: rowNumber - 1, c: statusColIndex });

        console.log(`Writing VNP Work ID to ${vnpWorkIdCell}: ${vnpWorkId}`);
        console.log(`Writing Status to ${statusCell}: ${status}`);

        firstSheet[vnpWorkIdCell] = { v: vnpWorkId, t: 's' };
        firstSheet[statusCell] = { v: status, t: 's' };

        // Write the updated workbook back to the file
        XLSX.writeFile(workbook, filePath);
        console.log(`Workbook written to ${filePath}`);

        return res.status(200).json({ status: 'success', message: 'Sheet updated successfully.' });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error updating the Excel file.', error: error.message });
    }
});

// Define a port
const PORT = process.env.PORT || 3000;

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
