/**
 * Inventory Management System
 * Complete frontend application with localStorage persistence
 * No frameworks - Vanilla JavaScript
 */

// ==================== DATA MODELS ====================
let currentUser = null;
let products = [];
let suppliers = [];
let transactions = [];
let currentPage = 'dashboard';
let stockChart = null;
let salesChart = null;

// ==================== BACKEND API CONFIG ====================
// If your backend runs elsewhere, change this one value.
const API_BASE = 'http://localhost:5000';
const AUTH_TOKEN_KEY = 'ims_token';

function normalizeProduct(p) {
    // MongoDB returns `_id`. The UI already expects `id`.
    if (!p) return p;
    return { ...p, id: p._id || p.id };
}

async function apiRequest(path, options = {}) {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...(options.headers || {})
        }
    });

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await res.json() : await res.text();

    if (!res.ok) {
        const message = (data && data.message) ? data.message : `Request failed (${res.status})`;
        throw new Error(message);
    }
    return data;
}

async function fetchAllProducts() {
    const data = await apiRequest('/products', { method: 'GET' });
    return Array.isArray(data) ? data.map(normalizeProduct) : [];
}

async function createProductApi(productData) {
    const created = await apiRequest('/products', {
        method: 'POST',
        body: JSON.stringify(productData)
    });
    return normalizeProduct(created);
}

async function updateProductApi(id, updates) {
    const updated = await apiRequest(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
    });
    return normalizeProduct(updated);
}

async function deleteProductApi(id) {
    return await apiRequest(`/products/${id}`, { method: 'DELETE' });
}

function showToast(message, type = 'success') {
    // Simple UI message without changing existing HTML/CSS files
    let el = document.getElementById('ims-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'ims-toast';
        el.style.position = 'fixed';
        el.style.right = '16px';
        el.style.bottom = '16px';
        el.style.zIndex = '9999';
        el.style.maxWidth = '320px';
        el.style.padding = '12px 14px';
        el.style.borderRadius = '10px';
        el.style.fontSize = '14px';
        el.style.boxShadow = '0 10px 25px rgba(0,0,0,0.18)';
        el.style.display = 'none';
        document.body.appendChild(el);
    }

    el.textContent = message;
    el.style.background = type === 'error' ? '#ef4444' : '#10b981';
    el.style.color = '#fff';
    el.style.display = 'block';

    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
        el.style.display = 'none';
    }, 2500);
}

// ==================== LOCALSTORAGE HELPERS ====================
function loadData() {
    suppliers = JSON.parse(localStorage.getItem('ims_suppliers')) || [];
    transactions = JSON.parse(localStorage.getItem('ims_transactions')) || [];
    
    if (suppliers.length === 0) {
        suppliers = [
            { id: 's1', name: 'TechSupply Co', contact: 'contact@techsupply.com', linkedProducts: ['Laptop', 'Mouse'] },
            { id: 's2', name: 'Office Essentials', contact: 'sales@office.com', linkedProducts: ['Desk Chair', 'Keyboard'] }
        ];
        saveSuppliers();
    }
    
    if (transactions.length === 0) {
        transactions = [];
        saveTransactions();
    }
}

function saveProducts() {
    // Products are stored in MongoDB now (via backend APIs).
    // Keeping this function so existing calls don't break.
}

function saveSuppliers() {
    localStorage.setItem('ims_suppliers', JSON.stringify(suppliers));
}

function saveTransactions() {
    localStorage.setItem('ims_transactions', JSON.stringify(transactions));
}

// ==================== AUTHENTICATION ====================
function initUsers() {
    // Users are stored in MongoDB now.
    // Keeping this function so existing calls don't break.
}

async function registerUser(email, password, role, name) {
    const data = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, role, name })
    });
    if (data?.token) localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    if (data?.user) {
        currentUser = data.user;
        localStorage.setItem('ims_current', JSON.stringify(data.user));
    }
    return true;
}

