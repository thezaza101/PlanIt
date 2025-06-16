// This file will contain the logic for the new Graph View feature.

// --- CONFIGURATION ---
const CARD_WIDTH = 200;
const MIN_CARD_HEIGHT = 80;
const MAX_CARD_HEIGHT = 180;
const HORIZONTAL_SPACING = 50;
const VERTICAL_SPACING = 50;
const CARD_PADDING = 10;
const LINE_HEIGHT = 18;

const TYPE_COLORS = {
    'Information': '#6bafd2',
    'Process': '#78c28a',
    'Follow Up': '#d2b56b',
    'Other': '#a9a9a9',
    'default': '#cccccc'
};

const STATUS_INDICATORS = {
    'New': '🆕',
    'In Progress': '⏳',
    'Done': '✅',
    'default': '📝'
};

let canvas, ctx;
let currentTodo, currentDetailData;
let nodes = []; // Will store all items to be drawn (todo + cards)
let allDetailData = []; // To store all details from the file

// Panning and view state
let panX = 0, panY = 0;
let isPanning = false;
let isDraggingCard = false;
let draggedNode = null;
let currentlyEditedCardId = null; // To track which card is in the modal
let panStartX = 0, panStartY = 0;
let hasPanned = false; // To distinguish a pan from a click

/**
 * Sets up the canvas, context, and event listeners for the graph view.
 * This function is idempotent, so it's safe to call multiple times.
 */
function setupGraphView() {
    canvas = document.getElementById('graph-canvas');
    if (!canvas) {
        console.error('Canvas element not found!');
        return;
    }
    ctx = canvas.getContext('2d');

    // --- Force Canvas Size ---
    // Calculate available height: window height - canvas top position - a small margin for padding/border
    const canvasRect = canvas.getBoundingClientRect();
    const availableHeight = window.innerHeight - canvasRect.top - 20; 

    // Set a minimum height to avoid it collapsing
    const newHeight = Math.max(300, availableHeight); 

    // Apply the new dimensions directly to the canvas element's style
    if (canvas.height !== newHeight) {
        canvas.style.height = `${newHeight}px`;
    }
    // Let width be handled by CSS (100%)
    const newWidth = canvas.getBoundingClientRect().width;


    // Adjust canvas rendering resolution for high DPI displays
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== newWidth * dpr || canvas.height !== newHeight * dpr) {
        canvas.width = newWidth * dpr;
        canvas.height = newHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Use setTransform for consistency
    }


    // Always re-attach the Add Card button event
    const addCardButton = document.getElementById('addCardButton');
    if (addCardButton && !addCardButton._graphHandlerAttached) {
        addCardButton.addEventListener('click', addNewCard);
        addCardButton._graphHandlerAttached = true;
    }

    // Attach panning listeners if they haven't been attached yet
    if (canvas && !canvas._panningHandlersAttached) {
        canvas.addEventListener('mousedown', onMouseDown);
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('mouseleave', onMouseUp);
        canvas._panningHandlersAttached = true;
    }

    // Attach modal button listeners if they haven't been attached yet
    if (!window._cardModalHandlersAttached) {
        document.getElementById('deleteCardButton').addEventListener('click', () => {
            if (currentlyEditedCardId !== null) {
                if (confirm('Are you sure you want to delete this card? This cannot be undone.')) {
                    deleteCard(currentlyEditedCardId);
                }
            }
        });

        document.getElementById('addChildCardButton').addEventListener('click', () => {
            if (currentlyEditedCardId !== null) {
                addNewCard(currentlyEditedCardId);
                closeCardEditModal();
            }
        });
        window._cardModalHandlersAttached = true;
    }
}

document.addEventListener('DOMContentLoaded', setupGraphView);

/**
 * Initializes the detail module with data from the file.
 * Called by io.js when a file is loaded.
 * @param {Array<object>} details - The array of all detail card items.
 */
function initializeDetails(details) {
    allDetailData = details || [];
    console.log('All detail data initialized:', allDetailData);
}

/**
 * Returns all detail data for saving to the file.
 * Called by io.js.
 * @returns {Array<object>}
 */
function getDetailData() {
    // Here we should also update positions of currently displayed nodes
    if (nodes && nodes.length > 0) {
        nodes.forEach(node => {
            if (!node.isRoot) {
                const detailItem = allDetailData.find(d => d.id === node.id);
                if (detailItem) {
                    detailItem.x = node.x;
                    detailItem.y = node.y;
                }
            }
        });
    }
    return allDetailData;
}

