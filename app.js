Const SUPABASE_URL = "https://cwshmvrsucmklspqghll.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3c2htdnJzdWNta2xzcHFnaGxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMjE3MTUsImV4cCI6MjEwMzg5NzcxNX0.gwE37PnjKXM49ck8lrGKvWmTMm3tvd5F3AYMAvv08SY";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


const authOverlay = document.getElementById('auth-overlay');

const authForm = document.getElementById('auth-form');

const logoutBtn = document.getElementById('logout-btn');

const nameInput = document.getElementById('event-name');

const slugInput = document.getElementById('event-slug');

const typeSelect = document.getElementById('event-type');

const priceContainer = document.getElementById('price-container');

const priceInput = document.getElementById('event-price');

const createForm = document.getElementById('create-event-form');


// Auth Session Check

window.addEventListener('DOMContentLoaded', () => {

const session = localStorage.getItem('entrii_admin_session');

if (session === 'active') {

authOverlay.classList.add('hidden');

loadOrganizerData();

}

});


// Password Check

authForm.addEventListener('submit', (e) => {

e.preventDefault();

const enteredPassword = document.getElementById('auth-password').value.trim();

const ADMIN_PASSWORD = "mukhty-22"; 


if (enteredPassword === ADMIN_PASSWORD) {

localStorage.setItem('entrii_admin_session', 'active');

authOverlay.classList.add('hidden');

loadOrganizerData();

} else {

alert("Incorrect password. Access denied.");

document.getElementById('auth-password').value = "";

}

});


// Logout

logoutBtn.addEventListener('click', () => {

localStorage.removeItem('entrii_admin_session');

authOverlay.classList.remove('hidden');

});


// Auto-generate Slug

nameInput.addEventListener('input', () => {

slugInput.value = nameInput.value.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

});


// Toggle Price Input

typeSelect.addEventListener('change', () => {

if (typeSelect.value === 'paid') {

priceContainer.classList.remove('hidden');

} else {

priceContainer.classList.add('hidden');

priceInput.value = 0;

}

});


// Fetch and Display Events

async function loadOrganizerData() {

try {

const response = await fetch(`${SUPABASE_URL}/rest/v1/events?select=*&order=id.desc`, {

method: 'GET',

headers: {

'apikey': SUPABASE_ANON_KEY,

'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,

'Content-Type': 'application/json'

}

});


if (!response.ok) return;

const events = await response.json();


const guestsResponse = await fetch(`${SUPABASE_URL}/rest/v1/guests?select=*`, {

method: 'GET',

headers: {

'apikey': SUPABASE_ANON_KEY,

'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,

'Content-Type': 'application/json'

}

});

const guests = guestsResponse.ok ? await guestsResponse.json() : [];


document.getElementById('stat-total-events').textContent = events.length;

document.getElementById('stat-total-guests').textContent = guests.length;

document.getElementById('stat-total-checkedin').textContent = guests.filter(g => g.checked_in).length;


const tableBody = document.getElementById('events-table-body');

if (!tableBody) return;


if (!events || events.length === 0) {

tableBody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-gray-400">No events found.</td></tr>`;

return;

}


tableBody.innerHTML = '';

events.forEach(event => {

const eventGuests = guests ? guests.filter(g => g.event_id === event.id) : [];

const tr = document.createElement('tr');

tr.className = "hover:bg-brand-surface/50 transition-colors";


const isPaid = event.type === 'paid';

const priceBadge = isPaid 

? `<span class="text-emerald-400">₦${Number(event.price).toLocaleString()}</span>` 

: `<span class="text-gray-400">Free</span>`;


tr.innerHTML = `

<td class="py-3.5 px-4 font-bold text-white">${event.name}</td>

<td class="py-3.5 px-4 text-gray-300">${new Date(event.date).toLocaleDateString()}</td>

<td class="py-3.5 px-4">${priceBadge}</td>

<td class="py-3.5 px-4 text-gray-300">${eventGuests.length} registered</td>

<td class="py-3.5 px-4 text-right space-x-2">

<button onclick="copyLink('ticket.html?slug=${event.slug || event.id}')" class="text-brand-accent hover:underline text-sm font-semibold">Copy Link</button>

<button onclick="deleteEvent('${event.id}', '${event.name}')" class="text-red-400 hover:underline text-sm font-semibold">Delete</button>

</td>

`;

tableBody.appendChild(tr);

});


} catch (err) {

console.error("Network error:", err);

}

}


// Publish Event

createForm.addEventListener('submit', async (e) => {

e.preventDefault();

const btn = document.getElementById('create-event-btn');

btn.disabled = true;

btn.textContent = "Publishing...";


const dateVal = document.getElementById('event-date').value;

const timeVal = document.getElementById('event-time').value;


const eventPayload = {

name: nameInput.value.trim(),

slug: slugInput.value.trim(),

date: dateVal,

event_date: dateVal,

time: timeVal,

event_time: timeVal,

venue: document.getElementById('event-venue').value.trim(),

city: document.getElementById('event-city').value.trim(),

type: typeSelect.value,

price: typeSelect.value === 'paid' ? parseFloat(priceInput.value) || 0 : 0,

capacity: parseInt(document.getElementById('event-capacity').value) || 100,

subaccount_code: document.getElementById('event-subaccount').value.trim()

};


try {

const { error } = await supabaseClient.from('events').insert([eventPayload]);

if (error) {

alert('Failed to publish: ' + error.message);

} else {

alert('Event published successfully!');

createForm.reset();

priceContainer.classList.add('hidden');

loadOrganizerData();

}

} catch (err) {

alert('An unexpected error occurred.');

} finally {

btn.disabled = false;

btn.textContent = "Publish Event";

}

});


// Delete Event

async function deleteEvent(eventId, eventName) {

if (!confirm(`Delete "${eventName}"? This will remove all associated ticket records.`)) return;


try {

await supabaseClient.from('guests').delete().eq('event_id', eventId);

const { error } = await supabaseClient.from('events').delete().eq('id', eventId);

if (error) {

alert('Error: ' + error.message);

} else {

alert('Event deleted.');

loadOrganizerData();

}

} catch (err) {

alert('Delete failed.');

}

}


// Copy Link Utility

function copyLink(path) {

const currentUrl = window.location.href;

const baseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/'));

const fullUrl = `${baseUrl}/${path}`;


navigator.clipboard.writeText(fullUrl).then(() => {

alert('Copied link:\n' + fullUrl);

}).catch(() => {

prompt('Copy this link manually:', fullUrl);

});

}


document.getElementById('refresh-events-btn').addEventListener('click', loadOrganizerData);


// Search Functionality

const searchInput = document.getElementById('search-events-input');

if (searchInput) {

searchInput.addEventListener('input', (e) => {

const searchTerm = e.target.value.toLowerCase().trim();

const rows = document.querySelectorAll('#events-table-body tr');


rows.forEach(row => {

const eventName = row.cells[0]?.textContent.toLowerCase() || '';

if (eventName.includes(searchTerm)) {

row.style.display = '';

} else {

row.style.display = 'none';

}

});

});

}