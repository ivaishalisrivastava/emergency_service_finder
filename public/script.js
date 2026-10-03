// ================= MAP INITIALIZATION =================
const map = L.map("map").setView([28.6139, 77.2090], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

let serviceMarkers = [];
let userLat = null;
let userLon = null;

// ================= DOM ELEMENTS =================
const locationInput = document.getElementById("locationInput");
const findServicesBtn = document.getElementById("findServicesBtn");
const serviceCards = document.querySelectorAll(".service-card");
const listContainer = document.getElementById("nearbyList");

// ================= LOCATION EVENT HANDLER =================
findServicesBtn.addEventListener("click", function () {
    if (!navigator.geolocation) {
        alert("Your browser does not support geolocation.");
        return;
    }

    findServicesBtn.innerHTML = "Finding...";

    navigator.geolocation.getCurrentPosition(
        async function (position) {
            userLat = position.coords.latitude;
            userLon = position.coords.longitude;

            // Center map on user location
            map.setView([userLat, userLon], 14);

            // User Location Marker
            L.marker([userLat, userLon])
                .addTo(map)
                .bindPopup("<b>📍 You are here</b>")
                .openPopup();

            if (locationInput) {
                locationInput.value = `Lat: ${userLat.toFixed(4)}, Lon: ${userLon.toFixed(4)}`;
            }
            findServicesBtn.innerHTML = "Location Found";

            // Fetch and render both map markers and list items
            await fetchAndRenderNearbyServices(userLat, userLon, "hospital");
        },
        function (error) {
            console.error("Geolocation Error:", error);
            alert("Please allow location access to find nearby services.");
            findServicesBtn.innerHTML = "Use My Location";
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
});

// ================= FETCH & RENDER (MAP + LIST) =================
async function fetchAndRenderNearbyServices(lat, lon, category) {
    if (listContainer) {
        listContainer.innerHTML = '<p class="loading-text">Fetching nearby services...</p>';
    }

    // Clear existing markers
    serviceMarkers.forEach(marker => map.removeLayer(marker));
    serviceMarkers = [];

    try {
        const response = await fetch(`/api/nearby?lat=${lat}&lon=${lon}&category=${category}`);
        const result = await response.json();

        if (result.status === "success" && result.data && result.data.length > 0) {
            // 1. Render Markers on Leaflet Map
            result.data.forEach(place => {
                if (!place.lat || !place.lon) return;

                const marker = L.marker([place.lat, place.lon])
                    .addTo(map)
                    .bindPopup(`
                        <div style="font-family: sans-serif;">
                            <h4 style="margin: 0 0 5px 0;">${place.name}</h4>
                            <p style="margin: 0; font-size: 12px; color: #555;">${place.fullAddress || "Address unavailable"}</p>
                        </div>
                    `);
                
                serviceMarkers.push(marker);
            });

            // 2. Render List Items in DOM Side Panel
            updateNearbyList(result.data);
        } else {
            if (listContainer) {
                listContainer.innerHTML = `<p class="no-results">No nearby ${category}s found in your area.</p>`;
            }
        }
    } catch (error) {
        console.error("API Fetch Error:", error);
        if (listContainer) {
            listContainer.innerHTML = '<p class="error-text">Failed to connect to backend server.</p>';
        }
    }
}

// ================= DOM LIST BUILDER =================
function updateNearbyList(places) {
    if (!listContainer) return;
    listContainer.innerHTML = "";

    places.forEach(place => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "nearby-item";

        let icon = "🏥";
        const cat = (place.type || "").toLowerCase();
        if (cat.includes("pharmacy")) icon = "🩹";
        else if (cat.includes("police")) icon = "👮";
        else if (cat.includes("fire")) icon = "🔥";

        const distanceText = place.distance ? `${place.distance} km away` : "Nearby";

        itemDiv.innerHTML = `
            <div class="item-icon hospital-icon">${icon}</div>
            <div class="item-info">
                <strong>${place.name}</strong>
                <span>${distanceText}</span>
            </div>
            <span class="open-badge">Open</span>
            <i class="fa-solid fa-chevron-right arrow"></i>
        `;

        // Pan map & open popup on list item click
        itemDiv.addEventListener("click", () => {
            if (place.lat && place.lon) {
                map.setView([place.lat, place.lon], 16);
                
                // Find matching marker and open popup
                const matchedMarker = serviceMarkers.find(m => {
                    const pos = m.getLatLng();
                    return pos.lat === place.lat && pos.lng === place.lon;
                });
                
                if (matchedMarker) matchedMarker.openPopup();
            }
        });

        listContainer.appendChild(itemDiv);
    });
}
// ================= CATEGORY CARD CLICK HANDLERS =================
serviceCards.forEach(card => {
    card.addEventListener("click", function () {
        // 1. Get service category from HTML data attribute
        const serviceType = this.getAttribute("data-service");

        if (!serviceType) {
            console.error("Missing 'data-service' attribute on clicked card element.");
            return;
        }

        // 2. Ensure user coordinates exist before querying backend
        if (!userLat || !userLon) {
            alert("Please click 'Use My Location' first to locate nearby services.");
            return;
        }

        // 3. Highlight selected category card in the UI
        serviceCards.forEach(c => c.classList.remove("active"));
        this.classList.add("active");

        // 4. Fetch and render both map markers and list items for selected service
        fetchAndRenderNearbyServices(userLat, userLon, serviceType);
    });
});