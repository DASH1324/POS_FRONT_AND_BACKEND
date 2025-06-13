import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../admin/products.css"; // Ensure this CSS path is correct
import Sidebar from "../sidebar"; // Ensure this path is correct
import { FaChevronDown, FaBell } from "react-icons/fa";
import DataTable from "react-data-table-component";
import { DEFAULT_PROFILE_IMAGE } from "./employeeRecords"; // Ensure this path and export are correct

const API_BASE_URL = "http://127.0.0.1:9001"; // POS Backend URL

// Moved outside component as it doesn't depend on state/props
const currentDate = new Date().toLocaleString("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

function Products() {
  const [loggedInUserDisplay, setLoggedInUserDisplay] = useState({
    role: "User",
    name: "Current User",
  });
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();

  // State for dynamic product data from backend
  const [activeTab, setActiveTab] = useState(null); // e.g., 'Drink', 'Food'
  const [productTypes, setProductTypes] = useState([]); // e.g., ['Drink', 'Food', 'Merchandise']
  const [productsByType, setProductsByType] = useState({}); // { 'Drink': [...], 'Food': [...] }
  const [filterStates, setFilterStates] = useState({}); // Manages filter values for each tab

  // State for API call status
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const toggleDropdown = () => {
    setDropdownOpen(!isDropdownOpen);
  };

  const getAuthToken = () => {
    return localStorage.getItem("access_token");
  };

  // Effect for setting user display info from token
  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      try {
        const decodedToken = JSON.parse(atob(token.split(".")[1]));
        setLoggedInUserDisplay({
          name: decodedToken.sub || "Current User",
          role: decodedToken.role || "User",
        });
      } catch (error) {
        console.error("Error decoding token for display:", error);
        // In case of a bad token, log the user out
        localStorage.removeItem("access_token");
        navigate("/");
      }
    } else {
      // No token, redirect to login
      navigate("/");
    }
  }, [navigate]);

  // Effect for fetching and processing product data from the backend
  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      const token = getAuthToken();

      if (!token) {
        setError("Authentication token not found. Please log in.");
        setIsLoading(false);
        navigate("/");
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/Products/products/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            setError("Unauthorized. Please log in again.");
            localStorage.removeItem("access_token");
            navigate("/");
          } else {
            const errorData = await response.json().catch(() => ({ detail: "Unknown server error" }));
            throw new Error(`HTTP error ${response.status}: ${errorData.detail || "Failed to fetch products"}`);
          }
          return;
        }

        const allProductsFromBackend = await response.json();
        const typesCollector = {};
        const productsGroupedByType = {};
        const initialFilterStates = {};

        allProductsFromBackend.forEach((product) => {
          const {
              ProductID,
              ProductName,
              ProductTypeName, // This determines the tab
              ProductCategory,
              ProductDescription,
              ProductPrice,
              ProductImage,
              ProductSizes // Assuming backend sends this as an array of strings
          } = product;

          // Collect unique product types for tabs
          if (ProductTypeName) {
            typesCollector[ProductTypeName] = true;
          }

          // Initialize data structures for each new product type
          if (!productsGroupedByType[ProductTypeName]) {
            productsGroupedByType[ProductTypeName] = [];
            initialFilterStates[ProductTypeName] = {
              search: "",
              category: "",
            };
            // Add specific filters for 'Drink' type
            if (ProductTypeName === "Drink") {
              initialFilterStates[ProductTypeName].specificType = "";
              initialFilterStates[ProductTypeName].specificSize = "";
            }
          }

          // Construct full image URL from backend's relative path
          let processedImageURL = DEFAULT_PROFILE_IMAGE; // Fallback
          if (ProductImage && typeof ProductImage === 'string' && ProductImage.trim()) {
              try {
                  // `new URL` correctly joins the base URL and the relative path
                  processedImageURL = new URL(ProductImage, API_BASE_URL).href;
              } catch (e) {
                  console.error(`Invalid image path for ${ProductName}:`, ProductImage);
              }
          }

          // Format product data for the frontend
          const frontendProduct = {
            id: ProductID,
            name: ProductName || "Unknown",
            description: ProductDescription || "No description available.",
            category: ProductCategory || "Uncategorized",
            price: ProductPrice != null ? `₱${parseFloat(ProductPrice).toFixed(2)}` : "N/A",
            image: processedImageURL,
            // Handle specific fields for Drinks
            types: ProductTypeName === "Drink" ? "Hot & Iced" : undefined, // Example static value, adjust if backend provides it
            sizes: (ProductSizes && Array.isArray(ProductSizes) && ProductSizes.length > 0)
                   ? ProductSizes.join(" & ")
                   : "N/A",
            _rawSizesList: ProductSizes || [], // Keep raw array for filtering
          };

          productsGroupedByType[ProductTypeName].push(frontendProduct);
        });

        const uniqueProductTypes = Object.keys(typesCollector).sort();
        setProductTypes(uniqueProductTypes);
        setProductsByType(productsGroupedByType);
        setFilterStates(initialFilterStates);

        // Set the first available product type as the default active tab
        if (uniqueProductTypes.length > 0 && !activeTab) {
          setActiveTab(uniqueProductTypes[0]);
        }

      } catch (err) {
        console.error("Failed to fetch or process products:", err);
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setIsLoading(false);
      }
    };

    if (getAuthToken()) {
        fetchProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]); // Fetch only on initial load or if user is redirected

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    navigate("/");
  };

  // Generic handler to update filter state for any tab
  const handleFilterChange = (typeName, filterKey, value) => {
    setFilterStates(prev => ({
      ...prev,
      [typeName]: {
        ...(prev[typeName] || {}),
        [filterKey]: value,
      }
    }));
  };

  // Memoized functions to get unique filter options for the active tab
  const getUniqueValuesForFilter = (products, key) => {
    if (!products || products.length === 0) return [];
    return [...new Set(products.map(p => p[key]).filter(Boolean))].sort();
  };
  
  const getUniqueIndividualSizes = (products) => {
    if (!products || products.length === 0) return [];
    const allSizes = new Set();
    products.forEach(p => {
      if (p._rawSizesList && Array.isArray(p._rawSizesList)) {
        p._rawSizesList.forEach(size => allSizes.add(String(size).trim()));
      }
    });
    return [...allSizes].sort();
  };

  const uniqueCategoriesForTab = useMemo(() => getUniqueValuesForFilter(productsByType[activeTab], 'category'), [activeTab, productsByType]);
  const uniqueTypesForDrinkTab = useMemo(() => activeTab === 'Drink' ? getUniqueValuesForFilter(productsByType[activeTab], 'types') : [], [activeTab, productsByType]);
  const uniqueSizesForDrinkTab = useMemo(() => activeTab === 'Drink' ? getUniqueIndividualSizes(productsByType[activeTab]) : [], [activeTab, productsByType]);

  // Memoized calculation for filtering products based on active filters
  const filteredProductsForActiveTab = useMemo(() => {
    if (!activeTab || !productsByType[activeTab] || !filterStates[activeTab]) {
      return [];
    }
    const currentProducts = productsByType[activeTab];
    const currentFilters = filterStates[activeTab];

    return currentProducts.filter(item => {
      const searchLower = (currentFilters.search || "").toLowerCase();
      const searchMatch = item.name.toLowerCase().includes(searchLower);
      const categoryMatch = !currentFilters.category || item.category === currentFilters.category;

      let typeMatch = true;
      let sizeMatch = true;

      // Apply drink-specific filters only if the active tab is 'Drink'
      if (activeTab === "Drink" && currentFilters) {
        typeMatch = !currentFilters.specificType || item.types === currentFilters.specificType;
        if (currentFilters.specificSize) {
          // Check if the selected size is in the product's raw size list
          sizeMatch = item._rawSizesList.map(s => String(s).trim()).includes(String(currentFilters.specificSize).trim());
        }
      }
      return searchMatch && categoryMatch && typeMatch && sizeMatch;
    });
  }, [activeTab, productsByType, filterStates]);

  // Function to generate columns dynamically for the DataTable
  const getColumnsForProductType = (typeName) => {
    const baseColumns = [
      {
        name: "NO.",
        // The cell function receives the row data, and the index of the row
        cell: (row, index) => index + 1,
        width: "60px", // Fixed width for the number column
        center: true,
      },
      {
        name: "PRODUCT IMAGE",
        cell: (row) => (
            <img
              src={row.image}
              alt={row.name}
              className="product-photo"
              onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_PROFILE_IMAGE; }}
            />
        ),
        width: "120px",
        center: true,
      },
      {
        name: "PRODUCT NAME",
        selector: (row) => row.name,
        cell: (row) => <div className="product-name">{row.name}</div>,
        sortable: true,
        width: "18%",
      },
      { name: "DESCRIPTION", selector: (row) => row.description, wrap: true, width: "25%" },
      { name: "CATEGORY", selector: (row) => row.category, center: true, sortable: true, width: "12%" },
    ];

    if (typeName === "Drink") {
      baseColumns.push(
        { name: "TYPES", selector: (row) => row.types, center: true, width: "10%" },
        { name: "SIZES", selector: (row) => row.sizes, center: true, width: "12%" }
      );
    } else {
        // Generic SIZES column for non-drink items if they have sizes
        baseColumns.push({ name: "SIZES", selector: (row) => row.sizes, center: true, width: "15%" });
    }

    baseColumns.push({ name: "PRICE", selector: (row) => row.price, center: true, sortable: true, width: "8%" });

    return baseColumns;
  };

  const dataTableStyles = {
    headCells: {
      style: {
        backgroundColor: "#4B929D",
        color: "#FFFFFF",
        fontWeight: "600",
        fontSize: "14px",
        padding: "12px",
        textTransform: "uppercase",
        textAlign: "center",
      },
    },
    rows: {
      style: {
        minHeight: "70px",
        padding: "8px",
      },
       highlightOnHoverStyle: {
        backgroundColor: "#f0f8ff",
      },
    },
     cells: {
      style: {
        fontSize: '14px',
        verticalAlign: 'middle',
      },
    },
  };

  if (isLoading) {
    return (
      <div className="productList">
        <Sidebar />
        <div className="products">
          <header className="header"><div className="header-left"><h2 className="page-title">Products</h2></div></header>
          <div className="loading-container">Loading products...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="productList">
        <Sidebar />
        <div className="products">
           <header className="header"><div className="header-left"><h2 className="page-title">Products</h2></div></header>
          <div className="error-container">Error: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="productList">
      <Sidebar />
      <div className="products">
        <header className="header">
          <div className="header-left">
            <h2 className="page-title">Products</h2>
          </div>
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
          <div className="tabs">
            {productTypes.map((typeName) => (
              <button
                key={typeName}
                className={`tab ${activeTab === typeName ? "active-tab" : ""}`}
                onClick={() => setActiveTab(typeName)}
              >
                {typeName}
              </button>
            ))}
            {productTypes.length === 0 && !isLoading && <div className="no-data-message">No product types found.</div>}
          </div>

          <div className="tab-content">
            {activeTab && productsByType[activeTab] && filterStates[activeTab] && (
              <div className="dynamic-product-content">
                <div className="filter-bar">
                  <input
                    type="text"
                    placeholder={`Search ${activeTab}...`}
                    value={filterStates[activeTab]?.search || ""}
                    onChange={(e) => handleFilterChange(activeTab, "search", e.target.value)}
                  />
                  <select
                    value={filterStates[activeTab]?.category || ""}
                    onChange={(e) => handleFilterChange(activeTab, "category", e.target.value)}
                  >
                    <option value="">All Categories</option>
                    {uniqueCategoriesForTab.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>

                  {/* Conditional filters for Drinks */}
                  {activeTab === "Drink" && (
                    <>
                      <select
                        value={filterStates[activeTab]?.specificType || ""}
                        onChange={(e) => handleFilterChange(activeTab, "specificType", e.target.value)}
                      >
                        <option value="">All Types</option>
                         {uniqueTypesForDrinkTab.map((type) => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      <select
                        value={filterStates[activeTab]?.specificSize || ""}
                        onChange={(e) => handleFilterChange(activeTab, "specificSize", e.target.value)}
                      >
                        <option value="">All Sizes</option>
                        {uniqueSizesForDrinkTab.map((size) => (
                            <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
                <DataTable
                  columns={getColumnsForProductType(activeTab)}
                  data={filteredProductsForActiveTab}
                  striped
                  highlightOnHover
                  responsive
                  pagination
                  customStyles={dataTableStyles}
                  noDataComponent={<div className="no-data-message">No products found for '{activeTab}' with the current filters.</div>}
                />
              </div>
            )}
             {!activeTab && productTypes.length > 0 && <div className="no-data-message">Please select a product type.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Products;