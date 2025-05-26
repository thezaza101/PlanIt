const fileInput = document.getElementById('fileInput');
const jsonDisplay = document.getElementById('jsonDisplay');
const saveButton = document.getElementById('saveButton');
const swimlaneContainer = document.getElementById('swimlaneContainer');
const arrowCanvas = document.getElementById('arrowCanvas');
const itemModal = document.getElementById('itemModal');
const itemForm = document.getElementById('itemForm');
const modalTitle = document.getElementById('modalTitle');
const itemIdInput = document.getElementById('itemId');
const itemNameInput = document.getElementById('itemName');
const itemDescriptionInput = document.getElementById('itemDescription');
const itemBucketSelect = document.getElementById('itemBucket');
const itemPredecessorsInput = document.getElementById('itemPredecessors');
const itemDesignEffortInput = document.getElementById('itemDesignEffort');
const itemBuildEffortInput = document.getElementById('itemBuildEffort');
const itemTestEffortInput = document.getElementById('itemTestEffort');
const itemStatusSelect = document.getElementById('itemStatus');

// JSON Display Toggle Elements
const jsonDisplayContainer = document.getElementById('jsonDisplayContainer'); // Though not directly used in toggle, good to have if needed
const jsonDisplayToggle = document.getElementById('jsonDisplayToggle');
const jsonToggleIndicator = document.getElementById('jsonToggleIndicator');

// Bucket Modal Elements
const addBucketButton = document.getElementById('addBucketButton');
const bucketModal = document.getElementById('bucketModal');
const bucketForm = document.getElementById('bucketForm');
const bucketModalTitle = document.getElementById('bucketModalTitle');
const bucketNameInput = document.getElementById('bucketNameInput');
const bucketDescriptionInput = document.getElementById('bucketDescriptionInput');

let originalFileName = 'edited_data.json';
let jsonData = null;

// Initialize JSON display state from localStorage
if (jsonDisplayToggle && jsonDisplay && jsonToggleIndicator) {
    // Default to collapsed if not explicitly set to 'false'
    const isJsonCollapsed = localStorage.getItem('jsonDisplayCollapsed') !== 'false';
    if (isJsonCollapsed) {
        jsonDisplay.classList.add('collapsed');
        jsonToggleIndicator.textContent = '(Show)';
    } else {
        jsonDisplay.classList.remove('collapsed'); // Ensure it is expanded
        jsonToggleIndicator.textContent = '(Hide)';
    }
}

fileInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        originalFileName = file.name;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const content = e.target.result;
                jsonData = JSON.parse(content);
                jsonDisplay.value = JSON.stringify(jsonData, null, 4);
                renderSwimlanes(jsonData);
                populateBucketSelector();
                requestAnimationFrame(() => {
                     requestAnimationFrame(() => {
                        drawDependencyArrows(jsonData);
                    });
                });
            } catch (error) {
                alert('Error parsing JSON file: ' + error.message);
                jsonDisplay.value = "Error: Could not load or parse the JSON file. Please ensure it's a valid JSON format.";
                swimlaneContainer.innerHTML = '';
                arrowCanvas.innerHTML = '';
                jsonData = null;
                itemBucketSelect.innerHTML = '';
            }
        };
        reader.onerror = function() {
            alert('Error reading file.');
            jsonDisplay.value = "Error: Could not read the file.";
        };
        reader.readAsText(file);
    }
});

