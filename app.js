// SUPABASE CONFIGURATION
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// GLOBAL STATE
let allEvents = [];
let currentEventGuests = [];

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  setupEventListeners();
});

// AUTHENTICATION MANAGEMENT
function initAuth() {
  const session = supabaseClient.auth.getSession();
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
      document.getElementById('auth-overlay')?.classList.add('hidden');
      loadOrganizerData();
    } else {
      document.getElementById('auth-overlay')?.classList.remove('hidden');
    }
  });
}

document.getElementById('auth-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const btn = document.getElementById('auth-btn');

  btn.disabled = true;
  btn.textContent = 'Signing in...';

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    alert('Authentication error: ' + error.message);
    btn.disabled = false;
    btn.textContent = 'Sign In to Dashboard';
  }
});

document.getElementById('logout-btn')?.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.reload();
});

// EVENT FORM LOGIC
document.getElementById('event-type')?.addEventListener('change', (e) => {
  const priceContainer = document.getElementById('price-container');
  if (e.target.value === 'paid') {
    priceContainer?.classList.remove('hidden');
  } else {
    priceContainer?.classList.add('hidden');
  }
});

document.getElementById('create-event-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('create-event-btn');
  btn.disabled = true;
  btn.textContent = 'Publishing...';

  const user = (await supabaseClient.auth.getUser()).data.user;

  const eventData = {
    user_id: user.id,
    name: document.getElementById('event-name').value,
    slug: document.getElementById('event-slug').value,
    date: document.getElementById('event-date').value,
    time: document.getElementById('event-time').value,
    venue: document.getElementById('event-venue').value,
    city: document.getElementById('event-city').value,
    type: document.getElementById('event-type').value,
    capacity: parseInt(document.getElementById('event-capacity').value) || 100,
    price: document.getElementById('event-type').value === 'paid' 
      ? parseFloat(document.getElementById('event-price').value) || 0 
      : 0,
    subaccount_code: document.getElementById('event-subaccount')?.value || null
  };

  const { error } = await supabaseClient.from('events').insert([eventData]);

  if (error) {
    alert('Error creating event: ' + error.message);
  } else {
    document.getElementById('create-event-form').reset();
    document.getElementById('price-container')?.classList.add('hidden');
    loadOrganizerData();
  }

  btn.disabled = false;
  btn.textContent = 'Publish Event';
});

