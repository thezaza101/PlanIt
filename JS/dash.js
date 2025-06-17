// This file will contain the logic for the dashboard tab.
// It will handle loading data from the 'dashboard' worksheet,
// and managing links, displayed items, and contacts.

let dashboardData = {
    links: [],
    displayedItems: [],
    contacts: []
};

function initDashboard() {
    // The global excelData is loaded in io.js, we need to check if it exists and has a dashboard sheet
    if (window.excelData && window.excelData['dashboard']) {
        parseDashboardSheet(window.excelData['dashboard']);
    } else {
        // If no dashboard sheet, use empty data and maybe render a message
        dashboardData = {
            links: [{name: "Example Link", url: "https://example.com"}],
            displayedItems: [],
            contacts: [{name: "John Doe", role: "Developer"}]
        };
        console.log("No 'dashboard' sheet found in Excel file. Using default/empty data.");
    }
    renderDashboard();
}

function parseDashboardSheet(sheet) {
    console.log("Parsing dashboard sheet (implementation pending).");
    // This is where the key-value parsing logic will go.
    // For now, we will just log the raw sheet data.
    console.log(sheet);

    const data = {};
    sheet.forEach(row => {
        if (row[0] && typeof row[1] === 'string') { // Key in first col, value in second
            try {
                // Assuming the value is a JSON string
                data[row[0]] = JSON.parse(row[1]);
            } catch (e) {
                console.error(`Error parsing dashboard data for key "${row[0]}". Value was:`, row[1], "Error:", e);
                // If parsing fails, it might not be JSON, handle as a plain string or ignore.
                data[row[0]] = row[1];
            }
        }
    });

    dashboardData.links = data.links || [];
    dashboardData.displayedItems = data.displayedItems || [];
    dashboardData.contacts = data.contacts || [];
}


function renderDashboard() {
    renderLinks();
    renderDisplayedItems();
    renderContacts();
    renderTodoSummary();
    renderPlanSummary();
}

function renderLinks() {
    const container = document.getElementById('linksContainer');
    container.innerHTML = ''; // Clear previous content

    if (!dashboardData.links || dashboardData.links.length === 0) {
        container.innerHTML = '<p>No links to display.</p>';
        return;
    }

    const list = document.createElement('ul');
    list.className = 'dashboard-list';
    dashboardData.links.forEach((link, index) => {
        const item = document.createElement('li');
        item.innerHTML = `<a href="${link.url}" target="_blank" rel="noopener noreferrer">${link.name}</a>`;
        
        // Make the li clickable to edit, but allow the 'a' tag to function normally.
        item.addEventListener('click', (e) => {
            if (e.target.tagName.toLowerCase() !== 'a') {
                openDashboardItemModal('link', index);
            }
        });

        list.appendChild(item);
    });
    container.appendChild(list);
}

function renderDisplayedItems() {
    const container = document.getElementById('displayedItemsContainer');
    container.innerHTML = ''; // Clear previous content
    
    if (!dashboardData.displayedItems || dashboardData.displayedItems.length === 0) {
        container.innerHTML = '<p>No items from Plan or Todo are being displayed.</p>';
        return;
    }

    const list = document.createElement('ul');
    list.className = 'dashboard-list';

    // Get data sources once
    const planItems = (window.jsonData && window.jsonData.items) ? window.jsonData.items : null;
    const todoItems = (typeof getTodoData === 'function') ? getTodoData() : null;

    dashboardData.displayedItems.forEach((ref, index) => {
        const itemElement = document.createElement('li');
        let foundItem = null;
        let itemText = '';

        // Ensure ref.id is a number for comparison
        const refId = parseInt(ref.id, 10);

        if (ref.type === 'plan') {
            if (planItems) {
                foundItem = planItems.find(item => item.id === refId);
                if (foundItem) {
                    // Assuming stripTagsFromName is globally available from app.js
                    itemText = `[PLAN] ${stripTagsFromName(foundItem.name)} - (Status: ${foundItem.status || 'N/A'})`;
                } else {
                    itemText = `[PLAN] Item with ID ${refId} not found.`;
                }
            } else {
                 itemText = `Could not search for plan item ID ${refId}. Plan data source not available.`;
            }
        } else if (ref.type === 'todo') {
            if (todoItems) {
                foundItem = todoItems.find(item => item.ID === refId);
                if (foundItem) {
                    itemText = `[TODO] ${foundItem.Title} - (Status: ${foundItem.Status || 'N/A'})`;
                } else {
                    itemText = `[TODO] Item with ID ${refId} not found.`;
                }
            } else {
                itemText = `Could not search for todo item ID ${refId}. Todo data source not available.`;
            }
        } else {
            itemText = `Unknown item type "${ref.type}" for item ID ${refId}.`;
        }
        
        itemElement.textContent = itemText;
        if (!foundItem) {
            itemElement.style.color = 'red';
            itemElement.style.borderLeftColor = 'red';
        }
        
        itemElement.addEventListener('click', () => {
            openDashboardItemModal('displayedItem', index);
        });

        list.appendChild(itemElement);
    });

    container.appendChild(list);
}

