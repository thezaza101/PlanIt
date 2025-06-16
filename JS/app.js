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
/** @type {HTMLElement|null} Reference to the container for filter UI elements. */
let filterContainer = null; // Will be assigned in DOMContentLoaded
/** @type {Set<string>} Set of all unique tags extracted from item names across the loaded data. */
let allUniqueTags = new Set();
// let activeTagFilters = new Set(); // Old filter state - REMOVE or replace

/** 
 * @type {Object.<string, 'show'|'hide'>} 
 * Stores the visibility state for each tag for Filter A. 
 * e.g., { 'TAG1': 'show', 'TAG2': 'hide' }
 */
let tagVisibilityState = {};

/**
 * @typedef {object} FocusTagState
 * @property {boolean} enabled - Whether the focus filter (Filter B) is active.
 * @property {string|null} selectedTag - The tag currently selected for focus.
 */
/** @type {FocusTagState} Stores the state for the focus filter (Filter B). */
let focusTagState = { enabled: false, selectedTag: null };

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

// Filter Section Toggle Elements (assuming these IDs in HTML)
const filtersToggle = document.getElementById('filtersToggle');
const filtersToggleIndicator = document.getElementById('filtersToggleIndicator');
const allFiltersContainer = document.getElementById('allFiltersContainer');

let originalFileName = 'edited_data.json';
/** @type {object|null} Stores the parsed JSON data from the loaded file. */
let jsonData = null;
/** @type {number|null} Stores the original ID of an item being edited. */
let currentEditingOriginalId = null;

// Color Management for Tag Prefixes
let tagPrefixColorMap = {};
let tagColorMap = {};
const availableColors = [
    '#ADD8E6', // LightBlue
    '#FFB6C1', // LightPink
    '#90EE90', // LightGreen
    '#FFDAB9', // PeachPuff
    '#E6E6FA', // Lavender
    '#FAFAD2', // LightGoldenrodYellow
    '#AFEEEE', // PaleTurquoise
    '#F0E68C', // Khaki
    '#DDA0DD', // Plum
    '#B0C4DE', // LightSteelBlue
    '#FFEFD5', // PapayaWhip
    '#D8BFD8', // Thistle
];
let nextColorIndex = 0;

/**
 * Parses a tag string into its prefix and value.
 * e.g., "[APP:ELH]" becomes { prefix: "APP", value: "ELH", original: "APP:ELH" }
 * or "[TAG]" becomes { prefix: "GENERAL", value: "TAG", original: "TAG" }
 * @param {string} tagString - The tag string (e.g., "APP:ELH" or "FEAT").
 * @returns {{prefix: string, value: string, original: string}}
 */
function getTagPrefixAndValue(tagString) {
    const parts = tagString.split(':');
    if (parts.length > 1) {
        return { prefix: parts[0], value: parts.slice(1).join(':'), original: tagString };
    }
    return { prefix: 'GENERAL', value: tagString, original: tagString };
}

/**
 * Assigns and retrieves a color for a given full tag string.
 * Uses a predefined list of available colors in a round-robin fashion.
 * @param {string} tag - The full tag string (e.g., "APP:ELH").
 * @returns {string} The hex color code.
 */
function getColorForTag(tag) {
    if (!tagColorMap[tag]) {
        tagColorMap[tag] = availableColors[nextColorIndex % availableColors.length];
        nextColorIndex++;
    }
    return tagColorMap[tag];
}

/**
 * Assigns and retrieves a color for a given tag prefix.
 * Uses a predefined list of available colors in a round-robin fashion.
 * @param {string} prefix - The tag prefix.
 * @returns {string} The hex color code.
 */
function getColorForTagPrefix(prefix) {
    if (!tagPrefixColorMap[prefix]) {
        tagPrefixColorMap[prefix] = availableColors[nextColorIndex % availableColors.length];
        nextColorIndex++;
    }
    return tagPrefixColorMap[prefix];
}

/**
 * Determines if text color should be light or dark based on background color's luminance.
 * @param {string} bgColor - The background color in hex format (e.g., "#RRGGBB").
 * @returns {string} "white" or "black".
 */
function getTextColorForBackground(bgColor) {
    const color = bgColor.startsWith('#') ? bgColor.substring(1) : bgColor;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    // Standard luminance calculation
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? 'black' : 'white';
}

