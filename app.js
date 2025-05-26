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

// Filter Elements (to be added in HTML later)
let filterContainer = null; // Will be assigned in DOMContentLoaded
let allUniqueTags = new Set();
// let activeTagFilters = new Set(); // Old filter state - REMOVE or replace

let tagVisibilityState = {}; // For Filter A: { tag1: 'show', tag2: 'hide', ... }
let focusTagState = { enabled: false, selectedTag: null }; // For Filter B

// JSON Display Toggle Elements
const jsonDisplayContainer = document.getElementById('jsonDisplayContainer'); // Though not directly used in toggle, good to have if needed
const jsonDisplayToggle = document.getElementById('jsonDisplayToggle');
const jsonToggleIndicator = document.getElementById('jsonToggleIndicator');

// Analytics Section Elements
const analyticsToggle = document.getElementById('analyticsToggle');
const analyticsToggleIndicator = document.getElementById('analyticsToggleIndicator');
const analyticsContent = document.getElementById('analyticsContent');

// Bucket Modal Elements
const addBucketButton = document.getElementById('addBucketButton');
const bucketModal = document.getElementById('bucketModal');
const bucketForm = document.getElementById('bucketForm');
const bucketModalTitle = document.getElementById('bucketModalTitle');
const bucketNameInput = document.getElementById('bucketNameInput');
const bucketDescriptionInput = document.getElementById('bucketDescriptionInput');

let originalFileName = 'edited_data.json';
let jsonData = null;

function extractTagsFromString(text) {
    if (!text || typeof text !== 'string') return [];
    const matches = text.match(/\[(.*?)\]/g); // Find all [TAG] occurrences
    if (matches) {
        return matches.map(tag => tag.substring(1, tag.length - 1)); // Remove brackets
    }
    return [];
}

// Initialize JSON display state from localStorage
if (jsonDisplayToggle && jsonDisplay && jsonToggleIndicator) {
    const isJsonCollapsed = localStorage.getItem('jsonDisplayCollapsed') !== 'false';
    if (isJsonCollapsed) {
        jsonDisplay.classList.add('collapsed');
        jsonToggleIndicator.textContent = '(Show)';
    } else {
        jsonDisplay.classList.remove('collapsed');
        jsonToggleIndicator.textContent = '(Hide)';
    }
    // Arrows will be drawn by initial renderSwimlanes if data loads,
    // or if a toggle happens before data load, nothing happens, which is fine.
}

// Initialize Analytics display state from localStorage
if (analyticsToggle && analyticsContent && analyticsToggleIndicator) {
    const isAnalyticsCollapsed = localStorage.getItem('analyticsCollapsed') !== 'false';
    if (isAnalyticsCollapsed) {
        analyticsContent.classList.add('collapsed');
        analyticsToggleIndicator.textContent = '(Show)';
    } else {
        analyticsContent.classList.remove('collapsed');
        analyticsToggleIndicator.textContent = '(Hide)';
    }
    // Arrows will be drawn by initial renderSwimlanes if data loads.
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

                // Process tags from items
                allUniqueTags.clear();
                if (jsonData.items) {
                    jsonData.items.forEach(item => {
                        item.extractedTags = extractTagsFromString(item.name);
                        item.extractedTags.forEach(tag => allUniqueTags.add(tag));
                    });
                }
                renderFilterUI(); // Render filter options
                calculateAndRenderAnalytics(); // Calculate and Render Analytics

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
            if (typeof getFilteredDataForArrows === 'function') {
                drawDependencyArrows(getFilteredDataForArrows());
            }
        });
    }
});