function renderContacts() {
    const container = document.getElementById('contactsContainer');
    container.innerHTML = ''; // Clear previous content

    if (!dashboardData.contacts || dashboardData.contacts.length === 0) {
        container.innerHTML = '<p>No contacts to display.</p>';
        return;
    }

    const list = document.createElement('ul');
    list.className = 'dashboard-list';
    dashboardData.contacts.forEach((contact, index) => {
        const item = document.createElement('li');
        
        let content = `${contact.name || ''}`;
        if (contact.role) {
            content += ` - ${contact.role}`;
        }
        if (contact.email) {
            content += ` (<a href="mailto:${contact.email}" title="Send email to ${contact.name}">${contact.email}</a>)`;
        }
        
        item.innerHTML = content;

        item.addEventListener('click', (e) => {
            if (e.target.tagName.toLowerCase() !== 'a') {
                openDashboardItemModal('contact', index);
            }
        });
        list.appendChild(item);
    });
    container.appendChild(list);
}

function renderTodoSummary() {
    const container = document.getElementById('todoSummaryContainer');
    if (!container) return;

    const todoItems = (typeof getTodoData === 'function') ? getTodoData() : null;

    if (!todoItems || todoItems.length === 0) {
        container.innerHTML = '<p>No Todo items to summarize.</p>';
        return;
    }

    // Define the axes from the constants in todo.js, assuming they are globally available or can be accessed
    const TODO_TYPES = ['Action', 'Information', 'Issue', 'Other', 'Question', 'Risk'];
    const TODO_STATUSES = ['Not Started', 'Open', 'In Progress', 'Done', 'Closed'];

    const summary = {};
    TODO_TYPES.forEach(type => {
        summary[type] = {};
        TODO_STATUSES.forEach(status => {
            summary[type][status] = 0;
        });
    });

    todoItems.forEach(item => {
        const type = item.Type || 'Other';
        const status = item.Status || 'Not Started';
        if (summary[type] && summary[type][status] !== undefined) {
            summary[type][status]++;
        }
    });

    let tableHtml = '<table><thead><tr><th>Type</th>';
    TODO_STATUSES.forEach(status => {
        tableHtml += `<th>${status}</th>`;
    });
    tableHtml += '<th>Total</th></tr></thead><tbody>';

    const statusTotals = {};
    TODO_STATUSES.forEach(status => statusTotals[status] = 0);
    let grandTotal = 0;

    TODO_TYPES.forEach(type => {
        let rowTotal = 0;
        tableHtml += `<tr><td class="row-header">${type}</td>`;
        TODO_STATUSES.forEach(status => {
            const count = summary[type][status];
            tableHtml += `<td>${count}</td>`;
            rowTotal += count;
            statusTotals[status] += count;
        });
        tableHtml += `<td class="total-cell">${rowTotal}</td></tr>`;
        grandTotal += rowTotal;
    });

    tableHtml += '<tr><td class="total-cell row-header">Total</td>';
    TODO_STATUSES.forEach(status => {
        tableHtml += `<td class="total-cell">${statusTotals[status]}</td>`;
    });
    tableHtml += `<td class="total-cell">${grandTotal}</td></tr>`;

    tableHtml += '</tbody></table>';
    container.innerHTML = tableHtml;
}