saveButton.addEventListener('click', function() {
    let contentToSave = jsonDisplay.value;
    try {
        // Validate that the content is valid JSON before saving
        JSON.parse(contentToSave); 
    } catch (error) {
        alert('The content in the editor is not valid JSON. Please correct it before saving.\nError: ' + error.message);
        return;
    }

    const blob = new Blob([contentToSave], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = originalFileName; // Suggest the original file name or a default
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

swimlaneContainer.addEventListener('scroll', function() {
    if (jsonData) {
        requestAnimationFrame(() => {
            drawDependencyArrows(jsonData);
        });
    }
});

function renderSwimlanes(data) {
    swimlaneContainer.innerHTML = '';

    if (!data || !data.buckets || !data.items) {
        swimlaneContainer.innerHTML = '<p style="text-align:center; color: #777;">No data to display or data is not in the expected format (missing buckets or items).</p>';
        return;
    }

    data.buckets.forEach(bucket => {
        const swimlaneDiv = document.createElement('div');
        swimlaneDiv.className = 'swimlane';

        const swimlaneHeader = document.createElement('div');
        swimlaneHeader.className = 'swimlane-header';

        const title = document.createElement('h3');
        title.textContent = bucket.name || 'Unnamed Bucket';
        swimlaneHeader.appendChild(title);

        const removeBucketBtn = document.createElement('button');
        removeBucketBtn.className = 'remove-bucket-btn';
        removeBucketBtn.innerHTML = '&times;'; // A simple 'x' for remove
        removeBucketBtn.title = 'Remove Bucket';
        removeBucketBtn.onclick = () => deleteBucket(bucket.name);
        swimlaneHeader.appendChild(removeBucketBtn);
        
        swimlaneDiv.appendChild(swimlaneHeader);

        if (bucket.description) {
            const bucketDesc = document.createElement('p');
            bucketDesc.className = 'bucket-description';
            bucketDesc.textContent = bucket.description;
            swimlaneDiv.appendChild(bucketDesc);
        }

        const itemsInBucket = data.items.filter(item => item.bucket === bucket.name);

        if (itemsInBucket.length === 0) {
            const noItemsMsg = document.createElement('p');
            noItemsMsg.textContent = 'No items in this bucket.';
            noItemsMsg.style.textAlign = 'center';
            noItemsMsg.style.fontSize = '0.8em';
            noItemsMsg.style.color = '#888';
            swimlaneDiv.appendChild(noItemsMsg);
        }
        itemsInBucket.forEach(item => {
            const itemCardDiv = document.createElement('div');
            itemCardDiv.className = 'itemCard';
            const statusClass = `item-status-${(item.status || 'new').replace(/\s+/g, '_').toLowerCase()}`;
            if (item.status && item.status !== 'new') {
                 itemCardDiv.classList.add(statusClass);
            }
            itemCardDiv.setAttribute('data-id', item.id);

            const itemIdSpan = document.createElement('span');
            itemIdSpan.className = 'itemIdDisplay';
            itemIdSpan.textContent = `ID: ${item.id}`;
            itemCardDiv.appendChild(itemIdSpan);

            // Create item name (as link or plain text)
            if (data.link_base && typeof data.link_base === 'string') {
                const itemNameLink = document.createElement('a');
                itemNameLink.href = data.link_base.replace('{id}', item.id.toString());
                itemNameLink.textContent = item.name || 'Unnamed Item';
                itemNameLink.target = '_blank'; // Open in new tab
                itemNameLink.className = 'item-name-link'; // For styling if needed
                
                // Wrap link in an H4 to maintain similar styling/structure, or style the link directly
                const itemNameHeader = document.createElement('h4');
                itemNameHeader.appendChild(itemNameLink);
                itemCardDiv.appendChild(itemNameHeader);
            } else {
                const itemName = document.createElement('h4');
                itemName.textContent = item.name || 'Unnamed Item';
                itemCardDiv.appendChild(itemName);
            }

            const itemDescription = document.createElement('p');
            itemDescription.textContent = item.description || 'No description.';
            itemCardDiv.appendChild(itemDescription);
            
            // Display Efforts on Card
            const effortsDiv = document.createElement('div');
            effortsDiv.className = 'item-efforts';
            effortsDiv.innerHTML = `
                <span>D: <strong>${item.design_effort || 0}</strong></span>
                <span>B: <strong>${item.build_effort || 0}</strong></span>
                <span>T: <strong>${item.test_effort || 0}</strong></span>
            `;
            itemCardDiv.appendChild(effortsDiv);

            const itemControlsDiv = document.createElement('div');
            itemControlsDiv.className = 'item-controls';

            const modifyButton = document.createElement('button');
            modifyButton.className = 'item-btn item-btn-modify';
            modifyButton.textContent = 'Modify';
            modifyButton.onclick = () => openModifyModal(item.id);
            itemControlsDiv.appendChild(modifyButton);

            const deleteButton = document.createElement('button');
            deleteButton.className = 'item-btn item-btn-delete';
            deleteButton.textContent = 'Delete';
            deleteButton.onclick = () => deleteItem(item.id);
            itemControlsDiv.appendChild(deleteButton);

            itemCardDiv.appendChild(itemControlsDiv);
            
            swimlaneDiv.appendChild(itemCardDiv);
        });

        const addItemButton = document.createElement('button');
        addItemButton.className = 'add-item-btn';
        addItemButton.textContent = '+ Add Item';
        addItemButton.onclick = () => openAddModal(bucket.name);
        swimlaneDiv.appendChild(addItemButton);

        // Calculate and Display Bucket Effort Summaries
        let totalDesignEffort = 0;
        let totalBuildEffort = 0;
        let totalTestEffort = 0;
        itemsInBucket.forEach(item => {
            totalDesignEffort += parseFloat(item.design_effort || 0);
            totalBuildEffort += parseFloat(item.build_effort || 0);
            totalTestEffort += parseFloat(item.test_effort || 0);
        });

        const effortSummaryDiv = document.createElement('div');
        effortSummaryDiv.className = 'bucket-effort-summary';
        effortSummaryDiv.innerHTML = `
            <hr>
            <p><strong>Total Efforts:</strong></p>
            <span>Design: <strong>${totalDesignEffort.toFixed(1)}</strong></span>
            <span>Build: <strong>${totalBuildEffort.toFixed(1)}</strong></span>
            <span>Test: <strong>${totalTestEffort.toFixed(1)}</strong></span>
        `;
        swimlaneDiv.appendChild(effortSummaryDiv);

        swimlaneContainer.appendChild(swimlaneDiv);
    });
    
    if (data.buckets.length === 0){
         swimlaneContainer.innerHTML = '<p style="text-align:center; color: #777;">No buckets found in the data.</p>';
    }
}

function drawDependencyArrows(data) {
    arrowCanvas.innerHTML = '';

    if (!data || !data.items) {
        return;
    }

    const swimlaneContainerRect = swimlaneContainer.getBoundingClientRect();
    const arrowCanvasRect = arrowCanvas.getBoundingClientRect();

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('refX', '0');
    marker.setAttribute('refY', '3.5');
    marker.setAttribute('orient', 'auto');
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
    polygon.setAttribute('fill', '#555');
    marker.appendChild(polygon);
    defs.appendChild(marker);
    arrowCanvas.appendChild(defs);

    data.items.forEach(item => {
        if (item.predecessor) {
            const predecessors = Array.isArray(item.predecessor) ? item.predecessor : [item.predecessor];
            const targetElement = swimlaneContainer.querySelector(`.itemCard[data-id='${item.id}']`);

            if (!targetElement) return;

            const targetRect = targetElement.getBoundingClientRect();
            const targetX = targetRect.left - arrowCanvasRect.left + swimlaneContainer.scrollLeft;
            const targetY = targetRect.top - arrowCanvasRect.top + targetRect.height / 2 + swimlaneContainer.scrollTop;

            predecessors.forEach(predId => {
                const predElement = swimlaneContainer.querySelector(`.itemCard[data-id='${predId}']`);
                if (!predElement) return;

                const predRect = predElement.getBoundingClientRect();
                const predX = predRect.right - arrowCanvasRect.left + swimlaneContainer.scrollLeft;
                const predY = predRect.top - arrowCanvasRect.top + predRect.height / 2 + swimlaneContainer.scrollTop;

                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', predX.toString());
                line.setAttribute('y1', predY.toString());
                line.setAttribute('x2', targetX.toString());
                line.setAttribute('y2', targetY.toString());
                line.setAttribute('stroke', '#555');
                line.setAttribute('stroke-width', '1.5');
                line.setAttribute('marker-end', 'url(#arrowhead)');
                arrowCanvas.appendChild(line);
            });
        }
    });
}

function refreshDisplayAndData() {
    if (!jsonData) return;

    // 1. Update JSON in textarea
    jsonDisplay.value = JSON.stringify(jsonData, null, 4);

    // 2. Re-render swimlanes
    renderSwimlanes(jsonData);

    // 3. Re-draw arrows (with delay for DOM update)
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            drawDependencyArrows(jsonData);
        });
    });
    
    // 4. (Re)-populate bucket selector in modal (in case buckets changed, though not implemented yet)
    populateBucketSelector();
}

