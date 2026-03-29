import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

/**
 * Smart Pharmacy Management System - Core Logic
 * Author: Esraa M. Ibrahim & Team
 * Features: Smart Discounting, Interaction Guard, Analytics & RBAC
 */

function App() {
    // ---------------------------------------------------------
    // 1. GLOBAL CONFIGURATION
    // ---------------------------------------------------------
    const API_BASE = 'https://localhost:7168/api';
    const API_URL = 'https://localhost:7168/api/Medicines';
    const PATIENT_API = 'https://localhost:7168/api/Patients';
    const TRENDING_THRESHOLD = 5;
    // ---------------------------------------------------------
    // 2. AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC)
    // ---------------------------------------------------------
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false); // New state for Client registration
    const [currentUserId, setCurrentUserId] = useState(null);
    const [userRole, setUserRole] = useState('Staff');
    const [loginCredentials, setLoginCredentials] = useState({
        username: '',
        passwordHash: '',
        role: 'Staff',
        phoneNumber: '', // New field for Client registration
        fullName: ''     // New field for Client registration
    });

    // ---------------------------------------------------------
    // 3. INVENTORY & SEARCH STATE
    // ---------------------------------------------------------
    const [medicines, setMedicines] = useState([]);
    const [view, setView] = useState('inventory'); // Change between 'inventory', 'patients', or 'suppliers'
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        name: '', activeIngredient: '', price: 0, stockQuantity: 0, expiryDate: '', category: '', barcode: ''
    });
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);

    // ---------------------------------------------------------
    // 4. CLINICAL SAFETY & ALTERNATIVES
    // ---------------------------------------------------------
    const [med1, setMed1] = useState('');
    const [med2, setMed2] = useState('');
    const [safetyMessage, setSafetyMessage] = useState('');
    const [searchAlt, setSearchAlt] = useState('');
    const [alternatives, setAlternatives] = useState([]);
    const [myOrders, setMyOrders] = useState([]);

    // ---------------------------------------------------------
    // 5. PATIENT & SALES DATA
    // ---------------------------------------------------------
    const [patients, setPatients] = useState([]);
    const [patientName, setPatientName] = useState('');
    const [patientPhone, setPatientPhone] = useState('');
    const [patientEmail, setPatientEmail] = useState('');
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [selectedHistory, setSelectedHistory] = useState([]);
    const [isEditingPatient, setIsEditingPatient] = useState(false);
    const [editPatientId, setEditPatientId] = useState(null);

    // =========================================================
    // 6. USER PROVISIONING (Registration)
    // =========================================================

    /**
     * Handles new Client registration.
     * Manually maps camelCase frontend state to PascalCase C# DTOs.
     */
    const handleRegister = async () => {
        try {
            // 1. Send data with Capitalized keys to match C# Model
            const response = await axios.post('https://localhost:7168/api/Auth/register', {
                Username: loginCredentials.username,
                PasswordHash: loginCredentials.passwordHash,
                FullName: loginCredentials.fullName,
                PhoneNumber: loginCredentials.phoneNumber,
                Role: 'Client' // Even though the backend forces this, it's good practice to send it
            });

            console.log("Server Response:", response.data);

            // Note: C# usually returns properties in camelCase in the JSON response
            alert(`✅ Registration Successful for ${response.data.username || loginCredentials.username}! You can now login.`);

            setIsRegistering(false); // Switch back to login mode
        } catch (error) {
            // Show the specific error from the backend if available
            const message = error.response?.data?.message || "Username or Phone might already exist.";
            alert(`❌ Registration Failed: ${message}`);
        }
    };

    // =========================================================
    // 7. COMPUTED STATISTICS (Inventory Insights)
    // =========================================================

    /** * The following constants perform real-time analysis on the 'medicines' state.
     * These are used for the Dashboard KPI (Key Performance Indicator) boxes.
     */
    // --- 4. LOGIC & STATISTICS ---
    // Only count medicine types that are ACTIVE
    // Fix the filters to check both naming styles
    const totalItems = medicines.filter(m => {
        const status = m.IsActive ?? m.isActive;
        return status !== false && status !== 0 && status !== "0";
    }).length;

    // NEW: Sum of all stock quantities (Total physical boxes, ONLY for ACTIVE medicines)
    const totalUnits = medicines.reduce((sum, m) => {
        const status = m.IsActive ?? m.isActive;
        const isActive = status !== false && status !== 0 && status !== "0";

        // If active, add its stock to the total; if disabled, add 0
        return isActive ? sum + (m.StockQuantity ?? m.stockQuantity ?? 0) : sum;
    }, 0);
    // Only show low stock alerts for medicines that are still ACTIVE
    const lowStockCount = medicines.filter(m => {
        const status = m.IsActive ?? m.isActive;
        const isActive = status !== false && status !== 0 && status !== "0";
        const stock = m.StockQuantity ?? m.stockQuantity ?? 0; return isActive && stock < 10;
    }).length;
    // 2. Only count expiring alerts for medicines that are ACTIVE
    const expiringCount = medicines.filter(m => {
        const status = m.IsActive ?? m.isActive;
        const isActive = status !== false && status !== 0 && status !== "0";

        const d = new Date(m.ExpiryDate ?? m.expiryDate);
        const today = new Date();
        const thirtyDays = new Date();
        thirtyDays.setDate(today.getDate() + 30);

        return isActive && d <= thirtyDays && d >= today;
    }).length;


    // ---------------------------------------------------------
    // 7. SUPPLIER & PROCUREMENT
    // ---------------------------------------------------------
    const [suppliers, setSuppliers] = useState([]);
    const [supplierData, setSupplierData] = useState({ name: '', phone: '', contactPerson: '', email: '', address: '' });
    const [isEditingSupplier, setIsEditingSupplier] = useState(false);
    const [editSupplierId, setEditSupplierId] = useState(null);
    const [purchaseHistory, setPurchaseHistory] = useState([]);
    const [order, setOrder] = useState({ medicineId: '', supplierId: '', quantity: 0, costPrice: 0 });

    // ---------------------------------------------------------
    // 8. TRANSACTION & UI UTILITIES
    // ---------------------------------------------------------
    const [cart, setCart] = useState([]);
    const [currentInvoice, setCurrentInvoice] = useState(null);
    const [barcodeInput, setBarcodeInput] = useState('');
    const [checkoutStep, setCheckoutStep] = useState('shop'); // 'shop', 'cart', or 'payment'
    const [deliveryInfo, setDeliveryInfo] = useState({ address: '', city: 'Cairo', method: 'Cash' });
    const [isOrderPlaced, setIsOrderPlaced] = useState(false);
    const [dismissedSuggestions, setDismissedSuggestions] = useState([]);

    // =========================================================
    // 9. DATA ANALYTICS & SMART LOGIC (useMemo)
    // =========================================================

    /**
     * Normalizes sales data into a performant Map.
     * Handles case-sensitivity by checking both C# and JS naming conventions.
     */
    const [salesHistory, setSalesHistory] = useState([]);
    const salesCountMap = React.useMemo(() => {
        return salesHistory.reduce((map, record) => {
            // FIX: Check both camelCase and PascalCase
            const name = (record?.medicineName || record?.MedicineName || "").toLowerCase().trim();
            const qty = parseInt(record?.quantity || record?.Quantity || 0);

            if (name) {
                map[name] = (map[name] || 0) + qty;
            }
            return map;
        }, {});
    }, [salesHistory]);

    /**
     * Dynamic Risk Assessment: Calculates discount tiers based on expiry proximity.
     * @param {string} expiryDate 
     * @returns {number} Discount percentage (0.10, 0.20, 0.40)
     */
    const getSmartDiscount = (expiryDate) => {
        if (!expiryDate) return 0;
        const daysUntilExpiry = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry <= 0) return 0; // Already expired (should be disabled)
        if (daysUntilExpiry <= 5) return 0.40; // 40% (Last chance to break even)
        if (daysUntilExpiry <= 14) return 0.20; // 20% (Standard promotion)
        if (daysUntilExpiry <= 30) return 0.10; // 10% (Early incentive)
        return 0; // No risk yet
    };

    // =========================================================
    // 10. AUTHENTICATION & SESSION HANDLERS
    // =========================================================

    /**
     * Validates credentials and initializes User Session.
     * Implements persistent login via LocalStorage.
     */
    const handleLogin = async () => {
    try {
        const response = await axios.post(`${API_BASE}/Auth/login`, {
            username: loginCredentials.username,
            passwordHash: loginCredentials.passwordHash,
            role: loginCredentials.role || 'Staff'
        });

        // 1. Capture Data from C# Response
        const { id, role, username } = response.data;

        /// Sync State
        setUserRole(role);
        setIsLoggedIn(true);
        setCurrentUserId(id);
        // Ensure username is updated in credentials so checkout can see it
        setLoginCredentials(prev => ({ ...prev, username: username }));

        // Persistent Storage for Cloud/Refresh recovery
        localStorage.setItem('savedUserId', id);
        localStorage.setItem('savedUserRole', role);
        localStorage.setItem('savedUsername', username);

        // Conditional Routing based on RBAC
        setView(role === 'Client' ? 'client_store' : 'inventory');
        alert(`Welcome back, ${username}!`);
    } catch (error) {
        const msg = error.response?.data?.message || "Login Failed";
        alert(`❌ ${msg}`);
    }
    };

    /**
     * Terminates session and purges sensitive local data.
     */
    const handleLogout = () => {
        setIsLoggedIn(false);
        setCurrentUserId(null); // Clear the ID
        setMyOrders([]);        // Clear the history table
        setCart([]);            // Clear the basket
        setUserRole('');        // Clear the role
        localStorage.clear(); // Purge all session keys
        setLoginCredentials({ username: '', passwordHash: '', role: 'Staff' }); // Reset form
    };

    // =========================================================
    // 11. INVENTORY DATA OPERATIONS (CRUD)
    // =========================================================

    /**
     * Synchronizes local medicine state with the SQL Database.
     */
    const fetchMedicines = async () => {
        try {
            const response = await axios.get(`${API_BASE}/Medicines`);
            setMedicines(response.data);
        } catch (error) {
            console.error("Critical: Failed to fetch inventory from SQL.", error);
        }
    };

    /**
     * Persists a new medicine entry to the database.
     */
    const addMedicine = async () => {
        if (!formData.name || !formData.activeIngredient || !formData.category || !formData.expiryDate) {
            alert("⚠️ Validation Error: Please fill in all mandatory fields.");
            return;
        }
        try {
            await axios.post(API_URL, formData);//`${API_BASE}/Medicines`==API_URL...Notice 
            fetchMedicines();// Refresh view
            clearForm();
            alert("✅ Inventory entry created successfully!");
        } catch (error) {
            alert("❌ Database Write Error: Check server connection.");
        }
    };

    /**
     * Updates an existing medicine record using safe ID targeting.
     */
    const updateMedicine = async () => {
        try {
            await axios.put(`${API_URL}/${editId}`, { ...formData, id: editId });
            fetchMedicines();
            clearForm();
            alert("✅ Record updated successfully!");
        } catch (error) {
            alert("❌ Update failed. Record may be locked or missing.");
        }
    };

    /**
     * Toggles the logical availability of a product without deleting it.
     * Essential for maintaining historical sales records.
     */
    const toggleActiveStatus = async (medicine) => {
        // 1. Calculate exactly what we want to send
        const targetId = medicine.id || medicine.Id;
        // We check both naming styles to be 100% safe
        const currentStatus = (medicine.IsActive !== undefined) ? medicine.IsActive : medicine.isActive;
        const newStatus = !currentStatus;

        try {
            // UI Update: Update both names in local state for instant feedback
            setMedicines(prev => prev.map(m =>
                (m.id === targetId || m.Id === targetId)
                    ? { ...m, IsActive: newStatus, isActive: newStatus }
                    : m
            ));

            // API Update: Send both naming styles so C# can't miss it
            await axios.put(`${API_URL}/${targetId}`, {
                ...medicine,
                Id: targetId,
                id: targetId,
                IsActive: newStatus,
                isActive: newStatus
            });

            await fetchMedicines();
            alert(`✅ ${medicine.name} is now ${newStatus ? 'Active' : 'Disabled'}.`);

        } catch (error) {
            console.error("Update Error:", error.response?.data || error.message);
            // If it fails, pull the real data back to fix the UI
            await fetchMedicines();
            alert("❌ Update failed. Check the Black C# Console.");
        }
    };

    /**
     * Safety Protocol: Scans for expired stock and deactivates them in bulk.
     */
    const disableExpiredMedicines = async () => {
        const expiredOnes = medicines.filter(m =>
            new Date(m.expiryDate) < new Date() && (m.IsActive ?? m.isActive) !== false
        );

        if (expiredOnes.length === 0) return alert("✅ No active expired medicines found!");

        if (window.confirm(`Found ${expiredOnes.length} expired items. Disable all for safety?`)) {
            try {
                // Loop through each expired item and call your existing toggle function
                for (const med of expiredOnes) {
                    await axios.put(`${API_URL}/${med.id || med.Id}`, {
                        ...med,
                        Id: med.id || med.Id,
                        IsActive: false
                    });
                }

                await fetchMedicines(); // Refresh the table
                alert(`✅ Successfully disabled ${expiredOnes.length} items.`);
            } catch (error) {
                alert("❌ Error during batch update.");
            }
        }
    };


    // =========================================================
    // 12. CLINICAL DECISION SUPPORT & SAFETY
    // =========================================================

    /**
     * Cross-references two substances via the backend Clinical Interaction Guard.
     */
    const checkSafety = async () => {
        try {
            // Ensure this uses med1 and med2 (the names you type in the input boxes)
            const response = await axios.get(`${API_BASE}/api/Medicines/CheckInteractionByMedicine?med1=${med1}&med2=${med2}`);
            setSafetyMessage(response.data);
        } catch (error) {
            // If an interaction is found (400 Error), display the message from the backend
            if (error.response && error.response.data) {
                setSafetyMessage(error.response.data);
            } else {
                setSafetyMessage("⚠️ Connection Error or Medicine not found.");
            }
        }
    };

    /**
     * Queries the database for alternatives based on active ingredients.
     */
    const findAlternatives = async () => {
        if (!searchAlt) return;
        try {
            const response = await axios.get(`${API_URL}/FindAlternatives/${encodeURIComponent(searchAlt)}`);
            // DOUBLE CHECK: Filter out any inactive ones in React too
            const activeAlts = response.data.filter(alt => (alt.IsActive ?? alt.isActive) !== false);

            if (activeAlts.length === 0) {
                alert("Medicine found, but zero units are currently active in stock.");
                setAlternatives([]);
            } else {
                setAlternatives(activeAlts);
            }
        } catch (error) {
            setAlternatives([]);
            alert("❌ Medicine not found.");
        }
    };

    // =========================================================
    // 13. PATIENT DATA & CLINICAL HISTORY
    // =========================================================

    /**
     * Retrieves the complete list of registered patients.
     */
    const fetchPatients = async () => {
        try {
            const response = await axios.get(`${API_BASE}/Patients`);
            setPatients(response.data);
        } catch (error) { console.error("Patient Retrieval Error:", error); }
    };

    /**
     * Registers a new patient profile for chronic tracking and history.
     */
    const addPatient = async () => {
        if (!patientPhone) return alert("Validation Error: Phone Number is required!"); // Phone is the only mandatory field

        try {
            const response = await axios.post(PATIENT_API, {
                fullName: patientName || "Unknown Patient", // Default if name is empty
                phoneNumber: patientPhone,
                email: patientEmail || null
            });
            setPatients([...patients, response.data]);
            setPatientName(''); setPatientPhone(''); setPatientEmail('');
            alert("Patient Registered!");
        } catch (error) { alert("Error: Is this phone number already registered?"); }
    };

    /**
     * Initializes the patient edit form with existing record data.
     */
    const handlePatientEditClick = (p) => {
        setPatientName(p.fullName || "");
        setPatientPhone(p.phoneNumber);
        setPatientEmail(p.email || "");
        setEditPatientId(p.id);
        setIsEditingPatient(true);
    };
    /**
     * Persists updated patient metadata to the SQL database.
     * Validates for phone number uniqueness via backend constraints.
     */
    const updatePatient = async () => {
        try {
            await axios.put(`${PATIENT_API}/${editPatientId}`, {
                id: editPatientId,
                fullName: patientName,
                phoneNumber: patientPhone,
                email: patientEmail
            });
            fetchPatients(); // Refresh list
            setPatientName(''); setPatientPhone(''); setPatientEmail('');
            setIsEditingPatient(false);
            alert("✅ Patient Updated Successfully!");
        } catch (error) {
            alert("❌ Update failed. Check if phone number is already assigned to another profile.");
        }
    };

    /**
     * Performs a soft-delete/unbind operation on a patient profile.
     */
    const deletePatient = async (id) => {
        if (window.confirm("Are you sure you want to delete this patient profile? This will not delete their purchase history but will unbind it.")) {
            try {
                await axios.delete(`${PATIENT_API}/${id}`);
                // Update the local state to remove the deleted patient
                setPatients(patients.filter(p => p.id !== id));
                alert("✅ Patient deleted successfully.");
            } catch (error) {
                console.error("Delete error:", error);
                alert("❌ Error deleting patient. They might have active records linked to them.");
            }
        }
    };

    /**
     * Fetches historical transaction data for a specific patient profile.
     */
    const viewHistory = async (patient) => {
        setSelectedPatient(patient);
        try {
            const response = await axios.get(`${PATIENT_API}/${patient.id}/history`);
            setSelectedHistory(response.data);
        } catch (error) {
            setSelectedHistory([]);
            console.error("History fetch error", error);
        }
    };

    // =========================================================
    // 14. SUPPLY CHAIN & PROCUREMENT (Suppliers)
    // =========================================================

    /**
     * Synchronizes supplier directory with the SQL backend.
     */
    const fetchSuppliers = async () => {
        try {
            const response = await axios.get(`${API_BASE}/Suppliers`);
            // This now includes ContactPerson, Email, and Address from your PharmacyDB
            setSuppliers(response.data);
        } catch (error) {
            console.error("Supplier Fetch Error", error);
        }
    };

    /**
     * Onboards a new pharmaceutical supplier to the system.
     */
    const handleAddSupplier = async () => {
        // Basic validation
        if (!supplierData.name) {
            return alert("⚠️ Supplier Company Name is required!");
        }

        try {
            // Sends the entire supplierData object (Name, Phone, Email, etc.)
            await axios.post('https://localhost:7168/api/Suppliers', supplierData);

            // Refresh the table to show the new supplier
            await fetchSuppliers();

            // IMPORTANT: Reset the form to empty for the next entry
            setSupplierData({
                name: '',
                phone: '',
                contactPerson: '',
                email: '',
                address: ''
            });

            alert("✅ Supplier Registered Successfully!");
        } catch (error) {
            console.error("Add Error:", error);
            alert("❌ Error: Could not add supplier. Check the C# Console.");
        }
    };
    /**
     * Initializes the supplier modification interface.
     */
    const handleSupplierEditClick = (s) => {
        setSupplierData({
            name: s.name, phone: s.phone, contactPerson: s.contactPerson || '',
            email: s.email || '',
            address: s.address || ''
        });
        setEditSupplierId(s.id);
        setIsEditingSupplier(true);
    };

    /**
     * Updates supplier corporate information in the database.
     */
    const updateSupplier = async () => {
        try {
            await axios.put(`https://localhost:7168/api/Suppliers/${editSupplierId}`, {
                Id: editSupplierId, // Primary Key for SQL
                Name: supplierData.name,
                Phone: supplierData.phone,
                ContactPerson: supplierData.contactPerson,
                Email: supplierData.email,
                Address: supplierData.address
                // If you added IsActive later, add it here too: isActive: true
            });

            await fetchSuppliers(); // Refresh the table
            // Clear the form fields
            setSupplierData({
                name: '',
                phone: '',
                contactPerson: '',
                email: '',
                address: ''
            });
            setIsEditingSupplier(false);
            alert("✅ Supplier Updated Successfully!");
        } catch (error) {
            console.error("Update Error:", error.response?.data || error.message);
            // Professional Error Handling
            if (error.response?.status === 405) {
                alert("❌ Error 405: The C# Controller is missing the [HttpPut] method.");
            } else {
                alert("❌ Update failed. Check the Black C# Console for SQL errors.");
            }
        }
    };

    /**
     * Removes a supplier and triggers a cascade check for shipment history.
     */
    const deleteSupplier = async (id) => {
        // Professional Confirmation Message
        if (window.confirm("⚠️ WARNING: Deleting a supplier will affect all linked supply history! Proceed?")) {
            try {
                // Sends the DELETE request to your C# API
                await axios.delete(`https://localhost:7168/api/Suppliers/${id}`);

                // UI Update: Remove from the local list immediately
                setSuppliers(suppliers.filter(s => s.id !== id));

                // IMPORTANT: Refresh the history table too
                // Since the supplier is gone, their history is also gone from SQL
                await fetchPurchaseHistory();

                alert("✅ Supplier and related history removed.");
            } catch (error) {
                console.error("Delete Error:", error);
                alert("❌ Cannot delete: Please ensure the C# Delete method handles cascading history.");
            }
        }
    };

    /**
     * Finalizes and records a stock shipment, triggering an inventory increase.
     */
    const handleRecordPurchase = async () => {
        if (!order.medicineId || !order.supplierId || !order.quantity) {
            alert("⚠️ Please verify all shipment fields.");
            return;
        }

        try {
            // This sends the shipment to your C# API
            await axios.post('https://localhost:7168/api/Suppliers/RecordShipment', {
                medicineId: parseInt(order.medicineId),
                supplierId: parseInt(order.supplierId),
                quantityReceived: parseInt(order.quantity),
                costPrice: parseFloat(order.costPrice || 0)
            });

            // 3. REFRESH: This is the "Smart" part that updates your screen
            await fetchPurchaseHistory(); // Refreshes the new history table
            await fetchMedicines();       // Updates the stock counts in the main inventory
            // Clear the order form
            setOrder({ medicineId: '', supplierId: '', quantity: 0, costPrice: 0 });

            alert("✅ Shipment recorded! Stock has been updated.");   
        } catch (error) {
            console.error("Purchase Error:", error);
            alert("❌ Failed to record shipment. Check the Black C# Console.");
        }
    };
    /**
     * Retrieves the complete historical log of stock shipments from suppliers.
     */
    const fetchPurchaseHistory = async () => {
        try {
            const response = await axios.get('https://localhost:7168/api/Suppliers/PurchaseHistory');

            // This updates the '📜 Supply & Purchase History' table on your screen
            setPurchaseHistory(response.data);
        } catch (error) {
            console.error("History Error:", error.response?.data || error.message);
        }
    };
    

    /**
     * Aggregates global sales data for trending and velocity analytics.
     */
    const fetchSalesHistory = async () => {
        try {
            const response = await axios.get('https://localhost:7168/api/Patients/AllSales');
            setSalesHistory(response.data);
        } catch (error) {
            console.error("Sales Fetch Error:", error);
        }
    };



    // =========================================================
    // 15. TRANSACTIONAL LOGIC (Cart & Checkout)
    // =========================================================

    /**
     * Adds medicine to the virtual cart. 
     * Includes an automated Clinical Interaction check against existing items.
     */
    const addToCart = async (newMedicine) => {
        if (!newMedicine) return;

        // 1. DATA PREP: Support both Capital (SQL) and Small (Legacy) names
        const medName = newMedicine.Name || newMedicine.name;
        const medId = newMedicine.Id || newMedicine.id;
        const medPrice = Number(newMedicine.Price || newMedicine.price || 0);

        // Check Active Status//Validation: Prevent selection of inactive stock
        const isActive = newMedicine.IsActive ?? newMedicine.isActive;
        if (isActive === false) {
            alert(`🚫 ${medName} is currently restricted (Inactive).`);
            return;
        }


        // 2. AUTOMATED CLINICAL GUARD: Check interactions with every item already in cart
        for (const cartItem of cart) {
            try {
                const response = await axios.get(
                    `https://localhost:7168/api/Medicines/CheckInteractionByMedicine?med1=${medName}&med2=${cartItem.name}`
                );

                if (response.data.includes("DANGER") || response.data.includes("⚠️")) {
                    const proceed = window.confirm(
                        `🚨 CLINICAL INTERACTION ALERT:\n\n` +
                        `New Item: ${medName}\n` +
                        `Cart Item: ${cartItem.name}\n\n` +
                        `${response.data}\n\n` +
                        `Add anyway?`
                    );
                    if (!proceed) return;
                }
            } catch (error) {
                if (error.response?.status === 400) {
                    const proceed = window.confirm(`🛑 CLINICAL DANGER:\n\n${error.response.data}\n\nProceed anyway?`);
                    if (!proceed) return;
                }
            }
        }

        // 3. FINAL CART LOGIC: Update state
        const existingItem = cart.find(item => item.id === medId);

        if (existingItem) {
            setCart(cart.map(item =>
                item.id === medId
                    ? { ...item, quantity: item.quantity + 1, totalPrice: (item.quantity + 1) * medPrice }
                    : item
            ));
        } else {
            const newItem = {
                id: medId,
                name: medName,
                price: medPrice,
                quantity: 1,
                totalPrice: medPrice,
                cartId: Date.now() // Unique ID for React mapping
            };
            setCart([...cart, newItem]);
        }
    };

    /**
     * Finalizes order based on User Role.
     * Clients create 'OnlineOrders' while Staff record 'PatientPurchases'.
     */
    const removeFromCart = (cartId) => {
        setCart(cart.filter(item => item.cartId !== cartId));
    };
    const handleCheckout = async () => {
        if (cart.length === 0) return;

        const finalAddress = deliveryInfo.address.trim();

        if (userRole === 'Client' && finalAddress === "") {
            alert("⚠️ Please enter a delivery address before confirming.");
            return;
        }

        // CRITICAL: If you are a client but somehow the ID didn't load, stop here.
        if (userRole === 'Client' && !currentUserId) {
            alert("❌ Session Error: Please log out and log back in to refresh your User ID.");
            return;
        }

        let customerIdentifier = "";
        let displayIdentifier = "";

        if (userRole === 'Client') {
            customerIdentifier = loginCredentials.username;
            displayIdentifier = loginCredentials.username;
        } else {
            const phone = prompt("Enter Patient Phone Number (Leave blank for Anonymous):");
            customerIdentifier = phone || "0000000000";
            displayIdentifier = phone || "Walk-in Customer";
        }

        try {
            for (const item of cart) {
                if (userRole === 'Client') {
                    // CHANGE: Match C# Property Names EXACTLY (Upper Case first letter)
                    const orderPayload = {
                        UserId: parseInt(currentUserId),
                        MedicineName: String(item.name),
                        Quantity: parseInt(item.quantity),
                        TotalPrice: parseFloat(item.totalPrice),
                        ShippingAddress: finalAddress,
                        PaymentMethod: String(deliveryInfo.method || "Cash"),
                        Status: "Processing",
                        OrderDate: new Date().toISOString()
                    };

                    console.log("Sending Payload to SQL:", orderPayload);
                    await axios.post('https://localhost:7168/api/OnlineOrders', orderPayload);
                } else {
                    await axios.post('https://localhost:7168/api/Patients/RecordPurchase', {
                        patientPhone: customerIdentifier,
                        medicineName: item.name,
                        quantity: parseInt(item.quantity),
                        totalPrice: parseFloat(item.totalPrice)
                    });
                }
            }

            // Generate Invoice & Refresh
            setCurrentInvoice({
                items: cart,
                total: cart.reduce((sum, item) => sum + item.totalPrice, 0),
                date: new Date().toLocaleString(),
                patient: displayIdentifier,
                address: finalAddress,
                paymentMethod: deliveryInfo.method
            });

            await fetchMedicines();
            await fetchPatients();
            if (userRole === 'Client') await fetchMyHistory();

            setIsOrderPlaced(true);
            setCheckoutStep('shop');
            setCart([]);

            alert(userRole === 'Client' ? `✅ Order confirmed! Delivering to: ${finalAddress}` : "✅ Sale Complete!");

        } catch (error) {
            console.error("DEBUG SERVER ERROR:", error.response?.data);
            // This will show you exactly which field C# is unhappy with
            const errorDetail = JSON.stringify(error.response?.data?.errors || error.response?.data);
            alert(`❌ Checkout Failed: ${errorDetail}`);
        }
    };

    /**
     * Securely retrieves the order history for the authenticated Client profile.
     */
    const fetchMyHistory = async () => {
        // 1. CHANGE: Check for currentUserId instead of just username
        // If currentUserId is null or 0, the API call will fail with a 400 error
        if (!currentUserId) {
            console.warn("Cannot fetch history: User ID is missing. Try logging in again.");
            return;
        }

        try {
            // 2. We use backticks `` for the URL to correctly insert the variable
            const response = await axios.get(`https://localhost:7168/api/OnlineOrders/MyHistory/${currentUserId}`);

            // 3. Optional: Add a console log to see what data is coming back from SQL
            console.log("Orders loaded from SQL:", response.data);

            setMyOrders(response.data);
        } catch (error) {
            console.error("Error fetching order history:", error);
            // Reset to empty array so the table shows "No orders found" instead of crashing
            setMyOrders([]);
        }
    };


    /**
     * Executes the Smart Discounting algorithm on a specific SKU.
     * Adjusts the current price while preserving the original BasePrice.
     */
    const handleApplyInventoryDiscount = async (med) => {
        // 1. Calculate the discount details first
        const discountFactor = getSmartDiscount(med.expiryDate);
        if (discountFactor === 0) return;

        // FIX: Always calculate based on the original BasePrice
        const suggestedPrice = (med.basePrice * (1 - discountFactor)).toFixed(2);
        const percentage = (discountFactor * 100).toFixed(0);

        // If the current price is already equal to or lower than the suggestion, stop.
        if (med.price <= parseFloat(suggestedPrice)) {
            alert("This discount has already been applied.");
            setDismissedSuggestions(prev => [...prev, med.id]);
            return;
        }

        // 2. Professional confirmation including the percentage
        if (window.confirm(`Apply ${percentage}% smart discount? New price: ${suggestedPrice} EGP`)) {
            try {
                await axios.put(`${API_URL}/${med.id}`, {
                    ...med,
                    price: parseFloat(suggestedPrice),
                    basePrice: med.basePrice, // Keep original base price permanent
                    Id: med.id
                });
                setMedicines(prev => prev.map(m =>
                    m.id === med.id ? { ...m, price: parseFloat(suggestedPrice) } : m
                ));

                // 4. Update UI: Change the price immediately
                /*setMedicines(prev => prev.map(m =>
                    m.id === med.id ? { ...m, price: parseFloat(suggestedPrice), basePrice: m.basePrice || m.price } : m
                ));*/

                // 6. Hide the yellow decision box (Move it to dismissed)
                setDismissedSuggestions(prev => [...prev, med.id]);

                alert(`✅ Success: ${percentage}% Discount Applied!`);
            } catch (error) {
                console.error("Discount Error:", error);
                alert("❌ Database update failed. Check the C# console.");
            }
        }
    };









    // =========================================================
    // 16. SYSTEM UTILITIES & LIFECYCLE
    // =========================================================

    /**
     * Captures physical barcode scanner input (mimicked via Keyboard events).
     */
    const handleBarcodeKeyDown = (e) => {
        if (e.key === 'Enter') {
            const foundMed = medicines.find(m => m.barcode === barcodeInput);

            if (foundMed) {
                // Instead of recordPurchase, we call addToCart
                addToCart(foundMed);
                setBarcodeInput(''); // Clear for the next scan
            } else {
                alert("⚠️ Barcode not found in inventory.");
                setBarcodeInput('');
            }
        }
    };

    /**
     * Global Initialization: Loads all background data and restores session.
     */
    useEffect(() => {
        // 1. Load Data from Backend
        fetchMedicines();
        fetchPatients();
        fetchSuppliers();
        fetchPurchaseHistory();
        fetchSalesHistory();

        // 2. SAFE Session Restore
        const id = localStorage.getItem('savedUserId');
        const role = localStorage.getItem('savedUserRole');
        const username = localStorage.getItem('savedUsername');

        // Added safety: checks that id is a real value and not the string "null"
        if (id && id !== "null" && id !== "undefined" && role) {
            setCurrentUserId(parseInt(id));
            setUserRole(role);
            setIsLoggedIn(true);

            // Sync username for checkout logic
            setLoginCredentials(prev => ({ ...prev, username: username }));

            // Auto-navigate to correct dashboard
            if (role === 'Client') {
                setView('client_store');
            } else {
                setView('inventory');
            }
        }
    }, []); 

    // =========================================================
    // 17. UI HELPER & DATA TRANSFORMATION
    // =========================================================

    /**
     * Resets the inventory form to default values.
     */
    const clearForm = () => {
        setFormData({ name: '', activeIngredient: '', price: 0, stockQuantity: 0, expiryDate: '', category: '', barcode: '' });
        setIsEditing(false);
        setEditId(null);
    };

    /**
     * Populates the form with existing medicine data for modification.
     */
    const handleEditClick = (med) => {
        setFormData({
            name: med.name, activeIngredient: med.activeIngredient, price: med.price,
            stockQuantity: med.stockQuantity, expiryDate: med.expiryDate?.split('T')[0], category: med.Category || med.category || '', barcode: med.barcode || ''
        });
        setEditId(med.id);
        setIsEditing(true);
    };

    /**
     * Triggers the browser's native print interface for reporting.
     */
    const handlePrint = () => { window.print(); };
    
    /**
     * Performs a multi-criteria search filter on the medicine array.
     * Normalizes case-sensitivity for both Name and Category.
     */
    const filteredMedicines = medicines.filter(med => {
        // CHANGE: Added safety check if med is null
        if (!med) return false;

        // CHANGE: Support both Name (Capital) and name (Small)
        const name = (med?.name || med?.Name || "").toString().toLowerCase();
        const category = (med.Category || med.category || "").toString().toLowerCase();
        const search = searchTerm.toLowerCase().trim();

        return name.includes(search) || category.includes(search);
    });

    // Final check for the Sales Map before rendering the UI
    console.log("Calculated Sales Map:", salesCountMap);
    
    


    return (
        <div className="App">

            {/* --- THE GATEKEEPER --- */}
            {!isLoggedIn ? (
                <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' }}>
                    <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '15px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', width: '380px', textAlign: 'center' }}>
                        <h2 style={{ color: '#28a745', marginBottom: '20px' }}>
                            {isRegistering ? "📝 Client Registration" : "✚ Smart Pharmacy Login"}
                        </h2>

                        <input
                            placeholder="Username"
                            style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '5px', border: '1px solid #ddd', color: 'black' }}
                            onChange={e => setLoginCredentials({ ...loginCredentials, username: e.target.value })}
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '5px', border: '1px solid #ddd', color: 'black' }}
                            onChange={e => setLoginCredentials({ ...loginCredentials, passwordHash: e.target.value })}
                        />

                        {/* SHOW THESE ONLY DURING REGISTRATION */}
                        {isRegistering && (
                            <>
                                <input
                                    placeholder="Full Name"
                                    style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '5px', border: '1px solid #ddd', color: 'black' }}
                                    onChange={e => setLoginCredentials({ ...loginCredentials, fullName: e.target.value })}
                                />
                                <input
                                    placeholder="Phone Number"
                                    style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '5px', border: '1px solid #ddd', color: 'black' }}
                                    onChange={e => setLoginCredentials({ ...loginCredentials, phoneNumber: e.target.value })}
                                />
                            </>
                        )}

                        {/* ONLY SHOW ROLE SELECTOR FOR STAFF LOGIN */}
                        {!isRegistering && (
                            <select
                                style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '5px', border: '1px solid #ddd', backgroundColor: 'white', color: 'black' }}
                                value={loginCredentials.role || 'Staff'}
                                onChange={e => setLoginCredentials({ ...loginCredentials, role: e.target.value })}
                            >
                                <option value="Admin">🛡️ Admin</option>
                                <option value="Pharmacist">💊 Pharmacist</option>
                                <option value="Staff">👤 Staff</option>
                                <option value="Client">🛒 Client (Public)</option>
                            </select>
                        )}

                        <button
                            onClick={isRegistering ? handleRegister : handleLogin}
                            style={{ width: '100%', padding: '12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            {isRegistering ? "Create Client Account" : "Enter Pharmacy System"}
                        </button>

                        <p
                            onClick={() => setIsRegistering(!isRegistering)}
                            style={{ marginTop: '15px', fontSize: '13px', color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            {isRegistering ? "Already have an account? Login here" : "New Customer? Register as a Client"}
                        </p>
                    </div>
                </div>
            ) : (
            
                /* 2. MAIN APP: Shown only after successful login */
                <header className="App-header">
                    <h1>Smart Pharmacy Management System</h1>

                        {/* --- NAVIGATION & ROLE SWITCHER --- */}
                        <div className="no-print" style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'center' }}>
                            <div style={{ backgroundColor: '#444', padding: '10px', borderRadius: '8px' }}>

                                {/* 🛡️ ROLE-BASED NAVIGATION */}
                                {userRole === 'Client' ? (
                                    /* Only the Client sees these two buttons */
                                    <>
                                    <button
                                        onClick={() => setView('client_store')}
                                        style={{ backgroundColor: view === 'client_store' ? '#28a745' : 'transparent', border: 'none', color: 'white', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                                    >
                                        🛒 Shop Medicines
                                        </button>
                                        <button
                                            onClick={() => {
                                                setView('my_orders');
                                                fetchMyHistory(); // <--- Add this call here!
                                            }}
                                            style={{
                                                marginLeft: '10px',
                                                backgroundColor: view === 'my_orders' ? '#28a745' : 'transparent',
                                                border: 'none', color: 'white', padding: '8px 15px',
                                                borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold'
                                            }}
                                        >
                                            📜 My Orders
                                        </button>
                                    </>

                                ) : (
                                    /* Admin, Pharmacist, and Staff see the full menu */
                                    <>
                                        <button onClick={() => setView('inventory')} style={{ marginRight: '10px', backgroundColor: view === 'inventory' ? '#007bff' : 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>📦 Inventory</button>
                                        <button onClick={() => setView('patients')} style={{ marginRight: '10px', backgroundColor: view === 'patients' ? '#007bff' : 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>👥 Patients</button>
                                        <button onClick={() => setView('suppliers')} style={{ backgroundColor: view === 'suppliers' ? '#007bff' : 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>🚚 Suppliers</button>
                                    </>
                                )}
                            </div>

                            {/* User Info & Logout (Stays the same for everyone) */}
                            <div style={{ borderLeft: '1px solid white', paddingLeft: '20px', display: 'flex', alignItems: 'center' }}>
                                <span style={{ fontSize: '14px', color: 'white' }}>Logged in as: </span>
                                <span style={{ color: '#28a745', fontWeight: 'bold', fontSize: '16px', marginLeft: '5px' }}>{userRole}</span>
                                <button
                                    onClick={handleLogout} // <--- Simply call the function name here
                                    style={{
                                        marginLeft: '15px',
                                        backgroundColor: '#dc3545',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        padding: '5px 10px',
                                        cursor: 'pointer',
                                        fontSize: '12px'
                                    }}
                                >
                                    Logout / Change User
                                </button>
                            </div>
                        </div>

                        {/* --- VIEW 1: INVENTORY --- */}
                        {view === 'inventory' && userRole !== 'Client' && (
                        <>
                            {/* 1. STATISTICS */}
                            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-around', gap: '20px', marginBottom: '30px', width: '95%' }}>
                                {/* Box 1: Original Blue Box (Product Types) */}
                                <div style={{ flex: 1, backgroundColor: '#007bff', color: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                                    <h2 style={{ fontSize: '28px', margin: 0 }}>{totalItems}</h2>
                                    <p style={{ margin: '5px 0 0 0', fontWeight: 'bold' }}>Total Product Types</p>
                                </div>
                                {/* NEW Box 2: Total physical units in the whole pharmacy */}
                                <div style={{ flex: 1, backgroundColor: '#17a2b8', color: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                                    <h2 style={{ fontSize: '28px', margin: 0 }}>{totalUnits}</h2>
                                    <p style={{ margin: '5px 0 0 0', fontWeight: 'bold' }}>Total Units In Stock</p>
                                </div>
                                {/* Box 3: Low Stock Alerts */}
                                <div style={{ flex: 1, backgroundColor: '#dc3545', color: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                                    <h2 style={{ fontSize: '28px', margin: 0 }}>{lowStockCount}</h2>
                                    <p style={{ margin: '5px 0 0 0', fontWeight: 'bold' }}>Low Stock 🚨</p>
                                </div>
                                {/* Box 4: Expiring Soon */}
                                    {/* COMBINED EXPIRY & FINANCIAL RISK BOX */}
                                    <div style={{
                                        flex: 1.5, // Make this box slightly wider than the others for emphasis
                                        backgroundColor: '#ffc107',
                                        color: '#000',
                                        padding: '20px',
                                        borderRadius: '12px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                        borderLeft: '8px solid #fd7e14', // High-contrast orange strip
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <span style={{ fontWeight: '800', fontSize: '12px', textTransform: 'uppercase', color: '#856404' }}>
                                                ⚠️ Expiry Alert Center
                                            </span>
                                            <span style={{
                                                backgroundColor: '#fd7e14',
                                                color: 'white',
                                                padding: '2px 8px',
                                                borderRadius: '10px',
                                                fontSize: '10px',
                                                fontWeight: 'bold'
                                            }}>
                                                ACTION REQUIRED
                                            </span>
                                        </div>

                                        <h2 style={{ fontSize: '32px', margin: '10px 0 5px 0', fontWeight: '900' }}>
                                            {expiringCount} <small style={{ fontSize: '14px', fontWeight: '600' }}>Items Expiring</small>
                                        </h2>

                                        <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '10px', marginTop: '5px' }}>
                                            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#d9480f' }}>
                                                {medicines
                                                    .filter(m => getSmartDiscount(m.ExpiryDate || m.expiryDate) > 0 && (m.Price || m.price) >= (m.BasePrice || m.basePrice))
                                                    .reduce((sum, m) => sum + (Number(m.Price || m.price || 0) * (m.StockQuantity || m.stockQuantity || 0)), 0).toFixed(2)} EGP
                                            </span>
                                            <div style={{
                                                fontSize: '11px',
                                                fontWeight: '700',
                                                color: '#d9480f',
                                                textTransform: 'uppercase',
                                                marginTop: '2px'
                                            }}>
                                                ⚠️ Requires Attention (Capital at Risk)
                                            </div>
                                        </div>
                                    </div>
                                    {/* Box 5: Sales Velocity Insight */}
                                    <div style={{ flex: 1, backgroundColor: '#6610f2', color: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                                        <h2 style={{ fontSize: '24px', margin: 0 }}>
                                            {medicines.filter(m => {
                                                const n = (m.name || m.Name || "").toLowerCase().trim();
                                                return salesCountMap[n] >= TRENDING_THRESHOLD;
                                            }).length}
                                        </h2>
                                        <p style={{ margin: '5px 0 0 0', fontWeight: 'bold' }}>Trending Products 🔥</p>
                                    </div>
                                    {/* Box 6:Out of Stock (Dead Stock) */}
                                    <div style={{ flex: 1, backgroundColor: '#6c757d', color: 'white', padding: '20px', borderRadius: '10px' }}>
                                        <h2 style={{ fontSize: '24px', margin: 0 }}>
                                            {medicines.filter(m => (m.StockQuantity ?? m.stockQuantity) === 0 && (m.IsActive ?? m.isActive)).length}
                                        </h2>
                                        <p style={{ margin: '5px 0 0 0', fontWeight: 'bold' }}>Out of Stock (Dead Stock)</p>
                                    </div>

                            </div>

                            {/*"Safety Clean-up" Button*/}
                            <div className="no-print" style={{ textAlign: 'center', marginBottom: '20px' }}>
                                <button
                                    onClick={disableExpiredMedicines}
                                    style={{
                                        backgroundColor: '#6f42c1', // Purple for "Special Tools"
                                        color: 'white',
                                        padding: '10px 20px',
                                        border: 'none',
                                        borderRadius: '5px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    🧹 Auto-Disable All Expired Stock
                                </button>
                                </div>
                                

                            {/* 2. ENTRY FORM */}
                            {(userRole === 'Admin' || userRole === 'Pharmacist') && (
                                <div className="no-print" style={{ backgroundColor: '#e2e2e2', padding: '20px', borderRadius: '10px', color: 'black', marginBottom: '20px', width: '85%' }}>
                                    <h3>{isEditing ? "📝 Modify Medicine" : "➕ Add New Inventory"}</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                        <input placeholder="Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                        <input placeholder="Ingredient" value={formData.activeIngredient} onChange={e => setFormData({ ...formData, activeIngredient: e.target.value })} />
                                        <input type="number" placeholder="Price" value={formData.price} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })} />
                                        <input type="number" placeholder="Stock" value={formData.stockQuantity} onChange={e => setFormData({ ...formData, stockQuantity: parseInt(e.target.value) })} />
                                        <input type="date" value={formData.expiryDate} onChange={e => setFormData({ ...formData, expiryDate: e.target.value })} />
                                        <input placeholder="Category" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} />
                                            <input placeholder="📟 Barcode (Optional)" value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} style={{ border: '2px solid #28a745' }} />
                                    </div>
                                    <button onClick={isEditing ? updateMedicine : addMedicine} style={{ marginTop: '15px', backgroundColor: isEditing ? 'orange' : 'green', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                                        {isEditing ? "Save Changes" : "Add to Inventory"}
                                    </button>
                                </div>
                            )}

                            {/* 3. ALTERNATIVE MATCHER */}
                            <div className="no-print" style={{ backgroundColor: '#e9ecef', padding: '20px', borderRadius: '10px', color: 'black', marginBottom: '20px', width: '85%' }}>
                                <h3>🔍 Alternative Matcher</h3>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input placeholder="Enter Out-of-Stock Medicine" value={searchAlt} onChange={(e) => setSearchAlt(e.target.value)} style={{ flex: 2, padding: '10px' }} />
                                    <button onClick={findAlternatives} style={{ flex: 1, backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Find Alternatives</button>
                                </div>
                                {alternatives.length > 0 && (
                                    <ul style={{ textAlign: 'left', marginTop: '10px' }}>
                                        {alternatives.map(alt => <li key={alt.id}>{alt.name} - {alt.price} EGP (Stock: {alt.stockQuantity})</li>)}
                                    </ul>
                                )}
                            </div>

                            {/* 4. INTERACTION GUARD */}
                            <div className="no-print" style={{ backgroundColor: '#f0f0f0', padding: '20px', borderRadius: '10px', color: 'black', marginBottom: '20px', width: '85%' }}>
                                <h3>🛡️ Interaction Guard</h3>
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                    <input placeholder="Medicine 1" onChange={(e) => setMed1(e.target.value)} style={{ padding: '8px' }} />
                                    <input placeholder="Medicine 2" onChange={(e) => setMed2(e.target.value)} style={{ padding: '8px' }} />
                                    <button onClick={checkSafety} style={{ padding: '8px 15px', cursor: 'pointer' }}>Check Safety</button>
                                </div>
                                <div style={{ marginTop: '10px', fontWeight: 'bold', color: safetyMessage.includes('DANGER') ? 'red' : 'green' }}>{safetyMessage}</div>
                            </div>

                            {/* 5. TABLE ACTIONS */}
                            <div className="no-print" style={{ width: '85%', display: 'flex', gap: '10px', marginBottom: '20px' }}>
                                <input type="text" placeholder="🔍 Search by Name or Category..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ flex: 3, padding: '12px', borderRadius: '5px' }} />
                                <button onClick={handlePrint} style={{ flex: 1, cursor: 'pointer' }}>🖨️ Print Report</button>
                            </div>

                            {/*barcode*/}
                            <div style={{
                                backgroundColor: '#343a40',
                                padding: '20px',
                                borderRadius: '12px',
                                marginBottom: '30px',
                                width: '100%',
                                maxWidth: '600px', // Limits the width so it's not too wide
                                margin: '0 auto 30px auto', // Centers the box on the screen
                                border: '2px solid #28a745',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.3)', // Adds a nice shadow
                                textAlign: 'center'
                            }}>
                                <h3 style={{ color: '#28a745', marginTop: 0, fontSize: '20px' }}>
                                    📟 Quick Scan (Barcode Simulator)
                                </h3>
                                <input
                                    type="text"
                                    placeholder="Type Barcode and press ENTER..."
                                    value={barcodeInput}
                                    onChange={(e) => setBarcodeInput(e.target.value)}
                                    onKeyDown={handleBarcodeKeyDown}
                                    style={{
                                        width: '90%', // Input stays slightly smaller than the box
                                        padding: '12px',
                                        fontSize: '18px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        outline: 'none',
                                        backgroundColor: '#fff',
                                        textAlign: 'center',
                                        fontWeight: 'bold',
                                        color: '#333'
                                    }}
                                    autoFocus
                                />
                                <p style={{ color: '#aaa', fontSize: '13px', marginTop: '10px', fontStyle: 'italic' }}>
                                    Tip: Real scanners send an 'Enter' signal automatically.
                                </p>
                            </div>

                            {cart.length > 0 && (
                                <div style={{ backgroundColor: '#fff3cd', padding: '20px', borderRadius: '12px', marginBottom: '30px', border: '2px solid #ffc107', color: '#856404', width: '85%' }}>
                                    <h3>🛒 Pending Prescription (Basket)</h3>
                                    <table style={{ width: '100%', marginBottom: '15px' }}>
                                        <thead>
                                            <tr><th>Medicine</th><th>Qty</th><th>Subtotal</th><th>Action</th></tr>
                                        </thead>
                                        <tbody>
                                            {cart.map(item => (
                                                <tr key={item.cartId}>
                                                    <td>{item.name}</td>
                                                    <td>{item.quantity}</td>
                                                    <td>{item.totalPrice} EGP</td>
                                                    <td><button onClick={() => removeFromCart(item.cartId)} style={{ backgroundColor: 'red', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Delete</button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div style={{ textAlign: 'right' }}>
                                        <h4 style={{ margin: '10px 0' }}>Grand Total: {cart.reduce((sum, i) => sum + i.totalPrice, 0)} EGP</h4>
                                        <button onClick={handleCheckout} style={{ backgroundColor: '#28a745', color: 'white', padding: '10px 30px', border: 'none', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
                                            Confirm & Process Purchase
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* 6. TABLE */}
                            <table border="1" style={{ width: '95%', backgroundColor: 'white', color: 'black', borderCollapse: 'collapse', marginBottom: '50px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#ddd' }}>
                                        <th>Category</th><th>Name</th><th>Ingredient</th><th>Price</th><th>Stock</th><th>Expiry</th><th className="no-print">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMedicines.map((med) => {
                                        // FIX: Check BOTH Capital and Small 'i'. 
                                        // Also check if it's 0 or false.
                                        const activeVal = med.IsActive ?? med.isActive;
                                        const isInactive = activeVal === false || activeVal === 0 || activeVal === "0";
                                        const stock = med?.StockQuantity ?? med?.stockQuantity ?? 0; // Checks both cases
                                        const isLow = stock < 10;
                                        const currentPrice = Number(med?.Price ?? med?.price ?? 0);
                                        const basePrice = Number(med?.BasePrice ?? med?.basePrice ?? currentPrice);
                                        const medName = med?.Name || med?.name || "Unknown";
                                        const medCat = med?.Category || med?.category || "General";
                                        const d = new Date(med?.ExpiryDate || med?.expiryDate);
                                        const soon = d <= new Date(new Date().setDate(new Date().getDate() + 30)) && d >= new Date();
                                        return (
                                            <tr key={med.Id || med.id} style={{ backgroundColor: isInactive ? '#f8f9fa' : (isLow ? '#f8d7da' : 'white'), color: isInactive ? '#adb5bd' : 'black', opacity: isInactive ? 0.7 : 1 }}>
                                                <td style={{ padding: '10px' }}>{medCat}</td>
                                                <td>
                                                    {medName}
                                                    {/* Decision Support: Sales Velocity Icon */}
                                                    {salesCountMap[medName.toLowerCase().trim()] >= TRENDING_THRESHOLD && (
                                                        <span
                                                            title={`High Demand: ${salesCountMap[medName.toLowerCase().trim()]} units sold`}
                                                            style={{ marginLeft: '8px', cursor: 'help' }}
                                                        >
                                                            🔥
                                                        </span>
                                                    )}
                                                    {isInactive ? ' 🚫 (Inactive)' : ''}
                                                    {!isInactive && isLow ? ' 🚨' : ''}
                                                    {!isInactive && soon ? ' ⚠️' : ''}
                                                </td>
                                                <td>{med.activeIngredient || med.activeIngredient}</td>

                                                {/*this is the price smart engine*/ }
                                                <td style={{ minWidth: '180px', textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>

                                                        {/* NEW LOGIC: Show the Decision Interface (Style A) ONLY if:
                                                             1. There is an active risk (discountFactor > 0)
                                                                  2. It hasn't been manually dismissed
                                                                         3. The current price is STILL higher than what the engine suggests (med.price > suggested)
                                                                          */}
                                                        {getSmartDiscount(med.expiryDate) > 0 &&
                                                            !dismissedSuggestions.includes(med.id) &&
                                                            currentPrice > (basePrice * (1 - getSmartDiscount(med.expiryDate))).toFixed(2) ? (

                                                            /* --- STYLE A: THE SMART DECISION INTERFACE (STAYS THE SAME) --- */
                                                            <>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                    <input
                                                                        type="number"
                                                                            value={med.price}
                                                                            /* 1. LOCK THE INPUT FOR STAFF */
                                                                            disabled={userRole === 'Staff'}
                                                                        onChange={(e) => {
                                                                            const newPrice = parseFloat(e.target.value);
                                                                            setMedicines(medicines.map(m => m.id === med.id ? { ...m, price: newPrice } : m));
                                                                        }}
                                                                            /* 2. CHANGE STYLE FOR STAFF */
                                                                            style={{
                                                                                width: '80px',
                                                                                padding: '6px',
                                                                                borderRadius: '5px',
                                                                                border: '2px solid #ffc107',

                                                                                // If staff, make it gray and remove the pointer
                                                                                backgroundColor: userRole === 'Staff' ? '#eeeeee' : '#ffffff',
                                                                                color: userRole === 'Staff' ? '#888888' : '#000000',
                                                                                cursor: userRole === 'Staff' ? 'not-allowed' : 'text',

                                                                                fontWeight: 'bold',
                                                                                textAlign: 'center'
                                                                        }}
                                                                    />
                                                                    <span style={{ fontSize: '12px', fontWeight: 'bold' }}>EGP</span>
                                                                </div>

                                                                <div style={{
                                                                    backgroundColor: '#fff3cd',
                                                                    padding: '10px',
                                                                    borderRadius: '8px',
                                                                    border: '1px solid #ffeeba',
                                                                    fontSize: '11px',
                                                                    width: '100%',
                                                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                                                }}>
                                                                    <span style={{ color: '#856404', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                                                                        ⚠️ EXPIRY RISK
                                                                    </span>
                                                                        <div style={{ marginBottom: '8px' }}>
                                                                            {/* Always suggest based on BasePrice to prevent double-discounting */}
                                                                            Suggest: <strong style={{ fontSize: '13px' }}>{(currentPrice * (1 - getSmartDiscount(med.expiryDate))).toFixed(2)}</strong>
                                                                    </div>

                                                                        <div style={{ display: 'flex', gap: '5px' }}>
                                                                            {/* --- ROLE-BASED ACCESS CONTROL (RBAC) --- */}
                                                                            {userRole === 'Admin' || userRole === 'Pharmacist' ? (
                                                                                <>

                                                                        <button
                                                                            onClick={() => handleApplyInventoryDiscount(med)}
                                                                            style={{ flex: 1, backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', padding: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                                                                        >
                                                                            Accept
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setDismissedSuggestions([...dismissedSuggestions, med.id])}
                                                                            style={{ flex: 1, backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', padding: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                                                                        >
                                                                            Discard
                                                                                    </button>
                                                                                </>
                                                                            ) : (
                                                                                /* --- VIEW FOR STAFF --- */
                                                                                <div style={{
                                                                                    flex: 1,
                                                                                    textAlign: 'center',
                                                                                    color: '#856404',
                                                                                    fontStyle: 'italic',
                                                                                    padding: '5px',
                                                                                    border: '1px dashed #ffc107',
                                                                                    borderRadius: '4px'
                                                                                }}>
                                                                                    Pending Approval...
                                                                                </div>
                                                                            )}
                                                                    </div>
                                                                </div>
                                                            </>
                                                        ) : (

                                                            /* --- STYLE B: THE MODIFIED PROFESSIONAL VIEW (WITH BADGE) --- */
                                                                /* --- STYLE B: THE PERMANENT PROFESSIONAL VIEW --- */
                                                                <div style={{ padding: '10px', textAlign: 'center' }}>
                                                                    <span style={{
                                                                        fontSize: '18px',
                                                                        fontWeight: '800',
                                                                        color: '#2c3e50',
                                                                        letterSpacing: '0.5px'
                                                                    }}>
                                                                        {currentPrice.toFixed(2)}
                                                                    </span>
                                                                    <span style={{ fontSize: '11px', marginLeft: '4px', color: '#95a5a6', fontWeight: '600' }}>
                                                                        EGP
                                                                    </span>

                                                                    {/* PERMANENT BADGE: Logic based on Database Values */}
                                                                    {/* If current price is less than original price, show the discount percentage */}
                                                                    {basePrice > currentPrice && (
                                                                        <div style={{
                                                                            marginTop: '8px',
                                                                            backgroundColor: '#d4edda',
                                                                            color: '#155724',
                                                                            fontSize: '10px',
                                                                            fontWeight: 'bold',
                                                                            padding: '4px 10px',
                                                                            borderRadius: '20px',
                                                                            border: '1px solid #c3e6cb',
                                                                            display: 'block',
                                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                                                        }}>
                                                                            ✨ {(((basePrice - currentPrice) / basePrice) * 100).toFixed(0)}% DISCOUNT APPLIED
                                                                        </div>
                                                                    )}
                                                                </div>
                                                        )}
                                                    </div>
                                                </td>
                                                {/*---the end of the smart price engine--*/}
                                                <td>{med.stockQuantity}</td>
                                                <td>{d.toLocaleDateString()}</td>
                                                <td className="no-print">
                                                    {(userRole === 'Admin' || userRole === 'Pharmacist') && <button onClick={() => handleEditClick(med)} style={{ backgroundColor: '#007bff', color: 'white', marginRight: '5px', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>Edit</button>}
                                                    <button
                                                        onClick={() => addToCart(med)}
                                                        disabled={isInactive} // 🔒 Prevents clicking
                                                        style={{
                                                            backgroundColor: isInactive ? '#6c757d' : '#28a745', // Gray if disabled
                                                            color: 'white',
                                                            marginRight: '5px',
                                                            border: 'none',
                                                            borderRadius: '3px',
                                                            cursor: isInactive ? 'not-allowed' : 'pointer', // Shows "No" icon
                                                            opacity: isInactive ? 0.5 : 1
                                                        }}
                                                    >
                                                        {isInactive ? '🚫 Inactive' : '➕ Add to Cart'}
                                                    </button>
                                                    {userRole === 'Admin' && (
                                                        <button
                                                            onClick={() => toggleActiveStatus(med)}
                                                            style={{
                                                                // Check both naming styles for the color
                                                                backgroundColor: (med.IsActive === false || med.IsActive === 0 || med.isActive === false || med.isActive === 0)
                                                                    ? '#28a745'
                                                                    : '#dc3545',
                                                                color: 'white',
                                                                border: 'none',
                                                                padding: '5px 10px',
                                                                borderRadius: '3px',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            {/* Check both naming styles for the text */}
                                                            {(med.IsActive === false || med.IsActive === 0 || med.isActive === false || med.isActive === 0)
                                                                ? 'Enable'
                                                                : 'Disable'}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </>
                        )}
                        {/* --- VIEW: CLIENT STOREFRONT (THE PUBLIC WEBSITE) --- */}
                        {view === 'client_store' && (
                            <div style={{ padding: '40px', backgroundColor: '#f4f7f6', minHeight: '100vh', width: '100%' }}>

                                {/* --- THE SUCCESS MESSAGE --- */}
                                {isOrderPlaced && (
                                    <div style={{
                                        backgroundColor: '#d4edda', color: '#155724', padding: '20px',
                                        borderRadius: '10px', marginBottom: '20px', textAlign: 'center',
                                        border: '1px solid #c3e6cb'
                                    }}>
                                        <h2 style={{ margin: 0 }}>🎉 Thank you for your order!</h2>
                                        <p>Your medicines are being prepared and will be sent to: <strong>{deliveryInfo.address}</strong></p>
                                        <button
                                            onClick={() => setIsOrderPlaced(false)}
                                            style={{ marginTop: '10px', padding: '5px 15px', cursor: 'pointer' }}
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                )}
                                {/* STEP A: THE SHOPPING UI (Only shows if step is 'shop') */}
                                {checkoutStep === 'shop' && (
                                    <>
                                {/* 1. Welcome Header & Client Search */}
                                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                                    <h1 style={{ color: '#28a745', fontSize: '36px', fontWeight: '800' }}>✚ Online Pharmacy Store</h1>
                                    <p style={{ color: '#666', fontSize: '18px' }}>Quality medicine with smart savings on every order.</p>

                                    <input
                                        type="text"
                                        placeholder="🔍 Search for medicine name or category..."
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{
                                            width: '60%', padding: '15px 25px', borderRadius: '40px',
                                            border: '2px solid #28a745', outline: 'none', fontSize: '16px',
                                            boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginTop: '20px', color: 'black'
                                        }}
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', justifyContent: 'center' }}>
                                {/* 3. ALTERNATIVE MATCHER */}
                                <div className="no-print" style={{ backgroundColor: '#e9ecef', padding: '20px', borderRadius: '10px', color: 'black', marginBottom: '20px', width: '85%' }}>
                                    <h3>🔍 Alternative Matcher</h3>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <input placeholder="Enter Out-of-Stock Medicine" value={searchAlt} onChange={(e) => setSearchAlt(e.target.value)} style={{ flex: 2, padding: '10px' }} />
                                        <button onClick={findAlternatives} style={{ flex: 1, backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Find Alternatives</button>
                                    </div>
                                    {alternatives.length > 0 && (
                                        <ul style={{ textAlign: 'left', marginTop: '10px' }}>
                                            {alternatives.map(alt => <li key={alt.id}>{alt.name} - {alt.price} EGP (Stock: {alt.stockQuantity})</li>)}
                                        </ul>
                                    )}
                                </div>

                                {/* 4. INTERACTION GUARD */}
                                <div className="no-print" style={{ backgroundColor: '#f0f0f0', padding: '20px', borderRadius: '10px', color: 'black', marginBottom: '20px', width: '85%' }}>
                                    <h3>🛡️ Interaction Guard</h3>
                                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                        <input placeholder="Medicine 1" onChange={(e) => setMed1(e.target.value)} style={{ padding: '8px' }} />
                                        <input placeholder="Medicine 2" onChange={(e) => setMed2(e.target.value)} style={{ padding: '8px' }} />
                                        <button onClick={checkSafety} style={{ padding: '8px 15px', cursor: 'pointer' }}>Check Safety</button>
                                    </div>
                                    <div style={{ marginTop: '10px', fontWeight: 'bold', color: safetyMessage.includes('DANGER') ? 'red' : 'green' }}>{safetyMessage}</div>
                                </div>
                                </div>
                                {/* 2. TRENDING & OFFERS SECTION */}
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '40px' }}>
                                    <div style={{ padding: '10px 20px', backgroundColor: '#6610f2', color: 'white', borderRadius: '50px', fontWeight: 'bold', fontSize: '14px' }}>
                                        🔥 Trending Now
                                    </div>
                                    <div style={{ padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', borderRadius: '50px', fontWeight: 'bold', fontSize: '14px' }}>
                                        📉 Smart Savings Applied
                                    </div>
                                </div>

                                        {/* 3. THE PRODUCT GRID (Card View) */}
                                        <div style={{
                                            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                            gap: '30px', maxWidth: '1200px', margin: '0 auto'
                                        }}>
                                            {filteredMedicines
                                                .filter(m => {
                                                    // 1. Check for both naming styles (Capital and Small)
                                                    const isActive = m?.IsActive ?? m?.isActive;
                                                    const stock = m?.StockQuantity ?? m?.stockQuantity;

                                                    // Return only active items with stock > 0
                                                    return isActive !== false && stock > 0;
                                                })
                                                .map(med => {
                                                    // 2. CRASH PROTECTION: Ensure price and basePrice are numbers
                                                    const currentPrice = Number(med?.Price ?? med?.price ?? 0);
                                                    const basePrice = Number(med?.BasePrice ?? med?.basePrice ?? currentPrice);
                                                    const medName = med?.Name || med?.name || "Unknown Medicine";
                                                    const medCat = med?.Category || med?.category || "General";

                                                    return (
                                                        <div key={med?.Id || med?.id} style={{
                                                            backgroundColor: 'white', padding: '30px', borderRadius: '20px',
                                                            boxShadow: '0 10px 25px rgba(0,0,0,0.05)', textAlign: 'center',
                                                            border: '1px solid #eee', position: 'relative'
                                                        }}>
                                                            {/* Discount Badge */}
                                                            {basePrice > currentPrice && (
                                                                <div style={{
                                                                    position: 'absolute', top: '15px', right: '15px',
                                                                    backgroundColor: '#dc3545', color: 'white',
                                                                    padding: '5px 15px', borderRadius: '50px',
                                                                    fontSize: '12px', fontWeight: 'bold'
                                                                }}>
                                                                    SAVE {(((basePrice - currentPrice) / basePrice) * 100).toFixed(0)}%
                                                                </div>
                                                            )}

                                                            <div style={{ fontSize: '70px', marginBottom: '20px' }}>💊</div>

                                                            <h3 style={{ margin: '0 0 10px 0', fontSize: '22px', color: '#333' }}>
                                                                {medName}
                                                                {/* Trending Logic */}
                                                                {salesCountMap[medName?.toLowerCase()?.trim() || ""] >= TRENDING_THRESHOLD && (
                                                                    <span style={{ marginLeft: '8px' }} title="Trending Product">🔥</span>
                                                                )}
                                                            </h3>

                                                            <p style={{ color: '#adb5bd', fontSize: '14px', marginBottom: '20px', textTransform: 'uppercase' }}>
                                                                {medCat}
                                                            </p>

                                                            {/* Pricing Section */}
                                                            <div style={{ marginBottom: '25px' }}>
                                                                {basePrice > currentPrice && (
                                                                    <span style={{ textDecoration: 'line-through', color: '#ced4da', marginRight: '15px', fontSize: '18px' }}>
                                                                        {basePrice.toFixed(2)} EGP
                                                                    </span>
                                                                )}
                                                                <span style={{ fontSize: '28px', fontWeight: '900', color: '#28a745' }}>
                                                                    {currentPrice.toFixed(2)} <small style={{ fontSize: '14px' }}>EGP</small>
                                                                </span>
                                                            </div>

                                                            <button
                                                                onClick={() => {
                                                                    addToCart(med);
                                                                    if (window.confirm(`✅ ${medName} added! Go to checkout now?`)) {
                                                                        setCheckoutStep('cart');
                                                                    }
                                                                }}
                                                                style={{
                                                                    width: '100%', padding: '15px', backgroundColor: '#28a745',
                                                                    color: 'white', border: 'none', borderRadius: '15px',
                                                                    cursor: 'pointer', fontWeight: 'bold', fontSize: '16px'
                                                                }}
                                                            >
                                                                🛒 Add to Order
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </>
                                )}
                                {/* --- VIEW: MY ORDERS (HISTORY FOR CLIENTS) --- */}
                                {view === 'my_orders' && (
                                    <div style={{ padding: '40px', backgroundColor: '#f4f7f6', minHeight: '100vh', width: '100%', color: 'black', textAlign: 'left' }}>
                                        <h2 style={{ color: '#333' }}>📦 My Online Orders</h2>
                                        <p style={{ color: '#666' }}>Track your recent pharmacy purchases and delivery status.</p>
                                        <hr style={{ marginBottom: '30px' }} />

                                        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                                                        <th style={{ padding: '15px' }}>Date</th>
                                                        <th>Medicine Items</th>
                                                        <th>Delivery Address</th>
                                                        <th>Total Paid</th>
                                                        <th>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {myOrders.length > 0 ? (
                                                        myOrders.map((order) => (
                                                            <tr key={order.id} style={{ borderBottom: '1px solid #eee' }}>
                                                                <td style={{ padding: '15px' }}>
                                                                    {new Date(order.orderDate).toLocaleDateString()}
                                                                </td>
                                                                <td style={{ padding: '10px' }}>{order.medicineName}</td>
                                                                <td style={{ padding: '10px' }}>{order.shippingAddress}</td>
                                                                <td style={{ padding: '10px', fontWeight: 'bold' }}>
                                                                    {order.totalPrice.toFixed(2)} EGP
                                                                </td>
                                                                <td style={{ padding: '10px' }}>
                                                                    <span style={{
                                                                        backgroundColor: order.status === 'Delivered' ? '#d4edda' : '#fff3cd',
                                                                        color: order.status === 'Delivered' ? '#155724' : '#856404',
                                                                        padding: '5px 12px',
                                                                        borderRadius: '20px',
                                                                        fontSize: '12px',
                                                                        fontWeight: 'bold',
                                                                        display: 'inline-block'
                                                                    }}>
                                                                        {order.status === 'Delivered' ? '✅ Delivered' : '🚚 ' + order.status}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#999' }}>
                                                                No orders found yet. Start shopping to see your history!
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        <button
                                            onClick={() => setView('client_store')}
                                            style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                                        >
                                            ⬅ Back to Shopping
                                        </button>
                                    </div>
                                )}
                                {/* STEP B: THE CHECKOUT UI (Only shows if step is 'cart') */}
                                {checkoutStep === 'cart' && (
                                    <div style={{ maxWidth: '1000px', margin: '0 auto', color: 'black' }}>
                                        <button
                                            onClick={() => setCheckoutStep('shop')}
                                            style={{ marginBottom: '20px', padding: '10px 20px', borderRadius: '10px', border: '1px solid #ccc', cursor: 'pointer' }}
                                        >
                                            ⬅ Back to Medicines
                                        </button>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '30px' }}>

                                            {/* LEFT: ORDER SUMMARY (The Pending Card) */}
                                            <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                                                <h2 style={{ color: '#28a745' }}>🛒 Finalize Your Order</h2>
                                                <hr />
                                                {cart.map(item => (
                                                    <div key={item.cartId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #eee' }}>
                                                        <div style={{ flex: 1, textAlign: 'left' }}>
                                                            <strong style={{ fontSize: '18px', color: 'black' }}>{item.name}</strong>
                                                            <p style={{ margin: 0, color: '#666' }}>Quantity: {item.quantity}</p>
                                                        </div>
                                                        <strong style={{ fontSize: '18px', marginRight: '20px', color: 'black' }}>{item.totalPrice.toFixed(2)} EGP</strong>

                                                        <button
                                                            onClick={() => removeFromCart(item.cartId)}
                                                            style={{ backgroundColor: '#ffefef', color: '#dc3545', border: '1px solid #dc3545', borderRadius: '5px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px' }}
                                                        >
                                                            🗑️ Remove
                                                        </button>
                                                    </div>
                                                ))}
                                                <div style={{ textAlign: 'right', marginTop: '20px' }}>
                                                    <h3 style={{ fontSize: '24px' }}>Total Cost: {cart.reduce((sum, i) => sum + i.totalPrice, 0).toFixed(2)} EGP</h3>
                                                </div>
                                            </div>

                                            {/* RIGHT: ADDRESS & PAYMENT DETAILS */}
                                            <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                                                <h3 style={{ marginTop: 0 }}>🚚 Delivery Info</h3>
                                                <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Shipping Address:</label>
                                                <textarea
                                                    placeholder="Street Name, Building No, Apartment..."
                                                    style={{ width: '100%', padding: '10px', margin: '10px 0', borderRadius: '8px', border: '1px solid #ddd', height: '80px', color: 'black' }}
                                                    value={deliveryInfo.address} // <--- Add this line
                                                    onChange={(e) => setDeliveryInfo({ ...deliveryInfo, address: e.target.value })}
                                                />

                                                <h3 style={{ marginTop: '20px' }}>💳 Payment Options</h3>
                                                <select
                                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
                                                    onChange={(e) => setDeliveryInfo({ ...deliveryInfo, method: e.target.value })}
                                                >
                                                    <option value="Cash">💵 Cash on Delivery</option>
                                                    <option value="Visa">💳 Pay by Visa / Card</option>
                                                </select>

                                                {/* Optional: Simple Package/Service fee calculation */}
                                                <div style={{ marginTop: '15px', fontSize: '13px', color: '#666' }}>
                                                    Package Handling: 5.00 EGP (Included)
                                                </div>

                                                <button
                                                    onClick={handleCheckout}
                                                    style={{
                                                        width: '100%', marginTop: '30px', padding: '15px',
                                                        backgroundColor: '#28a745', color: 'white', border: 'none',
                                                        borderRadius: '15px', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer'
                                                    }}
                                                >
                                                    Confirm Order
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {/* --- PATIENT VIEW (UPDATED) --- */}
                    {view === 'patients' && (
                        <div style={{ width: '85%', backgroundColor: '#fff', color: '#000', padding: '30px', borderRadius: '12px', textAlign: 'left' }}>
                            <h2>👥 Patient Management</h2>
                            <hr />

                            <div style={{ marginBottom: '20px', backgroundColor: isEditingPatient ? '#fff3cd' : '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                                <h4>{isEditingPatient ? "📝 Edit Patient Information" : "👥 Register New Patient"}</h4>
                                <input
                                    placeholder="Full Name (Optional)"
                                    value={patientName}
                                    onChange={(e) => setPatientName(e.target.value)}
                                    style={{ marginRight: '10px', padding: '8px' }}
                                />
                                <input
                                    placeholder="Phone (Required)"
                                    value={patientPhone}
                                    onChange={(e) => setPatientPhone(e.target.value)}
                                    style={{ marginRight: '10px', padding: '8px' }}
                                />
                                <input
                                    placeholder="Email (Optional)"
                                    value={patientEmail}
                                    onChange={(e) => setPatientEmail(e.target.value)}
                                    style={{ marginRight: '10px', padding: '8px' }}
                                />

                                <button
                                    onClick={isEditingPatient ? updatePatient : addPatient}
                                    style={{ backgroundColor: isEditingPatient ? 'orange' : '#28a745', color: 'white', padding: '8px 15px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                                >
                                    {isEditingPatient ? "Save Changes" : "Register"}
                                </button>

                                {isEditingPatient && (
                                    <button
                                        onClick={() => { setIsEditingPatient(false); setPatientName(''); setPatientPhone(''); setPatientEmail(''); }}
                                        style={{ marginLeft: '10px', padding: '8px 15px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f2f2f2' }}>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>ID</th>
                                        <th style={{ textAlign: 'left' }}>Name</th>
                                        <th style={{ textAlign: 'left' }}>Phone</th>
                                        <th style={{ textAlign: 'left' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {patients.map(p => (
                                        <tr key={p.id} style={{ borderBottom: '1px solid #ddd' }}>
                                            <td style={{ padding: '10px' }}>{p.id}</td>
                                            <td>{p.fullName}</td>
                                            <td>{p.phoneNumber}</td>
                                            <td>
                                                <button onClick={() => viewHistory(p)} style={{ marginRight: '5px', cursor: 'pointer' }}>View History</button>

                                                <button
                                                    onClick={() => handlePatientEditClick(p)}
                                                    style={{ backgroundColor: '#007bff', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', marginRight: '5px' }}
                                                >
                                                    Edit
                                                </button>

                                                {userRole === 'Admin' && (
                                                    <button
                                                        onClick={() => deletePatient(p.id)}
                                                        style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer' }}
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {selectedPatient && (
                                <div style={{ marginTop: '30px', padding: '20px', border: '2px solid #007bff', borderRadius: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <h3>📜 Purchase History: {selectedPatient.fullName}</h3>
                                        <button onClick={() => setSelectedPatient(null)} style={{ backgroundColor: 'red', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer' }}>Close</button>
                                    </div>
                                    <table style={{ width: '100%', marginTop: '10px' }}>
                                            <thead style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                                                <tr>
                                                    <th style={{ padding: '10px' }}>Date</th>
                                                    <th>Medicine</th>
                                                    <th>Qty</th>
                                                    <th>Total</th>
                                                </tr>
                                            </thead>
                                        <tbody>
                                            {selectedHistory.length > 0 ? (
                                                selectedHistory.map(h => (
                                                    <tr key={h.id}>
                                                        <td>{new Date(h.purchaseDate).toLocaleDateString()}</td>
                                                        <td>{h.medicineName}</td>
                                                        <td>{h.quantity}</td>
                                                        <td>{h.totalPrice} EGP</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>No records found in SQL for this patient.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                    )}
                    
                        {/*Supplier View*/}
                        {view === 'suppliers' && (
                            <div style={{
                                width: '90%',
                                backgroundColor: '#ffffff', // Clean White Card
                                color: '#333',              // High contrast text
                                padding: '30px',
                                borderRadius: '15px',
                                margin: '20px auto',
                                textAlign: 'left',
                                boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
                            }}>

                                <h2>🚚 Supplier Management</h2>
                                {/* Using a 3-column grid to fit all the fields from your SQL table */}
                                {/* 1. Register Supplier Section */}
                                <div style={{ backgroundColor: '#f8f9fa', padding: '25px', borderRadius: '12px', marginBottom: '25px', border: '1px solid #dee2e6' }}>
                                    <h4 style={{ marginTop: 0, color: isEditingSupplier ? '#007bff' : '#28a745', marginBottom: '20px' }}>{isEditingSupplier ? "📝 Edit Supplier Info" : "➕ Register New Supplier"}</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                                        {/* Row 1 */}
                                        <input
                                            placeholder="Company Name"
                                            value={supplierData.name}
                                            onChange={e => setSupplierData({ ...supplierData, name: e.target.value })}
                                            style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc' }}
                                        />
                                        <input
                                            placeholder="Contact Person (Manager)"
                                            value={supplierData.contactPerson}
                                            onChange={e => setSupplierData({ ...supplierData, contactPerson: e.target.value })}
                                            style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc' }}
                                        />
                                        <input
                                            placeholder="Phone Number"
                                            value={supplierData.phone}
                                            onChange={e => setSupplierData({ ...supplierData, phone: e.target.value })}
                                            style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc' }}
                                        />

                                        {/* Row 2 */}
                                        <input
                                            placeholder="Email Address"
                                            value={supplierData.email}
                                            onChange={e => setSupplierData({ ...supplierData, email: e.target.value })}
                                            style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc' }}
                                        />
                                        <input
                                            placeholder="Office Address"
                                            value={supplierData.address}
                                            onChange={e => setSupplierData({ ...supplierData, address: e.target.value })}
                                            style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc', gridColumn: 'span 2' }}
                                        />
                                    </div>
                                    {/*Edit Button*/}
                                        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                                            <button
                                                onClick={isEditingSupplier ? updateSupplier : handleAddSupplier}
                                                style={{
                                                    flex: 1,
                                                    backgroundColor: isEditingSupplier ? '#007bff' : '#28a745',
                                                    color: 'white',
                                                    padding: '12px',
                                                    border: 'none',
                                                    borderRadius: '5px',
                                                    cursor: 'pointer',
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                {isEditingSupplier ? "Save Changes" : "Add Supplier to Database"}
                                            </button>
                                        {/* --- OPTIONAL: CANCEL BUTTON --- */}
                                        {isEditingSupplier && (
                                            <button
                                                onClick={() => {
                                                    setIsEditingSupplier(false);
                                                    setSupplierData({ name: '', phone: '', contactPerson: '', email: '', address: '' });
                                                }}
                                                style={{ backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', padding: '0 20px', cursor: 'pointer' }}
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* 2. Record Shipment Section (Action Area) */}
                                <div style={{ backgroundColor: '#e3f2fd', padding: '20px', borderRadius: '10px', marginBottom: '30px', border: '2px dashed #007bff' }}>
                                    <h3 style={{ marginTop: 0, color: '#0056b3' }}>📥 Record New Stock Shipment</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                                        <select
                                            value={order.medicineId}
                                            onChange={(e) => setOrder({ ...order, medicineId: e.target.value })}
                                            style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                                        >
                                            <option value="">-- Medicine --</option>
                                            {medicines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                        <select
                                            value={order.supplierId}
                                            onChange={(e) => setOrder({ ...order, supplierId: e.target.value })}
                                            style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                                        >
                                            <option value="">-- Supplier --</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                        <input
                                            type="number"
                                            placeholder="Qty Received"
                                            value={order.quantity}
                                            onChange={(e) => setOrder({ ...order, quantity: e.target.value })}
                                            style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                                        />
                                        <input
                                            type="number"
                                            placeholder="Total Cost (EGP)"
                                            value={order.costPrice}
                                            onChange={(e) => setOrder({ ...order, costPrice: e.target.value })}
                                            style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                                        />
                                    </div>
                                    <button onClick={handleRecordPurchase} style={{ marginTop: '15px', width: '100%', backgroundColor: '#007bff', color: 'white', padding: '12px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                                        Confirm Shipment & Increase Stock
                                    </button>
                                </div>

                                {/* Change the flex-direction to column to stack them */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', marginTop: '20px' }}>

                                    {/* Active Suppliers List */}
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ borderBottom: '2px solid #f2f2f2' }}>🚚 Active Suppliers</h3>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ textAlign: 'left', borderBottom: '2px solid #333', backgroundColor: '#fdfdfd' }}>
                                                    <th style={{ padding: '12px' }}>Company & Manager</th>
                                                    <th style={{ padding: '12px' }}>Contact Info</th>
                                                    <th style={{ padding: '12px' }}>Office Address</th> {/* NEW COLUMN */}
                                                    <th style={{ padding: '12px', textAlign: 'center' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {suppliers.map(s => (
                                                    <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                                                        {/* Column 1: Company */}
                                                        <td style={{ padding: '15px' }}>
                                                            <strong style={{ fontSize: '18px' }}>{s.name}</strong><br />
                                                            <small style={{ color: '#007bff', fontWeight: '500' }}>👤 {s.contactPerson || 'N/A'}</small>
                                                        </td>
                                                        {/* Column 2: Contact */}
                                                        <td style={{ padding: '15px' }}>
                                                            <div style={{ fontSize: '16px', fontWeight: '500' }}>📞 {s.phone}</div>
                                                            <div style={{ fontSize: '16px', color: '#444', marginTop: '8px' }}>📧 {s.email || 'N/A'}</div>
                                                        </td>
                                                        {/* Column 3: Address (The fix!) */}
                                                        <td style={{ padding: '15px', fontSize: '16px', color: '#444' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span>📍</span>
                                                                <span>{s.address || 'No Address Listed'}</span>
                                                            </div>
                                                        </td>
                                                        {/* Column 4: Actions */}
                                                        <td style={{ padding: '15px', textAlign: 'center' }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                                                                {(userRole === 'Admin' || userRole === 'Pharmacist') && (
                                                                    <button onClick={() => handleSupplierEditClick(s)} style={{ backgroundColor: '#e7f3ff', color: '#007bff', border: '1px solid #007bff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>✏️ Edit</button>
                                                                )}
                                                                {userRole === 'Admin' && (
                                                                    <button onClick={() => deleteSupplier(s.id)} style={{ backgroundColor: '#fff5f5', color: '#dc3545', border: '1px solid #dc3545', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>❌ Delete</button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Shipment History List */}
                                    <div style={{ flex: 2 }}>
                                        <h3 style={{ borderBottom: '2px solid #f2f2f2' }}>📜 Supply History</h3>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                                                <tr>
                                                    <th style={{ padding: '10px' }}>Date</th>
                                                    <th>Medicine</th>
                                                    <th>Supplier</th>
                                                    <th>Qty</th>
                                                    <th>Total Cost</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {purchaseHistory.length > 0 ? (
                                                    purchaseHistory.map(h => (
                                                        <tr key={h.id} style={{ borderBottom: '1px solid #eee' }}>
                                                            <td style={{ padding: '10px' }}>{h.orderDate ? new Date(h.orderDate).toLocaleDateString() : "No Date"}</td>{/* Use orderDate to match the Shipment model */}
                                                            <td><strong>{h.medicineName}</strong></td>
                                                            <td>{h.supplierName}</td>
                                                            <td>{h.quantityReceived}</td>
                                                            <td>{h.costPrice} EGP</td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>No records found.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                </header>
            )}
            {currentInvoice && (
                <div className="invoice-overlay" style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div id="printable-invoice" style={{
                        backgroundColor: 'white', color: 'black', padding: '40px', borderRadius: '10px', width: '400px', textAlign: 'center'
                    }}>
                        <h2 style={{ borderBottom: '2px solid #28a745', paddingBottom: '10px' }}>Smart Pharmacy Receipt</h2>
                        <p><strong>Date:</strong> {currentInvoice.date}</p>
                        <p><strong>Patient:</strong> {currentInvoice.patient}</p>
                        <hr />
                        <table style={{ width: '100%', marginBottom: '20px' }}>
                            <thead style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #333' }}>
                                <tr className="report-row">
                                    <th style={{ padding: '12px', textAlign: 'left', color: '#000' }}>Item</th>
                                    <th style={{ padding: '12px', textAlign: 'center', color: '#000' }}>Qty</th>
                                    <th style={{ padding: '12px', textAlign: 'right', color: '#000' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentInvoice.items.map((item, index) => (
                                    <tr key={index}>
                                        <td>{item.name}</td>
                                        <td>{item.quantity}</td>
                                        <td>{item.totalPrice} EGP</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <h3 style={{ backgroundColor: '#f8f9fa', padding: '10px' }}>Total: {currentInvoice.total} EGP</h3>
                        <p style={{ fontSize: '12px' }}>Thank you for choosing Smart Pharmacy!</p>

                        <div className="no-print" style={{ marginTop: '20px' }}>
                            <button onClick={({ handlePrint }) => window.print()} style={{ backgroundColor: '#28a745', color: 'white', padding: '10px 20px', marginRight: '10px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>🖨️ Print</button>
                            <button onClick={() => setCurrentInvoice(null)} style={{ backgroundColor: '#dc3545', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;