// Initialize Filter section display state from localStorage
if (filtersToggle && allFiltersContainer && filtersToggleIndicator) {
    const isFiltersCollapsed = localStorage.getItem('filtersCollapsed') !== 'false'; // Default to expanded
    if (isFiltersCollapsed) {
        allFiltersContainer.classList.add('collapsed');
        filtersToggleIndicator.textContent = '(Show)';
    } else {
        allFiltersContainer.classList.remove('collapsed');
        filtersToggleIndicator.textContent = '(Hide)';
    }
}

/**
 * Extracts tags from a string.
 * Tags are expected to be in the format [TAG_NAME].
 * @param {string} text - The text to extract tags from.
 * @returns {string[]} An array of extracted tag names (without brackets).
 */
function extractTagsFromString(text) {
    if (!text || typeof text !== 'string') return [];
    const matches = text.match(/\[(.*?)\]/g); // Find all [TAG] occurrences
    if (matches) {
        return matches.map(tag => tag.substring(1, tag.length - 1)); // Remove brackets
    }
    return [];
}

function stripTagsFromName(name) {
    if (!name || typeof name !== 'string') return '';
    return name.replace(/\[.*?\]\s*/g, '').trim(); // Simpler regex: Remove tags and leading/trailing whitespace
}

// Initialize Analytics display state from localStorage
/** 
 * Initializes the display state (collapsed/expanded) of the Analytics section 
 * based on localStorage preference.
 */
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

