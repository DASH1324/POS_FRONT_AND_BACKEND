import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../admin/discounts.css";
import Sidebar from "../sidebar";
import { FaChevronDown, FaBell, FaFolderOpen, FaEdit, FaArchive, FaPlus } from "react-icons/fa";
import DataTable from "react-data-table-component";
import { DEFAULT_PROFILE_IMAGE } from "./employeeRecords";

const API_BASE_URL_DISCOUNTS = "http://localhost:9002";
const API_BASE_URL_PRODUCTS = "http://127.0.0.1:8001";

const currentDate = new Date().toLocaleString("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

function Discounts() {
  const [loggedInUserDisplay, setLoggedInUserDisplay] = useState({ role: "User", name: "Current User" });
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [applicationFilter, setApplicationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const today = new Date().toISOString().split('T')[0];

  const [discounts, setDiscounts] = useState([]);
  const [isLoadingDiscounts, setIsLoadingDiscounts] = useState(true);
  const [errorDiscounts, setErrorDiscounts] = useState(null);

  const [availableProducts, setAvailableProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [errorProducts, setErrorProducts] = useState(null);

  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [editingDiscountId, setEditingDiscountId] = useState(null);
  const [viewingDiscount, setViewingDiscount] = useState(null);
  const [isSavingDiscount, setIsSavingDiscount] = useState(false);

  const [discountForm, setDiscountForm] = useState({
    discountName: '',
    productName: '',
    discountPercentage: '',
    minSpend: '',
    validFrom: '',
    validTo: '',
    status: 'active',
  });

  const navigate = useNavigate();

  const getAuthToken = () => localStorage.getItem("authToken");
  const getUsernameFromStorage = () => localStorage.getItem("username");

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("username");
    navigate("/");
  };

  useEffect(() => {
    const token = getAuthToken();
    const username = getUsernameFromStorage();

    if (!token || !username) {
      console.log("Discounts Page: Auth token or username not found. Redirecting to login.");
      handleLogout();
      return;
    }

    try {
      const decodedToken = JSON.parse(atob(token.split(".")[1]));
      setLoggedInUserDisplay({
        name: username,
        role: decodedToken.role || "User",
      });

      fetchDiscounts();
      fetchAvailableProducts();

    } catch (error) {
      console.error("Discounts Page: Invalid token found. Logging out.", error);
      handleLogout();
    }
  }, [navigate]);


  const fetchDiscounts = useCallback(async () => {
    setIsLoadingDiscounts(true);
    setErrorDiscounts(null);
    const token = getAuthToken();
    if (!token) {
      navigate("/");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL_DISCOUNTS}/discounts/`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const formattedDiscounts = data.map(d => ({
        id: d.DiscountID,
        name: d.DiscountName,
        application: d.ProductName || `Product ID: ${d.ProductID}`,
        discount: `${parseFloat(d.PercentageValue).toFixed(1)}%`,
        minSpend: d.MinimumSpend !== null ? parseFloat(d.MinimumSpend) : 0,
        validFrom: d.ValidFrom.split('T')[0],
        validTo: d.ValidTo.split('T')[0],
        status: d.Status,
      }));
      setDiscounts(formattedDiscounts);
    } catch (err) {
      console.error("Failed to fetch discounts:", err);
      setErrorDiscounts(err.message);
    } finally {
      setIsLoadingDiscounts(false);
    }
  }, [navigate]);

  const fetchAvailableProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    setErrorProducts(null);
    const token = getAuthToken();
    if (!token) {
      setErrorProducts("Authentication token not found to fetch products.");
      setIsLoadingProducts(false);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL_PRODUCTS}/is_products/products/`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!response.ok) {
        let errorDetail = `HTTP error! status: ${response.status}`;
        try {
            const errData = await response.json();
            errorDetail = errData.detail || errorDetail;
        } catch (e) { /* Ignore if response is not JSON */ }
        throw new Error(errorDetail);
      }
      const data = await response.json();
      setAvailableProducts(data || []);
    } catch (err) {
      console.error("Failed to fetch available products:", err);
      setErrorProducts(err.message);
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);


  useEffect(() => {
    // This effect to auto-update status is better handled by the backend.
    // However, if needed on the frontend, it can remain.
    const todayISO = new Date().toISOString().split("T")[0];
    setDiscounts(prev =>
      prev.map(d => {
        if (d.status.toLowerCase() === "active" && d.validTo < todayISO) {
           // You might want to visually indicate this, but changing state here can be complex.
        }
        return d;
      })
    );
  }, [discounts]);


  const toggleDropdown = () => setDropdownOpen(!isDropdownOpen);

  const handleDiscountModalOpen = (discountToEdit = null) => {
    if (discountToEdit) {
      setEditingDiscountId(discountToEdit.id);
      setDiscountForm({
        discountName: discountToEdit.name,
        productName: discountToEdit.application.startsWith("Product ID:") ? "" : discountToEdit.application,
        discountPercentage: parseFloat(discountToEdit.discount) || '',
        minSpend: discountToEdit.minSpend || '',
        validFrom: discountToEdit.validFrom,
        validTo: discountToEdit.validTo,
        status: discountToEdit.status.toLowerCase(),
      });
    } else {
      setEditingDiscountId(null);
      setDiscountForm({
        discountName: '',
        productName: '',
        discountPercentage: '',
        minSpend: '',
        validFrom: today,
        validTo: '',
        status: 'active',
      });
    }
    setShowDiscountModal(true);
  };

  const handleDiscountModalClose = () => {
    setShowDiscountModal(false);
    setEditingDiscountId(null);
    setDiscountForm({
      discountName: "",
      productName: "",
      discountPercentage: "",
      minSpend: "",
      validFrom: "",
      validTo: "",
      status: "active",
    });
  };

  const handleDiscountFormChange = (e) => {
    const { name, value } = e.target;
    setDiscountForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveDiscount = async () => {
    if (!discountForm.productName || discountForm.productName.trim() === "") {
        alert("Product Name must be selected.");
        return;
    }
    if (new Date(discountForm.validFrom) >= new Date(discountForm.validTo)) {
        alert("Valid From date must be before Valid To date.");
        return;
    }
    
    // The username is retrieved on the backend from the token, not sent in the payload.

    // ================== //
    //  *** FIX HERE ***  //
    // The payload now matches the Pydantic model in the FastAPI backend.
    // ================== //
    const payload = {
      DiscountName: discountForm.discountName,
      Description: null, // Sending null for optional fields
      ProductName: discountForm.productName,
      
      // FIX: Added the required DiscountType field. 
      // Since the UI only supports percentages, it's hardcoded.
      DiscountType: 'Percentage',
      
      PercentageValue: parseFloat(discountForm.discountPercentage),
      
      // FIX: Added FixedValue and set to null as required for the 'Percentage' type.
      FixedValue: null,
      
      MinimumSpend: discountForm.minSpend ? parseFloat(discountForm.minSpend) : null,
      ValidFrom: new Date(discountForm.validFrom).toISOString(),
      ValidTo: new Date(discountForm.validTo).toISOString(),
      Status: discountForm.status,
    };

    const token = getAuthToken();
    const method = editingDiscountId ? "PUT" : "POST";
    const url = editingDiscountId
      ? `${API_BASE_URL_DISCOUNTS}/discounts/${editingDiscountId}`
      : `${API_BASE_URL_DISCOUNTS}/discounts/`;

    setIsSavingDiscount(true);
    try {
      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();
      if (!response.ok) {
          // Log the detailed error from FastAPI for easier debugging
          console.error("Backend validation error:", responseData);
          throw new Error(responseData.detail || `Failed to save discount. Status: ${response.status}`);
      }
      
      fetchDiscounts();
      handleDiscountModalClose();
      alert(`Discount "${responseData.DiscountName}" ${editingDiscountId ? 'updated' : 'created'} successfully!`);

    } catch (err) {
      alert(`Error saving discount: ${err.message}`);
    } finally {
        setIsSavingDiscount(false);
    }
  };

  const handleEditClick = (discount) => handleDiscountModalOpen(discount);

  const handleViewClick = (discount) => setViewingDiscount(discount);
  
  const handleDeleteClick = async (discount) => {
    if (!window.confirm(`Are you sure you want to delete the discount "${discount.name}"?`)) return;

    const token = getAuthToken();
    setIsSavingDiscount(true); // Re-use saving state for UI feedback
    try {
      const response = await fetch(`${API_BASE_URL_DISCOUNTS}/discounts/${discount.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.detail || "Failed to delete discount.");
      }
      
      // Some DELETE requests might not return a body, check for it.
      const responseData = await response.text();
      try {
          const jsonResponse = JSON.parse(responseData);
          alert(jsonResponse.message || "Discount deleted successfully.");
      } catch {
          alert("Discount deleted successfully.");
      }

      fetchDiscounts();
    } catch (err) {
      alert(`Error deleting discount: ${err.message}`);
    } finally {
        setIsSavingDiscount(false);
    }
  };

  const discountListColumns = [
    { name: "NAME", selector: row => row.name, sortable: true, width: "15%" },
    { name: "DISCOUNT", selector: row => row.discount, sortable: true, width: "10%" },
    { name: "MIN. SPEND", selector: row => `₱${row.minSpend.toLocaleString()}`, sortable: true, width: "10%" },
    { name: "PRODUCT NAME", selector: row => row.application, width: "20%" },
    { name: "VALID PERIOD", selector: row => `${row.validFrom} - ${row.validTo}`, width: "15%" },
    { name: "STATUS", cell: row => <span className={`status-badge ${row.status.toLowerCase()}`}>{row.status}</span>, sortable: true, center: true, width: "10%" },
    { name: "ACTION", cell: (row) => (
        <div className="action-buttons">
          <button className="view-button" title="View" onClick={() => handleViewClick(row)}><FaFolderOpen /></button>
          <button className="edit-button" title="Edit" onClick={() => handleEditClick(row)}><FaEdit /></button>
          <button className="delete-button" title="Delete" onClick={() => handleDeleteClick(row)}><FaArchive /></button>
        </div>
      ), ignoreRowClick: true, allowOverflow: true, button: true, center: true, width: "20%" },
  ];

  const filteredDiscounts = discounts.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (applicationFilter === "" || d.application.toLowerCase().includes(applicationFilter.toLowerCase())) &&
    (statusFilter === "" || d.status.toLowerCase() === statusFilter.toLowerCase())
  );

  const productApplications = [...new Set(discounts.map(d => d.application.startsWith("Product ID:") ? null : d.application))].filter(Boolean);

  if (isLoadingDiscounts && discounts.length === 0) return <div className="mng-discounts"><Sidebar /><div className="discounts"><p>Loading discounts...</p></div></div>;
  if (errorDiscounts) return <div className="mng-discounts"><Sidebar /><div className="discounts"><p>Error fetching discounts: {errorDiscounts}</p><button onClick={fetchDiscounts}>Retry</button></div></div>;

  return (
    <div className="mng-discounts">
      <Sidebar />
      <div className="discounts">
        <header className="header">
          <div className="header-left">
            <h2 className="page-title">Manage Discounts</h2>
          </div>
          <div className="header-right">
            <div className="header-date">{currentDate}</div>
            <div className="header-profile">
              <div className="profile-left">
                <div
                  className="profile-pic"
                  style={{ backgroundImage: `url(${DEFAULT_PROFILE_IMAGE})` }}
                ></div>
                <div className="profile-info">
                  <div className="profile-role">Hi! I'm {loggedInUserDisplay.role}</div>
                  <div className="profile-name">{loggedInUserDisplay.name}</div>
                </div>
              </div>
              <div className="profile-right">
                <div className="dropdown-icon" onClick={toggleDropdown}>
                  <FaChevronDown />
                </div>
                <div className="bell-icon">
                  <FaBell className="bell-outline" />
                </div>
              </div>
              {isDropdownOpen && (
                <div className="profile-dropdown">
                  <ul><li onClick={handleLogout}>Logout</li></ul>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="discounts-content">
          <div className="filter-bar">
            <input
              type="text"
              placeholder="Search by Discount Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select value={applicationFilter} onChange={(e) => setApplicationFilter(e.target.value)}>
              <option value="">Product Name: All</option>
              {productApplications.map(app => <option key={app} value={app}>{app}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Status: All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="expired">Expired</option>
            </select>
            <button className="add-btn" onClick={() => handleDiscountModalOpen()}>
              <FaPlus /> Add Discount
            </button>
          </div>

          {showDiscountModal && (
            <div className="modal-overlay">
              <div className="modal-container">
                <div className="modal-header">
                  <h2>{editingDiscountId ? "Edit Discount" : "Add Discount"}</h2>
                  <button className="modal-close" onClick={handleDiscountModalClose}>×</button>
                </div>
                <div className="modal-body">
                  <form className="form-grid" onSubmit={(e) => { e.preventDefault(); handleSaveDiscount(); }}>

                    <label htmlFor="discountName">Discount Name</label>
                    <input
                      id="discountName" type="text" name="discountName"
                      placeholder="Enter discount name" value={discountForm.discountName}
                      onChange={handleDiscountFormChange} required
                    />

                    <label htmlFor="productName">Product Name</label>
                    <select
                      id="productName"
                      name="productName"
                      value={discountForm.productName}
                      onChange={handleDiscountFormChange}
                      required
                      disabled={isLoadingProducts}
                      className={errorProducts ? 'input-error' : ''}
                    >
                      <option value="" disabled>
                        {isLoadingProducts ? "Loading products..." : (errorProducts ? "Error loading products" : "Select a Product")}
                      </option>
                      {!isLoadingProducts && !errorProducts && availableProducts.map(product => (
                        <option key={product.ProductID || product.id || product.ProductName} value={product.ProductName}>
                          {product.ProductName}
                        </option>
                      ))}
                    </select>
                    {errorProducts && <small style={{ color: 'red' }}>Could not load products: {errorProducts}</small>}

                    <div className="row">
                      <div>
                        <label htmlFor="discountPercentage">Percentage (%)</label>
                        <input
                          id="discountPercentage" type="number" name="discountPercentage"
                          placeholder="e.g., 10.5" value={discountForm.discountPercentage}
                          onChange={handleDiscountFormChange} required
                          min="0.1" max="99.9" step="0.1"
                        />
                      </div>
                      <div>
                        <label htmlFor="minSpend">Minimum Spend (₱)</label>
                        <input
                          id="minSpend" type="number" name="minSpend"
                          placeholder="Enter minimum spend" value={discountForm.minSpend}
                          onChange={handleDiscountFormChange} min="0" step="0.01"
                        />
                      </div>
                    </div>

                     <div className="row">
                      <div>
                        <label htmlFor="validFrom">Valid From</label>
                        <input
                          id="validFrom" type="date" name="validFrom"
                          value={discountForm.validFrom} onChange={handleDiscountFormChange}
                          min={!editingDiscountId ? today : undefined} required
                        />
                      </div>
                      <div>
                        <label htmlFor="validTo">Valid Until</label>
                        <input
                          id="validTo" type="date" name="validTo"
                          value={discountForm.validTo} onChange={handleDiscountFormChange}
                          min={discountForm.validFrom || today} required
                        />
                      </div>
                    </div>
                    <div>
                        <label htmlFor="status">Status</label>
                        <select
                            id="status" name="status" value={discountForm.status}
                            onChange={handleDiscountFormChange} required
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="expired">Expired</option>
                        </select>
                    </div>
                    <button type="submit" className="save-btn" disabled={isSavingDiscount}>
                        {isSavingDiscount ? (editingDiscountId ? 'Saving...' : 'Creating...') : (editingDiscountId ? 'Save Changes' : 'Create Discount')}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {viewingDiscount && (
            <div className="modal-overlay">
              <div className="modal-container">
                <div className="modal-header">
                  <h2>View Discount Details</h2>
                  <button className="modal-close" onClick={() => setViewingDiscount(null)}>×</button>
                </div>
                <div className="modal-body">
                  <div className="form-grid view-details">
                    <label>Discount Name:</label>
                    <p>{viewingDiscount.name}</p>

                    <label>Product Name:</label>
                    <p>{viewingDiscount.application}</p>

                    <div className="row">
                      <div>
                        <label>Discount Value:</label>
                        <p>{viewingDiscount.discount}</p>
                      </div>
                      <div>
                        <label>Minimum Spend:</label>
                        <p>₱{viewingDiscount.minSpend.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="row">
                      <div>
                        <label>Valid From:</label>
                        <p>{viewingDiscount.validFrom}</p>
                      </div>
                      <div>
                        <label>Valid Until:</label>
                        <p>{viewingDiscount.validTo}</p>
                      </div>
                    </div>

                    <label>Status:</label>
                    <p><span className={`status-badge ${viewingDiscount.status.toLowerCase()}`}>{viewingDiscount.status}</span></p>
                  </div>
                </div>
              </div>
            </div>
        )}

          <DataTable
            columns={discountListColumns}
            data={filteredDiscounts}
            striped highlightOnHover responsive pagination
            progressPending={isLoadingDiscounts && !showDiscountModal}
            customStyles={{
              headCells: { style: { backgroundColor: "#4B929D", color: "#fff", fontWeight: "600", fontSize: "14px", padding: "12px", textTransform: "uppercase", textAlign: "center", letterSpacing: "1px" }},
              rows: { style: { minHeight: "55px", padding: "5px" } },
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default Discounts;