function renderSwimlanes(data) {
    swimlaneContainer.innerHTML = '';
    arrowCanvas.innerHTML = ''; // Clear arrows before re-rendering swimlanes

    if (!data || !data.buckets || !data.items) {
        swimlaneContainer.innerHTML = '<p style="text-align:center; color: #777;">No data to display or data is not in the expected format (missing buckets or items).</p>';
        return;
    }

    // Apply new filter logic
    let itemsToConsider = data.items;

    // --- Apply Filter B (Focus) first ---
    if (focusTagState.enabled && focusTagState.selectedTag) {
        itemsToConsider = itemsToConsider.filter(item => 
            item.extractedTags && item.extractedTags.includes(focusTagState.selectedTag)
        );
    }

    // --- Apply Filter A (Visibility) to the (potentially focused) set ---
    const itemsToDisplay = itemsToConsider.filter(item => {
        if (!item.extractedTags || item.extractedTags.length === 0) {
            return true; // Show items with no tags by default
        }
        // Show if ANY tag is set to 'show'. Hide if ALL tags are 'hide' or not in state (defaulting to hide implicitly then)
        let canShow = false;
        for (const tag of item.extractedTags) {
            if (tagVisibilityState[tag] === 'show') {
                canShow = true;
                break;
            }
        }
        return canShow;
    });

    data.buckets.forEach(bucket => {
        const swimlaneDiv = document.createElement('div');
        swimlaneDiv.className = 'swimlane';
        swimlaneDiv.setAttribute('data-bucket-name', bucket.name); // For drop target identification

        // Drag and Drop Event Listeners for Swimlane (Drop Target)
        swimlaneDiv.addEventListener('dragover', handleDragOver);
        swimlaneDiv.addEventListener('dragleave', handleDragLeave);
        swimlaneDiv.addEventListener('drop', (event) => handleDrop(event, bucket.name));

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

        const itemsInBucket = itemsToDisplay.filter(item => item.bucket === bucket.name);

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
            itemCardDiv.className = 'itemCard'; // Base class
            itemCardDiv.setAttribute('draggable', 'true'); // Make item draggable
            itemCardDiv.addEventListener('dragstart', (event) => handleDragStart(event, item.id));
            itemCardDiv.addEventListener('dragend', handleDragEnd); // To clean up dragging class
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
                <span>Total: <strong>${item.total_effort || 0}</strong></span>
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
    
    // Centralized call to draw arrows after swimlanes are rendered and DOM updated.
    requestAnimationFrame(() => { 
        if (typeof getFilteredDataForArrows === 'function') {
            drawDependencyArrows(getFilteredDataForArrows());
        }
    });
}

function drawDependencyArrows(data) {
    arrowCanvas.innerHTML = '';

    if (!data || !data.items || data.items.length === 0) { // Added check for empty items array
        return;
    }

    const swimlaneContainerRect = swimlaneContainer.getBoundingClientRect();
    const arrowCanvasRect = arrowCanvas.getBoundingClientRect();

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('refX', '10');
    marker.setAttribute('refY', '3.5');
    marker.setAttribute('orient', 'auto');
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
    polygon.setAttribute('fill', '#555');
    marker.appendChild(polygon);
    defs.appendChild(marker);
    arrowCanvas.appendChild(defs);

    data.items.forEach(successorItem => {
        if (successorItem.predecessor) {
            const predecessors = Array.isArray(successorItem.predecessor) ? successorItem.predecessor : [successorItem.predecessor];
            const successorElement = swimlaneContainer.querySelector(`.itemCard[data-id='${successorItem.id}']`);

            if (!successorElement) return;

            const successorRect = successorElement.getBoundingClientRect();

            predecessors.forEach(predId => {
                const predecessorItem = data.items.find(p => p.id === predId);
                if (!predecessorItem) return;

                const predecessorElement = swimlaneContainer.querySelector(`.itemCard[data-id='${predId}']`);
                if (!predecessorElement) return;

                const predecessorRect = predecessorElement.getBoundingClientRect();

                let x1, y1, x2, y2; // Start (predecessor) and End (successor) points for the arrow

                if (successorItem.bucket === predecessorItem.bucket) {
                    // Same bucket: Draw a vertical arrow
                    if (predecessorRect.top < successorRect.top) { // Predecessor is visually above successor
                        x1 = predecessorRect.left - arrowCanvasRect.left + predecessorRect.width / 2; // Bottom-center of predecessor
                        y1 = predecessorRect.bottom - arrowCanvasRect.top;
                        x2 = successorRect.left - arrowCanvasRect.left + successorRect.width / 2;   // Top-center of successor
                        y2 = successorRect.top - arrowCanvasRect.top;
                    } else { // Predecessor is visually below or at the same level as successor
                        x1 = predecessorRect.left - arrowCanvasRect.left + predecessorRect.width / 2; // Top-center of predecessor
                        y1 = predecessorRect.top - arrowCanvasRect.top;
                        x2 = successorRect.left - arrowCanvasRect.left + successorRect.width / 2;   // Bottom-center of successor
                        y2 = successorRect.bottom - arrowCanvasRect.top;
                    }
                } else {
                    // Different buckets: Draw a horizontal-ish arrow (original logic)
                    x1 = predecessorRect.right - arrowCanvasRect.left;                       // Right-middle of predecessor
                    y1 = predecessorRect.top - arrowCanvasRect.top + predecessorRect.height / 2;
                    x2 = successorRect.left - arrowCanvasRect.left;                          // Left-middle of successor
                    y2 = successorRect.top - arrowCanvasRect.top + successorRect.height / 2;
                }
                
                // Prevent drawing arrow if start and end points are identical or extremely close
                if (Math.hypot(x2 - x1, y2 - y1) < 2) { // Check if distance is less than 2px
                    return; 
                }

                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', x1.toString());
                line.setAttribute('y1', y1.toString());
                line.setAttribute('x2', x2.toString());
                line.setAttribute('y2', y2.toString());
                line.setAttribute('stroke', '#555');
                line.setAttribute('stroke-width', '1.5');
                line.setAttribute('marker-end', 'url(#arrowhead)');
                arrowCanvas.appendChild(line);
            });
        }
    });
}

function getFilteredDataForArrows() {
    if (!jsonData || !jsonData.items) { 
        return { items: [], buckets: (jsonData ? jsonData.buckets : []), link_base: (jsonData ? jsonData.link_base : null) };
    }

    let itemsToConsider = jsonData.items;

    // Apply Filter B (Focus)
    if (focusTagState.enabled && focusTagState.selectedTag) {
        itemsToConsider = itemsToConsider.filter(item => 
            item.extractedTags && item.extractedTags.includes(focusTagState.selectedTag)
        );
    }

    // Apply Filter A (Visibility)
    const currentlyDisplayedItems = itemsToConsider.filter(item => {
        if (!item.extractedTags || item.extractedTags.length === 0) {
            return true; // Show items with no tags
        }
        // Show if ANY tag on the item is set to 'show' in tagVisibilityState
        return item.extractedTags.some(tag => tagVisibilityState[tag] === 'show');
    });

    return {
        ...jsonData, // Keep other jsonData properties like buckets, link_base
        items: currentlyDisplayedItems
    };
}

function refreshDisplayAndData() {
    if (!jsonData) return;

    // 1. Update JSON in textarea (always shows full, unfiltered data)
    jsonDisplay.value = JSON.stringify(jsonData, null, 4);

    // 2. Re-render swimlanes (will use activeTagFilters internally)
    renderSwimlanes(jsonData);

    // 3. Re-draw arrows (renderSwimlanes now calls this with filtered data)
    // requestAnimationFrame(() => {
    //     requestAnimationFrame(() => {
    //         // drawDependencyArrows(jsonData); // This was problematic, renderSwimlanes handles it
    //     });
    // });
    
    // 4. (Re)-populate bucket selector in modal
    populateBucketSelector();
    // 5. (Re)-render filter UI (in case tags changed, though not implemented dynamically for now)
    // renderFilterUI(); // Potentially call if tags could change dynamically
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
    itemIdInput.readOnly = false; // Reset readOnly state
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
    itemIdInput.readOnly = false; // Make it editable for new items
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
    itemIdInput.readOnly = true; // Make ID read-only for existing items
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
            rebuildAllUniqueTagsAndRefreshFilters();
        } else {
            alert('Item not found for deletion.');
        }
    } else {
        alert('No data loaded to delete from.');
    }
}

