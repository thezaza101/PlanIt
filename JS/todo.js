// This file will contain the logic for the 'Todo' tab.

// Global variable to hold the todo items
let todoData = [];
let currentEditingTodoId = null;

// --- State Management ---
let filterKeyword = '';
let activeTypeFilters = new Set();
let activeStatusFilters = new Set();
let sortState = {
    column: 'ID',
    direction: 'asc'
};

const TODO_TYPES = ['Action', 'Information', 'Issue', 'Other', 'Question', 'Risk'];
const TODO_STATUSES = ['Not Started', 'Open', 'In Progress', 'Done', 'Closed'];

// DOM Elements
const todoTableContainer = document.getElementById('todoTableContainer');
const addTodoItemButton = document.getElementById('addTodoItemButton');
const todoItemModal = document.getElementById('todoItemModal');
const todoItemForm = document.getElementById('todoItemForm');
const todoModalTitle = document.getElementById('todoModalTitle');
const todoItemIdInput = document.getElementById('todoItemId'); // Hidden input
const saveTodoItemButton = document.getElementById('saveTodoItemButton');
const todoFilterInput = document.getElementById('todoFilterInput');

// Initialize filter sets to include all options by default
activeTypeFilters = new Set(TODO_TYPES);
activeStatusFilters = new Set(TODO_STATUSES);

/**
 * Initializes the todo module with data.
 * This function is called by io.js when a file is loaded.
 * @param {Array<Object>} todos - The array of todo items.
 */
function initializeTodo(todos) {
    todoData = todos;
    renderTodoTable();
}

/**
 * Returns the current todo data.
 * This function is called by io.js when saving the Excel file.
 * @returns {Array<Object>}
 */
function getTodoData() {
    return todoData;
}

/**
 * Renders the todo items into an HTML table.
 */
