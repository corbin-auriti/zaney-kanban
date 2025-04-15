// State (in-memory, replace with localStorage for persistence)
let tasks = [
    // { id: 1, text: "Design wacky UI", status: "done" },
    // { id: 2, text: "Implement drag n drop", status: "inprogress" },
    // { id: 3, text: "Add ADHD mode", status: "todo" },
    // { id: 4, text: "Find 90s sounds", status: "todo" }
];
let nextTaskId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
let currentlyFocusedTaskId = null;

// DOM Elements
const columns = {
    todo: document.querySelector('#todo .tasks'),
    inprogress: document.querySelector('#inprogress .tasks'),
    done: document.querySelector('#done .tasks')
};
const addTaskBtn = document.getElementById('add-task-btn');
const newTaskInput = document.getElementById('new-task-input');
const focusOverlay = document.getElementById('focus-overlay');
const focusTaskContainer = document.querySelector('.focus-task-container');
const focusTaskTitle = document.getElementById('focus-task-title');
const focusTaskDesc = document.getElementById('focus-task-desc'); // Placeholder
const focusCompleteBtn = document.getElementById('focus-complete-btn');
const focusNextBtn = document.getElementById('focus-next-btn');
const focusBackBtn = document.getElementById('focus-back-btn');

// --- Core Kanban Logic ---

function renderTasks() {
    // Clear existing tasks from columns
    Object.values(columns).forEach(col => col.innerHTML = '');

    // Render tasks into appropriate columns
    tasks.forEach(task => {
        const taskElement = createTaskElement(task);
        columns[task.status].appendChild(taskElement);
    });

    // Re-attach task click listeners after rendering
    attachTaskClickListeners();
}

function createTaskElement(task) {
    const div = document.createElement('div');
    div.classList.add('task');
    div.setAttribute('draggable', 'true');
    div.setAttribute('data-task-id', task.id);
    div.textContent = task.text;

    // Drag and Drop Event Listeners for the task
    div.addEventListener('dragstart', dragStart);
    div.addEventListener('dragend', dragEnd);

    return div;
}

function addTask() {
    const taskText = newTaskInput.value.trim();
    if (taskText === '') return; // Don't add empty tasks

    const newTask = {
        id: nextTaskId++,
        text: taskText,
        status: 'todo' // New tasks always start in 'todo'
    };
    tasks.push(newTask);
    newTaskInput.value = ''; // Clear input field
    renderTasks();
    playSound('add'); // Optional: sound for adding
}

// --- Drag and Drop Handlers ---

let draggedItemId = null;

function dragStart(event) {
    draggedItemId = event.target.getAttribute('data-task-id');
    event.dataTransfer.setData('text/plain', draggedItemId);
    // Add visual cue for dragging
    setTimeout(() => event.target.classList.add('dragging'), 0);
    playSound('drag'); // Optional: sound for drag start
}

function dragEnd(event) {
    event.target.classList.remove('dragging');
    draggedItemId = null;
}

function allowDrop(event) {
    event.preventDefault(); // Necessary to allow dropping
}

function dragEnter(event) {
    if (event.target.classList.contains('column') || event.target.classList.contains('tasks')) {
       const columnElement = event.target.closest('.column');
       if (columnElement) {
           columnElement.classList.add('drag-over');
       }
    }
}

function dragLeave(event) {
     if (event.target.classList.contains('column') || event.target.classList.contains('tasks')) {
        const columnElement = event.target.closest('.column');
        if (columnElement) {
           columnElement.classList.remove('drag-over');
        }
    }
}


function drop(event) {
    event.preventDefault();
    const columnElement = event.target.closest('.column');
    if (!columnElement) return; // Didn't drop on a valid column area

    columnElement.classList.remove('drag-over');
    const taskId = event.dataTransfer.getData('text/plain');
    const targetStatus = columnElement.id; // 'todo', 'inprogress', 'done'
    const task = tasks.find(t => t.id == taskId); // Use == for type coercion if needed, === is safer

    if (task && task.status !== targetStatus) {
        const previousStatus = task.status;
        task.status = targetStatus;

        // Trigger completion effect if moved to 'done'
        if (targetStatus === 'done' && previousStatus !== 'done') {
            triggerCompletionEffect(taskId);
        } else {
            renderTasks(); // Just re-render normally
            playSound('drop'); // Optional: sound for drop
        }
    }
}

// --- Task Completion Effect ---

function triggerCompletionEffect(taskId) {
    const taskElement = document.querySelector(`.task[data-task-id="${taskId}"]`);
    if (taskElement) {
        playSound('complete'); // Play completion sound
        taskElement.classList.add('completed-animation');
        // Remove the element after the animation completes
        taskElement.addEventListener('animationend', () => {
            renderTasks(); // Re-render the board to reflect the change accurately
        }, { once: true }); // Ensure listener runs only once
    } else {
        // If element wasn't found (e.g., already removed), just render
        renderTasks();
    }
}

// --- ADHD Focus Mode ---

