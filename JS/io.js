const fileInput = document.getElementById('fileInput');
const saveButton = document.getElementById('saveButton');
const saveAsExcelButton = document.getElementById('saveAsExcelButton');

/**
 * Handles the file input 'change' event.
 * Reads the selected file (JSON or Excel), parses it, and triggers rendering of the UI.
 */
fileInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    originalFileName = file.name;
    const reader = new FileReader();

    if (file.name.endsWith('.json')) {
        reader.onload = function(e) {
            try {
                const content = e.target.result;
                jsonData = JSON.parse(content);
                processJsonData(); // Refactored logic
            } catch (error) {
                handleFileLoadError('Error parsing JSON file: ' + error.message);
            }
        };
        reader.onerror = function() {
            handleFileLoadError('Error reading file.');
        };
        reader.readAsText(file);
    } else if (file.name.endsWith('.xlsx')) {
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // 1. Get "Work Items"
                const itemsSheet = workbook.Sheets['Work Items'];
                if (!itemsSheet) throw new Error('"Work Items" sheet not found.');
                const items = XLSX.utils.sheet_to_json(itemsSheet);

                // 2. Get "SETTINGS"
                const settingsSheet = workbook.Sheets['SETTINGS'];
                if (!settingsSheet) throw new Error('"SETTINGS" sheet not found.');
                const settingsData = XLSX.utils.sheet_to_json(settingsSheet, { header: 1 });

                let link_base = '';
                const buckets = [];
                
                const linkBaseRow = settingsData.find(row => row[0] === 'link_base');
                if (linkBaseRow) {
                    link_base = linkBaseRow[1] || '';
                }
                
                const bucketHeaderIndex = settingsData.findIndex(row => row[0] === 'name' && row[1] === 'description');

                if (bucketHeaderIndex > -1) {
                    for (let i = bucketHeaderIndex + 1; i < settingsData.length; i++) {
                        const row = settingsData[i];
                        if (row[0] || row[1]) { // Ensure it's not an empty row
                            buckets.push({ name: row[0], description: row[1] });
                        }
                    }
                }
                
                // 3. Get "Todo" (optional)
                const todoSheet = workbook.Sheets['Todo'];
                const todos = todoSheet ? XLSX.utils.sheet_to_json(todoSheet) : [];

                // 4. Get "Detail" (optional)
                const detailSheet = workbook.Sheets['detail'];
                const details = detailSheet ? XLSX.utils.sheet_to_json(detailSheet) : [];

                jsonData = {
                    link_base: link_base,
                    buckets: buckets,
                    items: items,
                    todos: todos, // Add todos to the main data object
                    details: details // Add details to the main data object
                };
                
                processJsonData(); // Use the same processing logic

            } catch (error) {
                handleFileLoadError('Error parsing Excel file: ' + error.message);
            }
        };
        reader.onerror = function() {
            handleFileLoadError('Error reading file.');
        };
        reader.readAsArrayBuffer(file);
    } else {
        alert('Unsupported file type. Please select a .json or .xlsx file.');
    }
});

/**
 * Common logic to process jsonData after it's loaded from either JSON or Excel.
 */
function processJsonData() {
    // Process main plan items
    if (jsonData.items) {
        allUniqueTags.clear();
        jsonData.items.forEach(item => {
            // Standardize predecessors
            let predecessors = [];
            if (item.predecessor) {
                if (Array.isArray(item.predecessor)) {
                    predecessors = item.predecessor;
                } else {
                    predecessors = [item.predecessor];
                }
                delete item.predecessor; // Remove old property
            } else if (item.predecessors) {
                if (typeof item.predecessors === 'string') {
                    predecessors = item.predecessors.split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p));
                } else if (Array.isArray(item.predecessors)) {
                    predecessors = item.predecessors;
                }
            }
            item.predecessors = predecessors;


            item.extractedTags = extractTagsFromString(item.name);
            item.extractedTags.forEach(tag => allUniqueTags.add(tag));
        });
        renderFilterUI();
        calculateAndRenderAnalytics();
        renderSwimlanes(jsonData);
        populateBucketSelector();
    } else {
        // Even if there are no plan items, clear the display
        renderSwimlanes({ items: [], buckets: [] });
    }

    // Process todo items
    if (typeof initializeTodo === 'function') {
        initializeTodo(jsonData.todos || []);
    }

    // Pass detail data to a new initializer in todo_detail.js if it exists
    if (typeof initializeDetails === 'function') {
        initializeDetails(jsonData.details || []);
    }

    // Redraw arrows after a short delay to ensure DOM is updated
    requestAnimationFrame(() => {
        if (typeof getFilteredDataForArrows === 'function') {
            drawDependencyArrows(getFilteredDataForArrows());
        }
    });
}