// --- Plan Summary ---

let selectedPlanSummaryTags = new Set();

function renderPlanSummary() {
    const planItems = (window.jsonData && window.jsonData.items) ? window.jsonData.items : null;
    if (!planItems) {
        document.getElementById('planSummaryFiltersContainer').innerHTML = '';
        document.getElementById('planSummaryChartContainer').innerHTML = '<p>No Plan items to summarize.</p>';
        return;
    }

    // 1. Get all unique tags from plan items
    const allPlanTags = new Set();
    planItems.forEach(item => {
        if (item.extractedTags) {
            item.extractedTags.forEach(tag => allPlanTags.add(tag));
        }
    });

    // Initialize filter state if it's the first run
    if (selectedPlanSummaryTags.size === 0) {
        allPlanTags.forEach(tag => selectedPlanSummaryTags.add(tag));
    }

    renderPlanSummaryFilters(allPlanTags);
    renderPlanSummaryChart(planItems);
}

function renderPlanSummaryFilters(allPlanTags) {
    const filtersContainer = document.getElementById('planSummaryFiltersContainer');
    filtersContainer.innerHTML = ''; // Clear existing filters

    const sortedTags = Array.from(allPlanTags).sort();

    sortedTags.forEach(tag => {
        const filterGroup = document.createElement('div');
        filterGroup.className = 'filter-group';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `plan-summary-tag-${tag}`;
        checkbox.value = tag;
        checkbox.checked = selectedPlanSummaryTags.has(tag);
        
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                selectedPlanSummaryTags.add(tag);
            } else {
                selectedPlanSummaryTags.delete(tag);
            }
            // Re-render the chart with the new selection
            const planItems = (window.jsonData && window.jsonData.items) ? window.jsonData.items : [];
            renderPlanSummaryChart(planItems);
        });

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = tag;

        filterGroup.appendChild(checkbox);
        filterGroup.appendChild(label);
        filtersContainer.appendChild(filterGroup);
    });
}

function renderPlanSummaryChart(planItems) {
    const chartContainer = document.getElementById('planSummaryChartContainer');
    chartContainer.innerHTML = '';

    const statusOrder = ['new', 'on_hold', 'in_progress', 'completed'];
    const statusColors = {
        'new': '#6c757d',
        'in_progress': '#007bff',
        'on_hold': '#ffc107',
        'completed': '#28a745'
    };

    const effortByStatus = {};
    statusOrder.forEach(status => effortByStatus[status] = { effort: 0, itemCount: 0 });
    let grandTotalEffort = 0;
    
    const processedItemIds = new Set(); // To avoid double counting

    planItems.forEach(item => {
        if (processedItemIds.has(item.id)) {
            return; // Already counted this item
        }

        // Check if the item has at least one of the selected tags
        const hasSelectedTag = item.extractedTags && item.extractedTags.some(tag => selectedPlanSummaryTags.has(tag));

        if (hasSelectedTag) {
            processedItemIds.add(item.id); // Mark as counted

            const design = item.design_effort || 0;
            const build = item.build_effort || 0;
            const test = item.test_effort || 0;
            const totalEffort = design + build + test;

            const status = (item.status || 'new').toLowerCase().replace(/\s+/g, '_');

            if (effortByStatus[status]) {
                effortByStatus[status].effort += totalEffort;
                effortByStatus[status].itemCount++;
                grandTotalEffort += totalEffort;
            }
        }
    });

    if (grandTotalEffort === 0) {
        chartContainer.innerHTML = '<p>No effort to display for the selected tags.</p>';
        return;
    }

    // --- Render the bar ---
    const chartRow = document.createElement('div');
    chartRow.className = 'chart-row';

    const barWrapper = document.createElement('div');
    barWrapper.className = 'chart-bar-wrapper';
    
    const bar = document.createElement('div');
    bar.className = 'chart-bar';

    statusOrder.forEach(statusKey => {
        const statusData = effortByStatus[statusKey];
        if (statusData && statusData.effort > 0) {
            const percentage = (grandTotalEffort > 0) ? (statusData.effort / grandTotalEffort) * 100 : 0;
            
            const segment = document.createElement('div');
            segment.className = 'chart-bar-segment';
            segment.style.width = `${percentage}%`;
            
            const bgColor = statusColors[statusKey] || '#ccc';
            segment.style.backgroundColor = bgColor;
            segment.style.color = getTextColorForBackground(bgColor); // Assumes getTextColorForBackground is global

            segment.title = `${statusKey.replace(/_/g, ' ')}: ${statusData.effort.toFixed(1)} effort (${percentage.toFixed(1)}%)`;

            if (percentage > 8) {
                segment.textContent = `${statusData.effort.toFixed(1)}`;
            }
            bar.appendChild(segment);
        }
    });

    barWrapper.appendChild(bar);
    chartRow.appendChild(barWrapper);

    const totalLabel = document.createElement('div');
    totalLabel.className = 'chart-total-label';
    totalLabel.textContent = grandTotalEffort.toFixed(1);
    chartRow.appendChild(totalLabel);

    chartContainer.appendChild(chartRow);

    // --- Render the legend ---
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    statusOrder.forEach(statusKey => {
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        
        const colorBox = document.createElement('span');
        colorBox.className = 'legend-color-box';
        colorBox.style.backgroundColor = statusColors[statusKey];
        
        const statusLabel = document.createElement('span');
        statusLabel.textContent = `${statusKey.replace(/_/g, ' ')} (${effortByStatus[statusKey].effort.toFixed(1)})`;

        legendItem.appendChild(colorBox);
        legendItem.appendChild(statusLabel);
        legend.appendChild(legendItem);
    });
    
    chartContainer.appendChild(legend);
}