function attachTaskClickListeners() {
    document.querySelectorAll('.task').forEach(taskElement => {
        // Remove any old listener first to prevent duplicates
        taskElement.removeEventListener('click', handleTaskClick);
        // Add the new listener
        taskElement.addEventListener('click', handleTaskClick);
    });
}

function handleTaskClick(event) {
    // Prevent focus mode when dragging
    if (event.target.classList.contains('dragging')) {
        return;
    }
    const taskId = event.target.getAttribute('data-task-id');
    enterFocusMode(taskId);
}

function enterFocusMode(taskId) {
    const task = tasks.find(t => t.id == taskId);
    if (!task) return;

    currentlyFocusedTaskId = taskId;
    focusTaskTitle.textContent = task.text;
    // focusTaskDesc.textContent = `Details for task ${task.id} would show here.`; // Example

    focusOverlay.style.display = 'flex'; // Use flex to enable centering
    // Delay adding 'visible' class to allow CSS transition
    setTimeout(() => {
        focusOverlay.classList.add('visible');
        focusTaskContainer.style.opacity = '1'; // Ensure container is visible for transform
        focusTaskContainer.style.transform = 'scale(1)';
        playSound('focus'); // Optional: sound for focus zoom
    }, 50); // Small delay
}

function exitFocusMode() {
    focusOverlay.classList.remove('visible');
    focusTaskContainer.style.transform = 'scale(0.1)'; // Zoom out animation

    // Wait for opacity transition to finish before hiding
    setTimeout(() => {
        focusOverlay.style.display = 'none';
        currentlyFocusedTaskId = null;
    }, 500); // Match CSS transition duration
}

function focusCompleteTask() {
    if (!currentlyFocusedTaskId) return;
    const task = tasks.find(t => t.id == currentlyFocusedTaskId);
    if (task) {
        task.status = 'done';
        const taskIdToAnimate = currentlyFocusedTaskId; // Store before clearing
        exitFocusMode();
        // Trigger completion effect *after* exiting focus mode
        setTimeout(() => triggerCompletionEffect(taskIdToAnimate), 550); // Delay slightly more than exit anim
    }
}

function focusNextTask() {
    if (!currentlyFocusedTaskId) return;

    const currentTask = tasks.find(t => t.id == currentlyFocusedTaskId);
    if (!currentTask) return;

    const tasksInSameColumn = tasks.filter(t => t.status === currentTask.status);
    const currentIndex = tasksInSameColumn.findIndex(t => t.id == currentlyFocusedTaskId);

    if (currentIndex !== -1 && currentIndex < tasksInSameColumn.length - 1) {
        // There is a next task in the same column
        const nextTask = tasksInSameColumn[currentIndex + 1];
        // Exit current focus smoothly then enter next
        focusTaskContainer.style.transform = 'scale(0.1)';
        focusTaskContainer.style.opacity = '0';
        setTimeout(() => {
            enterFocusMode(nextTask.id);
        }, 400); // Adjust timing as needed
    } else {
        // No more tasks in this column, just exit
        playSound('denied'); // Optional: sound indicating no next task
        exitFocusMode();
    }
}

// --- Sound Function (Placeholder) ---

function playSound(type) {
    console.log(`Playing sound: ${type}`); // Log sound type
    // Replace with actual audio playback using the Audio API
    // Example:
    // const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    // let soundUrl = '';
    // if (type === 'complete') soundUrl = 'sounds/complete.wav';
    // else if (type === 'drop') soundUrl = 'sounds/drop.wav';
    // // ... other sounds
    // if (soundUrl) {
    //     const sound = new Audio(soundUrl);
    //     sound.play().catch(e => console.error("Audio playback failed:", e));
    // }

    // Simple Alert Placeholder (REMOVE FOR REAL SOUNDS)
    // if (type === 'complete') {
    //     // Using console log instead of alert to avoid blocking
    //     console.log("✨ Task Complete! ✨");
    // }
}


// --- Event Listeners ---

addTaskBtn.addEventListener('click', addTask);
newTaskInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        addTask();
    }
});

// Focus Mode Button Listeners
focusCompleteBtn.addEventListener('click', focusCompleteTask);
focusNextBtn.addEventListener('click', focusNextTask);
focusBackBtn.addEventListener('click', exitFocusMode);
// Optional: Close focus mode if clicking outside the task container
focusOverlay.addEventListener('click', (event) => {
    if (event.target === focusOverlay) { // Clicked on the overlay background itself
        exitFocusMode();
    }
});


// --- Initial Render ---
document.addEventListener('DOMContentLoaded', () => {
    // Add some default tasks if needed for testing
    if (tasks.length === 0) {
         tasks = [
            { id: 1, text: "Design wacky UI", status: "done" },
            { id: 2, text: "Implement drag n drop", status: "inprogress" },
            { id: 3, text: "Add ADHD mode", status: "todo" },
            { id: 4, text: "Find 90s sounds", status: "todo" }
        ];
        nextTaskId = 5;
    }
    renderTasks();
});