/**
 * Handles errors during file loading and parsing.
 * @param {string} message - The error message to display.
 */
function handleFileLoadError(message) {
    alert(message);
    // jsonDisplay.value = `Error: ${message}`;
    swimlaneContainer.innerHTML = '';
    arrowCanvas.innerHTML = '';
    jsonData = null;
    itemBucketSelect.innerHTML = '';
}

/**
 * Provides access to data from a specific sheet.
 * @param {string} sheetName - The name of the sheet to get data for (e.g., 'todo', 'detail').
 * @returns {Array|undefined} The array of data objects for that sheet.
 */
function getSheetData(sheetName) {
    if (!jsonData) return undefined;
    
    // Simple mapping from singular name to plural key in jsonData
    const key = sheetName.toLowerCase() === 'todo' ? 'todos' : `${sheetName.toLowerCase()}s`;

    return jsonData[key];
}

/**
 * Handles the click event for the save button.
 * Converts the content of the JSON display textarea to a Blob and initiates a download.
 */
saveButton.addEventListener('click', function() {
    if (!jsonData) {
        alert("No data to save.");
        return;
    }
    try {
        // Ensure the data is up-to-date from the textarea
        const jsonString = JSON.stringify(jsonData, null, 4);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = originalFileName.replace(/(\.json|\.xlsx)$/, '_edited.json');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        alert('Error saving JSON. Please ensure the content in the text area is valid JSON.\n' + error.message);
    }
});

saveAsExcelButton.addEventListener('click', function() {
    if (!jsonData) {
        alert("No data available to save as Excel.");
        return;
    }

    try {
        // 1. Create 'Work Items' sheet from jsonData.items
        // Create a deep copy to avoid modifying the original data
        const itemsForExport = JSON.parse(JSON.stringify(jsonData.items));
        
        // Clean up items before export: remove runtime-added properties
        itemsForExport.forEach(item => {
            delete item.extractedTags;
            delete item.total_effort;
            delete item.predecessor; // Ensure old property is not exported
            // Convert predecessors array to comma-separated string for cleaner Excel output
            if (Array.isArray(item.predecessors) && item.predecessors.length > 0) {
                item.predecessors = item.predecessors.join(',');
            } else {
                delete item.predecessors; // Don't export empty array/string
            }
        });

        const wsItems = XLSX.utils.json_to_sheet(itemsForExport);

        // 2. Create 'SETTINGS' sheet
        const settingsData = [
            ["PLANNER_SETTINGS"], // Title
            [], // Spacer row
            ["link_base", jsonData.link_base || ''],
            [], // Spacer row
            ["buckets"], // Section header
            ["name", "description"] // Column headers for buckets
        ];
        
        jsonData.buckets.forEach(bucket => {
            settingsData.push([bucket.name, bucket.description]);
        });
        
        const wsSettings = XLSX.utils.aoa_to_sheet(settingsData);

        // 3. Create 'Todo' sheet if data exists
        let wsTodo = null;
        if (typeof getTodoData === 'function') {
            const todoData = getTodoData();
            if (todoData && todoData.length > 0) {
                 // Clean up for export if needed (e.g. converting arrays to strings)
                const todosForExport = JSON.parse(JSON.stringify(todoData));
                todosForExport.forEach(item => {
                    if (Array.isArray(item.Tags)) {
                        item.Tags = item.Tags.join(',');
                    }
                    if (Array.isArray(item['Connected To'])) {
                        item['Connected To'] = item['Connected To'].join(',');
                    }
                });
                wsTodo = XLSX.utils.json_to_sheet(todosForExport);
            }
        }

        // 4. Create 'detail' sheet if data exists
        let wsDetail = null;
        if (typeof getDetailData === 'function') {
            const detailData = getDetailData();
            if (detailData && detailData.length > 0) {
                wsDetail = XLSX.utils.json_to_sheet(detailData);
            }
        }

        // 5. Create Workbook and add all sheets
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsSettings, "SETTINGS");
        XLSX.utils.book_append_sheet(wb, wsItems, "Work Items");
        if (wsTodo) {
            XLSX.utils.book_append_sheet(wb, wsTodo, "Todo");
        }
        if (wsDetail) {
            XLSX.utils.book_append_sheet(wb, wsDetail, "detail");
        }
        
        // 6. Download the workbook
        const newFileName = originalFileName.replace(/(\.json|\.xlsx)$/, '_edited.xlsx');
        XLSX.writeFile(wb, newFileName);

    } catch (error) {
        alert('Error saving Excel file: ' + error.message);
    }
}); 