// --- Modal Management ---

let currentDashboardItemType = null;
let currentEditingIndex = null;

function openDashboardItemModal(type, index = null) {
    const modal = document.getElementById('dashboardItemModal');
    const title = document.getElementById('dashboardModalTitle');
    const formFields = document.getElementById('dashboardFormFields');
    const deleteButton = document.getElementById('deleteDashboardItemButton');

    currentDashboardItemType = type;
    currentEditingIndex = index;
    formFields.innerHTML = ''; // Clear previous fields

    let itemData = {};

    if (index !== null) {
        // Editing existing item
        if (type === 'link') {
            itemData = dashboardData.links[index];
            title.textContent = 'Edit Link';
        } else if (type === 'contact') {
            itemData = dashboardData.contacts[index];
            title.textContent = 'Edit Contact';
        } else if (type === 'displayedItem') {
            itemData = dashboardData.displayedItems[index];
            title.textContent = 'Edit Displayed Item';
        }
        deleteButton.style.display = 'block';
        deleteButton.onclick = () => deleteDashboardItem(type, index);
    } else {
        // Adding new item
        deleteButton.style.display = 'none';
        if (type === 'link') {
            title.textContent = 'Add New Link';
        } else if (type === 'contact') {
            title.textContent = 'Add New Contact';
        } else if (type === 'displayedItem') {
            title.textContent = 'Add Item to Display';
        }
    }
    
    generateDashboardFormFields(type, itemData);

    modal.style.display = 'block';
}

function closeDashboardItemModal() {
    const modal = document.getElementById('dashboardItemModal');
    modal.style.display = 'none';
    currentDashboardItemType = null;
    currentEditingIndex = null;
}

function generateDashboardFormFields(type, data = {}) {
    const container = document.getElementById('dashboardFormFields');
    container.innerHTML = '';

    if (type === 'link') {
        container.innerHTML = `
            <label for="linkName">Name:</label>
            <input type="text" id="linkName" name="name" value="${data.name || ''}" required>
            <label for="linkUrl">URL:</label>
            <input type="text" id="linkUrl" name="url" value="${data.url || ''}" required>
        `;
    } else if (type === 'contact') {
        container.innerHTML = `
            <label for="contactName">Name:</label>
            <input type="text" id="contactName" name="name" value="${data.name || ''}" required>
            <label for="contactRole">Role:</label>
            <input type="text" id="contactRole" name="role" value="${data.role || ''}">
            <label for="contactEmail">Email:</label>
            <input type="email" id="contactEmail" name="email" value="${data.email || ''}">
        `;
    } else if (type === 'displayedItem') {
        container.innerHTML = `
            <label for="itemType">Item Type:</label>
            <select id="itemType" name="type">
                <option value="plan" ${data.type === 'plan' ? 'selected' : ''}>Plan Item</option>
                <option value="todo" ${data.type === 'todo' ? 'selected' : ''}>Todo Item</option>
            </select>
            <label for="itemId">Item ID:</label>
            <input type="number" id="itemId" name="id" value="${data.id || ''}" required>
        `;
    }
}

function handleDashboardFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    if (currentDashboardItemType === 'link') {
        if (currentEditingIndex !== null) {
            dashboardData.links[currentEditingIndex] = data;
        } else {
            dashboardData.links.push(data);
        }
    } else if (currentDashboardItemType === 'contact') {
        if (currentEditingIndex !== null) {
            dashboardData.contacts[currentEditingIndex] = data;
        } else {
            dashboardData.contacts.push(data);
        }
    } else if (currentDashboardItemType === 'displayedItem') {
        data.id = parseInt(data.id, 10);
        if (currentEditingIndex !== null) {
            dashboardData.displayedItems[currentEditingIndex] = data;
        } else {
            dashboardData.displayedItems.push(data);
        }
    }
    
    renderDashboard();
    updateDashboardSheetData(); 
    closeDashboardItemModal();
}

function deleteDashboardItem(type, index) {
    let confirmed = false;
    if (type === 'link') {
        confirmed = confirm(`Are you sure you want to delete the link: "${dashboardData.links[index].name}"?`);
        if (confirmed) dashboardData.links.splice(index, 1);
    } else if (type === 'contact') {
        confirmed = confirm(`Are you sure you want to delete the contact: "${dashboardData.contacts[index].name}"?`);
        if (confirmed) dashboardData.contacts.splice(index, 1);
    } else if (type === 'displayedItem') {
        confirmed = confirm(`Are you sure you want to remove the item (ID: ${dashboardData.displayedItems[index].id}) from the dashboard?`);
        if (confirmed) dashboardData.displayedItems.splice(index, 1);
    }

    if(confirmed){
        renderDashboard();
        updateDashboardSheetData();
        closeDashboardItemModal();
    }
}

function updateDashboardSheetData() {
    if (!window.excelData) {
        window.excelData = {};
    }
    
    const sheetData = [
        ['links', JSON.stringify(dashboardData.links)],
        ['displayedItems', JSON.stringify(dashboardData.displayedItems)],
        ['contacts', JSON.stringify(dashboardData.contacts)]
    ];
    
    window.excelData['dashboard'] = sheetData;
    console.log("window.excelData updated with dashboard data.", window.excelData);
}


document.addEventListener('DOMContentLoaded', () => {
    const addLinkButton = document.getElementById('addLinkButton');
    const addDisplayedItemButton = document.getElementById('addDisplayedItemButton');
    const addContactButton = document.getElementById('addContactButton');
    const dashboardItemModal = document.getElementById('dashboardItemModal');
    const closeBtn = document.getElementById('closeDashboardItemModalBtn');
    const cancelBtn = document.getElementById('cancelDashboardItemButton');
    const dashboardItemForm = document.getElementById('dashboardItemForm');

    if(addLinkButton) addLinkButton.addEventListener('click', () => openDashboardItemModal('link'));
    if(addDisplayedItemButton) addDisplayedItemButton.addEventListener('click', () => openDashboardItemModal('displayedItem'));
    if(addContactButton) addContactButton.addEventListener('click', () => openDashboardItemModal('contact'));

    if(closeBtn) closeBtn.addEventListener('click', closeDashboardItemModal);
    if(cancelBtn) cancelBtn.addEventListener('click', closeDashboardItemModal);
    
    if(dashboardItemModal) {
        window.addEventListener('click', (event) => {
            if (event.target === dashboardItemModal) {
                closeDashboardItemModal();
            }
        });
    }

    if(dashboardItemForm) dashboardItemForm.addEventListener('submit', handleDashboardFormSubmit);
});