function populateBucketSelector() {
    itemBucketSelect.innerHTML = ''; // Clear existing options
    if (jsonData && jsonData.buckets) {
        jsonData.buckets.forEach(bucket => {
            const option = document.createElement('option');
            option.value = bucket.name;
            option.textContent = bucket.name;
            itemBucketSelect.appendChild(option);
        });
    }
}

function openModal(title = 'Add/Edit Item') {
    modalTitle.textContent = title;
    itemModal.style.display = 'block';
}

function closeModal() {
    itemModal.style.display = 'none';
    itemForm.reset(); // Clear form fields
    itemIdInput.value = ''; // Ensure hidden ID field is cleared
}

// Close modal if user clicks outside of it
window.onclick = function(event) {
    if (event.target == itemModal) {
        closeModal();
    }
    if (event.target == bucketModal) { // Added for bucket modal
        closeBucketModal();
    }
}

// --- Placeholder functions for CRUD --- 
function openAddModal(bucketName) {
    itemForm.reset();
    itemIdInput.value = ''; // Ensure it's a new item
    itemStatusSelect.value = 'new'; // Default status for new items
    openModal('Add New Item');
    if (bucketName) {
        itemBucketSelect.value = bucketName; // Pre-select the bucket if called from a swimlane
    }
}

function openModifyModal(id) {
    const item = jsonData.items.find(i => i.id === id);
    if (!item) {
        alert('Item not found!');
        return;
    }
    openModal(`Modify Item (ID: ${id})`);
    itemIdInput.value = item.id;
    itemNameInput.value = item.name || '';
    itemDescriptionInput.value = item.description || '';
    itemBucketSelect.value = item.bucket || '';
    itemStatusSelect.value = item.status || 'new';
    itemDesignEffortInput.value = item.design_effort || '';
    itemBuildEffortInput.value = item.build_effort || '';
    itemTestEffortInput.value = item.test_effort || '';
    if (Array.isArray(item.predecessor)) {
        itemPredecessorsInput.value = item.predecessor.join(', ');
    } else if (item.predecessor) {
        itemPredecessorsInput.value = item.predecessor.toString();
    } else {
        itemPredecessorsInput.value = '';
    }
}