/**
 * Main function to render the graph, called from todo.js
 * This is the "heavy" function that rebuilds the node tree and resizes the canvas.
 * @param {object} todo - The main todo item.
 */
function renderGraph(todo) {
    setupGraphView(); // Always re-initialize canvas and context
    if (!ctx) {
        console.error("Canvas context is not available, cannot render graph.");
        return;
    }

    // Filter the global detail data for the relevant items
    const detailData = allDetailData.filter(d => d.todo_id === todo.ID);

    currentTodo = todo;
    currentDetailData = detailData;

    // 1. Build the node tree
    buildNodeTree();

    // 2. Draw everything on the canvas
    drawCanvasContent();
}

/**
 * This is the "lightweight" drawing function.
 * It only clears the canvas and redraws the current nodes and connections.
 */
function drawCanvasContent() {
    if (!ctx) return;
    
    // Use device-pixel-ratio-aware dimensions
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, canvasWidth / dpr, canvasHeight / dpr);
    ctx.save();
    ctx.translate(panX, panY);

    // Draw connections first
    nodes.forEach(node => {
        if (node.children) {
            node.children.forEach(child => {
                drawConnection(node, child);
            });
        }
    });

    // Draw nodes on top
    nodes.forEach(node => {
        drawNode(node);
    });

    ctx.restore();
}

/**
 * Builds a structured list of nodes to be rendered on the canvas.
 */
function buildNodeTree() {
    nodes = [];

    // The central todo item is the root node
    const rootNode = {
        id: `todo_${currentTodo.ID}`,
        data: currentTodo,
        isRoot: true,
        children: []
    };
    
    // Create nodes for each detail card
    const detailNodes = currentDetailData.map(card => ({
        id: card.id,
        parentId: card.parent_id,
        data: card,
        x: card.x, // Use stored position if available
        y: card.y,
        children: []
    }));

    // Add root and detail nodes to a temporary list to calculate heights
    const allNodesTemp = [rootNode, ...detailNodes];
    allNodesTemp.forEach(node => {
        node.height = calculateNodeHeight(node);
    });

    // Build the hierarchy: connect children to parents
    const nodeMap = new Map(detailNodes.map(node => [node.id, node]));
    detailNodes.forEach(node => {
        let parent = null;
        if (node.parentId) {
            parent = nodeMap.get(node.parentId);
        }
        // If parent is not found or null, it belongs to the root
        if (parent) {
            parent.children.push(node);
        } else {
            rootNode.children.push(node);
        }
    });
    
    // Add all nodes to the final list for drawing
    nodes = allNodesTemp;
    
    // Position nodes that don't have a position yet (for layout)
    layoutNodes(rootNode);
}

/**
 * Calculates the required height for a node based on its text content.
 * @param {object} node The node to measure.
 * @returns {number} The calculated height.
 */
function calculateNodeHeight(node) {
    const text = node.isRoot ? node.data.Title : node.data.content;
    if (!ctx || !text) return MIN_CARD_HEIGHT;

    const words = String(text).split(' ');
    let line = '';
    let lineCount = 0;
    const maxWidth = CARD_WIDTH - 2 * CARD_PADDING;

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            lineCount++;
            line = words[n] + ' ';
        } else {
            line = testLine;
        }
    }
    lineCount++; // For the last line

    // Height based on text lines + top/bottom padding + space for the status line
    const calculatedHeight = (lineCount * LINE_HEIGHT) + (2 * CARD_PADDING) + 20;
    
    return Math.max(MIN_CARD_HEIGHT, Math.min(MAX_CARD_HEIGHT, calculatedHeight));
}

/**
 * Arranges nodes on the canvas if they don't have x/y coordinates.
 * @param {object} root - The root node to start the layout from.
 */
function layoutNodes(root) {
    // Layout nodes recursively
    positionNode(root, canvas.getBoundingClientRect().width / 2, 70);
}

/**
 * Recursively positions a node and its children.
 * @param {object} node The node to position.
 * @param {number} x The target x-coordinate for the node.
 * @param {number} y The target y-coordinate for the node.
 */
function positionNode(node, x, y) {
    // Use stored position if it exists, otherwise use the calculated one.
    if (node.x === undefined) node.x = x;
    if (node.y === undefined) node.y = y;

    if (!node.children || node.children.length === 0) {
        return;
    }

    const totalChildWidth = node.children.length * (CARD_WIDTH + HORIZONTAL_SPACING) - HORIZONTAL_SPACING;
    let currentX = node.x - totalChildWidth / 2;
    const childY = node.y + (node.height / 2) + VERTICAL_SPACING;

    node.children.forEach(child => {
        const childX = currentX + (CARD_WIDTH / 2);
        positionNode(child, childX, childY + (child.height / 2));
        currentX += CARD_WIDTH + HORIZONTAL_SPACING;
    });
}