itemForm.addEventListener('submit', function(event) {
    event.preventDefault();
    if (!jsonData) {
        alert('No data loaded. Please load a file first.');
        return;
    }

    const idString = itemIdInput.value.trim();
    if (!idString) {
        alert('Item ID is required.');
        return;
    }
    const id = parseInt(idString);
    if (isNaN(id)) {
        alert('Item ID must be a valid number.');
        return;
    }

    const isNewItem = !itemIdInput.readOnly; // Check if we are adding a new item

    if (isNewItem) {
        // Check for ID uniqueness only for new items
        if (jsonData.items.some(item => item.id === id)) {
            alert(`An item with ID ${id} already exists. Please choose a unique ID.`);
            return;
        }
    }

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

    newItemData.extractedTags = extractTagsFromString(newItemData.name);

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
    rebuildAllUniqueTagsAndRefreshFilters();
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
        rebuildAllUniqueTagsAndRefreshFilters();
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
    rebuildAllUniqueTagsAndRefreshFilters();
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
        requestAnimationFrame(() => {
            if (jsonData && typeof getFilteredDataForArrows === 'function') {
                drawDependencyArrows(getFilteredDataForArrows());
            }
        });
    });
}

// Analytics Display Toggle Functionality
if (analyticsToggle && analyticsContent && analyticsToggleIndicator) {
    analyticsToggle.addEventListener('click', () => {
        const isCollapsed = analyticsContent.classList.toggle('collapsed');
        if (isCollapsed) {
            analyticsToggleIndicator.textContent = '(Show)';
            localStorage.setItem('analyticsCollapsed', 'true');
        } else {
            analyticsToggleIndicator.textContent = '(Hide)';
            localStorage.setItem('analyticsCollapsed', 'false');
        }
        requestAnimationFrame(() => {
             if (jsonData && typeof getFilteredDataForArrows === 'function') {
                 drawDependencyArrows(getFilteredDataForArrows());
            }
        });
    });
}

