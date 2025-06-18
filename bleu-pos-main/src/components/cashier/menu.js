import React, { useState, useEffect } from 'react';
import Navbar from '../navbar';
import CartPanel from './cartPanel.js';
import './menu.css';

const API_BASE_URL = 'http://127.0.0.1:8001';

function Menu() {
  // State for UI and Cart
  const [selectedFilter, setSelectedFilter] = useState({ type: 'all', value: 'All Products' });
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  // State for data fetching, loading, and errors
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for order details
  const [orderType, setOrderType] = useState('Dine in');
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  // State for user info
  const [loggedInUser, setLoggedInUser] = useState(null);

  useEffect(() => {
    // --- NEW AUTHENTICATION LOGIC ---
    // This effect now handles the handoff from the login system.
    
    const params = new URLSearchParams(window.location.search);
    const urlUsername = params.get('username');
    const urlToken = params.get('authorization');
    
    let activeToken = null;
    let activeUsername = null;

    // 1. Check if credentials are in the URL (fresh login from another system)
    if (urlUsername && urlToken) {
      console.log("Found credentials in URL. Setting up new session.");
      
      // 2. Save the new credentials to this app's localStorage
      localStorage.setItem('username', urlUsername);
      localStorage.setItem('authToken', urlToken);

      // 3. Set the active user and token for the current render
      activeToken = urlToken;
      activeUsername = urlUsername;
      
      // 4. (Best Practice) Clean the URL so the token isn't visible or bookmarkable
      window.history.replaceState({}, document.title, window.location.pathname);

    } else {
      // 5. Fallback: If no credentials in URL, read from localStorage (user is already in this app)
      console.log("No credentials in URL. Reading from localStorage.");
      activeToken = localStorage.getItem('authToken');
      activeUsername = localStorage.getItem('username');
    }

    // Set the user for the Navbar
    if (activeUsername) {
      setLoggedInUser(activeUsername);
    }
    
    // --- DATA FETCHING LOGIC (now uses the correct token) ---

    const fetchAndSetProducts = async (token) => {
      setIsLoading(true);
      setError(null);

      if (!token) {
        setError("Authorization Error. Please log in.");
        setIsLoading(false);
        return;
      }

      try {
        const headers = { 'Authorization': `Bearer ${token}` };
        console.log("Authorization header being sent for API requests:", headers);

        const [detailsResponse, productsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/is_products/products/details/`, { headers }),
          fetch(`${API_BASE_URL}/is_products/products/`, { headers })
        ]);
        
        if (detailsResponse.status === 401 || productsResponse.status === 401) {
          throw new Error("Your session is invalid or has expired. Please log in again.");
        }
        if (!detailsResponse.ok || !productsResponse.ok) {
          throw new Error(`Failed to fetch data.`);
        }
        
        const apiDetails = await detailsResponse.json();
        const apiProducts = await productsResponse.json(); 

        const imageMap = apiProducts.reduce((map, product) => {
          map[product.ProductName] = product.ProductImage;
          return map;
        }, {});

        const placeholderImage = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93';
        const mappedProducts = apiDetails.map(p => ({
          name: p.ProductName,
          description: p.Description,
          price: p.Price,
          category: p.ProductCategory,
          status: p.Status,
          image: imageMap[p.ProductName] || placeholderImage, 
        }));
        setProducts(mappedProducts);

        const dynamicCategories = {};
        apiDetails.forEach(p => {
          const group = p.ProductTypeName.toUpperCase() + 'S';
          const category = p.ProductCategory;
          if (!dynamicCategories[group]) dynamicCategories[group] = [];
          if (!dynamicCategories[group].includes(category)) dynamicCategories[group].push(category);
        });
        setCategories(dynamicCategories);

      } catch (e) {
        console.error("Failed to fetch products:", e);
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };

    // Call the fetch function with the determined token
    fetchAndSetProducts(activeToken);

  }, []); // Empty dependency array ensures this runs only once on component mount

  useEffect(() => {
    setIsCartOpen(cartItems.length > 0);
  }, [cartItems]);

  const filterProducts = () => {
    if (selectedFilter.type === 'all') return products;
    if (selectedFilter.type === 'group' && categories[selectedFilter.value]) {
      return products.filter(p => categories[selectedFilter.value].includes(p.category));
    }
    if (selectedFilter.type === 'item') {
      return products.filter(p => p.category === selectedFilter.value);
    }
    return [];
  };

  const filteredProducts = filterProducts();

  const addToCart = (product) => {
    if (product.status === 'Unavailable') return;
    const defaultAddons = { espressoShots: 0, seaSaltCream: 0, syrupSauces: 0 };
    const existingIndex = cartItems.findIndex(item => item.name === product.name);
    if (existingIndex !== -1) {
      const updatedCart = [...cartItems];
      updatedCart[existingIndex].quantity += 1;
      setCartItems(updatedCart);
    } else {
      setCartItems([...cartItems, { ...product, quantity: 1, addons: defaultAddons }]);
    }
  };
  
  const ProductList = ({ products, addToCart }) => (
    <div className="menu-product-grid">
      {products.map(product => (
        <div key={product.name} className="menu-product-item">
          {product.status === 'Unavailable' && (
            <div className="menu-product-unavailable-overlay">
              <span>Not Available</span>
            </div>
          )}
          <div className="menu-product-main">
            <div className="menu-product-img-container">
              <img src={product.image} alt={product.name} />
            </div>
            <div className="menu-product-details">
              <div className="menu-product-title">{product.name}</div>
              <div className="menu-product-description">{product.description}</div>
              <div className="menu-product-price">₱{product.price.toFixed(2)}</div>
            </div>
          </div>
          <button 
            className="menu-add-button" 
            onClick={() => addToCart(product)}
            disabled={product.status === 'Unavailable'}
          >
            Add Product
          </button>
        </div>
      ))}
    </div>
  );

  const renderMainContent = () => {
    if (isLoading) return <div className="menu-status-container">Loading Products...</div>;
    if (error) return <div className="menu-status-container">{error}</div>;
    if (filteredProducts.length > 0) {
      return (
        <>
          <div className="menu-product-list-header">
            <h2 className="menu-selected-category-title">
              {selectedFilter.value.toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
            </h2>
          </div>
          <div className="menu-product-grid-container">
            <ProductList products={filteredProducts} addToCart={addToCart} />
          </div>
        </>
      );
    }
    return <div className="menu-no-products">No items in this category.</div>;
  };

  return (
    <div className="menu-page">
      <Navbar user={loggedInUser} isCartOpen={isCartOpen} />
      
      <div className="menu-page-content">
        <div className="menu-category-sidebar">
          <div className="menu-category-group">
            <div className={`menu-all-products-btn ${selectedFilter.type === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedFilter({ type: 'all', value: 'All Products' })}>
              ALL PRODUCTS
            </div>
          </div>
          {Object.entries(categories).map(([group, items]) => (
            <div className="menu-category-group" key={group}>
              <div className={`menu-group-title ${selectedFilter.type === 'group' && selectedFilter.value === group ? 'active' : ''}`}
                onClick={() => setSelectedFilter({ type: 'group', value: group })}>
                {group}
              </div>
              {items.map(item => (
                <div key={item} className={`menu-category-item ${selectedFilter.type === 'item' && selectedFilter.value === item ? 'active' : ''}`}
                  onClick={() => setSelectedFilter({ type: 'item', value: item })}>
                  {item}
                </div>
              ))}
            </div>
          ))}
        </div>
        
        <div className={`menu-main-content ${isCartOpen ? 'menu-cart-open' : ''}`}>
          <div className="menu-container">
            <div className="menu-product-list">
              {renderMainContent()}
            </div>
          </div>
        </div>
      </div>

      <CartPanel 
        cartItems={cartItems}
        setCartItems={setCartItems}
        isCartOpen={isCartOpen}
        orderType={orderType}
        setOrderType={setOrderType}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        addonPrices={{ espressoShots: 50, seaSaltCream: 30, syrupSauces: 20 }}
      />
    </div>
  );
}

export default Menu;