function renderTodoTable() {
    if (!todoTableContainer) return;

    // 1. Filter data
    let dataToRender = todoData.filter(item => {
        // Checkbox filters first for efficiency
        const typeMatch = activeTypeFilters.has(item.Type || 'Other');
        const statusMatch = activeStatusFilters.has(item.Status || 'Not Started');
        if (!typeMatch || !statusMatch) {
            return false;
        }

        // Then, apply text filter only if there's a keyword
        if (filterKeyword) {
            const lowercasedFilter = filterKeyword.toLowerCase();
            return Object.values(item).some(value => 
                String(value).toLowerCase().includes(lowercasedFilter)
            );
        }

        return true; // Pass if checkbox filters match and there's no text filter
    });

    // 2. Sort data
    dataToRender.sort((a, b) => {
        const valA = a[sortState.column] || '';
        const valB = b[sortState.column] || '';
        const dir = sortState.direction === 'asc' ? 1 : -1;

        if (sortState.column === 'ID') {
            return (Number(valA) - Number(valB)) * dir;
        }
        if (sortState.column === 'Due Date') {
            if (!valA) return 1; // Put empty dates at the end
            if (!valB) return -1;
            return (new Date(valA) - new Date(valB)) * dir;
        }
        // Default to string comparison
        return String(valA).toLowerCase().localeCompare(String(valB).toLowerCase()) * dir;
    });

    const nextId = todoData.reduce((max, item) => item.ID > max ? item.ID : max, 0) + 1;

    let tableHtml = `
        <table>
            <thead>
                <tr>
                    <th class="col-id sortable" data-column="ID">ID</th>
                    <th class="col-type sortable" data-column="Type">Type</th>
                    <th class="col-title sortable" data-column="Title">Title</th>
                    <th class="col-description sortable" data-column="Description">Description</th>
                    <th class="col-tags sortable" data-column="Tags">Tags</th>
                    <th class="col-status sortable" data-column="Status">Status</th>
                    <th class="col-owner sortable" data-column="Owner">Owner</th>
                    <th class="col-due-date sortable" data-column="Due Date">Due Date</th>
                    <th class="col-actions">Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (dataToRender.length === 0) {
        tableHtml += '<tr><td colspan="9" style="text-align:center; color: #777;">No items match the filter.</td></tr>';
    } else {
        dataToRender.forEach(item => {
            let tagsHtml = '';
            if (item.Tags && typeof item.Tags === 'string' && item.Tags.trim() !== '') {
                const tags = item.Tags.split(',').map(t => t.trim());
                tags.forEach(tag => {
                    if (!tag) return;
                    // Assumes color functions from app.js are available in the global scope
                    const tagParts = getTagPrefixAndValue(tag);
                    const bgColor = getColorForTag(tag); // Use full tag for color
                    const textColor = getTextColorForBackground(bgColor);
                    const displayTag = tagParts.prefix === 'GENERAL' ? tagParts.value : `${tagParts.prefix}:${tagParts.value}`;
                    tagsHtml += `<span class="tag" style="background-color: ${bgColor}; color: ${textColor};" title="${tag}">${displayTag}</span>`;
                });
            }

            const itemTypeClass = item.Type ? `todo-type-${item.Type.toLowerCase().replace(/\s+/g, '-')}` : '';

            tableHtml += `
                <tr data-id="${item.ID}" class="${itemTypeClass}">
                    <td class="col-id">${item.ID}</td>
                    <td class="col-type">${item.Type || ''}</td>
                    <td class="col-title">${item.Title || ''}</td>
                    <td class="col-description">${item.Description || ''}</td>
                    <td class="col-tags">${tagsHtml}</td>
                    <td class="col-status">${item.Status || ''}</td>
                    <td class="col-owner">${item.Owner || ''}</td>
                    <td class="col-due-date">${item['Due Date'] || ''}</td>
                    <td class="col-actions todo-actions">
                        <button class="item-btn item-btn-modify" onclick="openEditTodoModal(${item.ID})">Edit</button>
                        <button class="item-btn item-btn-delete" onclick="deleteTodoItem(${item.ID})">Delete</button>
                    </td>
                </tr>
            `;
        });
    }

    // Add the inline 'add new' row
    tableHtml += `
        <tr id="new-todo-row">
            <td class="col-id"><span class="new-id-placeholder">${nextId}</span></td>
            <td class="col-type">
                <select id="new-todo-type" class="inline-todo-input">
                    <option value="Action">Action</option>
                    <option value="Information">Information</option>
                    <option value="Issue">Issue</option>
                    <option value="Other">Other</option>
                    <option value="Question">Question</option>
                    <option value="Risk">Risk</option>
                </select>
            </td>
            <td class="col-title"><input type="text" id="new-todo-title" class="inline-todo-input" placeholder="Enter title..."></td>
            <td class="col-description"><input type="text" id="new-todo-description" class="inline-todo-input" placeholder="Description..."></td>
            <td class="col-tags"><input type="text" id="new-todo-tags" class="inline-todo-input" placeholder="Tags..."></td>
            <td class="col-status">
                <select id="new-todo-status" class="inline-todo-input">
                    <option value="Not Started" selected>Not Started</option>
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Done">Done</option>
                    <option value="Closed">Closed</option>
                </select>
            </td>
            <td class="col-owner"><input type="text" id="new-todo-owner" class="inline-todo-input" placeholder="Owner..."></td>
            <td class="col-due-date"><input type="date" id="new-todo-due-date" class="inline-todo-input"></td>
            <td class="col-actions todo-actions">
                <button class="item-btn" style="background-color: #28a745; color: white;" onclick="saveNewTodoFromInlineRow()">Add</button>
            </td>
        </tr>
    `;

    tableHtml += `
            </tbody>
        </table>
    `;

    todoTableContainer.innerHTML = tableHtml;

    // Add sorting classes to headers
    const headers = todoTableContainer.querySelectorAll('th.sortable');
    headers.forEach(header => {
        const column = header.dataset.column;
        if (column === sortState.column) {
            header.classList.add(sortState.direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
        }
    });

    // Add click listeners to headers for sorting
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.dataset.column;
            if (sortState.column === column) {
                sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
            } else {
                sortState.column = column;
                sortState.direction = 'asc';
            }
            renderTodoTable();
        });
    });

    // Add click listeners to title cells to open graph view
    const titleCells = todoTableContainer.querySelectorAll('td.col-title');
    titleCells.forEach(cell => {
        const row = cell.closest('tr');
        if (!row || row.id === 'new-todo-row' || !row.dataset.id) return; // Skip the 'add new' row and header
        
        const todoId = parseInt(row.dataset.id, 10);
        
        // Clear any existing listeners to avoid duplicates
        const newCell = cell.cloneNode(true);
        cell.parentNode.replaceChild(newCell, cell);

        newCell.style.cursor = 'pointer';
        newCell.style.textDecoration = 'underline';
        newCell.addEventListener('click', () => showGraphViewForTodo(todoId));
    });

    if (todoItemModal) {
        todoItemModal.style.display = 'none';
    }
}

/**
 * Opens the modal for adding a new todo item.
 */
function openAddTodoModal() {
    currentEditingTodoId = null;
    todoItemForm.reset();
    todoModalTitle.textContent = 'Add New Todo Item';
    
    // Find the next available ID
    const maxId = todoData.reduce((max, item) => item.ID > max ? item.ID : max, 0);
    // You can't edit the ID field directly in this flow, it's auto-assigned on save.
    // The hidden input will be set on form submission.
    
    todoItemModal.style.display = 'block';
}

/**
 * Opens the modal to edit an existing todo item.
 * @param {number} id - The ID of the item to edit.
 */
function openEditTodoModal(id) {
    const item = todoData.find(i => i.ID === id);
    if (!item) {
        alert('Item not found!');
        return;
    }

    currentEditingTodoId = id;
    todoItemForm.reset();
    todoModalTitle.textContent = 'Edit Todo Item';

    // Populate form
    document.getElementById('todoItemId').value = item.ID;
    document.getElementById('todoItemTitle').value = item.Title || '';
    document.getElementById('todoItemDescription').value = item.Description || '';
    document.getElementById('todoItemType').value = item.Type || 'Action';
    document.getElementById('todoItemStatus').value = item.Status || 'Not Started';
    document.getElementById('todoItemOwner').value = item.Owner || '';
    document.getElementById('todoItemDueDate').value = item['Due Date'] || '';
    document.getElementById('todoItemTags').value = item.Tags || '';
    document.getElementById('todoItemConnectedTo').value = item['Connected To'] || '';

    todoItemModal.style.display = 'block';
}

/**
 * Closes the todo item modal.
 */
function closeTodoModal() {
    if (todoItemModal) {
        todoItemModal.style.display = 'none';
    }
}

/**
 * Deletes a todo item.
 * @param {number} id - The ID of the item to delete.
 */
function deleteTodoItem(id) {
    if (confirm(`Are you sure you want to delete todo item ID: ${id}?`)) {
        const itemIndex = todoData.findIndex(item => item.ID === id);
        if (itemIndex > -1) {
            todoData.splice(itemIndex, 1);
            renderTodoTable();
        }
    }
}

/**
 * Handles the form submission for adding or editing a todo item.
 * @param {Event} event - The form submission event.
 */
function handleTodoFormSubmit(event) {
    event.preventDefault();

    const today = new Date().toISOString().split('T')[0];
    let id;

    const formData = new FormData(todoItemForm);
    const itemData = {
        Title: formData.get('title'),
        Description: formData.get('description'),
        Type: formData.get('type'),
        Status: formData.get('status'),
        Owner: formData.get('owner'),
        'Due Date': formData.get('due_date'),
        Tags: formData.get('tags'),
        'Connected To': formData.get('connected_to'),
    };

    if (currentEditingTodoId !== null) {
        // Editing existing item
        id = currentEditingTodoId;
        const existingItem = todoData.find(i => i.ID === id);
        itemData.ID = id;
        itemData['Created Date'] = existingItem['Created Date']; // Preserve original creation date
        itemData['Last Updated'] = today;

        const itemIndex = todoData.findIndex(i => i.ID === id);
        todoData[itemIndex] = itemData;

    } else {
        // Adding new item
        const maxId = todoData.reduce((max, item) => (item.ID > max ? item.ID : max), 0);
        id = maxId + 1;
        itemData.ID = id;
        itemData['Created Date'] = today;
        itemData['Last Updated'] = today;
        todoData.push(itemData);
    }

    renderTodoTable();
    closeTodoModal();
}

/**
 * Shows the graph view for a specific todo item.
 * @param {number} todoId The ID of the todo item to display.
 */
function showGraphViewForTodo(todoId) {
    const graphContainer = document.getElementById('graph-view-container');
    const todo = todoData.find(item => item.ID === todoId);
    if (!todo || !graphContainer) return;

    console.log(`Showing graph for Todo ID: ${todoId}`, todo);

    // Make the container visible
    graphContainer.style.display = 'block';

    // Scroll to the graph view
    graphContainer.scrollIntoView({ behavior: 'smooth' });

    // Call the function from todo_detail.js to render the graph
    if (typeof renderGraph === 'function') {
        renderGraph(todo);
    } else {
        console.error('renderGraph function not found. Is todo_detail.js loaded?');
    }
}

/**
 * Saves a new todo item from the inline table row.
 */
function saveNewTodoFromInlineRow() {
    const titleInput = document.getElementById('new-todo-title');
    const descriptionInput = document.getElementById('new-todo-description');
    const title = titleInput.value.trim();
    if (!title) {
        alert('Title is required to add a new item.');
        return;
    }
    const description = descriptionInput.value.trim();
    const tags = document.getElementById('new-todo-tags').value.trim();

    const today = new Date().toISOString().split('T')[0];
    const nextId = todoData.reduce((max, item) => item.ID > max ? item.ID : max, 0) + 1;

    const newTodoItem = {
        ID: nextId,
        Title: title,
        Description: description,
        Type: document.getElementById('new-todo-type').value,
        Status: document.getElementById('new-todo-status').value,
        Owner: document.getElementById('new-todo-owner').value.trim(),
        'Due Date': document.getElementById('new-todo-due-date').value || '',
        Tags: tags,
        'Connected To': '', // Can be edited via modal
        'Created Date': today,
        'Last Updated': today,
    };

    todoData.push(newTodoItem);
    renderTodoTable(); // Re-render to show new item and a fresh input row
}

/**
 * Renders the filter controls (checkboxes) for Type and Status.
 */
function renderTodoFilterControls() {
    const typeContainer = document.getElementById('todoTypeFilterContainer');
    const statusContainer = document.getElementById('todoStatusFilterContainer');

    if (!typeContainer || !statusContainer) return;

    // --- Render Type Filters ---
    let typeHtml = '<h4>Type</h4><div class="filter-items-container">';
    TODO_TYPES.forEach(type => {
        const isChecked = activeTypeFilters.has(type);
        typeHtml += `
            <label class="filter-item-label">
                <input type="checkbox" class="todo-type-filter" value="${type}" ${isChecked ? 'checked' : ''}>
                ${type}
            </label>
        `;
    });
    typeHtml += '</div>';
    typeContainer.innerHTML = typeHtml;

    // --- Render Status Filters ---
    let statusHtml = '<h4>Status</h4><div class="filter-items-container">';
    TODO_STATUSES.forEach(status => {
        const isChecked = activeStatusFilters.has(status);
        statusHtml += `
            <label class="filter-item-label">
                <input type="checkbox" class="todo-status-filter" value="${status}" ${isChecked ? 'checked' : ''}>
                ${status}
            </label>
        `;
    });
    statusHtml += '</div>';
    statusContainer.innerHTML = statusHtml;

    // --- Add Event Listeners ---
    typeContainer.querySelectorAll('.todo-type-filter').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                activeTypeFilters.add(e.target.value);
            } else {
                activeTypeFilters.delete(e.target.value);
            }
            renderTodoTable();
        });
    });

    statusContainer.querySelectorAll('.todo-status-filter').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                activeStatusFilters.add(e.target.value);
            } else {
                activeStatusFilters.delete(e.target.value);
            }
            renderTodoTable();
        });
    });
}

// --- DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    if (addTodoItemButton) {
        addTodoItemButton.addEventListener('click', openAddTodoModal);
    }
    if (todoFilterInput) {
        todoFilterInput.addEventListener('input', (e) => {
            filterKeyword = e.target.value;
            renderTodoTable();
        });
    }
    if (todoItemForm) {
        todoItemForm.addEventListener('submit', handleTodoFormSubmit);
    }

    // Initialize filter controls
    renderTodoFilterControls();

    // Collapsible Todo Section Logic
    const todoToggle = document.getElementById('todoToggle');
    const todoToggleIndicator = document.getElementById('todoToggleIndicator');
    const todoContent = document.getElementById('todoContent');

    if (todoToggle && todoToggleIndicator && todoContent) {
        // Initialize state from localStorage
        const isTodoCollapsed = localStorage.getItem('todoCollapsed') === 'true';
        todoContent.classList.toggle('collapsed', isTodoCollapsed);
        todoToggleIndicator.textContent = isTodoCollapsed ? '(Show)' : '(Hide)';

        todoToggle.addEventListener('click', () => {
            const isCollapsed = todoContent.classList.toggle('collapsed');
            localStorage.setItem('todoCollapsed', isCollapsed);
            todoToggleIndicator.textContent = isCollapsed ? '(Show)' : '(Hide)';
        });
    }
}); 