// DATA FETCHING & EVENT TABLE RENDER
async function loadOrganizerData() {
  try {
    const user = (await supabaseClient.auth.getUser()).data.user;
    if (!user) return;

    // Fetch Events with count of registered guests
    const { data: events, error: eventsErr } = await supabaseClient
      .from('events')
      .select('*, guests(count)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (eventsErr) throw eventsErr;
    allEvents = events || [];

    // Fetch Total Analytics
    const { count: totalTickets } = await supabaseClient.from('guests').select('*', { count: 'exact', head: true });
    const { count: totalCheckedIn } = await supabaseClient.from('guests').select('*', { count: 'exact', head: true }).eq('checked_in', true);

    document.getElementById('stat-total-events').textContent = allEvents.length;
    document.getElementById('stat-total-guests').textContent = totalTickets || 0;
    document.getElementById('stat-total-checkedin').textContent = totalCheckedIn || 0;

    renderEventsTable(allEvents);
  } catch (err) {
    console.error('Failed to load dashboard data:', err);
  }
}

function renderEventsTable(events) {
  const tbody = document.getElementById('events-table-body');
  if (!tbody) return;

  if (events.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-gray-500">No events found.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  events.forEach(event => {
    const registeredCount = event.guests ? event.guests[0]?.count || 0 : 0;
    const priceDisplay = event.type === 'paid' ? `₦${Number(event.price).toLocaleString()}` : 'Free';

    const tr = document.createElement('tr');
    tr.className = "hover:bg-brand-surface/50 transition-colors border-b border-brand-border";

    // FIXED COLUMN ALIGNMENT:
    // 1. Event Title
    // 2. Type / Price
    // 3. Date
    // 4. Capacity (Registered / Capacity)
    // 5. Actions (Guests | Copy Link | Delete)
    tr.innerHTML = `
      <td class="py-3.5 px-4 font-bold text-white">${event.name}</td>
      <td class="py-3.5 px-4 text-gray-300">${priceDisplay}</td>
      <td class="py-3.5 px-4 text-gray-300">${event.date || 'N/A'}</td>
      <td class="py-3.5 px-4 text-gray-300">${registeredCount} / ${event.capacity} registered</td>
      <td class="py-3.5 px-4 text-right space-x-2">
        <button onclick="openGuestModal('${event.id}', '${event.name.replace(/'/g, "\\'")}')" class="text-emerald-400 hover:underline text-xs font-bold">
          Guests
        </button>
        <button onclick="copyLink('${event.slug || event.id}')" class="text-brand hover:underline text-xs font-semibold">
          Copy Link
        </button>
        <button onclick="deleteEvent('${event.id}', '${event.name.replace(/'/g, "\\'")}')" class="text-red-400 hover:underline text-xs font-semibold">
          Delete
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// EVENT SEARCH FILTER
document.getElementById('search-events-input')?.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  const filtered = allEvents.filter(evt => evt.name.toLowerCase().includes(query));
  renderEventsTable(filtered);
});

document.getElementById('refresh-events-btn')?.addEventListener('click', loadOrganizerData);

// GUEST SEARCH MODAL & MANUAL CHECK-IN
async function openGuestModal(eventId, eventName) {
  const modal = document.getElementById('guest-modal');
  const title = document.getElementById('modal-event-title');
  const tbody = document.getElementById('guests-modal-body');

  if (!modal) return;

  title.textContent = `Guests: ${eventName}`;
  tbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-gray-400">Loading guests...</td></tr>`;
  modal.classList.remove('hidden');

  try {
    const { data: guests, error } = await supabaseClient
      .from('guests')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    currentEventGuests = guests || [];
    renderGuestList(currentEventGuests);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-red-400">Failed to load guest list.</td></tr>`;
  }
}

function renderGuestList(guests) {
  const tbody = document.getElementById('guests-modal-body');
  if (!tbody) return;

  if (guests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-gray-500">No guests found for this event.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  guests.forEach(guest => {
    const tr = document.createElement('tr');
    tr.className = "border-b border-brand-border/50";

    const isCheckedIn = guest.checked_in;
    const status = isCheckedIn 
      ? `<span class="text-emerald-400 font-bold">Checked In</span>` 
      : `<span class="text-amber-400 font-bold">Pending</span>`;

    const action = isCheckedIn
      ? `<span class="text-gray-500 text-xs">Verified</span>`
      : `<button onclick="manualCheckIn('${guest.id}')" class="bg-brand text-black px-3 py-1 rounded-lg text-xs font-black hover:bg-brand-hover">Check In</button>`;

    tr.innerHTML = `
      <td class="py-2.5 px-3 font-medium text-white">${guest.name || guest.full_name || 'N/A'}</td>
      <td class="py-2.5 px-3 text-gray-400">${guest.email || 'N/A'}</td>
      <td class="py-2.5 px-3">${status}</td>
      <td class="py-2.5 px-3 text-right">${action}</td>
    `;
    tbody.appendChild(tr);
  });
}

// SEARCH PERSON BY NAME OR EMAIL WITHIN AN EVENT
document.getElementById('search-guests-input')?.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  const filtered = currentEventGuests.filter(g => 
    (g.name && g.name.toLowerCase().includes(query)) ||
    (g.full_name && g.full_name.toLowerCase().includes(query)) ||
    (g.email && g.email.toLowerCase().includes(query))
  );
  renderGuestList(filtered);
});

// MANUAL CHECK-IN ACTION
async function manualCheckIn(guestId) {
  try {
    const { error } = await supabaseClient
      .from('guests')
      .update({ checked_in: true })
      .eq('id', guestId);

    if (error) throw error;

    const guest = currentEventGuests.find(g => g.id === guestId);
    if (guest) guest.checked_in = true;
    renderGuestList(currentEventGuests);
    loadOrganizerData();
  } catch (err) {
    alert('Check-in failed: ' + err.message);
  }
}

// UTILITY FUNCTIONS
function copyLink(slug) {
  const url = `${window.location.origin}/ticket.html?slug=${slug}`;
  navigator.clipboard.writeText(url);
  alert('Event link copied to clipboard!');
}

async function deleteEvent(eventId, eventName) {
  if (!confirm(`Are you sure you want to delete "${eventName}"?`)) return;

  const { error } = await supabaseClient.from('events').delete().eq('id', eventId);
  if (error) {
    alert('Delete failed: ' + error.message);
  } else {
    loadOrganizerData();
  }
}

// MODAL EVENT LISTENERS
document.getElementById('close-guest-modal')?.addEventListener('click', () => {
  document.getElementById('guest-modal')?.classList.add('hidden');
});