function deleteItem(id) {
    if (!confirm(`Are you sure you want to delete item ID: ${id}? This will also remove it as a predecessor from other items.`)) {
        return;
    }

    if (jsonData && jsonData.items) {
        const itemIndex = jsonData.items.findIndex(item => item.id === id);
        if (itemIndex > -1) {
            jsonData.items.splice(itemIndex, 1);

            // Also remove this ID from any other item's predecessor list
            jsonData.items.forEach(item => {
                if (Array.isArray(item.predecessor)) {
                    item.predecessor = item.predecessor.filter(predId => predId !== id);
                    if (item.predecessor.length === 0) {
                        delete item.predecessor; // Remove empty array
                    } else if (item.predecessor.length === 1) {
                        item.predecessor = item.predecessor[0]; // Convert to single value if only one left
                    }
                } else if (item.predecessor === id) {
                    delete item.predecessor;
                }
            });

            refreshDisplayAndData();
        } else {
            alert('Item not found for deletion.');
        }
    } else {
        alert('No data loaded to delete from.');
    }
}

function generateNewId() {
    if (!jsonData || !jsonData.items || jsonData.items.length === 0) {
        return Date.now(); // Fallback to timestamp if no items or for the very first item
    }
    const maxId = jsonData.items.reduce((max, item) => Math.max(max, typeof item.id === 'number' ? item.id : 0), 0);
    return maxId + 1;
}

