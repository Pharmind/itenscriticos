// Function to load and display dashboard statistics
async function loadDashboardStats() {
    try {
        // Get all items from the database
        const items = await getItems();
        
        let itemsCriticos = 0;
        let itemsAlerta = 0;
        let itemsNormais = 0;
        
        // Calculate status for each item
        items.forEach(item => {
            const diasDisponiveis = Math.floor(item.estoque / item.consumoDiario);
            
            if (diasDisponiveis <= 15) {
                itemsCriticos++;
            } else if (diasDisponiveis <= 30) {
                itemsAlerta++;
            } else {
                itemsNormais++;
            }
        });
        
        // Update UI with counts
        document.getElementById('numItemsCriticos').textContent = itemsCriticos;
        document.getElementById('numItemsAlerta').textContent = itemsAlerta;
        document.getElementById('numItemsNormais').textContent = itemsNormais;
        
    } catch (error) {
        console.error("Error loading dashboard stats:", error);
    }
}

// Add logout button to the navigation bar
function addLogoutButton() {
    const navbarNav = document.getElementById('navbarNav');
    const logoutLi = document.createElement('li');
    logoutLi.className = 'nav-item ms-3';
  
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'btn btn-outline-light';
    logoutBtn.textContent = 'Sair';
    logoutBtn.addEventListener('click', () => {
        firebase.auth().signOut().then(() => {
            window.location.href = 'index.html';
        });
    });
  
    logoutLi.appendChild(logoutBtn);
    navbarNav.appendChild(logoutLi);
}

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    firebase.auth().onAuthStateChanged(function(user) {
        if (!user) {
            // User is not signed in, redirect to login page
            window.location.href = 'login.html';
            return;
        }
        
        // User is signed in, load dashboard
        loadDashboardStats();
        
        // Add logout button
        addLogoutButton();
    });
});