async function loginUser(email, password) {
    const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
    if (data?.token) localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    if (data?.user) {
        currentUser = data.user;
        localStorage.setItem('ims_current', JSON.stringify(data.user));
    }
    return true;
}

function logoutUser() {
    localStorage.removeItem('ims_current');
    localStorage.removeItem(AUTH_TOKEN_KEY);
    currentUser = null;
}

function checkAuth() {
    const stored = localStorage.getItem('ims_current');
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (stored && token) {
        currentUser = JSON.parse(stored);
        return true;
    }
    return false;
}

// ==================== TRANSACTION HELPER ====================
function addTransaction(type, productId, quantity, date = new Date().toISOString().slice(0, 10)) {
    const product = products.find(p => p.id === productId);
    if (!product) return false;

    const qtyChange = parseInt(quantity);
    if (!qtyChange || qtyChange <= 0) return false;
    if (type !== 'Purchase' && type !== 'Sale') return false;

    transactions.unshift({
        id: Date.now(),
        type,
        productId: product.id,
        productName: product.name,
        quantity: qtyChange,
        date
    });
    
    saveProducts();
    saveTransactions();
    return true;
}

async function refreshProductsFromBackend() {
    products = await fetchAllProducts();
}

// ==================== AUTH UI ====================
function showAuth() {
    document.getElementById('auth-container').style.display = 'flex';
    document.getElementById('app-layout').style.display = 'none';
    
    const authHtml = `
        <div class="auth-card">
            <h2 style="margin-bottom: 1rem;">
                <i class="fas fa-boxes" style="color: var(--accent);"></i> 
                Inventory Management
            </h2>
            <div class="auth-tabs">
                <button class="btn" id="loginTabBtn">Login</button>
                <button class="btn btn-outline" id="signupTabBtn">Sign Up</button>
            </div>
            <div id="loginForm">
                <div class="form-group">
                    <input type="email" id="loginEmail" placeholder="Email" required>
                </div>
                <div class="form-group">
                    <input type="password" id="loginPassword" placeholder="Password">
                </div>
                <button class="btn" id="doLogin" style="width: 100%;">Login</button>
                <div class="auth-error" id="authError"></div>
            </div>
            <div id="signupForm" style="display: none;">
                <div class="form-group">
                    <input type="text" id="signupName" placeholder="Full Name">
                </div>
                <div class="form-group">
                    <input type="email" id="signupEmail" placeholder="Email">
                </div>
                <div class="form-group">
                    <input type="password" id="signupPassword" placeholder="Password">
                </div>
                <div class="form-group">
                    <input type="password" id="signupConfirm" placeholder="Confirm Password">
                </div>
                <div class="form-group">
                    <select id="signupRole">
                        <option value="User">User</option>
                        <option value="Admin">Admin</option>
                    </select>
                </div>
                <button class="btn" id="doSignup" style="width: 100%;">Register</button>
            </div>
        </div>
    `;
    
    document.getElementById('auth-container').innerHTML = authHtml;
    
    document.getElementById('loginTabBtn').onclick = () => {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('signupForm').style.display = 'none';
    };
    
    document.getElementById('signupTabBtn').onclick = () => {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('signupForm').style.display = 'block';
    };
    
    document.getElementById('doLogin').onclick = () => {
        const email = document.getElementById('loginEmail').value;
        const pwd = document.getElementById('loginPassword').value;
        (async () => {
            try {
                await loginUser(email, pwd);
                initApp();
            } catch (err) {
                document.getElementById('authError').innerText = err.message || 'Invalid email or password';
            }
        })();
    };
    
    document.getElementById('doSignup').onclick = () => {
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const pwd = document.getElementById('signupPassword').value;
        const confirm = document.getElementById('signupConfirm').value;
        const role = document.getElementById('signupRole').value;
        
        if (!email || !pwd) {
            alert('All fields required');
            return;
        }
        if (pwd !== confirm) {
            alert('Passwords do not match');
            return;
        }
        (async () => {
            try {
                await registerUser(email, pwd, role, name);
                alert('Signup successful! Please login.');
                document.getElementById('loginTabBtn').click();
            } catch (err) {
                alert(err.message || 'Signup failed');
            }
        })();
    };
}