itemForm.addEventListener('submit', function(event) {
    event.preventDefault();
    if (!jsonData) {
        alert('No data loaded. Please load a file first.');
        return;
    }

    const id = itemIdInput.value ? parseInt(itemIdInput.value) : generateNewId();
    const name = itemNameInput.value.trim();
    const description = itemDescriptionInput.value.trim();
    const bucket = itemBucketSelect.value;
    const status = itemStatusSelect.value;
    const designEffort = parseFloat(itemDesignEffortInput.value) || 0;
    const buildEffort = parseFloat(itemBuildEffortInput.value) || 0;
    const testEffort = parseFloat(itemTestEffortInput.value) || 0;
    let predecessors = itemPredecessorsInput.value.split(',')
                        .map(p => parseInt(p.trim()))
                        .filter(p => !isNaN(p) && p !== id); // Filter out NaNs and self-references

    if (!name) {
        alert('Item name cannot be empty.');
        return;
    }
    if (!bucket) {
        alert('Item must be assigned to a bucket.');
        return;
    }

    // Ensure predecessor IDs actually exist and are not the current item itself
    if (predecessors.length > 0) {
        predecessors = predecessors.filter(predId => {
            if (predId === id) return false; // Cannot be its own predecessor
            const exists = jsonData.items.some(i => i.id === predId);
            if (!exists) {
                alert(`Warning: Predecessor ID ${predId} does not exist and will be ignored.`);
            }
            return exists;
        });
    }

    const newItemData = {
        id,
        name,
        description,
        bucket,
        status,
        design_effort: designEffort,
        build_effort: buildEffort,
        test_effort: testEffort
    };

    if (predecessors.length > 0) {
        newItemData.predecessor = predecessors.length === 1 ? predecessors[0] : predecessors;
    } else {
        delete newItemData.predecessor; // Ensure no empty predecessor array/value
    }

    const existingItemIndex = itemIdInput.value ? jsonData.items.findIndex(item => item.id === id) : -1;

    if (existingItemIndex > -1) {
        // Update existing item
        jsonData.items[existingItemIndex] = newItemData;
    } else {
        // Add new item
        jsonData.items.push(newItemData);
    }

    closeModal();
    refreshDisplayAndData();
});

// --- Bucket Management Functions ---
function openBucketModal() {
    bucketForm.reset();
    bucketModalTitle.textContent = 'Add New Bucket';
    bucketModal.style.display = 'block';
}

function closeBucketModal() {
    bucketModal.style.display = 'none';
    bucketForm.reset();
}

function deleteBucket(bucketName) {
    if (!jsonData || !jsonData.buckets) return;

    if (!confirm(`Are you sure you want to delete the bucket "${bucketName}"? This will also delete ALL items within this bucket.`)) {
        return;
    }

    const bucketIndex = jsonData.buckets.findIndex(b => b.name === bucketName);
    if (bucketIndex > -1) {
        jsonData.buckets.splice(bucketIndex, 1);
        // Remove items associated with this bucket
        jsonData.items = jsonData.items.filter(item => item.bucket !== bucketName);
        // Since items are removed, we also need to update predecessors in other items
        jsonData.items.forEach(item => {
            if (Array.isArray(item.predecessor)) {
                item.predecessor = item.predecessor.filter(predId => jsonData.items.some(i => i.id === predId));
                if (item.predecessor.length === 0) delete item.predecessor;
                else if (item.predecessor.length === 1) item.predecessor = item.predecessor[0];
            }
             else if (item.predecessor && !jsonData.items.some(i => i.id === item.predecessor)) {
                delete item.predecessor;
            }
        });

        refreshDisplayAndData();
    } else {
        alert('Bucket not found for deletion.');
    }
}

if (addBucketButton) { // Check if the button exists (it should)
    addBucketButton.addEventListener('click', openBucketModal);
}

bucketForm.addEventListener('submit', function(event) {
    event.preventDefault();
    if (!jsonData) {
        alert('No data loaded. Please load a file first.');
        return;
    }

    const name = bucketNameInput.value.trim();
    const description = bucketDescriptionInput.value.trim();

    if (!name) {
        alert('Bucket name cannot be empty.');
        return;
    }

    if (jsonData.buckets.some(b => b.name === name)) {
        alert('A bucket with this name already exists.');
        return;
    }

    jsonData.buckets.push({ name, description });
    closeBucketModal();
    refreshDisplayAndData();
});

// JSON Display Toggle Functionality
if (jsonDisplayToggle && jsonDisplay && jsonToggleIndicator) {
    jsonDisplayToggle.addEventListener('click', () => {
        const isCollapsed = jsonDisplay.classList.toggle('collapsed');
        if (isCollapsed) {
            jsonToggleIndicator.textContent = '(Show)';
            localStorage.setItem('jsonDisplayCollapsed', 'true');
        } else {
            jsonToggleIndicator.textContent = '(Hide)';
            localStorage.setItem('jsonDisplayCollapsed', 'false');
        }
    });
} 