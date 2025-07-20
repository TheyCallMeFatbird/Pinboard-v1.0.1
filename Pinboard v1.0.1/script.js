
class DetectivePinboard {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.evidenceLayer = document.getElementById('evidenceLayer');
        
        // State management
        this.points = [];
        this.lines = [];
        this.evidenceItems = [];
        this.currentMode = 'drawing';
        this.selectedPoint = null;
        this.selectedEvidence = null;
        this.draggedItem = null;
        this.isDragging = false;
        this.isDrawingLine = false;
        this.lineStart = null;
        
        // Viewport settings
        this.zoom = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isPanning = false;
        this.lastPanPoint = { x: 0, y: 0 };
        
        // Line settings
        this.currentLineColor = '#cc0000';
        this.currentLineStyle = 'solid';
        
        // Initialize
        this.setupCanvas();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.updateStatus();
        
        // Auto-save interval
        setInterval(() => this.autoSave(), 30000); // Auto-save every 30 seconds
    }
    
    setupCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        const container = document.getElementById('pinboardContainer');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.redraw();
    }
    
    setupEventListeners() {
        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('contextmenu', (e) => this.handleRightClick(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        
        // Toolbar events
        this.setupToolbarEvents();
        
        // Modal events
        this.setupModalEvents();
        
        // Info panel events
        document.getElementById('toggleInfo').addEventListener('click', () => {
            document.getElementById('infoPanel').classList.toggle('open');
        });
        
        // Shortcuts panel events
        document.getElementById('toggleShortcuts').addEventListener('click', () => {
            document.getElementById('shortcutsPanel').classList.toggle('collapsed');
        });
        
        // Global click to hide context menu
        document.addEventListener('click', () => this.hideContextMenu());
    }
    
    setupToolbarEvents() {
        // File operations
        document.getElementById('newCaseBtn').addEventListener('click', () => this.newCase());
        document.getElementById('saveCaseBtn').addEventListener('click', () => this.saveCase());
        document.getElementById('loadCaseBtn').addEventListener('click', () => this.loadCase());
        
        // Evidence operations
        document.getElementById('addEvidenceBtn').addEventListener('click', () => this.showEvidenceModal());
        document.getElementById('addPhotoBtn').addEventListener('click', () => this.showEvidenceModal('photo'));
        document.getElementById('addNoteBtn').addEventListener('click', () => this.showEvidenceModal('note'));
        
        // Line settings
        document.getElementById('lineColorSelect').addEventListener('change', (e) => {
            const colorPicker = document.getElementById('customColorPicker');
            if (e.target.value === 'custom') {
                colorPicker.style.display = 'inline-block';
                colorPicker.click(); // Open color picker immediately
                this.currentLineColor = colorPicker.value;
            } else {
                colorPicker.style.display = 'none';
                this.currentLineColor = e.target.value;
            }
        });
        
        document.getElementById('customColorPicker').addEventListener('change', (e) => {
            this.currentLineColor = e.target.value;
        });
        
        document.getElementById('lineStyleSelect').addEventListener('change', (e) => {
            this.currentLineStyle = e.target.value;
        });
        
        // Zoom controls
        document.getElementById('zoomInBtn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOutBtn').addEventListener('click', () => this.zoomOut());
        document.getElementById('resetViewBtn').addEventListener('click', () => this.resetView());
        
        // Delete mode
        document.getElementById('deleteMode').addEventListener('click', (e) => {
            this.toggleDeleteMode();
            e.target.classList.toggle('active');
        });
    }
    
    setupModalEvents() {
        const modal = document.getElementById('evidenceModal');
        const closeBtn = document.getElementById('closeModal');
        const cancelBtn = document.getElementById('cancelEvidence');
        const confirmBtn = document.getElementById('addEvidenceConfirm');
        
        closeBtn.addEventListener('click', () => this.hideEvidenceModal());
        cancelBtn.addEventListener('click', () => this.hideEvidenceModal());
        confirmBtn.addEventListener('click', () => this.addEvidence());
        
        // Close modal on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.hideEvidenceModal();
        });
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            switch (e.key.toLowerCase()) {
                case 'n':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.newCase();
                    }
                    break;
                case 's':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.saveCase();
                    }
                    break;
                case 'o':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.loadCase();
                    }
                    break;
                case 'e':
                    this.showEvidenceModal();
                    break;
                case 'p':
                    this.showEvidenceModal('photo');
                    break;
                case 't':
                    this.showEvidenceModal('note');
                    break;
                case 'd':
                    this.toggleDeleteMode();
                    break;
                case 'delete':
                case 'backspace':
                    this.deleteSelected();
                    break;
                case 'escape':
                    this.clearSelection();
                    this.hideContextMenu();
                    this.hideEvidenceModal();
                    break;
                case '+':
                case '=':
                    this.zoomIn();
                    break;
                case '-':
                    this.zoomOut();
                    break;
                case '0':
                    this.resetView();
                    break;
            }
        });
    }
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - this.offsetX) / this.zoom,
            y: (e.clientY - rect.top - this.offsetY) / this.zoom
        };
    }
    
    handleMouseDown(e) {
        e.preventDefault();
        const pos = this.getMousePos(e);
        
        if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
            // Middle mouse or Shift+Click for panning
            this.isPanning = true;
            this.lastPanPoint = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
            return;
        }
        
        if (e.button !== 0) return; // Only left click
        
        // Check if clicking on existing point
        const clickedPoint = this.getPointAt(pos);
        
        if (this.currentMode === 'delete') {
            if (clickedPoint) {
                this.deletePoint(clickedPoint);
                return;
            }
            
            const clickedLine = this.getLineAt(pos);
            if (clickedLine) {
                this.deleteLine(clickedLine);
                return;
            }
        }
        
        if (clickedPoint) {
            if (this.isDrawingLine && this.lineStart && this.lineStart !== clickedPoint) {
                // Complete line drawing
                this.addLine(this.lineStart, clickedPoint);
                this.isDrawingLine = false;
                this.lineStart = null;
                this.selectedPoint = null;
            } else {
                // Start line drawing or prepare for dragging
                this.selectedPoint = clickedPoint;
                this.lineStart = clickedPoint;
                this.isDrawingLine = true;
                this.draggedItem = clickedPoint;
            }
        } else {
            // Create new point and start line drawing
            const newPoint = this.addPoint(pos.x, pos.y);
            this.selectedPoint = newPoint;
            this.lineStart = newPoint;
            this.isDrawingLine = true;
        }
        
        this.redraw();
        this.updateStatus();
    }
    
    handleMouseMove(e) {
        const pos = this.getMousePos(e);
        
        if (this.isPanning) {
            const deltaX = e.clientX - this.lastPanPoint.x;
            const deltaY = e.clientY - this.lastPanPoint.y;
            this.offsetX += deltaX;
            this.offsetY += deltaY;
            this.lastPanPoint = { x: e.clientX, y: e.clientY };
            this.redraw();
            this.updateEvidencePositions();
            return;
        }
        
        if (this.draggedItem && !this.isDrawingLine) {
            this.isDragging = true;
            this.draggedItem.x = pos.x;
            this.draggedItem.y = pos.y;
            this.redraw();
            this.updateEvidencePositions();
        }
        
        // Update cursor based on hover
        const hoveredPoint = this.getPointAt(pos);
        this.canvas.style.cursor = hoveredPoint ? 'pointer' : 'crosshair';
        
        this.updateStatus(pos);
    }
    
    handleMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = 'crosshair';
        }
        
        this.isDragging = false;
        this.draggedItem = null;
    }
    
    handleRightClick(e) {
        e.preventDefault();
        const pos = this.getMousePos(e);
        
        this.contextMenuPos = pos;
        this.showContextMenu(e.clientX, e.clientY);
    }
    
    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoom *= delta;
        this.zoom = Math.max(0.1, Math.min(3, this.zoom));
        this.redraw();
        this.updateEvidencePositions();
        this.updateStatus();
    }
    
    getPointAt(pos) {
        const threshold = 15 / this.zoom;
        return this.points.find(point => {
            const dx = point.x - pos.x;
            const dy = point.y - pos.y;
            return Math.sqrt(dx * dx + dy * dy) < threshold;
        });
    }
    
    getLineAt(pos) {
        const threshold = 10 / this.zoom;
        return this.lines.find(line => {
            const distance = this.distanceToLine(pos, line.start, line.end);
            return distance < threshold;
        });
    }
    
    distanceToLine(point, lineStart, lineEnd) {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) return Math.sqrt(A * A + B * B);
        
        let param = dot / lenSq;
        
        let xx, yy;
        if (param < 0) {
            xx = lineStart.x;
            yy = lineStart.y;
        } else if (param > 1) {
            xx = lineEnd.x;
            yy = lineEnd.y;
        } else {
            xx = lineStart.x + param * C;
            yy = lineStart.y + param * D;
        }
        
        const dx = point.x - xx;
        const dy = point.y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    addPoint(x, y) {
        const point = {
            id: Date.now() + Math.random(),
            x: x,
            y: y,
            label: '',
            color: '#d4af37'
        };
        this.points.push(point);
        return point;
    }
    
    addLine(start, end) {
        const line = {
            id: Date.now() + Math.random(),
            start: start,
            end: end,
            color: this.currentLineColor,
            style: this.currentLineStyle,
            width: 2
        };
        this.lines.push(line);
        return line;
    }
    
    deletePoint(point) {
        // Remove all lines connected to this point
        this.lines = this.lines.filter(line => 
            line.start !== point && line.end !== point
        );
        
        // Remove the point
        this.points = this.points.filter(p => p !== point);
        
        this.redraw();
        this.updateStatus();
    }
    
    deleteLine(line) {
        this.lines = this.lines.filter(l => l !== line);
        this.redraw();
        this.updateStatus();
    }
    
    deleteSelected() {
        if (this.selectedPoint) {
            this.deletePoint(this.selectedPoint);
            this.selectedPoint = null;
        }
        if (this.selectedEvidence) {
            this.deleteEvidence(this.selectedEvidence);
            this.selectedEvidence = null;
        }
    }
    
    redraw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.zoom, this.zoom);
        
        // Draw lines
        this.lines.forEach(line => this.drawLine(line));
        
        // Draw preview line if drawing
        if (this.isDrawingLine && this.lineStart) {
            this.drawPreviewLine();
        }
        
        // Draw points
        this.points.forEach(point => this.drawPoint(point));
        
        this.ctx.restore();
    }
    
    drawLine(line) {
        this.ctx.beginPath();
        this.ctx.moveTo(line.start.x, line.start.y);
        this.ctx.lineTo(line.end.x, line.end.y);
        
        this.ctx.strokeStyle = line.color;
        this.ctx.lineWidth = line.width;
        
        // Set line style
        switch (line.style) {
            case 'dashed':
                this.ctx.setLineDash([10, 5]);
                break;
            case 'dotted':
                this.ctx.setLineDash([2, 3]);
                break;
            default:
                this.ctx.setLineDash([]);
        }
        
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }
    
    drawPreviewLine() {
        // This would draw a preview line from lineStart to mouse position
        // For now, we'll skip this as it requires mouse tracking
    }
    
    drawPoint(point) {
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, 8, 0, 2 * Math.PI);
        
        if (point === this.selectedPoint) {
            this.ctx.fillStyle = '#ff4444';
            this.ctx.strokeStyle = '#fff';
        } else {
            this.ctx.fillStyle = point.color;
            this.ctx.strokeStyle = '#333';
        }
        
        this.ctx.fill();
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Draw label if exists
        if (point.label) {
            this.ctx.fillStyle = '#000';
            this.ctx.font = '12px Arial';
            this.ctx.fillText(point.label, point.x + 12, point.y + 4);
        }
    }
    
    showContextMenu(x, y) {
        const menu = document.getElementById('contextMenu');
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.style.display = 'block';
        
        // Setup context menu actions
        document.getElementById('addConnectionHere').onclick = () => {
            this.hideContextMenu();
            if (this.contextMenuPos) {
                const newPoint = this.addPoint(this.contextMenuPos.x, this.contextMenuPos.y);
                this.redraw();
            }
        };
        
        document.getElementById('addEvidenceHere').onclick = () => {
            this.hideContextMenu();
            this.modalPos = this.contextMenuPos;
            this.showEvidenceModal();
        };
        
        document.getElementById('addNoteHere').onclick = () => {
            this.hideContextMenu();
            this.modalPos = this.contextMenuPos;
            this.showEvidenceModal('note');
        };
    }
    
    hideContextMenu() {
        document.getElementById('contextMenu').style.display = 'none';
    }
    
    showEvidenceModal(type = 'document', skipClear = false) {
        const modal = document.getElementById('evidenceModal');
        const typeSelect = document.getElementById('evidenceType');
        typeSelect.value = type;
        modal.style.display = 'flex';
        
        // Only clear form if not editing existing evidence
        if (!skipClear && !this.editingEvidence) {
            document.getElementById('evidenceTitle').value = '';
            document.getElementById('evidenceDescription').value = '';
            document.getElementById('evidenceImage').value = '';
            document.getElementById('evidencePriority').value = 'medium';
            
            // Reset button text
            document.getElementById('addEvidenceConfirm').textContent = 'Add Evidence';
        }
    }
    
    hideEvidenceModal() {
        document.getElementById('evidenceModal').style.display = 'none';
        this.modalPos = null;
        this.editingEvidence = null;
        
        // Reset button text
        document.getElementById('addEvidenceConfirm').textContent = 'Add Evidence';
    }
    
    addEvidence() {
        const title = document.getElementById('evidenceTitle').value;
        const description = document.getElementById('evidenceDescription').value;
        const type = document.getElementById('evidenceType').value;
        const priority = document.getElementById('evidencePriority').value;
        const imageFile = document.getElementById('evidenceImage').files[0];
        
        if (!title.trim()) {
            alert('Please enter a title for the evidence.');
            return;
        }
        
        if (this.editingEvidence) {
            // Update existing evidence
            this.editingEvidence.title = title;
            this.editingEvidence.description = description;
            this.editingEvidence.type = type;
            this.editingEvidence.priority = priority;
            
            if (imageFile) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.editingEvidence.image = e.target.result;
                    this.updateEvidenceElement(this.editingEvidence);
                    this.updateEvidenceList();
                    this.hideEvidenceModal();
                };
                reader.readAsDataURL(imageFile);
            } else {
                this.updateEvidenceElement(this.editingEvidence);
                this.updateEvidenceList();
                this.hideEvidenceModal();
            }
        } else {
            // Add new evidence
            const evidence = {
                id: Date.now() + Math.random(),
                title: title,
                description: description,
                type: type,
                priority: priority,
                x: this.modalPos ? this.modalPos.x : Math.random() * 400 + 100,
                y: this.modalPos ? this.modalPos.y : Math.random() * 400 + 100,
                image: null
            };
            
            if (imageFile) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    evidence.image = e.target.result;
                    this.createEvidenceElement(evidence);
                    this.evidenceItems.push(evidence);
                    this.updateEvidenceList();
                    this.hideEvidenceModal();
                };
                reader.readAsDataURL(imageFile);
            } else {
                this.createEvidenceElement(evidence);
                this.evidenceItems.push(evidence);
                this.updateEvidenceList();
                this.hideEvidenceModal();
            }
        }
    }
    
    createEvidenceElement(evidence) {
        const element = document.createElement('div');
        element.className = 'evidence-item';
        element.dataset.evidenceId = evidence.id;
        
        const screenX = evidence.x * this.zoom + this.offsetX;
        const screenY = evidence.y * this.zoom + this.offsetY;
        
        element.style.left = screenX + 'px';
        element.style.top = screenY + 'px';
        
        element.innerHTML = `
            <div class="evidence-header">
                <span class="evidence-type ${evidence.type}">${evidence.type.toUpperCase()}</span>
                <div class="evidence-priority ${evidence.priority}"></div>
            </div>
            <div class="evidence-content">
                <div class="evidence-title">${evidence.title}</div>
                <div class="evidence-description">${evidence.description}</div>
                ${evidence.image ? `<img src="${evidence.image}" class="evidence-image" alt="${evidence.title}">` : ''}
            </div>
        `;
        
        // Make draggable
        this.makeEvidenceDraggable(element, evidence);
        
        this.evidenceLayer.appendChild(element);
    }
    
    updateEvidenceElement(evidence) {
        const element = this.evidenceLayer.querySelector(`[data-evidence-id="${evidence.id}"]`);
        if (element) {
            element.innerHTML = `
                <div class="evidence-header">
                    <span class="evidence-type ${evidence.type}">${evidence.type.toUpperCase()}</span>
                    <div class="evidence-priority ${evidence.priority}"></div>
                </div>
                <div class="evidence-content">
                    <div class="evidence-title">${evidence.title}</div>
                    <div class="evidence-description">${evidence.description}</div>
                    ${evidence.image ? `<img src="${evidence.image}" class="evidence-image" alt="${evidence.title}">` : ''}
                </div>
            `;
        }
    }
    
    makeEvidenceDraggable(element, evidence) {
        let isDragging = false;
        let startX, startY, startMouseX, startMouseY;
        
        element.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            
            isDragging = true;
            startX = evidence.x;
            startY = evidence.y;
            startMouseX = e.clientX;
            startMouseY = e.clientY;
            
            this.selectedEvidence = evidence;
            element.classList.add('selected');
            
            // Remove selected class from other evidence
            this.evidenceLayer.querySelectorAll('.evidence-item').forEach(item => {
                if (item !== element) item.classList.remove('selected');
            });
            
            e.stopPropagation();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = (e.clientX - startMouseX) / this.zoom;
            const deltaY = (e.clientY - startMouseY) / this.zoom;
            
            evidence.x = startX + deltaX;
            evidence.y = startY + deltaY;
            
            const screenX = evidence.x * this.zoom + this.offsetX;
            const screenY = evidence.y * this.zoom + this.offsetY;
            
            element.style.left = screenX + 'px';
            element.style.top = screenY + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
        
        // Double-click to edit
        element.addEventListener('dblclick', () => {
            this.editEvidence(evidence);
        });
    }
    
    editEvidence(evidence) {
        // Store reference for updating
        this.editingEvidence = evidence;
        
        // Show modal without clearing form
        this.showEvidenceModal(evidence.type, true);
        
        // Fill form with existing data
        document.getElementById('evidenceTitle').value = evidence.title;
        document.getElementById('evidenceDescription').value = evidence.description;
        document.getElementById('evidenceType').value = evidence.type;
        document.getElementById('evidencePriority').value = evidence.priority;
        
        // Change button text
        document.getElementById('addEvidenceConfirm').textContent = 'Update Evidence';
    }
    
    deleteEvidence(evidence) {
        // Remove from array
        this.evidenceItems = this.evidenceItems.filter(item => item !== evidence);
        
        // Remove element from DOM
        const element = this.evidenceLayer.querySelector(`[data-evidence-id="${evidence.id}"]`);
        if (element) {
            element.remove();
        }
        
        this.updateEvidenceList();
        this.updateStatus();
    }
    
    updateEvidencePositions() {
        this.evidenceItems.forEach(evidence => {
            const element = this.evidenceLayer.querySelector(`[data-evidence-id="${evidence.id}"]`);
            if (element) {
                const screenX = evidence.x * this.zoom + this.offsetX;
                const screenY = evidence.y * this.zoom + this.offsetY;
                element.style.left = screenX + 'px';
                element.style.top = screenY + 'px';
                element.style.transform = `scale(${this.zoom})`;
            }
        });
    }
    
    updateEvidenceList() {
        const list = document.getElementById('evidenceList');
        list.innerHTML = '';
        
        this.evidenceItems.forEach(evidence => {
            const item = document.createElement('div');
            item.className = 'evidence-list-item';
            item.innerHTML = `
                <div class="title">${evidence.title}</div>
                <div class="type">${evidence.type} - ${evidence.priority} priority</div>
            `;
            
            item.addEventListener('click', () => {
                // Focus on evidence item
                const element = this.evidenceLayer.querySelector(`[data-evidence-id="${evidence.id}"]`);
                if (element) {
                    this.selectedEvidence = evidence;
                    this.evidenceLayer.querySelectorAll('.evidence-item').forEach(item => {
                        item.classList.remove('selected');
                    });
                    element.classList.add('selected');
                }
            });
            
            list.appendChild(item);
        });
    }
    
    toggleDeleteMode() {
        this.currentMode = this.currentMode === 'delete' ? 'drawing' : 'delete';
        this.canvas.style.cursor = this.currentMode === 'delete' ? 'crosshair' : 'crosshair';
        this.updateStatus();
    }
    
    clearSelection() {
        this.selectedPoint = null;
        this.selectedEvidence = null;
        this.isDrawingLine = false;
        this.lineStart = null;
        
        // Clear visual selections
        this.evidenceLayer.querySelectorAll('.evidence-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        this.redraw();
    }
    
    zoomIn() {
        this.zoom *= 1.2;
        this.zoom = Math.min(3, this.zoom);
        this.redraw();
        this.updateEvidencePositions();
        this.updateStatus();
    }
    
    zoomOut() {
        this.zoom *= 0.8;
        this.zoom = Math.max(0.1, this.zoom);
        this.redraw();
        this.updateEvidencePositions();
        this.updateStatus();
    }
    
    resetView() {
        this.zoom = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.redraw();
        this.updateEvidencePositions();
        this.updateStatus();
    }
    
    newCase(skipConfirm = false) {
        if (skipConfirm || confirm('Start a new case? This will clear all current data.')) {
            // Clear all data arrays
            this.points = [];
            this.lines = [];
            this.evidenceItems = [];
            
            // Clear selections and states
            this.selectedPoint = null;
            this.selectedEvidence = null;
            this.editingEvidence = null;
            this.draggedItem = null;
            this.isDragging = false;
            this.isDrawingLine = false;
            this.lineStart = null;
            this.modalPos = null;
            
            // Clear current mode states
            this.currentMode = 'drawing';
            const deleteBtn = document.getElementById('deleteMode');
            if (deleteBtn) {
                deleteBtn.classList.remove('active');
            }
            
            // Clear evidence layer completely
            this.evidenceLayer.innerHTML = '';
            
            // Reset UI elements
            document.getElementById('caseName').value = '';
            document.getElementById('caseNotes').value = '';
            
            // Hide modals and panels
            this.hideEvidenceModal();
            this.hideContextMenu();
            
            // Reset viewport
            this.zoom = 1;
            this.offsetX = 0;
            this.offsetY = 0;
            
            // Redraw and update
            this.redraw();
            this.updateEvidenceList();
            this.updateStatus();
        }
    }
    
    saveCase() {
        const caseData = {
            name: document.getElementById('caseName').value || 'Untitled Case',
            notes: document.getElementById('caseNotes').value || '',
            points: this.points,
            lines: this.lines,
            evidence: this.evidenceItems,
            viewport: {
                zoom: this.zoom,
                offsetX: this.offsetX,
                offsetY: this.offsetY
            },
            timestamp: new Date().toISOString()
        };
        
        const encryptedData = this.encryptCaseData(caseData);
        const dataBlob = new Blob([encryptedData], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `${caseData.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
        link.click();
    }
    
    loadCase() {
        const input = document.getElementById('fileInput');
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    let caseData;
                    const fileContent = e.target.result;
                    
                    // First try to decrypt the data
                    caseData = this.decryptCaseData(fileContent);
                    
                    // If decryption failed, try parsing as regular JSON (backward compatibility)
                    if (!caseData) {
                        caseData = JSON.parse(fileContent);
                    }
                    
                    this.loadCaseData(caseData);
                } catch (error) {
                    alert('Error loading case file: ' + error.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
    
    loadCaseData(caseData) {
        // Clear current data without confirmation
        this.newCase(true);
        
        // Load case data
        this.points = caseData.points || [];
        this.lines = caseData.lines || [];
        this.evidenceItems = caseData.evidence || [];
        
        if (caseData.viewport) {
            this.zoom = caseData.viewport.zoom || 1;
            this.offsetX = caseData.viewport.offsetX || 0;
            this.offsetY = caseData.viewport.offsetY || 0;
        }
        
        // Update UI
        document.getElementById('caseName').value = caseData.name || '';
        document.getElementById('caseNotes').value = caseData.notes || '';
        
        // Recreate evidence elements
        this.evidenceItems.forEach(evidence => {
            this.createEvidenceElement(evidence);
        });
        
        this.redraw();
        this.updateEvidenceList();
        this.updateStatus();
    }
    
    autoSave() {
        if (this.points.length > 0 || this.evidenceItems.length > 0) {
            const caseData = {
                name: document.getElementById('caseName').value || 'Auto-saved Case',
                notes: document.getElementById('caseNotes').value || '',
                points: this.points,
                lines: this.lines,
                evidence: this.evidenceItems,
                viewport: {
                    zoom: this.zoom,
                    offsetX: this.offsetX,
                    offsetY: this.offsetY
                },
                timestamp: new Date().toISOString()
            };
            
            localStorage.setItem('detectivePinboard_autosave', JSON.stringify(caseData));
        }
    }
    
    loadAutoSave() {
        const saved = localStorage.getItem('detectivePinboard_autosave');
        if (saved) {
            try {
                const caseData = JSON.parse(saved);
                if (confirm('Load auto-saved case data?')) {
                    this.loadCaseData(caseData);
                }
            } catch (error) {
                console.error('Error loading auto-save:', error);
            }
        }
    }
    
    updateStatus(mousePos = null) {
        const modeText = this.currentMode === 'delete' ? 'Delete Mode' : 'Drawing Mode';
        document.getElementById('modeStatus').textContent = `Mode: ${modeText}`;
        
        if (mousePos) {
            document.getElementById('coordStatus').textContent = 
                `Position: (${Math.round(mousePos.x)}, ${Math.round(mousePos.y)})`;
        }
        
        document.getElementById('zoomStatus').textContent = `Zoom: ${Math.round(this.zoom * 100)}%`;
        document.getElementById('evidenceCount').textContent = `Evidence: ${this.evidenceItems.length}`;
    }
    
    // Caesar cipher encryption/decryption
    caesarEncrypt(text, shift = 13) {
        return text.split('').map(char => {
            if (char.match(/[a-z]/i)) {
                const code = char.charCodeAt(0);
                const base = code >= 65 && code <= 90 ? 65 : 97;
                return String.fromCharCode(((code - base + shift) % 26) + base);
            }
            return char;
        }).join('');
    }
    
    caesarDecrypt(text, shift = 13) {
        return this.caesarEncrypt(text, 26 - shift);
    }
    
    encryptCaseData(data) {
        const jsonString = JSON.stringify(data);
        return this.caesarEncrypt(jsonString);
    }
    
    decryptCaseData(encryptedData) {
        try {
            const decryptedString = this.caesarDecrypt(encryptedData);
            return JSON.parse(decryptedString);
        } catch (error) {
            console.error('Failed to decrypt case data:', error);
            return null;
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const pinboard = new DetectivePinboard();
    
    // Load auto-save after a short delay
    setTimeout(() => {
        pinboard.loadAutoSave();
    }, 1000);
    
    // Make pinboard globally accessible for debugging
    window.pinboard = pinboard;
});
