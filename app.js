// SUPABASE CONFIGURATION
const SUPABASE_URL = "https://your-supabase-url.supabase.co"; // Replace with your URL
const SUPABASE_ANON_KEY = "your-anon-key";                   // Replace with your Key

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ADMIN AUTHENTICATION
const ADMIN_PASSWORD = "mukhty-22";

document.addEventListener("DOMContentLoaded", () => {
  const authForm = document.getElementById("auth-form");
  const authOverlay = document.getElementById("auth-overlay");
  const logoutBtn = document.getElementById("logout-btn");

  // Check login status on page load
  if (sessionStorage.getItem("entrii_admin_logged") === "true") {
    authOverlay.classList.add("hidden");
    loadDashboardData();
  }

  // Handle Login Submit
  if (authForm) {
    authForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const passwordInput = document.getElementById("auth-password").value;

      if (passwordInput === ADMIN_PASSWORD) {
        sessionStorage.setItem("entrii_admin_logged", "true");
        authOverlay.classList.add("hidden");
        loadDashboardData();
      } else {
        alert("Incorrect password!");
      }
    });
  }

  // Handle Logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem("entrii_admin_logged");
      location.reload();
    });
  }
});

// FETCH & RENDER DASHBOARD DATA
async function loadDashboardData() {
  try {
    const { data: events, error } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Update Analytics Numbers
    document.getElementById("stat-total-events").textContent = events ? events.length : 0;

    // Render Table Rows
    const tbody = document.getElementById("events-table-body");
    tbody.innerHTML = "";

    if (!events || events.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-gray-500">No events found. Create one to get started!</td></tr>`;
      return;
    }

    events.forEach((event) => {
      const row = document.createElement("tr");
      row.className = "hover:bg-brand-surface/50 transition";
      row.innerHTML = `
        <td class="py-3 px-4 font-semibold text-white">${event.title || event.name}</td>
        <td class="py-3 px-4 uppercase">${event.type || "Free"} ${event.price ? " - ₦" + event.price : ""}</td>
        <td class="py-3 px-4">${event.date || "N/A"}</td>
        <td class="py-3 px-4">${event.capacity || "Unlimited"}</td>
        <td class="py-3 px-4 text-right space-x-2">
          <button onclick="copyEventLink('${event.slug}')" class="text-brand hover:underline">Copy Link</button>
          <button onclick="deleteEvent('${event.id}')" class="text-red-400 hover:underline">Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error("Error loading dashboard data:", err.message);
  }
}

// CREATE NEW EVENT
const createEventForm = document.getElementById("create-event-form");
if (createEventForm) {
  createEventForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const newEvent = {
      title: document.getElementById("event-name").value,
      slug: document.getElementById("event-slug").value,
      date: document.getElementById("event-date").value,
      time: document.getElementById("event-time").value,
      venue: document.getElementById("event-venue").value,
      city: document.getElementById("event-city").value,
      type: document.getElementById("event-type").value,
      capacity: parseInt(document.getElementById("event-capacity").value),
      price: parseFloat(document.getElementById("event-price")?.value || 0)
    };

    const { error } = await supabase.from("events").insert([newEvent]);

    if (error) {
      alert("Failed to publish event: " + error.message);
    } else {
      alert("Event published successfully!");
      createEventForm.reset();
      loadDashboardData();
    }
  });
}

// DELETE EVENT
async function deleteEvent(eventId) {
  if (confirm("Are you sure you want to delete this event?")) {
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) {
      alert("Failed to delete event: " + error.message);
    } else {
      loadDashboardData();
    }
  }
}

// REFRESH BUTTON
const refreshBtn = document.getElementById("refresh-events-btn");
if (refreshBtn) {
  refreshBtn.addEventListener("click", loadDashboardData);
}

// LIVE TABLE SEARCH (EVENTS)
const searchInput = document.getElementById("search-events-input");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    const rows = document.querySelectorAll("#events-table-body tr");

    rows.forEach((row) => {
      const eventTitle = row.cells[0]?.textContent.toLowerCase() || "";
      if (eventTitle.includes(searchTerm)) {
        row.style.display = "";
      } else {
        row.style.display = "none";
      }
    });
  });
}

// HELPER: COPY LINK
function copyEventLink(slug) {
  const url = `${window.location.origin}/event.html?slug=${slug}`;
  navigator.clipboard.writeText(url).then(() => {
    alert("Event URL copied to clipboard:\n" + url);
  });
}