// --- Drag and Drop Handlers ---
function handleDragStart(event, itemId) {
    event.dataTransfer.setData('text/plain', itemId.toString());
    event.dataTransfer.effectAllowed = 'move';
    // Add a class to the dragged element for visual feedback
    event.target.classList.add('dragging');
}

function handleDragEnd(event) {
    // Remove the dragging class when drag operation ends (successfully or not)
    event.target.classList.remove('dragging');
    // Clear any lingering drag-over styles from targets
    document.querySelectorAll('.drag-over-target').forEach(el => el.classList.remove('drag-over-target'));
}

function handleDragOver(event) {
    event.preventDefault(); // Necessary to allow dropping
    event.dataTransfer.dropEffect = 'move';
    // Add a class to the potential drop target for visual feedback
    const targetSwimlane = event.currentTarget;
    if (targetSwimlane.classList.contains('swimlane')) { // Ensure it's a swimlane
        targetSwimlane.classList.add('drag-over-target');
    }
}

function handleDragLeave(event) {
    // Remove the visual feedback class when item is dragged out
    const targetSwimlane = event.currentTarget;
    if (targetSwimlane.classList.contains('swimlane')) {
        targetSwimlane.classList.remove('drag-over-target');
    }
}

function handleDrop(event, targetBucketName) {
    event.preventDefault();
    const droppedItemId = parseInt(event.dataTransfer.getData('text/plain'));
    
    const swimlaneElement = event.currentTarget; // This is the swimlane div
    swimlaneElement.classList.remove('drag-over-target');

    if (!jsonData || !jsonData.items || isNaN(droppedItemId)) {
        return;
    }

    const draggedItemOriginalIndex = jsonData.items.findIndex(item => item.id === droppedItemId);
    if (draggedItemOriginalIndex === -1) {
        return; // Item not found
    }

    // Retrieve and remove the item from its original position
    const [draggedItemObject] = jsonData.items.splice(draggedItemOriginalIndex, 1);
    
    // Update its bucket property
    draggedItemObject.bucket = targetBucketName;

    let insertAtIndex = -1;

    // Determine the reference item card, if any, under the drop point
    const directTargetElement = document.elementFromPoint(event.clientX, event.clientY);
    let referenceItemCard = null;
    if (directTargetElement) {
        referenceItemCard = directTargetElement.closest('.itemCard');
    }

    if (referenceItemCard && parseInt(referenceItemCard.dataset.id) !== draggedItemObject.id) {
        // Dropped onto a different item card
        const referenceItemId = parseInt(referenceItemCard.dataset.id);
        // Find the index of this reference item in the *current* (modified) jsonData.items array
        const referenceItemNewIndex = jsonData.items.findIndex(item => item.id === referenceItemId);

        if (referenceItemNewIndex !== -1) {
            const rect = referenceItemCard.getBoundingClientRect();
            if (event.clientY < rect.top + rect.height / 2) {
                // Drop occurred in the top half of the reference item card -> insert before
                insertAtIndex = referenceItemNewIndex;
            } else {
                // Drop occurred in the bottom half -> insert after
                insertAtIndex = referenceItemNewIndex + 1;
            }
        }
    }

    if (insertAtIndex !== -1) {
        jsonData.items.splice(insertAtIndex, 0, draggedItemObject);
    } else {
        // Dropped on swimlane background, on the item itself, or other edge case.
        // Attempt to append to the items of the target bucket logically.
        let lastIndexOfTargetBucketInCurrentArray = -1;
        for (let i = jsonData.items.length - 1; i >= 0; i--) {
            if (jsonData.items[i].bucket === targetBucketName) {
                lastIndexOfTargetBucketInCurrentArray = i;
                break;
            }
        }

        if (lastIndexOfTargetBucketInCurrentArray !== -1) {
            // Insert after the last known item of this bucket in the current array
            jsonData.items.splice(lastIndexOfTargetBucketInCurrentArray + 1, 0, draggedItemObject);
        } else {
            // Target bucket has no items in the current array (could be first item for this bucket)
            // or if it was the only item and moved to a different bucket.
            // Fallback: append to the very end of the main items list.
            jsonData.items.push(draggedItemObject);
        }
    }
    
    refreshDisplayAndData();
    rebuildAllUniqueTagsAndRefreshFilters();
}

