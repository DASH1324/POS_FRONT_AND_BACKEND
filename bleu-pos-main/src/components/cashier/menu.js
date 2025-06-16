import React, { useState, useEffect, useMemo } from 'react'; // Added useMemo
import Navbar from '../navbar';
import './menu.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faMoneyBillWave, faMobileAlt } from '@fortawesome/free-solid-svg-icons';

const API_BASE_URL = "http://127.0.0.1:8001";

function Menu() {
  // --- FIX #1: A clearer state to track the user's selection ---
  // We'll store exactly what the user clicked: its type ('group' or 'item') and its value.
  const [activeFilter, setActiveFilter] = useState({ type: null, value: null });
  
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
    // This logic for getting user/token is correct and remains the same
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
    // This data fetching and sidebar-building logic is correct and remains the same.
    const fetchAllData = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.error("Authentication token not found.");
        setIsLoading(false);
        return;
      }

      try {
        const [typesResponse, productsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/ProductType/`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/is_products/products/`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (!typesResponse.ok || !productsResponse.ok) {
          throw new Error("Failed to fetch all necessary data.");
        }

        const apiTypes = await typesResponse.json();
        const apiProducts = await productsResponse.json();

        const transformedProducts = apiProducts.map(product => ({
          name: product.ProductName,
          description: product.ProductDescription,
          price: parseFloat(product.ProductPrice),
          image: product.ProductImage,
          category: product.ProductCategory,
          sizes: product.ProductSizes || [],
          productTypeID: product.ProductTypeID,
          type: product.ProductDescription.toLowerCase().includes('hot') ? ['hot'] : ['iced'],
        }));
        setProducts(transformedProducts);

        const dynamicSidebarData = apiTypes.map(type => {
          const productsForThisType = transformedProducts.filter(
            p => p.productTypeID === type.productTypeID
          );
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

  // --- FIX #2: A robust filtering logic using useMemo for performance ---
  // This logic is now cleaner and directly tied to the `activeFilter` state.
  const filteredProducts = useMemo(() => {
    // If nothing is selected, return an empty array.
    if (!activeFilter.type || !activeFilter.value) {
      return [];
    }
    
    // If the user clicked a main 'group' (e.g., DRINKS)...
    if (activeFilter.type === 'group') {
      // ...filter by the ProductTypeID.
      return products.filter(p => p.productTypeID === activeFilter.value);
    }
    
    // If the user clicked an 'item' (e.g., Pasta)...
    if (activeFilter.type === 'item') {
      // ...filter by the category name.
      return products.filter(p => p.category === activeFilter.value);
    }

    // Default to returning nothing.
    return [];
  }, [products, activeFilter]); // This will re-run only when products or the filter changes.


  // Helper function to get the title for the product list area
  const getSelectedCategoryTitle = () => {
    if (!activeFilter.value) return "";
    if (activeFilter.type === 'group') {
      const foundType = sidebarData.find(type => type.productTypeID === activeFilter.value);
      return foundType ? foundType.productTypeName : "";
    }
    if (activeFilter.type === 'item') {
      return activeFilter.value; // The value itself is the category name
    }
    return "";
  };
  
  // All other functions (addToCart, getSubtotal, etc.) remain the same.
  const getSubtotal = () => {
    return cartItems.reduce((acc, item) => {
      const basePrice = item.price * item.quantity;
      const addonsPrice = getTotalAddonsPrice(item.addons) * item.quantity;
      return acc + basePrice + addonsPrice;
    }, 0);
  };

  const getDiscount = () => {
    const subtotal = getSubtotal();
    return subtotal > 100 ? 10 : 0;
  };

  const getTotal = () => {
    return getSubtotal() - getDiscount();
  };

  const addToCart = (product) => {
    const existingIndex = cartItems.findIndex(item => item.name === product.name);
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

  const updateAddons = (addonType, value) => {
    setAddons(prev => ({
      ...prev,
      [addonType]: Math.max(0, value)
    }));
  };

  const saveAddons = () => {
    if (selectedItemIndex !== null) {
      const updatedCart = [...cartItems];
      updatedCart[selectedItemIndex].addons = { ...addons };
      setCartItems(updatedCart);
    }
    closeAddonsModal();
  };

  const getAddonPrice = (addon, quantity) => {
    const prices = {
      espressoShots: 15,
      seaSaltCream: 20,
      syrupSauces: 10
    };
    return prices[addon] * quantity;
  };

  const getTotalAddonsPrice = (itemAddons) => {
    if (!itemAddons) return 0;
    return Object.entries(itemAddons).reduce((total, [addon, quantity]) => {
      return total + getAddonPrice(addon, quantity);
    }, 0);
  };

  const CartPanel = () => {
    const subtotal = getSubtotal();
    const discount = getDiscount(subtotal);
    const total = getTotal();

    const updateQuantity = (index, amount) => {
      setCartItems(prev => {
        const updated = [...prev];
        updated[index].quantity += amount;
        if (updated[index].quantity <= 0) updated.splice(index, 1);
        return updated;
      });
    };

    const removeFromCart = (index) => {
      const updatedCart = [...cartItems];
      updatedCart.splice(index, 1);
      setCartItems(updatedCart);
    };

    return (
      <div className={`cart-panel ${isCartOpen ? 'open' : ''}`}>
        <div className="order-section">
          <h2>Order Details</h2>
          
          <div className="order-type-toggle">
            <button 
              className={orderType === 'Dine in' ? 'active' : ''}
              onClick={() => setOrderType('Dine in')}
            >
              Dine in
            </button>
            <button 
              className={orderType === 'Take out' ? 'active' : ''}
              onClick={() => setOrderType('Take out')}
            >
              Take out
            </button>
          </div>

          <div className="cart-items">
            {cartItems.length > 0 ? (
              cartItems.map((item, index) => (
                <div key={index} className="cart-item">
                  <img src={item.image} alt={item.name} />
                  <div className="item-details">
                    <div className="item-name">{item.name}</div>
                    <div className="addons-link" onClick={() => openAddonsModal(index)}>Add ons</div>
                    {item.addons && (getTotalAddonsPrice(item.addons) > 0) && (
                      <div className="addons-summary">
                        {item.addons.espressoShots > 0 && <span>+{item.addons.espressoShots} Espresso</span>}
                        {item.addons.seaSaltCream > 0 && <span>+{item.addons.seaSaltCream} Sea Salt Cream</span>}
                        {item.addons.syrupSauces > 0 && <span>+{item.addons.syrupSauces} Syrups</span>}
                      </div>
                    )}
                    <div className="qty-price">
                      <button onClick={() => updateQuantity(index, -1)}>−</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(index, 1)}>+</button>
                      <span className="item-price">
                        ₱{((item.price + getTotalAddonsPrice(item.addons)) * item.quantity).toFixed(0)}
                      </span>
                    </div>
                  </div>
                  <button className="remove-item" onClick={() => removeFromCart(index)}>
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              ))
            ) : (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '200px', 
                color: '#999',
                fontSize: '14px'
              }}>
                No products added.
              </div>
            )}
          </div>

          <div className="discount-section">
            <input 
              type="text" 
              placeholder="Discounts and Promotions" 
              disabled 
            />
            
            <div className="summary">
              <div className="line">
                <span>Subtotal:</span>
                <span>₱{getSubtotal().toFixed(0)}</span>
              </div>
              <div className="line">
                <span>Discount:</span>
                <span>₱{getDiscount().toFixed(0)}</span>
              </div>
              <hr />
              <div className="line total">
                <span>Total:</span>
                <span>₱{getTotal().toFixed(0)}</span>
              </div>
            </div>
          </div>

          <div className="payment-section">
            <h3>Payment Method</h3>
            <div className="payment-options">
              <button 
                className={`cash ${paymentMethod === 'Cash' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('Cash')}
              >
                <FontAwesomeIcon icon={faMoneyBillWave} />
                <span>Cash</span>
              </button>
              <button 
                className={`ewallet ${paymentMethod === 'E-Wallet' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('E-Wallet')}
              >
                <FontAwesomeIcon icon={faMobileAlt} />
                <span>E-Wallet</span>
              </button>
            </div>
          </div>

          <button className="process-button">
            Process Transaction
          </button>
        </div>
      </div>
    );
  };
  
  if (isLoading) {
    return <div>Loading Menu...</div>;
  }

  return (
    <div className="menu">
      <Navbar user={loggedInUser} />
      
      <div className="menu-content">
        {/* --- FIX #3: The sidebar now correctly sets the activeFilter state and checks against it for the 'active' class --- */}
        <div className="category">
          {sidebarData.map((type) => (
            <div className="group" key={type.productTypeID}>
              <div
                className={`group-title ${
                  activeFilter.type === 'group' && activeFilter.value === type.productTypeID
                    ? 'active'
                    : ''
                }`}
                onClick={() => setActiveFilter({ type: 'group', value: type.productTypeID })}
              >
                {type.productTypeName}
              </div>
              {type.categories.map(categoryName => (
                <div
                  key={categoryName}
                  className={`item ${
                    activeFilter.type === 'item' && activeFilter.value === categoryName
                      ? 'active'
                      : ''
                  }`}
                  onClick={() => setActiveFilter({ type: 'item', value: categoryName })}
                >
                  {categoryName}
                </div>
              ))}
            </div>
          ))}
        </div>
        
        <div className={`menu-container ${isCartOpen ? 'cart-open' : ''}`}>
          <div className="product-list">
            {/* The logic to display products or messages remains the same, but it will now work correctly */}
            {activeFilter.value ? (
              filteredProducts.length > 0 ? (
                <>
                <h2 className="selected-category-title">
                  {getSelectedCategoryTitle()}
                </h2>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                  {filteredProducts.map((product, index) => (
                    <div key={product.name + index} className="product-item">
                       <div className="product-main">
                        <div className="product-img-container">
                          <img src={product.image} alt={product.name} />
                        </div>
                        <div className="product-details">
                          <div className="product-title">{product.name}</div>
                          <div className="product-description">{product.description}</div>
                          <div className="product-price">₱{product.price.toFixed(2)}</div>
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
                                {product.sizes.map((size, i) => {
                                  const match = size.match(/^(\d+)(oz)$/);
                                  return (
                                    <div key={i} className="option">
                                      {match ? (
                                        <>
                                          <span style={{ color: '#4197a2', fontWeight: 600 }}>{match[1]}</span>
                                          <span style={{ color: '#000', fontWeight: 700 }}>{match[2]}</span>
                                        </>
                                      ) : size}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <button className="add-button" onClick={() => addToCart(product)}>
                        Add Product
                      </button>
                    </div>
                  ))}
                </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', color: '#888', paddingTop: '50px' }}>
                  No items found in this category.
                </div>
              )
            ) : (
              <div style={{ textAlign: 'center', color: '#888', paddingTop: '50px' }}>
                Select a category to view items.
              </div>
            )}
          </div>
        </div>
      </div>

      <CartPanel />
      
      {showAddonsModal && (
        <div className="modal-overlay" onClick={closeAddonsModal}>
          <div className="addons-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Customize Order</h3>
              <button className="close-modal" onClick={closeAddonsModal}>×</button>
            </div>
            
            <div className="addons-content">
              <div className="addon-item">
                <div className="addon-info">
                  <span className="addon-name">Espresso Shots</span>
                  <span className="addon-price">+₱15 each</span>
                </div>
                <div className="addon-controls">
                  <button onClick={() => updateAddons('espressoShots', addons.espressoShots - 1)}>−</button>
                  <span>{addons.espressoShots}</span>
                  <button onClick={() => updateAddons('espressoShots', addons.espressoShots + 1)}>+</button>
                </div>
              </div>

              <div className="addon-item">
                <div className="addon-info">
                  <span className="addon-name">Sea Salt Cream</span>
                  <span className="addon-price">+₱20 each</span>
                </div>
                <div className="addon-controls">
                  <button onClick={() => updateAddons('seaSaltCream', addons.seaSaltCream - 1)}>−</button>
                  <span>{addons.seaSaltCream}</span>
                  <button onClick={() => updateAddons('seaSaltCream', addons.seaSaltCream + 1)}>+</button>
                </div>
              </div>

              <div className="addon-item">
                <div className="addon-info">
                  <span className="addon-name">Syrups/Sauces</span>
                  <span className="addon-price">+₱10 each</span>
                </div>
                <div className="addon-controls">
                  <button onClick={() => updateAddons('syrupSauces', addons.syrupSauces - 1)}>−</button>
                  <span>{addons.syrupSauces}</span>
                  <button onClick={() => updateAddons('syrupSauces', addons.syrupSauces + 1)}>+</button>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={closeAddonsModal}>Cancel</button>
              <button className="save-btn" onClick={saveAddons}>Save Add-ons</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Menu;