/**
 * Draws a single node (card or root item) on the canvas.
 * @param {object} node - The node object to draw.
 */
function drawNode(node) {
    const { x, y, height, data, isRoot } = node;
    const title = isRoot ? data.Title : data.content;
    const type = isRoot ? 'Todo Item' : data.type;
    const status = isRoot ? data.Status : data.status;

    ctx.save();
    ctx.fillStyle = isRoot ? '#4a678d' : (TYPE_COLORS[type] || TYPE_COLORS.default);
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Draw card background
    ctx.beginPath();
    ctx.rect(x - CARD_WIDTH / 2, y - height / 2, CARD_WIDTH, height);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // -- Text Drawing with Clipping --
    ctx.save();
    // Define a clipping region for the text area
    const contentX = x - CARD_WIDTH / 2;
    const contentY = y - height / 2 + CARD_PADDING;
    const contentWidth = CARD_WIDTH;
    const contentHeight = height - (2 * CARD_PADDING) - 15; // Reserve space for status
    ctx.beginPath();
    ctx.rect(contentX, contentY, contentWidth, contentHeight);
    ctx.clip();

    // Draw the wrapped text inside the clipped area
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    drawWrappedText(title, x, contentY, contentWidth - (2 * CARD_PADDING), LINE_HEIGHT);
    ctx.restore();

    // Draw Type and Status (outside the clipped area)
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const statusIcon = STATUS_INDICATORS[status] || STATUS_INDICATORS.default;
    ctx.fillText(`${statusIcon} ${type}`, x, y + height / 2 - 15);

    // Add click detection for cards (not root)
    if (!isRoot) {
        if (!node._clickRegion) node._clickRegion = {};
        node._clickRegion.x = x - CARD_WIDTH / 2;
        node._clickRegion.y = y - height / 2;
        node._clickRegion.width = CARD_WIDTH;
        node._clickRegion.height = height;
        node._clickRegion.id = node.id;
    }
}

/**
 * Draws a line connecting two nodes.
 * @param {object} parentNode 
 * @param {object} childNode 
 */
function drawConnection(parentNode, childNode) {
    ctx.beginPath();
    ctx.moveTo(parentNode.x, parentNode.y);
    ctx.lineTo(childNode.x, childNode.y);
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 2;
    ctx.stroke();
}

/**
 * Adds a new detail card to the current todo item or another card.
 * @param {number|null} parentId - The ID of the parent card. If null, attaches to the root todo.
 */
function addNewCard(parentId = null) {
    if (!currentTodo) {
        alert("Please select a Todo item from the list above to add details to.");
        return;
    }

    // Generate a unique ID for the new card.
    const maxId = allDetailData.reduce((max, card) => Math.max(max, card.id || 0), 0);
    const newCardId = maxId + 1;

    // Create the new card data object.
    const newCardData = {
        id: newCardId,
        todo_id: currentTodo.ID,
        parent_id: parentId, // This is the key change
        content: 'New Card',
        type: 'Information',
        status: 'New',
        x: undefined,
        y: undefined
    };

    // Add to the global data store.
    allDetailData.push(newCardData);

    // Re-render the graph.
    renderGraph(currentTodo);
}

/**
 * Helper function to wrap and draw text within a card.
 * @param {string} text The text to draw.
 * @param {number} x The center x-coordinate.
 * @param {number} y The top y-coordinate to start drawing.
 * @param {number} maxWidth The maximum width for a line.
 * @param {number} lineHeight The height of each line.
 */
function drawWrappedText(text, x, y, maxWidth, lineHeight) {
    const words = String(text || '').split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + ' ';
        let metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, x, currentY);
            line = words[n] + ' ';
            currentY += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, currentY);
}

window.addEventListener('resize', function() {
    if (currentTodo) {
        renderGraph(currentTodo);
    }
});

// Modal logic for editing cards
function openCardEditModal(card) {
    currentlyEditedCardId = card.id;
    document.getElementById('editCardId').value = card.id;
    document.getElementById('editCardContent').value = card.content || '';
    document.getElementById('editCardType').value = card.type || 'Information';
    document.getElementById('editCardStatus').value = card.status || 'New';
    document.getElementById('cardEditModal').style.display = 'block';
}