/**
 * Renders the swimlanes and item cards based on the provided data and current filter states.
 * This is a core function for displaying the visual plan.
 * @param {object} data - The main JSON data object, expected to have `buckets` and `items` arrays.
 */
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

            const itemHeaderInfoDiv = document.createElement('div');
            itemHeaderInfoDiv.className = 'item-header-info';

            // Render tags first, to appear on the left
            if (item.extractedTags && item.extractedTags.length > 0) {
                const tagsDiv = document.createElement('div');
                tagsDiv.className = 'item-tags';
                item.extractedTags.forEach(tag => {
                    const tagSpan = document.createElement('span');
                    tagSpan.className = 'tag';

                    // Apply new color logic for unique tags
                    const tagParts = getTagPrefixAndValue(tag);
                    const bgColor = getColorForTag(tag); // Use full tag for color
                    tagSpan.style.backgroundColor = bgColor;
                    tagSpan.style.color = getTextColorForBackground(bgColor);
                    // Display prefix:value or just value if prefix is GENERAL
                    tagSpan.textContent = tagParts.prefix === 'GENERAL' ? tagParts.value : `${tagParts.prefix}:${tagParts.value}`;
                    tagSpan.title = tag; // Show full original tag on hover

                    tagsDiv.appendChild(tagSpan);
                });
                itemHeaderInfoDiv.appendChild(tagsDiv);
            }

            const itemIdElement = document.createElement('a'); // Changed to 'a' for clickability
            itemIdElement.className = 'itemIdDisplay clickable-id'; // Added a class for styling
            itemIdElement.textContent = `ID: ${item.id}`;
            itemIdElement.href = '#'; // Make it behave like a link
            itemIdElement.onclick = (e) => {
                e.preventDefault(); // Prevent page jump
                openModifyModal(item.id);
            };
            itemHeaderInfoDiv.appendChild(itemIdElement);
            itemCardDiv.appendChild(itemHeaderInfoDiv);

            // Create item name (as link or plain text)
            const displayName = stripTagsFromName(item.name); // Use stripped name for display
            console.log(`Original: "${item.name}", Display: "${displayName}"`); // DEBUGGING
            if (data.link_base && typeof data.link_base === 'string') {
                const itemNameLink = document.createElement('a');
                itemNameLink.href = data.link_base.replace('{id}', item.id.toString());
                itemNameLink.textContent = displayName || 'Unnamed Item';
                itemNameLink.target = '_blank'; // Open in new tab
                itemNameLink.className = 'item-name-link'; // For styling if needed
                
                // Wrap link in an H4 to maintain similar styling/structure, or style the link directly
                const itemNameHeader = document.createElement('h4');
                itemNameHeader.appendChild(itemNameLink);
                itemCardDiv.appendChild(itemNameHeader);
            } else {
                const itemName = document.createElement('h4');
                itemName.textContent = displayName || 'Unnamed Item';
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

        const grandTotalEffortInBucket = totalDesignEffort + totalBuildEffort + totalTestEffort;

        const effortSummaryDiv = document.createElement('div');
        effortSummaryDiv.className = 'bucket-effort-summary';
        effortSummaryDiv.innerHTML = `
            <hr>
            <p><strong>Total Efforts:</strong></p>
            <span>Design: <strong>${totalDesignEffort.toFixed(1)}</strong></span>
            <span>Build: <strong>${totalBuildEffort.toFixed(1)}</strong></span>
            <span>Test: <strong>${totalTestEffort.toFixed(1)}</strong></span>
            <span style="margin-top: 5px;">Total: <strong>${grandTotalEffortInBucket.toFixed(1)}</strong></span>
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

/**
 * Retrieves the data (including filtered items) that should be used for drawing dependency arrows.
 * This function encapsulates the current filtering logic (Focus Filter B and Tag Visibility Filter A).
 * @returns {object} An object containing all original jsonData properties but with the `items` array filtered 
 *                   according to the current filter states. If no jsonData is loaded, returns a structure with empty items.
 */
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

/**
 * Draws SVG dependency arrows between item cards on the arrowCanvas.
 * Arrows are drawn based on the `predecessor` field in items.
 * Calculates positions dynamically based on item card bounding rectangles.
 * @param {object} data - The data object containing items to draw arrows for. 
 *                      Typically, this should be the output of `getFilteredDataForArrows()`.
 */
function drawDependencyArrows(data) {
    // Debounce arrow drawing
    clearTimeout(window.arrowDrawTimeout);
    window.arrowDrawTimeout = setTimeout(() => {
        _drawDependencyArrows(data);
    }, 50); // 50ms debounce
}

function _drawDependencyArrows(data) {
    if (!data || !data.items) return;
    const items = getFilteredDataForArrows(); // Use filtered data

    arrowCanvas.innerHTML = ''; // Clear previous arrows
    const containerRect = swimlaneContainer.getBoundingClientRect();
    const svgRect = arrowCanvas.getBoundingClientRect();
    const containerScrollTop = swimlaneContainer.scrollTop;
    const containerScrollLeft = swimlaneContainer.scrollLeft;

    items.forEach(item => {
        if (!item.predecessors || item.predecessors.length === 0) return;

        const successorsElem = document.getElementById(`item-${item.id}`);
        if (!successorsElem) return;

        item.predecessors.forEach(predecessorId => {
            const predecessorElem = document.getElementById(`item-${predecessorId}`);
            if (!predecessorElem) return; // Predecessor might be filtered out

            const predecessorRect = predecessorElem.getBoundingClientRect();
            const successorsRect = successorsElem.getBoundingClientRect();

            // Check if both elements are visible
            const isPredecessorVisible = (predecessorRect.top < containerRect.bottom) && (predecessorRect.bottom > containerRect.top);
            const isSuccessorVisible = (successorsRect.top < containerRect.bottom) && (successorsRect.bottom > containerRect.top);

            if (!isPredecessorVisible || !isSuccessorVisible) return;

            const startX = predecessorRect.right - svgRect.left - containerScrollLeft;
            const startY = predecessorRect.top + predecessorRect.height / 2 - svgRect.top;
            const endX = successorsRect.left - svgRect.left - containerScrollLeft;
            const endY = successorsRect.top + successorsRect.height / 2 - svgRect.top;

            // Draw line and arrowhead
            createArrowElement(startX, startY, endX, endY);
        });
    });
}

/**
 * Refreshes the entire display: updates the JSON textarea, re-renders swimlanes (which includes items and arrows),
 * and re-populates bucket selectors in modals.
 */
function refreshDisplayAndData() {
    if (!jsonData) return;

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
    rebuildAllUniqueTagsAndRefreshFilters();
}

/**
 * Populates the bucket selector dropdown in the item modal with current bucket names.
 */
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

/**
 * Opens the main item modal and sets its title.
 * @param {string} [title='Add/Edit Item'] - The title to display on the modal.
 */
function openModal(title = 'Add/Edit Item') {
    modalTitle.textContent = title;
    itemModal.style.display = 'block';
}

/**
 * Closes the main item modal, resets its form, and clears relevant input fields.
 */
function closeModal() {
    itemModal.style.display = 'none';
    currentEditingOriginalId = null; // Clear the original ID
    
    // Remove the dynamically added delete button if it exists
    const modalDeleteButton = document.getElementById('modalDeleteButton');
    if (modalDeleteButton) {
        modalDeleteButton.remove();
    }

    itemForm.reset(); // Clear form fields
    itemIdInput.value = ''; // Ensure hidden ID field is cleared
    itemIdInput.readOnly = false; // Reset readOnly state
}

// Close modal if user clicks outside of it
/**
 * Handles window click events to close modals (item or bucket) if the click is outside the modal content.
 * @param {MouseEvent} event - The click event.
 */
window.onclick = function(event) {
    if (event.target == itemModal) {
        closeModal();
    }
    if (event.target == bucketModal) { // Added for bucket modal
        closeBucketModal();
    }
}

/**
 * Opens the item modal in 'Add New Item' mode.
 * Resets the form, ensures the ID field is editable, and pre-selects a bucket if provided.
 * @param {string} [bucketName] - Optional. The name of the bucket to pre-select for the new item.
 */
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

/**
 * Opens the item modal in 'Modify Item' mode, populating it with the details of the specified item.
 * @param {number} id - The ID of the item to modify.
 */
function openModifyModal(id) {
    const item = jsonData.items.find(i => i.id === id);
    if (!item) {
        alert('Item not found!');
        return;
    }
    currentEditingOriginalId = item.id; // Store the original ID
    openModal(`Modify Item (ID: ${id})`);
    itemIdInput.value = item.id;
    itemIdInput.readOnly = false; // Allow ID to be edited
    itemNameInput.value = item.name || '';
    itemDescriptionInput.value = item.description || '';
    itemBucketSelect.value = item.bucket || '';
    itemStatusSelect.value = item.status || 'new';
    itemDesignEffortInput.value = item.design_effort || '';
    itemBuildEffortInput.value = item.build_effort || '';
    itemTestEffortInput.value = item.test_effort || '';
    
    // Handle predecessors - ensures we work with an array
    const predecessors = Array.isArray(item.predecessors) ? item.predecessors : [];
    itemPredecessorsInput.value = predecessors.join(', ');

    // Add Delete button to the modal
    const modalButtonsDiv = itemForm.querySelector('.modal-buttons');
    if (modalButtonsDiv) {
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button'; // Important: prevent form submission
        deleteButton.id = 'modalDeleteButton'; // ID for easy removal
        deleteButton.className = 'item-btn item-btn-delete'; // Reuse existing class for styling
        deleteButton.textContent = 'Delete Item';
        deleteButton.onclick = () => {
            deleteItem(item.id);
            closeModal(); // Close modal after deletion
        };
        // Add it before the existing buttons (e.g., Save, Cancel)
        // If modalButtonsDiv has other children like a save button, prepend delete.
        modalButtonsDiv.insertBefore(deleteButton, modalButtonsDiv.firstChild);
    }
}

/**
 * Deletes an item from `jsonData.items` after user confirmation.
 * Also removes the deleted item's ID from any other item's predecessor list.
 * Refreshes the display and updates filter UI afterwards.
 * @param {number} id - The ID of the item to delete.
 */
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
                if (Array.isArray(item.predecessors)) {
                    item.predecessors = item.predecessors.filter(predId => predId !== id);
                    if (item.predecessors.length === 0) {
                        delete item.predecessors; // Remove empty array
                    } else if (item.predecessors.length === 1) {
                        item.predecessors = item.predecessors[0]; // Convert to single value if only one left
                    }
                } else if (item.predecessors === id) {
                    delete item.predecessors;
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

/**
 * Handles the submission of the item form (for both adding new items and modifying existing ones).
 * Validates input, updates `jsonData.items`, and refreshes the display and filter UI.
 */
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

    const isNewItem = currentEditingOriginalId === null; // New item if no original ID was stored
    const oldId = isNewItem ? null : currentEditingOriginalId;

    if (isNewItem) {
        // Check for ID uniqueness only for new items
        if (jsonData.items.some(item => item.id === id)) {
            alert(`An item with ID ${id} already exists. Please choose a unique ID.`);
            return;
        }
    } else if (oldId !== id) {
        // ID has changed for an existing item, check for uniqueness against OTHER items
        if (jsonData.items.some(item => item.id === id && item.id !== oldId)) {
            alert(`An item with ID ${id} already exists (collides with another item). Please choose a unique ID.`);
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
    const predecessors = itemPredecessorsInput.value.split(',')
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
        newItemData.predecessors = predecessors.length === 1 ? predecessors[0] : predecessors;
    } else {
        delete newItemData.predecessors; // Ensure no empty predecessor array/value
    }

    newItemData.extractedTags = extractTagsFromString(newItemData.name);

    if (isNewItem) {
        // Add new item
        jsonData.items.push(newItemData);
    } else {
        // Update existing item
        const existingItemIndex = jsonData.items.findIndex(item => item.id === oldId);
        if (existingItemIndex > -1) {
            // If ID changed, update predecessors in other items first
            if (oldId !== id) {
                jsonData.items.forEach(item => {
                    if (item.id === oldId && item !== jsonData.items[existingItemIndex]) return; // Skip self if somehow it lists itself (should not happen)

                    if (Array.isArray(item.predecessors)) {
                        const predIndex = item.predecessors.indexOf(oldId);
                        if (predIndex > -1) {
                            item.predecessors[predIndex] = id;
                        }
                    } else if (item.predecessors === oldId) {
                        item.predecessors = id;
                    }
                });
            }
            jsonData.items[existingItemIndex] = newItemData; // Update the item itself
        } else {
            alert(`Error: Original item with ID ${oldId} not found for update. This should not happen.`);
            return; // Avoid further issues
        }
    }

    closeModal();
    refreshDisplayAndData();
    rebuildAllUniqueTagsAndRefreshFilters();
});

// --- Bucket Management Functions ---
/**
 * Opens the bucket modal for adding a new bucket.
 */
function openBucketModal() {
    bucketForm.reset();
    bucketModalTitle.textContent = 'Add New Bucket';
    bucketModal.style.display = 'block';
}

/**
 * Closes the bucket modal and resets its form.
 */
function closeBucketModal() {
    bucketModal.style.display = 'none';
    bucketForm.reset();
}

/**
 * Deletes a bucket and all its associated items after user confirmation.
 * Updates predecessor lists for remaining items and refreshes the display and filter UI.
 * @param {string} bucketName - The name of the bucket to delete.
 */
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
            if (Array.isArray(item.predecessors)) {
                item.predecessors = item.predecessors.filter(predId => jsonData.items.some(i => i.id === predId));
                if (item.predecessors.length === 0) delete item.predecessors;
                else if (item.predecessors.length === 1) item.predecessors = item.predecessors[0];
            }
             else if (item.predecessors && !jsonData.items.some(i => i.id === item.predecessors)) {
                delete item.predecessors;
            }
        });

        refreshDisplayAndData();
        rebuildAllUniqueTagsAndRefreshFilters();
    } else {
        alert('Bucket not found for deletion.');
    }
}

/**
 * Attaches an event listener to the 'Add New Bucket' button if it exists.
 */
if (addBucketButton) {
    addBucketButton.addEventListener('click', openBucketModal);
}

/**
 * Handles the submission of the bucket form (for adding new buckets).
 * Validates input, updates `jsonData.buckets`, and refreshes the display and filter UI.
 */
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

// Analytics Display Toggle Functionality
/**
 * Initializes and handles the click event for toggling the Analytics display area (collapse/expand).
 * Persists the state in localStorage and redraws dependency arrows.
 */
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

// Filter Section Toggle Functionality
if (filtersToggle && allFiltersContainer && filtersToggleIndicator) {
    filtersToggle.addEventListener('click', () => {
        const isCollapsed = allFiltersContainer.classList.toggle('collapsed');
        if (isCollapsed) {
            filtersToggleIndicator.textContent = '(Show)';
            localStorage.setItem('filtersCollapsed', 'true');
        } else {
            filtersToggleIndicator.textContent = '(Hide)';
            localStorage.setItem('filtersCollapsed', 'false');
        }
        // Redraw arrows as collapsing filters might change layout
        requestAnimationFrame(() => {
             if (jsonData && typeof getFilteredDataForArrows === 'function') {
                 drawDependencyArrows(getFilteredDataForArrows());
            }
        });
    });
}

// --- Drag and Drop Handlers ---
/**
 * Handles the dragstart event for an item card.
 * Sets the data to be transferred (item ID) and visual effect.
 * @param {DragEvent} event - The drag event.
 * @param {number} itemId - The ID of the item being dragged.
 */
function handleDragStart(event, itemId) {
    event.dataTransfer.setData('text/plain', itemId.toString());
    event.dataTransfer.effectAllowed = 'move';
    // Add a class to the dragged element for visual feedback
    event.target.classList.add('dragging');
}

/**
 * Handles the dragend event for an item card.
 * Cleans up any visual styling applied during the drag operation.
 * @param {DragEvent} event - The drag event.
 */
function handleDragEnd(event) {
    // Remove the dragging class when drag operation ends (successfully or not)
    event.target.classList.remove('dragging');
    // Clear any lingering drag-over styles from targets
    document.querySelectorAll('.drag-over-target').forEach(el => el.classList.remove('drag-over-target'));
}

/**
 * Handles the dragover event on a potential drop target (swimlane).
 * Prevents default behavior to allow dropping and sets the drop effect.
 * @param {DragEvent} event - The drag event.
 */
function handleDragOver(event) {
    event.preventDefault(); // Necessary to allow dropping
    event.dataTransfer.dropEffect = 'move';
    // Add a class to the potential drop target for visual feedback
    const targetSwimlane = event.currentTarget;
    if (targetSwimlane.classList.contains('swimlane')) { // Ensure it's a swimlane
        targetSwimlane.classList.add('drag-over-target');
    }
}

/**
 * Handles the dragleave event on a potential drop target.
 * Removes visual feedback styling when the dragged item leaves the target.
 * @param {DragEvent} event - The drag event.
 */
function handleDragLeave(event) {
    // Remove the visual feedback class when item is dragged out
    const targetSwimlane = event.currentTarget;
    if (targetSwimlane.classList.contains('swimlane')) {
        targetSwimlane.classList.remove('drag-over-target');
    }
}

/**
 * Handles the drop event on a swimlane.
 * Updates the dragged item's bucket and its position within `jsonData.items` based on drop location.
 * Refreshes the display.
 * @param {DragEvent} event - The drop event.
 * @param {string} targetBucketName - The name of the bucket where the item was dropped.
 */
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

/**
 * Renders the filter UI controls (Filter A: Tag Visibility and Filter B: Focus Tag).
 * Populates controls based on `allUniqueTags` and current filter states (`tagVisibilityState`, `focusTagState`).
 * Attaches event listeners to filter controls to update state and refresh the display.
 */
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

    // --- Render Filter A: Show/Hide per tag, grouped by prefix ---
    const filterATitle = document.createElement('h3');
    filterATitle.textContent = 'Tag Visibility (Filter A):';
    filterContainer.appendChild(filterATitle);

    const tagsByPrefix = {};
    allUniqueTags.forEach(tag => {
        const { prefix, value, original } = getTagPrefixAndValue(tag);
        if (!tagsByPrefix[prefix]) {
            tagsByPrefix[prefix] = [];
        }
        tagsByPrefix[prefix].push({ value, original, fullTag: tag }); // Store original tag and full tag
    });

    // Sort prefixes alphabetically, except for GENERAL which can be last or first
    const sortedPrefixes = Object.keys(tagsByPrefix).sort((a, b) => {
        if (a === 'GENERAL') return 1; // Push GENERAL to the end
        if (b === 'GENERAL') return -1;
        return a.localeCompare(b);
    });

    sortedPrefixes.forEach(prefix => {
        const prefixGroupContainer = document.createElement('div');
        prefixGroupContainer.className = 'filter-prefix-group';
        const bgColor = getColorForTagPrefix(prefix);
        prefixGroupContainer.style.backgroundColor = bgColor;
        prefixGroupContainer.style.borderColor = getTextColorForBackground(bgColor); // Border color for contrast

        const prefixHeader = document.createElement('h4');
        prefixHeader.className = 'filter-prefix-header';
        prefixHeader.textContent = prefix;
        prefixHeader.style.color = getTextColorForBackground(bgColor);
        prefixGroupContainer.appendChild(prefixHeader); // Add header first

        // Add Show All / Hide All buttons for this prefix group
        const groupToggleButtonContainer = document.createElement('div');
        groupToggleButtonContainer.className = 'filter-group-toggle-buttons';

        const showAllButton = document.createElement('button');
        showAllButton.textContent = 'Show All';
        showAllButton.className = 'filter-group-toggle-btn';
        showAllButton.style.color = getTextColorForBackground(bgColor);
        showAllButton.style.borderColor = getTextColorForBackground(bgColor);
        showAllButton.onclick = () => {
            tagsByPrefix[prefix].forEach(tagInfo => {
                tagVisibilityState[tagInfo.fullTag] = 'show';
            });
            renderFilterUI(); // Re-render to update radio buttons
            refreshDisplayAndData();
        };
        groupToggleButtonContainer.appendChild(showAllButton);

        const hideAllButton = document.createElement('button');
        hideAllButton.textContent = 'Hide All';
        hideAllButton.className = 'filter-group-toggle-btn';
        hideAllButton.style.color = getTextColorForBackground(bgColor);
        hideAllButton.style.borderColor = getTextColorForBackground(bgColor);
        hideAllButton.onclick = () => {
            tagsByPrefix[prefix].forEach(tagInfo => {
                tagVisibilityState[tagInfo.fullTag] = 'hide';
            });
            renderFilterUI(); // Re-render to update radio buttons
            refreshDisplayAndData();
        };
        groupToggleButtonContainer.appendChild(hideAllButton);

        prefixGroupContainer.appendChild(groupToggleButtonContainer); // Add buttons after header

        tagsByPrefix[prefix].sort((a,b) => a.value.localeCompare(b.value)).forEach(tagInfo => {
            const fullTag = tagInfo.fullTag; // Use the full tag for state management
            // Initialize state if not present (default to 'show')
            if (tagVisibilityState[fullTag] === undefined) {
                tagVisibilityState[fullTag] = 'show';
            }

            const tagGroup = document.createElement('div');
            tagGroup.className = 'filter-tag-group'; 
            tagGroup.style.color = getTextColorForBackground(bgColor);

            const tagValueLabel = document.createElement('span');
            tagValueLabel.className = 'filter-tag-value-label';
            tagValueLabel.textContent = `${tagInfo.value}: `;
            tagGroup.appendChild(tagValueLabel);

            const radioContainer = document.createElement('div'); // Container for radio buttons
            radioContainer.className = 'filter-tag-radio-container';

            const showRadioId = `filter-tag-${fullTag.replace(/[^a-zA-Z0-9]/g, '_')}-show`;
            const showLabel = document.createElement('label');
            showLabel.htmlFor = showRadioId;
            showLabel.className = 'filter-tag-radio-label';
            const showRadio = document.createElement('input');
            showRadio.type = 'radio';
            showRadio.id = showRadioId;
            showRadio.name = `filter-tag-${fullTag.replace(/[^a-zA-Z0-9]/g, '_')}`;
            showRadio.value = 'show';
            showRadio.checked = tagVisibilityState[fullTag] === 'show';
            showRadio.addEventListener('change', () => {
                if (showRadio.checked) {
                    tagVisibilityState[fullTag] = 'show';
                    refreshDisplayAndData();
                }
            });
            showLabel.appendChild(showRadio);
            showLabel.appendChild(document.createTextNode('Show'));
            radioContainer.appendChild(showLabel); // Add to radio container

            const hideRadioId = `filter-tag-${fullTag.replace(/[^a-zA-Z0-9]/g, '_')}-hide`;
            const hideLabel = document.createElement('label');
            hideLabel.htmlFor = hideRadioId;
            hideLabel.className = 'filter-tag-radio-label';
            const hideRadio = document.createElement('input');
            hideRadio.type = 'radio';
            hideRadio.id = hideRadioId;
            hideRadio.name = `filter-tag-${fullTag.replace(/[^a-zA-Z0-9]/g, '_')}`;
            hideRadio.value = 'hide';
            hideRadio.checked = tagVisibilityState[fullTag] === 'hide';
            hideRadio.addEventListener('change', () => {
                if (hideRadio.checked) {
                    tagVisibilityState[fullTag] = 'hide';
                    refreshDisplayAndData();
                }
            });
            hideLabel.appendChild(hideRadio);
            hideLabel.appendChild(document.createTextNode('Hide'));
            radioContainer.appendChild(hideLabel); // Add to radio container
            
            tagGroup.appendChild(radioContainer); // Add radio container to tag group
            prefixGroupContainer.appendChild(tagGroup);
        });
        filterContainer.appendChild(prefixGroupContainer);
    });

    // --- Render Filter B: Focus on Tag (remains largely the same, but uses full tag for value) ---
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
        focusSelect.disabled = !event.target.checked;
        if (!event.target.checked) { // If disabling focus, clear selected tag state
            focusTagState.selectedTag = null;
            focusSelect.value = ''; // Reset dropdown to placeholder
        } else if (focusSelect.options.length > 1 && focusSelect.value === '') {
            // If enabling and no tag is selected, auto-select the first available tag for convenience
            focusTagState.selectedTag = focusSelect.options[1].value; 
            focusSelect.value = focusTagState.selectedTag;
        }
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
        } else if (focusSelect.options.length > 1 && focusSelect.value === '') {
            // If enabling and no tag is selected, auto-select the first available tag for convenience
            focusTagState.selectedTag = focusSelect.options[1].value; 
            focusSelect.value = focusTagState.selectedTag;
        }
        refreshDisplayAndData();
    });

}

/**
 * Calculates and renders the analytics table.
 * Aggregates item efforts by tag and status, and computes grand totals.
 * Uses the original, unfiltered `jsonData.items` for calculations.
 * Displays the results in the #analyticsContent element.
 */
function calculateAndRenderAnalytics() {
    if (!jsonData || !jsonData.items) {
        analyticsContent.innerHTML = '<p>No data loaded for analytics.</p>';
        return;
    }

    const effortsByTag = {};
    const grandTotals = { design: 0, build: 0, test: 0, total: 0, itemCount: 0 };
    const statusOrder = ['new', 'on_hold', 'in_progress', 'completed']; // Define status order for rendering
    const statusColors = {
        'new': '#6c757d', // Grey
        'in_progress': '#0d6efd', // Blue
        'on_hold': '#ffc107',     // Yellow
        'completed': '#198754'   // Green
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

        const tags = (item.extractedTags && item.extractedTags.length > 0) ? item.extractedTags : ['UNTAGGED'];

        tags.forEach(tag => {
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
            // Item count for sub-totals should be handled carefully if items have multiple tags
            // This simple increment might double-count. For now, this logic is kept from the original.
            effortsByTag[tag].subTotals.itemCount++; 
        });
    });

    analyticsContent.innerHTML = ''; // Clear previous content

    const chartContainer = document.createElement('div');
    chartContainer.className = 'analytics-chart-container';

    const sortedTags = Object.keys(effortsByTag).sort();

    sortedTags.forEach(tag => {
        const tagData = effortsByTag[tag];
        const totalEffortForTag = tagData.subTotals.total;

        if (totalEffortForTag === 0) return; // Don't render a chart for tags with no effort

        const chartRow = document.createElement('div');
        chartRow.className = 'chart-row';

        const tagName = document.createElement('div');
        tagName.className = 'chart-tag-label';
        tagName.textContent = tag;
        chartRow.appendChild(tagName);

        const barWrapper = document.createElement('div');
        barWrapper.className = 'chart-bar-wrapper';

        const bar = document.createElement('div');
        bar.className = 'chart-bar';

        statusOrder.forEach(statusKey => {
            const statusData = tagData.statuses[statusKey];
            if (statusData && statusData.total > 0) {
                const percentage = (totalEffortForTag > 0) ? (statusData.total / totalEffortForTag) * 100 : 0;
                
                const segment = document.createElement('div');
                segment.className = 'chart-bar-segment';
                segment.style.width = `${percentage}%`;
                
                const bgColor = statusColors[statusKey] || '#ccc';
                segment.style.backgroundColor = bgColor;
                segment.style.color = getTextColorForBackground(bgColor);

                segment.title = `${statusKey.replace(/_/g, ' ')}: ${statusData.total.toFixed(1)} effort (${percentage.toFixed(1)}%)`;

                // Add text to the segment if it's wide enough
                if (percentage > 8) { // Threshold to prevent text overflow
                    segment.textContent = `${statusData.total.toFixed(1)} (${percentage.toFixed(0)}%)`;
                }

                bar.appendChild(segment);
            }
        });

        barWrapper.appendChild(bar);
        chartRow.appendChild(barWrapper);

        const totalLabel = document.createElement('div');
        totalLabel.className = 'chart-total-label';
        totalLabel.textContent = totalEffortForTag.toFixed(1);
        chartRow.appendChild(totalLabel);

        chartContainer.appendChild(chartRow);
    });

    // Add a legend
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    statusOrder.forEach(statusKey => {
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        
        const colorBox = document.createElement('span');
        colorBox.className = 'legend-color-box';
        colorBox.style.backgroundColor = statusColors[statusKey];
        
        const statusLabel = document.createElement('span');
        statusLabel.textContent = statusKey.replace(/_/g, ' ');

        legendItem.appendChild(colorBox);
        legendItem.appendChild(statusLabel);
        legend.appendChild(legendItem);
    });
    
    analyticsContent.appendChild(legend);
    analyticsContent.appendChild(chartContainer);
}

/**
 * Function to re-evaluate all unique tags from current items and update the filter UI and its state.
 * This is crucial after item additions, modifications (name changes), or deletions.
 */
function rebuildAllUniqueTagsAndRefreshFilters() {
    if (!jsonData || !jsonData.items) return;

    allUniqueTags.clear();
    // Reset color mapping to ensure consistency if prefixes change
    tagPrefixColorMap = {};
    tagColorMap = {};
    nextColorIndex = 0;

    jsonData.items.forEach(item => {
        // Ensure all items have their tags extracted/updated if they exist
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
/**
 *DOMContentLoaded event listener.
 * Ensures that the `filterContainer` variable is assigned after the DOM is fully loaded.
 * This is important as `renderFilterUI` depends on this element.
 */
document.addEventListener('DOMContentLoaded', () => {
    filterContainer = document.getElementById('filterTagsContainer');
    
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Deactivate all
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Activate clicked
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');

            // If switching to the plan tab, redraw arrows
            if (tabId === 'planTab') {
                requestAnimationFrame(() => {
                    if (jsonData) {
                        drawDependencyArrows(getFilteredDataForArrows());
                    }
                });
            }
        });
    });
}); 