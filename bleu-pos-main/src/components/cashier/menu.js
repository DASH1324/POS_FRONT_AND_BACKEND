import React, { useState, useEffect, useMemo } from 'react';
import Navbar from '../navbar';
import CartPanel from './cartPanel'; 
import './menu.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faMoneyBillWave, faMobileAlt } from '@fortawesome/free-solid-svg-icons';

const API_BASE_URL = "http://127.0.0.1:8001";

function Menu() {
  const [activeFilter, setActiveFilter] = useState({ type: 'all', value: 'All Products' });
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [sidebarData, setSidebarData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orderType, setOrderType] = useState('Dine in');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [showAddonsModal, setShowAddonsModal] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState(null);
  const [addons, setAddons] = useState({ espressoShots: 0, seaSaltCream: 0, syrupSauces: 0 });
  const [loggedInUser, setLoggedInUser] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const usernameFromUrl = params.get('username');
    const authorizationFromUrl = params.get('authorization');
    if (usernameFromUrl && authorizationFromUrl) {
      localStorage.setItem('username', usernameFromUrl);
      localStorage.setItem('authToken', authorizationFromUrl);
      setLoggedInUser(usernameFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      const storedUsername = localStorage.getItem('username');
      if (storedUsername) {
        setLoggedInUser(storedUsername);
      }
    }
  }, []);

  useEffect(() => {
    const fetchAllData = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.error("Authentication token not found.");
        setIsLoading(false);
        return;
      }

      try {
        const headers = { 'Authorization': `Bearer ${token}` };
        const [typesResponse, productsResponse, productsDetailsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/ProductType/`, { headers }),
          fetch(`${API_BASE_URL}/is_products/products/`, { headers }),
          fetch(`${API_BASE_URL}/is_products/products/details/`, { headers })
        ]);

        if (!typesResponse.ok || !productsResponse.ok || !productsDetailsResponse.ok) {
          throw new Error("Failed to fetch all necessary data.");
        }

        const apiTypes = await typesResponse.json();
        const apiProducts = await productsResponse.json();
        const apiProductsDetails = await productsDetailsResponse.json();

        const productStatusMap = apiProductsDetails.reduce((acc, detail) => {
          acc[detail.ProductName] = detail.Status;
          return acc;
        }, {});

        const transformedProducts = apiProducts.map(product => ({
          name: product.ProductName,
          description: product.ProductDescription,
          price: parseFloat(product.ProductPrice),
          image: product.ProductImage,
          category: product.ProductCategory,
          sizes: product.ProductSizes || [],
          productTypeID: product.ProductTypeID,
          type: product.ProductDescription.toLowerCase().includes('hot') ? ['hot'] : ['iced'],
          status: productStatusMap[product.ProductName] || 'Available',
        }));
        setProducts(transformedProducts);

        const dynamicSidebarData = apiTypes.map(type => {
          const productsForThisType = transformedProducts.filter(p => p.productTypeID === type.productTypeID);
          const uniqueCategories = [...new Set(productsForThisType.map(p => p.category))];
          return {
            productTypeName: type.productTypeName,
            productTypeID: type.productTypeID,
            categories: uniqueCategories.sort(),
          };
        }).filter(type => type.categories.length > 0);
        setSidebarData(dynamicSidebarData);

      } catch (error) {
        console.error("Failed to build menu:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();
  }, []);

  useEffect(() => {
    setIsCartOpen(cartItems.length > 0);
  }, [cartItems]);

  const filteredProducts = useMemo(() => {
    // CHANGE: Added condition to handle the 'all' filter type
    if (activeFilter.type === 'all') return products;
    if (!activeFilter.type || !activeFilter.value) return [];
    if (activeFilter.type === 'group') return products.filter(p => p.productTypeID === activeFilter.value);
    if (activeFilter.type === 'item') return products.filter(p => p.category === activeFilter.value);
    return [];
  }, [products, activeFilter]);

  const getSelectedCategoryTitle = () => {
    if (!activeFilter.value) return "All Products";
    if (activeFilter.type === 'all') return "All Products";
    if (activeFilter.type === 'group') {
      const foundType = sidebarData.find(type => type.productTypeID === activeFilter.value);
      return foundType ? foundType.productTypeName : "";
    }
    return activeFilter.value;
  };

  const addToCart = (product) => {
    if (product.status === 'Unavailable') return;
    const existingIndex = cartItems.findIndex(item => item.name === product.name && JSON.stringify(item.addons) === JSON.stringify({ espressoShots: 0, seaSaltCream: 0, syrupSauces: 0 }));
    if (existingIndex !== -1) {
      const updatedCart = [...cartItems];
      updatedCart[existingIndex].quantity += 1;
      setCartItems(updatedCart);
    } else {
      setCartItems([...cartItems, { 
        ...product, 
        quantity: 1, 
        addons: { espressoShots: 0, seaSaltCream: 0, syrupSauces: 0 }
      }]);
    }
  };
  
  const getSubtotal = () => cartItems.reduce((acc, item) => acc + (item.price + getTotalAddonsPrice(item.addons)) * item.quantity, 0);
  const getDiscount = () => getSubtotal() > 100 ? 10 : 0;
  const getTotal = () => getSubtotal() - getDiscount();
  const openAddonsModal = (itemIndex) => {
    setSelectedItemIndex(itemIndex);
    setAddons(cartItems[itemIndex].addons || { espressoShots: 0, seaSaltCream: 0, syrupSauces: 0 });
    setShowAddonsModal(true);
  };
  const closeAddonsModal = () => {
    setShowAddonsModal(false);
    setSelectedItemIndex(null);
    setAddons({ espressoShots: 0, seaSaltCream: 0, syrupSauces: 0 });
  };
  const updateAddons = (addonType, value) => setAddons(prev => ({...prev, [addonType]: Math.max(0, value)}));
  const saveAddons = () => {
    if (selectedItemIndex !== null) {
      const updatedCart = [...cartItems];
      updatedCart[selectedItemIndex].addons = { ...addons };
      setCartItems(updatedCart);
    }
    closeAddonsModal();
  };
  const getAddonPrice = (addon, quantity) => ({espressoShots: 15, seaSaltCream: 20, syrupSauces: 10}[addon] * quantity);
  const getTotalAddonsPrice = (itemAddons) => itemAddons ? Object.entries(itemAddons).reduce((total, [addon, quantity]) => total + getAddonPrice(addon, quantity), 0) : 0;
  
  if (isLoading) {
    return <div>Loading Menu...</div>;
  }

  return (
    <div className="menu-page">
      <Navbar user={loggedInUser} />
      <div className="menu-page-content">
        <div className="menu-category-sidebar">
           <div className="menu-category-group">
            <div
              className={`menu-all-products-btn ${activeFilter.type === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter({ type: 'all', value: 'All Products' })}
            >
              ALL PRODUCTS
            </div>
          </div>

          {sidebarData.map((type) => (
            <div className="menu-category-group" key={type.productTypeID}>
              <div
                className={`menu-group-title ${activeFilter.type === 'group' && activeFilter.value === type.productTypeID ? 'active' : ''}`}
                onClick={() => setActiveFilter({ type: 'group', value: type.productTypeID })}
              >
                {type.productTypeName}
              </div>
              {type.categories.map(categoryName => (
                <div
                  key={categoryName}
                  className={`menu-category-item ${activeFilter.type === 'item' && activeFilter.value === categoryName ? 'active' : ''}`}
                  onClick={() => setActiveFilter({ type: 'item', value: categoryName })}
                >
                  {categoryName}
                </div>
              ))}
            </div>
          ))}
        </div>
        
        <div className={`menu-main-content ${isCartOpen ? 'cart-open' : ''}`}>
          <div className="menu-container">
            <div className="menu-product-list">
              {filteredProducts.length > 0 ? (
                <>
                <div className="menu-product-list-header">
                    <h2 className="menu-selected-category-title">{getSelectedCategoryTitle()}</h2>
                </div>
                <div className="menu-product-grid-container">
                    <div className="menu-product-grid">
                      {filteredProducts.map((product, index) => (
                        <div key={product.name + index} className="menu-product-item">
                           {product.status === 'Unavailable' && (
                            <div className="unavailable-overlay">
                              <span>Unavailable</span>
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

                          {(product.type.length > 0 || product.sizes.length > 0) && (
                            <div className="product-options">
                              {product.type.length > 0 && (
                                <div className="option-section">
                                  <div className="option-label">Type</div>
                                  <div className="option-group">
                                    {product.type.includes('hot') && <div className="option">🔥</div>}
                                    {product.type.includes('iced') && <div className="option">❄️</div>}
                                  </div>
                                </div>
                              )}
                              {product.sizes.length > 0 && (
                                <div className="option-section">
                                  <div className="option-label">Size</div>
                                  <div className="option-group">
                                    {product.sizes.map((size, i) => (
                                      <div key={i} className="option">{size}</div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          <button 
                            className="add-button" 
                            onClick={() => addToCart(product)}
                            disabled={product.status === 'Unavailable'}
                          >
                            Add Product
                          </button>
                        </div>
                      ))}
                    </div>
                </div>
                </>
              ) : (
                <div className="menu-no-products">
                  {activeFilter.value ? 'No items found in this category.' : 'Select a category to view items.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CartPanel
        isCartOpen={isCartOpen}
        cartItems={cartItems}
        setCartItems={setCartItems}
        orderType={orderType}
        setOrderType={setOrderType}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        openAddonsModal={openAddonsModal}
        getTotalAddonsPrice={getTotalAddonsPrice}
        getSubtotal={getSubtotal}
        getDiscount={getDiscount}
        getTotal={getTotal}
      />
      
      {showAddonsModal && (
        <div className="modal-overlay" onClick={closeAddonsModal}>
          <div className="addons-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Customize Order</h3><button className="close-modal" onClick={closeAddonsModal}>×</button></div>
            <div className="addons-content">
              <div className="addon-item"><div className="addon-info"><span className="addon-name">Espresso Shots</span><span className="addon-price">+₱15 each</span></div><div className="addon-controls"><button onClick={() => updateAddons('espressoShots', addons.espressoShots - 1)}>−</button><span>{addons.espressoShots}</span><button onClick={() => updateAddons('espressoShots', addons.espressoShots + 1)}>+</button></div></div>
              <div className="addon-item"><div className="addon-info"><span className="addon-name">Sea Salt Cream</span><span className="addon-price">+₱20 each</span></div><div className="addon-controls"><button onClick={() => updateAddons('seaSaltCream', addons.seaSaltCream - 1)}>−</button><span>{addons.seaSaltCream}</span><button onClick={() => updateAddons('seaSaltCream', addons.seaSaltCream + 1)}>+</button></div></div>
              <div className="addon-item"><div className="addon-info"><span className="addon-name">Syrups/Sauces</span><span className="addon-price">+₱10 each</span></div><div className="addon-controls"><button onClick={() => updateAddons('syrupSauces', addons.syrupSauces - 1)}>−</button><span>{addons.syrupSauces}</span><button onClick={() => updateAddons('syrupSauces', addons.syrupSauces + 1)}>+</button></div></div>
            </div>
            <div className="modal-footer"><button className="cancel-btn" onClick={closeAddonsModal}>Cancel</button><button className="save-btn" onClick={saveAddons}>Save Add-ons</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Menu;