function closeCardEditModal() {
    document.getElementById('cardEditModal').style.display = 'none';
    currentlyEditedCardId = null;
}

document.getElementById('cardEditForm').onsubmit = function(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('editCardId').value, 10);
    const content = document.getElementById('editCardContent').value;
    const type = document.getElementById('editCardType').value;
    const status = document.getElementById('editCardStatus').value;
    const card = allDetailData.find(c => c.id === id);
    if (card) {
        card.content = content;
        card.type = type;
        card.status = status;
    }
    closeCardEditModal();
    if (currentTodo) renderGraph(currentTodo);
};

/**
 * Deletes a card and re-renders the graph.
 * @param {number} cardId The ID of the card to delete.
 */
function deleteCard(cardId) {
    const index = allDetailData.findIndex(c => c.id === cardId);
    if (index > -1) {
        allDetailData.splice(index, 1);
        closeCardEditModal();
        renderGraph(currentTodo);
    }
}

// Add click event to canvas for card editing
if (!window._graphCanvasClickHandlerAttached) {
    document.addEventListener('DOMContentLoaded', function() {
        const canvas = document.getElementById('graph-canvas');
        if (canvas) {
            canvas.addEventListener('click', function(evt) {
                if (hasPanned) { // If a pan just ended, don't treat it as a click
                    hasPanned = false;
                    return;
                }
                if (!nodes) return;
                
                const mousePos = getMousePos(canvas, evt);
                const worldX = mousePos.x - panX;
                const worldY = mousePos.y - panY;

                for (const node of nodes) {
                    if (node._clickRegion &&
                        worldX >= node._clickRegion.x &&
                        worldX <= node._clickRegion.x + node._clickRegion.width &&
                        worldY >= node._clickRegion.y &&
                        worldY <= node._clickRegion.y + node._clickRegion.height) {
                        openCardEditModal(node.data);
                        break;
                    }
                }
            });
        }
    });
    window._graphCanvasClickHandlerAttached = true;
}

// --- Panning & Dragging Handlers ---

function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    // Adjust mouse coordinates for canvas scaling and resolution
    const x = (evt.clientX - rect.left) * (canvas.width / rect.width) / dpr;
    const y = (evt.clientY - rect.top) * (canvas.height / rect.height) / dpr;
    return { x, y };
}

function onMouseDown(evt) {
    const mousePos = getMousePos(canvas, evt);
    const worldX = mousePos.x - panX;
    const worldY = mousePos.y - panY;
    
    draggedNode = null;
    // Check if a node is clicked, in reverse order so top nodes are checked first
    for (const node of [...nodes].reverse()) {
        if (worldX >= node.x - CARD_WIDTH / 2 && worldX <= node.x + CARD_WIDTH / 2 &&
            worldY >= node.y - node.height / 2 && worldY <= node.y + node.height / 2) {
            draggedNode = node;
            break;
        }
    }

    if (draggedNode) {
        // Start dragging a card
        isDraggingCard = true;
    } else {
        // Start panning the canvas
        isPanning = true;
    }
    
    hasPanned = false;
    panStartX = evt.clientX;
    panStartY = evt.clientY;
    canvas.style.cursor = 'grab';
}

function onMouseMove(evt) {
    if (!isPanning && !isDraggingCard) return;

    if (!hasPanned) {
        hasPanned = true;
        canvas.style.cursor = 'grabbing';
    }

    const dx = (evt.clientX - panStartX) / (window.devicePixelRatio || 1);
    const dy = (evt.clientY - panStartY) / (window.devicePixelRatio || 1);

    if (isDraggingCard && draggedNode) {
        // Move the card
        draggedNode.x += dx;
        draggedNode.y += dy;
    } else if (isPanning) {
        // Pan the canvas
        panX += dx;
        panY += dy;
    }

    panStartX = evt.clientX;
    panStartY = evt.clientY;

    drawCanvasContent();
}

function onMouseUp(evt) {
    if (isDraggingCard && draggedNode) {
        // Update the position in the main data array for persistence
        const dataItem = allDetailData.find(d => d.id === draggedNode.id);
        if (dataItem) {
            dataItem.x = draggedNode.x;
            dataItem.y = draggedNode.y;
        }
    }
    
    isPanning = false;
    isDraggingCard = false;
    draggedNode = null;
    canvas.style.cursor = 'default';

    // After a drag, we should prevent the click event from firing.
    // The existing 'hasPanned' flag handles this.
} 