function renderFilterUI() {
    if (!filterContainer) return; // filterContainer is for Filter A
    const focusFilterContainer = document.getElementById('focusFilterContainer');
    if (!focusFilterContainer) return;

    filterContainer.innerHTML = ''; // Clear existing Filter A
    focusFilterContainer.innerHTML = ''; // Clear existing Filter B

    if (allUniqueTags.size === 0) {
        filterContainer.innerHTML = '<span class="no-tags-message">No tags found for Filter A.</span>';
        focusFilterContainer.innerHTML = '<span class="no-tags-message">No tags for Focus Filter.</span>';
        return;
    }

    // --- Render Filter A: Show/Hide per tag ---
    const filterATitle = document.createElement('h3');
    filterATitle.textContent = 'Tag Visibility (Filter A):';
    filterContainer.appendChild(filterATitle);

    allUniqueTags.forEach(tag => {
        // Initialize state if not present (default to 'show')
        if (tagVisibilityState[tag] === undefined) {
            tagVisibilityState[tag] = 'show';
        }

        const tagGroup = document.createElement('div');
        tagGroup.className = 'filter-tag-group';
        tagGroup.textContent = `${tag}: `;

        const showRadioId = `filter-tag-${tag}-show`;
        const showLabel = document.createElement('label');
        showLabel.htmlFor = showRadioId;
        showLabel.className = 'filter-tag-radio-label';
        const showRadio = document.createElement('input');
        showRadio.type = 'radio';
        showRadio.id = showRadioId;
        showRadio.name = `filter-tag-${tag}`;
        showRadio.value = 'show';
        showRadio.checked = tagVisibilityState[tag] === 'show';
        showRadio.addEventListener('change', () => {
            tagVisibilityState[tag] = 'show';
            refreshDisplayAndData();
        });
        showLabel.appendChild(showRadio);
        showLabel.appendChild(document.createTextNode('Show'));
        tagGroup.appendChild(showLabel);

        const hideRadioId = `filter-tag-${tag}-hide`;
        const hideLabel = document.createElement('label');
        hideLabel.htmlFor = hideRadioId;
        hideLabel.className = 'filter-tag-radio-label';
        const hideRadio = document.createElement('input');
        hideRadio.type = 'radio';
        hideRadio.id = hideRadioId;
        hideRadio.name = `filter-tag-${tag}`;
        hideRadio.value = 'hide';
        hideRadio.checked = tagVisibilityState[tag] === 'hide';
        hideRadio.addEventListener('change', () => {
            tagVisibilityState[tag] = 'hide';
            refreshDisplayAndData();
        });
        hideLabel.appendChild(hideRadio);
        hideLabel.appendChild(document.createTextNode('Hide'));
        tagGroup.appendChild(hideLabel);
        
        filterContainer.appendChild(tagGroup);
    });

    // --- Render Filter B: Focus on Tag ---
    const filterBTitle = document.createElement('h3');
    filterBTitle.textContent = 'Focus (Filter B):';
    focusFilterContainer.appendChild(filterBTitle);

    const focusCheckboxLabel = document.createElement('label');
    focusCheckboxLabel.className = 'filter-tag-label';
    const focusCheckbox = document.createElement('input');
    focusCheckbox.type = 'checkbox';
    focusCheckbox.id = 'focus-tag-enabled';
    focusCheckbox.checked = focusTagState.enabled;
    focusCheckbox.addEventListener('change', (event) => {
        focusTagState.enabled = event.target.checked;
        refreshDisplayAndData();
    });
    focusCheckboxLabel.appendChild(focusCheckbox);
    focusCheckboxLabel.appendChild(document.createTextNode(' Focus on Tag: '));
    focusFilterContainer.appendChild(focusCheckboxLabel);

    const focusSelect = document.createElement('select');
    focusSelect.id = 'focus-tag-select';
    focusSelect.disabled = !focusTagState.enabled; // Disable if checkbox is not checked

    // Add a default/placeholder option if needed, or select the first tag
    const defaultOption = document.createElement('option');
    defaultOption.value = ''; // or some placeholder value
    defaultOption.textContent = '-- Select Tag --';
    focusSelect.appendChild(defaultOption);

    allUniqueTags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        if (focusTagState.selectedTag === tag) {
            option.selected = true;
        }
        focusSelect.appendChild(option);
    });
    focusSelect.addEventListener('change', (event) => {
        focusTagState.selectedTag = event.target.value;
        refreshDisplayAndData();
    });
    focusFilterContainer.appendChild(focusSelect);
    
    // Re-enable/disable select based on checkbox state (also on initial render)
    focusCheckbox.addEventListener('change', (event) => {
        focusTagState.enabled = event.target.checked;
        focusSelect.disabled = !event.target.checked;
        if (!event.target.checked) { // If disabling focus, clear selected tag state
            focusTagState.selectedTag = null;
            focusSelect.value = ''; // Reset dropdown to placeholder
        }
        refreshDisplayAndData();
    });

}