// ==================== DASHBOARD PAGE ====================
function renderDashboard() {
    const totalProducts = products.length;
    const totalStock = products.reduce((sum, p) => sum + p.quantity, 0);
    const totalOrders = transactions.length;
    const lowStockItems = products.filter(p => p.quantity > 0 && p.quantity <= 5);
    const outStockItems = products.filter(p => p.quantity === 0);
    
    const html = `
        <div class="page-container active-page">
            <h2 style="margin-bottom: 1.5rem;">Dashboard</h2>
            <div class="card-grid">
                <div class="stat-card">
                    <i class="fas fa-box" style="font-size: 2rem; color: var(--accent);"></i>
                    <h3>Total Products</h3>
                    <p>${totalProducts}</p>
                </div>
                <div class="stat-card">
                    <i class="fas fa-database" style="font-size: 2rem; color: var(--success);"></i>
                    <h3>Total Stock Units</h3>
                    <p>${totalStock}</p>
                </div>
                <div class="stat-card">
                    <i class="fas fa-shopping-cart" style="font-size: 2rem; color: var(--warning);"></i>
                    <h3>Total Orders</h3>
                    <p>${totalOrders}</p>
                </div>
            </div>
            
            <div class="card-grid">
                <div class="stat-card">
                    <h4><i class="fas fa-exclamation-triangle"></i> Stock Alerts</h4>
                    <ul class="alert-list">
                        ${lowStockItems.map(p => `<li>⚠️ ${p.name}: Low stock (${p.quantity} left)</li>`).join('')}
                        ${outStockItems.map(p => `<li>🔴 ${p.name}: OUT OF STOCK</li>`).join('')}
                        ${lowStockItems.length === 0 && outStockItems.length === 0 ? '<li>✅ All stock levels are healthy</li>' : ''}
                    </ul>
                </div>
                <div class="stat-card">
                    <h4><i class="fas fa-bolt"></i> Quick Actions</h4>
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        <button class="btn" id="quickAddProduct"><i class="fas fa-plus"></i> Add Product</button>
                        <button class="btn btn-outline" id="quickUpdateStock"><i class="fas fa-edit"></i> Update Stock</button>
                    </div>
                </div>
            </div>
            
            <div class="card-grid">
                <div class="stat-card">
                    <h4>Stock by Category</h4>
                    <canvas id="stockTrendChart" style="max-height: 250px;"></canvas>
                </div>
                <div class="stat-card">
                    <h4>Weekly Sales Trend</h4>
                    <canvas id="salesChart" style="max-height: 250px;"></canvas>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('page-content').innerHTML = html;
    
    // Render charts
    const categories = [...new Set(products.map(p => p.category))];
    const stockByCategory = categories.map(cat => 
        products.filter(p => p.category === cat).reduce((sum, p) => sum + p.quantity, 0)
    );
    
    const ctx1 = document.getElementById('stockTrendChart')?.getContext('2d');
    if (ctx1) {
        if (stockChart) stockChart.destroy();
        stockChart = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: categories,
                datasets: [{ label: 'Stock Quantity', data: stockByCategory, backgroundColor: '#3b82f6' }]
            },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }
    
    // Mock sales data
    const ctx2 = document.getElementById('salesChart')?.getContext('2d');
    if (ctx2) {
        if (salesChart) salesChart.destroy();
        salesChart = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{ label: 'Sales (units)', data: [12, 19, 7, 14, 23, 18, 25], borderColor: '#10b981', tension: 0.4 }]
            },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }
    
    document.getElementById('quickAddProduct')?.addEventListener('click', () => navigateTo('products'));
    document.getElementById('quickUpdateStock')?.addEventListener('click', () => navigateTo('inventory'));
}

// ==================== PRODUCTS PAGE ====================
function renderProductsPage() {
    const searchTerm = document.getElementById('globalSearch')?.value.toLowerCase() || '';
    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm) || 
        p.category.toLowerCase().includes(searchTerm)
    );
    
    const html = `
        <div class="page-container active-page">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                <h2><i class="fas fa-cubes"></i> Products</h2>
                <button class="btn" id="openAddProductModal"><i class="fas fa-plus"></i> Add Product</button>
            </div>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Quantity</th>
                            <th>Price</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map(p => `
                            <tr>
                                <td><strong>${escapeHtml(p.name)}</strong></td>
                                <td>${escapeHtml(p.category)}</td>
                                <td class="${p.quantity === 0 ? 'out-stock' : (p.quantity <= 5 ? 'low-stock' : '')}">${p.quantity}</td>
                                <td>$${p.price}</td>
                                <td>${p.quantity === 0 ? 'Out of Stock' : (p.quantity <= 5 ? 'Low Stock' : 'In Stock')}</td>
                                <td>
                                    <button class="editProd btn btn-outline" data-id="${p.id}" style="padding: 0.25rem 0.75rem; margin-right: 0.5rem;"><i class="fas fa-edit"></i></button>
                                    <button class="delProd btn btn-danger" data-id="${p.id}" style="padding: 0.25rem 0.75rem;"><i class="fas fa-trash"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                        ${filtered.length === 0 ? '<tr><td colspan="6" style="text-align: center;">No products found</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
            
            <!-- Product Modal -->
            <div id="productModal" class="modal">
                <div class="modal-content">
                    <h3><i class="fas fa-box"></i> <span id="modalTitle">Add Product</span></h3>
                    <input type="hidden" id="productId">
                    <div class="form-group">
                        <label>Product Name</label>
                        <input type="text" id="prodName" placeholder="Enter product name">
                    </div>
                    <div class="form-group">
                        <label>Category</label>
                        <input type="text" id="prodCategory" placeholder="Enter category">
                    </div>
                    <div class="form-group">
                        <label>Quantity</label>
                        <input type="number" id="prodQty" placeholder="Enter quantity">
                    </div>
                    <div class="form-group">
                        <label>Price ($)</label>
                        <input type="number" id="prodPrice" placeholder="Enter price" step="0.01">
                    </div>
                    <div class="modal-actions">
                        <button class="btn" id="saveProductBtn">Save</button>
                        <button class="btn btn-outline" id="closeModalBtn">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('page-content').innerHTML = html;
    
    const modal = document.getElementById('productModal');
    const openModal = (editMode = false, product = null) => {
        modal.style.display = 'flex';
        if (editMode && product) {
            document.getElementById('modalTitle').innerText = 'Edit Product';
            document.getElementById('productId').value = product.id;
            document.getElementById('prodName').value = product.name;
            document.getElementById('prodCategory').value = product.category;
            document.getElementById('prodQty').value = product.quantity;
            document.getElementById('prodPrice').value = product.price;
        } else {
            document.getElementById('modalTitle').innerText = 'Add Product';
            document.getElementById('productId').value = '';
            document.getElementById('prodName').value = '';
            document.getElementById('prodCategory').value = '';
            document.getElementById('prodQty').value = '';
            document.getElementById('prodPrice').value = '';
        }
    };
    
    document.getElementById('openAddProductModal')?.addEventListener('click', () => openModal(false));
    document.getElementById('closeModalBtn')?.addEventListener('click', () => modal.style.display = 'none');
    
    document.getElementById('saveProductBtn')?.addEventListener('click', async () => {
        const id = document.getElementById('productId').value;
        const name = document.getElementById('prodName').value;
        const category = document.getElementById('prodCategory').value;
        const quantity = parseInt(document.getElementById('prodQty').value);
        const price = parseFloat(document.getElementById('prodPrice').value);
        
        if (!name || !category || isNaN(quantity) || isNaN(price)) {
            showToast('Please fill all fields', 'error');
            return;
        }

        try {
            const payload = { name, category, quantity, price };
            if (id) {
                await updateProductApi(id, payload);
                showToast('Product updated', 'success');
            } else {
                await createProductApi(payload);
                showToast('Product added', 'success');
            }

            await refreshProductsFromBackend();
            modal.style.display = 'none';
            renderProductsPage();
            if (currentPage === 'dashboard') renderDashboard();
        } catch (err) {
            showToast(err.message || 'Failed to save product', 'error');
        }
    });
    
    document.querySelectorAll('.editProd').forEach(btn => {
        btn.addEventListener('click', () => {
            const product = products.find(p => p.id === btn.dataset.id);
            if (product) openModal(true, product);
        });
    });
    
    document.querySelectorAll('.delProd').forEach(btn => {
        btn.addEventListener('click', () => {
            (async () => {
                if (!confirm('Delete this product?')) return;
                try {
                    await deleteProductApi(btn.dataset.id);
                    showToast('Product deleted', 'success');
                    await refreshProductsFromBackend();
                    renderProductsPage();
                    if (currentPage === 'dashboard') renderDashboard();
                } catch (err) {
                    showToast(err.message || 'Failed to delete product', 'error');
                }
            })();
        });
    });
}

// ==================== SUPPLIERS PAGE ====================
function renderSuppliersPage() {
    let editingId = null;
    
    const html = `
        <div class="page-container active-page">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h2><i class="fas fa-truck"></i> Suppliers</h2>
                <button class="btn" id="addSupplierBtn"><i class="fas fa-plus"></i> Add Supplier</button>
            </div>
            
            <div id="supplierForm" style="display: none; margin-bottom: 2rem;">
                <div class="stat-card">
                    <h3 id="supplierFormTitle">Add Supplier</h3>
                    <div class="form-group">
                        <input type="text" id="supName" placeholder="Supplier Name">
                    </div>
                    <div class="form-group">
                        <input type="text" id="supContact" placeholder="Contact Info (Email/Phone)">
                    </div>
                    <div class="form-group">
                        <input type="text" id="supLinked" placeholder="Linked Products (comma separated)">
                    </div>
                    <div style="display: flex; gap: 1rem;">
                        <button class="btn" id="saveSupplierBtn">Save</button>
                        <button class="btn btn-outline" id="cancelSupplierBtn">Cancel</button>
                    </div>
                </div>
            </div>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Contact</th>
                            <th>Linked Products</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${suppliers.map(s => `
                            <tr>
                                <td><strong>${escapeHtml(s.name)}</strong></td>
                                <td>${escapeHtml(s.contact)}</td>
                                <td>${s.linkedProducts?.join(', ') || '-'}</td>
                                <td>
                                    <button class="editSup btn btn-outline" data-id="${s.id}" style="padding: 0.25rem 0.75rem; margin-right: 0.5rem;"><i class="fas fa-edit"></i></button>
                                    <button class="delSup btn btn-danger" data-id="${s.id}" style="padding: 0.25rem 0.75rem;"><i class="fas fa-trash"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                        ${suppliers.length === 0 ? '<tr><td colspan="4" style="text-align: center;">No suppliers found</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    document.getElementById('page-content').innerHTML = html;
    
    const formDiv = document.getElementById('supplierForm');
    const showForm = (editMode = false, supplier = null) => {
        formDiv.style.display = 'block';
        if (editMode && supplier) {
            document.getElementById('supplierFormTitle').innerText = 'Edit Supplier';
            document.getElementById('supName').value = supplier.name;
            document.getElementById('supContact').value = supplier.contact;
            document.getElementById('supLinked').value = supplier.linkedProducts?.join(', ') || '';
            editingId = supplier.id;
        } else {
            document.getElementById('supplierFormTitle').innerText = 'Add Supplier';
            document.getElementById('supName').value = '';
            document.getElementById('supContact').value = '';
            document.getElementById('supLinked').value = '';
            editingId = null;
        }
    };
    
    document.getElementById('addSupplierBtn')?.addEventListener('click', () => showForm(false));
    document.getElementById('cancelSupplierBtn')?.addEventListener('click', () => formDiv.style.display = 'none');
    
    document.getElementById('saveSupplierBtn')?.addEventListener('click', () => {
        const name = document.getElementById('supName').value;
        const contact = document.getElementById('supContact').value;
        const linked = document.getElementById('supLinked').value.split(',').map(s => s.trim()).filter(s => s);
        
        if (!name || !contact) {
            alert('Please fill required fields');
            return;
        }
        
        if (editingId) {
            const index = suppliers.findIndex(s => s.id === editingId);
            if (index !== -1) {
                suppliers[index] = { ...suppliers[index], name, contact, linkedProducts: linked };
            }
        } else {
            suppliers.push({ id: 's' + Date.now(), name, contact, linkedProducts: linked });
        }
        
        saveSuppliers();
        formDiv.style.display = 'none';
        renderSuppliersPage();
    });
    
    document.querySelectorAll('.editSup').forEach(btn => {
        btn.addEventListener('click', () => {
            const supplier = suppliers.find(s => s.id === btn.dataset.id);
            if (supplier) showForm(true, supplier);
        });
    });
    
    document.querySelectorAll('.delSup').forEach(btn => {
        btn.addEventListener('click', () => {
            if (confirm('Delete this supplier?')) {
                suppliers = suppliers.filter(s => s.id !== btn.dataset.id);
                saveSuppliers();
                renderSuppliersPage();
            }
        });
    });
}

// ==================== INVENTORY PAGE ====================
function renderInventoryPage() {
    const html = `
        <div class="page-container active-page">
            <h2 style="margin-bottom: 1.5rem;"><i class="fas fa-warehouse"></i> Stock Management</h2>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Current Stock</th>
                            <th>Status</th>
                            <th>Stock In</th>
                            <th>Stock Out</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${products.map(p => `
                            <tr>
                                <td><strong>${escapeHtml(p.name)}</strong><br><small>${escapeHtml(p.category)}</small></td>
                                <td class="${p.quantity === 0 ? 'out-stock' : (p.quantity <= 5 ? 'low-stock' : '')}">${p.quantity}</td>
                                <td>${p.quantity === 0 ? 'Out of Stock' : (p.quantity <= 5 ? 'Low Stock' : 'In Stock')}</td>
                                <td>
                                    <button class="stockIn btn btn-outline" data-id="${p.id}" data-qty="1" style="padding: 0.25rem 0.5rem;">+1</button>
                                    <button class="stockIn btn btn-outline" data-id="${p.id}" data-qty="5" style="padding: 0.25rem 0.5rem;">+5</button>
                                </td>
                                <td>
                                    <button class="stockOut btn btn-outline" data-id="${p.id}" data-qty="1" style="padding: 0.25rem 0.5rem;">-1</button>
                                    <button class="stockOut btn btn-outline" data-id="${p.id}" data-qty="5" style="padding: 0.25rem 0.5rem;">-5</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    document.getElementById('page-content').innerHTML = html;
    
    document.querySelectorAll('.stockIn').forEach(btn => {
        btn.onclick = async () => {
            const pid = btn.dataset.id;
            const qty = parseInt(btn.dataset.qty);
            const product = products.find(p => p.id === pid);
            if (product) {
                try {
                    await updateProductApi(pid, { quantity: product.quantity + qty });
                    await refreshProductsFromBackend();
                    showToast('Stock updated', 'success');
                    renderInventoryPage();
                    if (currentPage === 'dashboard') renderDashboard();
                } catch (err) {
                    showToast(err.message || 'Failed to update stock', 'error');
                }
            }
        };
    });
    
    document.querySelectorAll('.stockOut').forEach(btn => {
        btn.onclick = async () => {
            const pid = btn.dataset.id;
            const qty = parseInt(btn.dataset.qty);
            const product = products.find(p => p.id === pid);
            if (!product) return;
            if (product.quantity < qty) {
                showToast('Insufficient stock!', 'error');
                return;
            }

            try {
                await updateProductApi(pid, { quantity: product.quantity - qty });
                addTransaction('Sale', pid, qty);
                await refreshProductsFromBackend();
                showToast('Stock updated', 'success');
                renderInventoryPage();
                if (currentPage === 'dashboard') renderDashboard();
            } catch (err) {
                showToast(err.message || 'Failed to update stock', 'error');
            }
        };
    });
}

// ==================== ORDERS PAGE ====================
function renderOrdersPage() {
    const html = `
        <div class="page-container active-page">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h2><i class="fas fa-shopping-cart"></i> Transactions</h2>
                <button class="btn" id="newOrderBtn"><i class="fas fa-plus"></i> New Order</button>
            </div>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Product</th>
                            <th>Quantity</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transactions.map(t => `
                            <tr>
                                <td>${t.date}</td>
                                <td><span class="${t.type === 'Purchase' ? 'text-success' : 'text-warning'}">${t.type}</span></td>
                                <td>${escapeHtml(t.productName)}</td>
                                <td>${t.quantity}</td>
                            </tr>
                        `).join('')}
                        ${transactions.length === 0 ? '<tr><td colspan="4" style="text-align: center;">No transactions yet</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
            
            <!-- Order Modal -->
            <div id="orderModal" class="modal">
                <div class="modal-content">
                    <h3><i class="fas fa-exchange-alt"></i> New Transaction</h3>
                    <div class="form-group">
                        <label>Transaction Type</label>
                        <select id="orderType">
                            <option value="Purchase">Purchase (Stock In)</option>
                            <option value="Sale">Sale (Stock Out)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Product</label>
                        <select id="orderProduct">
                            ${products.map(p => `<option value="${p.id}">${p.name} (Stock: ${p.quantity})</option>`)}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Quantity</label>
                        <input type="number" id="orderQty" placeholder="Enter quantity">
                    </div>
                    <div class="modal-actions">
                        <button class="btn" id="submitOrder">Record Transaction</button>
                        <button class="btn btn-outline" id="closeOrderModal">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('page-content').innerHTML = html;
    
    const modal = document.getElementById('orderModal');
    document.getElementById('newOrderBtn')?.addEventListener('click', () => modal.style.display = 'flex');
    document.getElementById('closeOrderModal')?.addEventListener('click', () => modal.style.display = 'none');
    
    document.getElementById('submitOrder')?.addEventListener('click', async () => {
        const type = document.getElementById('orderType').value;
        const pid = document.getElementById('orderProduct').value;
        const qty = parseInt(document.getElementById('orderQty').value);
        
        if (!qty || qty <= 0) {
            showToast('Please enter a valid quantity', 'error');
            return;
        }

        const product = products.find(p => p.id === pid);
        if (!product) {
            showToast('Product not found', 'error');
            return;
        }

        try {
            if (type === 'Purchase') {
                await updateProductApi(pid, { quantity: product.quantity + qty });
            } else if (type === 'Sale') {
                if (product.quantity < qty) {
                    showToast('Transaction failed: Insufficient stock for sale', 'error');
                    return;
                }
                await updateProductApi(pid, { quantity: product.quantity - qty });
            } else {
                showToast('Invalid transaction type', 'error');
                return;
            }

            // Keep transactions UI/local history as-is
            addTransaction(type, pid, qty);
            await refreshProductsFromBackend();

            showToast('Transaction recorded', 'success');
            modal.style.display = 'none';
            document.getElementById('orderQty').value = '';
            renderOrdersPage();
            if (currentPage === 'dashboard') renderDashboard();
        } catch (err) {
            showToast(err.message || 'Failed to record transaction', 'error');
        }
    });
}

// ==================== REPORTS PAGE ====================
function renderReportsPage() {
    const lowInventory = products.filter(p => p.quantity <= 5);
    const totalSales = transactions.filter(t => t.type === 'Sale').reduce((sum, t) => sum + t.quantity, 0);
    const totalPurchases = transactions.filter(t => t.type === 'Purchase').reduce((sum, t) => sum + t.quantity, 0);
    const totalValue = products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    
    const html = `
        <div class="page-container active-page">
            <h2 style="margin-bottom: 1.5rem;"><i class="fas fa-chart-line"></i> Reports</h2>
            
            <div class="card-grid">
                <div class="stat-card">
                    <h3><i class="fas fa-chart-pie"></i> Stock Summary</h3>
                    <p>Total SKUs: ${products.length}</p>
                    <p>Total Units: ${products.reduce((a,b) => a + b.quantity, 0)}</p>
                    <p>Inventory Value: $${totalValue.toFixed(2)}</p>
                </div>
                <div class="stat-card">
                    <h3><i class="fas fa-chart-bar"></i> Sales Report</h3>
                    <p>Total Sales (units): ${totalSales}</p>
                    <p>Total Purchases (units): ${totalPurchases}</p>
                    <p>Transactions Count: ${transactions.length}</p>
                </div>
                <div class="stat-card">
                    <h3><i class="fas fa-exclamation-triangle"></i> Low Inventory Report</h3>
                    <ul class="alert-list">
                        ${lowInventory.map(p => `<li>${p.name}: ${p.quantity} units left</li>`).join('')}
                        ${lowInventory.length === 0 ? '<li>✅ No low inventory items</li>' : ''}
                    </ul>
                </div>
            </div>
            
            <div class="stat-card">
                <h4>Stock Distribution</h4>
                <canvas id="reportChart" style="max-height: 300px;"></canvas>
            </div>
        </div>
    `;
    
    document.getElementById('page-content').innerHTML = html;
    
    const ctx = document.getElementById('reportChart')?.getContext('2d');
    if (ctx) {
        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Healthy Stock (>5)', 'Low Stock (1-5)', 'Out of Stock (0)'],
                datasets: [{
                    data: [
                        products.filter(p => p.quantity > 5).length,
                        products.filter(p => p.quantity <= 5 && p.quantity > 0).length,
                        products.filter(p => p.quantity === 0).length
                    ],
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444']
                }]
            },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }
}

// ==================== NAVIGATION ====================
function navigateTo(page) {
    currentPage = page;
    
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.dataset.page === page) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Render page
    switch (page) {
        case 'dashboard': renderDashboard(); break;
        case 'products': renderProductsPage(); break;
        case 'suppliers': renderSuppliersPage(); break;
        case 'inventory': renderInventoryPage(); break;
        case 'orders': renderOrdersPage(); break;
        case 'reports': renderReportsPage(); break;
        default: renderDashboard();
    }
}

// ==================== UTILITIES ====================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ==================== INITIALIZATION ====================
async function initApp() {
    if (!checkAuth()) {
        showAuth();
        return;
    }
    
    loadData();
    try {
        await refreshProductsFromBackend();
    } catch (err) {
        // Backend might be offline; keep UI usable but warn user.
        showToast('Backend not reachable. Start the server to load products.', 'error');
        products = [];
    }
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('app-layout').style.display = 'block';
    document.getElementById('userNameDisplay').innerHTML = `<i class="fas fa-user-circle"></i> <span>${currentUser.name || currentUser.email.split('@')[0]}</span>`;
    
    // Setup event listeners
    document.getElementById('themeToggle').onclick = () => document.body.classList.toggle('light');
    document.getElementById('logoutBtn').onclick = () => {
        logoutUser();
        showAuth();
    };
    document.getElementById('menuToggle').onclick = () => document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('globalSearch').addEventListener('input', () => {
        if (currentPage === 'products') renderProductsPage();
    });
    
    // Setup navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.onclick = () => {
            navigateTo(item.dataset.page);
            if (window.innerWidth < 768) document.getElementById('sidebar').classList.remove('open');
        };
    });
    
    navigateTo('dashboard');
}

// Start the application
initUsers();
initApp().catch(err => {
    console.error(err);
    showToast('App failed to start', 'error');
});