import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../admin/products.css"; 
import Sidebar from "../sidebar";
import { FaChevronDown, FaBell } from "react-icons/fa";
import DataTable from "react-data-table-component";
import { jwtDecode } from 'jwt-decode'; // You'll need this for token decoding
import { DEFAULT_PROFILE_IMAGE } from "./employeeRecords"; 

const API_BASE_URL = "http://127.0.0.1:8001";
const getAuthToken = () => localStorage.getItem("authToken");

function Products() { // Assuming this is your POS component
  const currentDate = new Date().toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
  });
  
  const [loggedInUserDisplay, setLoggedInUserDisplay] = useState({ role: "User", name: "Current User" });
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();

  // FIX #1: Change state to match the working (IS) component's structure
  const [activeTab, setActiveTab] = useState(null); // Will hold productTypeID
  const [productTypes, setProductTypes] = useState([]); // For tabs
  const [products, setProducts] = useState([]); // Flat list of all products
  const [searchTerm, setSearchTerm] = useState(""); // For filtering

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const toggleDropdown = () => setDropdownOpen(!isDropdownOpen);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("username");
    navigate("/");
  }, [navigate]);
  
  // FIX #2: Add the `fetchProductTypes` function from your working component
  const fetchProductTypes = useCallback(async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/ProductType/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch product types");
      const data = await response.json();
      setProductTypes(data);
      if (data.length > 0) {
        // Set the first type as active by default
        setActiveTab(currentTab => currentTab === null ? data[0].productTypeID : currentTab);
      }
    } catch (err) {
      console.error(err);
      setError(error => error || err.message); // Set error only if not already set
    }
  }, []);

  // FIX #3: Simplify `fetchProducts` to just fetch and set the flat list
  const fetchProducts = useCallback(async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/is_products/products/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch products");
      const data = await response.json();
      setProducts(data);
    } catch (err) {
      console.error(err);
      setError(error => error || err.message);
    }
  }, []);

  // FIX #4: Fetch both types and products on component load
  useEffect(() => {
    const token = getAuthToken();
    const username = localStorage.getItem("username");

    if (!token || !username) {
      handleLogout();
      return;
    }
    
    try {
      const decodedToken = jwtDecode(token);
      setLoggedInUserDisplay({ name: username, role: decodedToken.role || "User" });

      // Fetch all data
      setIsLoading(true);
      Promise.all([
        fetchProductTypes(token),
        fetchProducts(token)
      ]).catch(err => {
        console.error("Error during data fetching:", err);
        setError("Could not load all required data.");
      }).finally(() => {
        setIsLoading(false);
      });

    } catch (error) {
      console.error("Invalid token:", error);
      handleLogout();
    }
  }, [handleLogout, fetchProductTypes, fetchProducts]);

  // FIX #5: Filter the flat `products` array for display
  const filteredProductsForActiveTab = useMemo(() => {
    if (!activeTab || products.length === 0) return [];
    
    return products.filter(product => 
      product.ProductTypeID === activeTab &&
      (product.ProductName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [activeTab, products, searchTerm]);

  // Define columns for the DataTable
  const columns = [
    { name: "IMAGE", cell: row => <img src={row.ProductImage || DEFAULT_PROFILE_IMAGE} alt={row.ProductName} className="product-photo" onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_PROFILE_IMAGE; }} />, width: "100px", center: true },
    { name: "NAME", selector: row => row.ProductName, sortable: true, width: "25%" },
    { name: "CATEGORY", selector: row => row.ProductCategory, sortable: true, width: "20%" },
    { name: "SIZES", selector: row => row.ProductSizes?.join(', ') || 'N/A', width: "20%" },
    { name: "PRICE", selector: row => `₱${parseFloat(row.ProductPrice).toFixed(2)}`, sortable: true, center: true, width: "15%" },
    // Add an action column if needed for POS, e.g., 'Add to Cart'
  ];

  const dataTableStyles = {
    headCells: { style: { backgroundColor: "#4B929D", color: "#FFFFFF", fontWeight: "600", fontSize: "14px" } },
    rows: { style: { minHeight: "70px" }, highlightOnHoverStyle: { backgroundColor: "#f0f8ff" } },
  };

  if (isLoading) {
    return <div>Loading...</div>; // Simple loading state
  }
  if (error) {
    return <div>Error: {error}</div>; // Simple error state
  }

  return (
    <div className="productList">
      <Sidebar />
      <div className="products">
        <header className="header">
          {/* Your header JSX remains the same */}
          <div className="header-left"><h2 className="page-title">Point of Sale</h2></div>
          <div className="header-right">
            <div className="header-date">{currentDate}</div>
            <div className="header-profile">
              <div className="profile-left">
                <div className="profile-pic" style={{ backgroundImage: `url(${DEFAULT_PROFILE_IMAGE})` }}></div>
                <div className="profile-info">
                  <div className="profile-role">Hi! I'm {loggedInUserDisplay.role}</div>
                  <div className="profile-name">{loggedInUserDisplay.name}</div>
                </div>
              </div>
              <div className="profile-right">
                <div className="dropdown-icon" onClick={toggleDropdown}><FaChevronDown /></div>
                <div className="bell-icon"><FaBell className="bell-outline" /></div>
              </div>
              {isDropdownOpen && (
                <div className="profile-dropdown">
                  <ul><li onClick={handleLogout}>Logout</li></ul>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="products-content">
          {/* FIX #6: Render tabs and filters based on the new state structure */}
          <div className="tabs">
            {productTypes.map((type) => (
              <button 
                key={type.productTypeID} 
                className={`tab ${activeTab === type.productTypeID ? "active-tab" : ""}`} 
                onClick={() => setActiveTab(type.productTypeID)}
              >
                {type.productTypeName}
              </button>
            ))}
          </div>
          <div className="tab-content">
            <div className="filter-bar">
                <input 
                    type="text" 
                    placeholder="Search in current category..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <DataTable 
                columns={columns} 
                data={filteredProductsForActiveTab} 
                striped 
                highlightOnHover 
                responsive 
                pagination 
                customStyles={dataTableStyles} 
                noDataComponent={<div style={{padding: "24px"}}>No products found in this category.</div>}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Products;