function calculateAndRenderAnalytics() {
    if (!jsonData || !jsonData.items) {
        analyticsContent.innerHTML = '<p>No data loaded for analytics.</p>';
        return;
    }

    const effortsByTag = {};
    const grandTotals = { design: 0, build: 0, test: 0, total: 0, itemCount: 0 };
    const statusOrder = ['new', 'in_progress', 'on_hold', 'completed']; // Define status order for rendering
    const statusColors = {
        'new': '#f8f9fa', // Default item card background, subtle enough for a row
        'in_progress': '#e6f7ff', // Light blue from .item-status-in_progress
        'on_hold': '#fffbe6',     // Light yellow from .item-status-on_hold
        'completed': '#f6ffed'   // Light green from .item-status-completed
    };

    // Use the original, unfiltered jsonData.items for analytics
    jsonData.items.forEach(item => {
        const design = parseFloat(item.design_effort || 0);
        const build = parseFloat(item.build_effort || 0);
        const test = parseFloat(item.test_effort || 0);
        item.total_effort = design + build + test; // Store total on item for display on card

        grandTotals.design += design;
        grandTotals.build += build;
        grandTotals.test += test;
        grandTotals.total += item.total_effort;
        grandTotals.itemCount++;

        const itemStatus = (item.status || 'new').toLowerCase().replace(/\s+/g, '_');

        (item.extractedTags || []).forEach(tag => {
            if (!effortsByTag[tag]) {
                effortsByTag[tag] = {
                    statuses: {},
                    subTotals: { design: 0, build: 0, test: 0, total: 0, itemCount: 0 }
                };
            }

            // Initialize status object for the tag if it doesn't exist
            if (!effortsByTag[tag].statuses[itemStatus]) {
                effortsByTag[tag].statuses[itemStatus] = { design: 0, build: 0, test: 0, total: 0, itemCount: 0 };
            }

            // Add to specific status
            effortsByTag[tag].statuses[itemStatus].design += design;
            effortsByTag[tag].statuses[itemStatus].build += build;
            effortsByTag[tag].statuses[itemStatus].test += test;
            effortsByTag[tag].statuses[itemStatus].total += item.total_effort;
            effortsByTag[tag].statuses[itemStatus].itemCount++;

            // Add to tag's subtotal
            effortsByTag[tag].subTotals.design += design;
            effortsByTag[tag].subTotals.build += build;
            effortsByTag[tag].subTotals.test += test;
            effortsByTag[tag].subTotals.total += item.total_effort;
            effortsByTag[tag].subTotals.itemCount++; // This will count unique items per tag correctly
        });
    });

    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Tag / Status</th>
                    <th>Items</th>
                    <th>Design Effort</th>
                    <th>Build Effort</th>
                    <th>Test Effort</th>
                    <th>Total Effort</th>
                </tr>
            </thead>
            <tbody>
    `;

    const sortedTags = Object.keys(effortsByTag).sort();

    sortedTags.forEach(tag => {
        const tagData = effortsByTag[tag];
        tableHTML += `
            <tr class="tag-group-header">
                <td colspan="6"><strong>Tag: ${tag}</strong></td>
            </tr>
        `;

        statusOrder.forEach(statusKey => {
            const statusData = tagData.statuses[statusKey];
            const displayStatus = statusKey.charAt(0).toUpperCase() + statusKey.slice(1).replace(/_/g, ' ');
            const bgColor = statusColors[statusKey] || '#ffffff'; // Fallback to white if status not in map

            if (statusData && statusData.itemCount > 0) {
                tableHTML += `
                    <tr class="status-row" style="background-color: ${bgColor};">
                        <td style="padding-left: 25px;">${displayStatus}</td>
                        <td class="effort-value">${statusData.itemCount}</td>
                        <td class="effort-value">${statusData.design.toFixed(1)}</td>
                        <td class="effort-value">${statusData.build.toFixed(1)}</td>
                        <td class="effort-value">${statusData.test.toFixed(1)}</td>
                        <td class="effort-value"><strong>${statusData.total.toFixed(1)}</strong></td>
                    </tr>
                `;
            } else {
                // Render row with 0s if no items for this status under this tag
                tableHTML += `
                    <tr class="status-row zero-value-row" style="background-color: ${bgColor};">
                        <td style="padding-left: 25px;">${displayStatus}</td>
                        <td class="effort-value">0</td>
                        <td class="effort-value">0.0</td>
                        <td class="effort-value">0.0</td>
                        <td class="effort-value">0.0</td>
                        <td class="effort-value"><strong>0.0</strong></td>
                    </tr>
                `;
            }
        });
        
        // Tag Sub-total Row
        tableHTML += `
            <tr class="tag-subtotal-row">
                <td style="padding-left: 15px;"><em>Subtotal for ${tag}</em></td>
                <td class="effort-value"><em>${tagData.subTotals.itemCount}</em></td>
                <td class="effort-value"><em>${tagData.subTotals.design.toFixed(1)}</em></td>
                <td class="effort-value"><em>${tagData.subTotals.build.toFixed(1)}</em></td>
                <td class="effort-value"><em>${tagData.subTotals.test.toFixed(1)}</em></td>
                <td class="effort-value"><strong><em>${tagData.subTotals.total.toFixed(1)}</em></strong></td>
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
            <tfoot>
                <tr class="total-row">
                    <td><strong>Grand Total (All Items)</strong></td>
                    <td class="effort-value"><strong>${grandTotals.itemCount}</strong></td>
                    <td class="effort-value"><strong>${grandTotals.design.toFixed(1)}</strong></td>
                    <td class="effort-value"><strong>${grandTotals.build.toFixed(1)}</strong></td>
                    <td class="effort-value"><strong>${grandTotals.test.toFixed(1)}</strong></td>
                    <td class="effort-value"><strong>${grandTotals.total.toFixed(1)}</strong></td>
                </tr>
            </tfoot>
        </table>
    `;

    analyticsContent.innerHTML = tableHTML;
}

function rebuildAllUniqueTagsAndRefreshFilters() {
    if (!jsonData || !jsonData.items) return;

    allUniqueTags.clear();
    jsonData.items.forEach(item => {
        // Ensure all items have their tags extracted/updated if they exist
        // This is especially important if an item was just added/modified
        if (item.name) { // Check if item.name exists before trying to extract tags
             item.extractedTags = extractTagsFromString(item.name);
             item.extractedTags.forEach(tag => allUniqueTags.add(tag));
        } else {
            item.extractedTags = []; // Ensure it's an empty array if no name
        }
    });
    // After rebuilding allUniqueTags, we also need to ensure tagVisibilityState is up-to-date
    // Remove any tags from tagVisibilityState that are no longer in allUniqueTags
    Object.keys(tagVisibilityState).forEach(tagInState => {
        if (!allUniqueTags.has(tagInState)) {
            delete tagVisibilityState[tagInState];
        }
    });
    // Add any new unique tags to tagVisibilityState, defaulting to 'show'
    allUniqueTags.forEach(tag => {
        if (tagVisibilityState[tag] === undefined) {
            tagVisibilityState[tag] = 'show';
        }
    });


    renderFilterUI(); // Re-render the filter controls
}

// Ensure filterContainer is assigned after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    filterContainer = document.getElementById('filterTagsContainer');
    // Any initial rendering that depends on filterContainer being present can go here
    // or be triggered after file load, which is current behavior.
}); 