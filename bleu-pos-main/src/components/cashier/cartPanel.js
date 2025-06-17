import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faMoneyBills, faQrcode } from '@fortawesome/free-solid-svg-icons';
import { FiMinus, FiPlus } from "react-icons/fi";
import './cartPanel.css';

const API_URL = 'http://127.0.0.1:9000';

const CartPanel = ({
  cartItems,
  setCartItems,
  isCartOpen,
  orderType,
  setOrderType,
  paymentMethod,
  setPaymentMethod,
  addonPrices = {},
  availableDiscounts = [],
  drinkCategories = []
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddonsModal, setShowAddonsModal] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState(null);
  const [addons, setAddons] = useState({ espressoShots: 0, seaSaltCream: 0, syrupSauces: 0 });
  const [showDiscountsModal, setShowDiscountsModal] = useState(false);
  const [appliedDiscounts, setAppliedDiscounts] = useState([]);
  const [stagedDiscounts, setStagedDiscounts] = useState([]);

  const isDrinkItem = (item) => drinkCategories.includes(item.category);
  const openAddonsModal = (itemIndex) => {
    setSelectedItemIndex(itemIndex);
    setAddons(cartItems[itemIndex].addons || { espressoShots: 0, seaSaltCream: 0, syrupSauces: 0 });
    setShowAddonsModal(true);
  };
  const closeAddonsModal = () => { setShowAddonsModal(false); setSelectedItemIndex(null); };
  const openDiscountsModal = () => { setStagedDiscounts([...appliedDiscounts]); setShowDiscountsModal(true); };
  const closeDiscountsModal = () => { setShowDiscountsModal(false); };
  const applyDiscounts = () => { setAppliedDiscounts([...stagedDiscounts]); setShowDiscountsModal(false); };
  const toggleStagedDiscount = (discountId) => {
    setStagedDiscounts(prev =>
      prev.includes(discountId) ? prev.filter(id => id !== discountId) : [...prev, discountId]
    );
  };
  const updateAddons = (addonType, value) => { setAddons(prev => ({ ...prev, [addonType]: Math.max(0, value) })); };
  const saveAddons = () => {
    if (selectedItemIndex !== null) {
      const updatedCart = [...cartItems];
      updatedCart[selectedItemIndex].addons = { ...addons };
      setCartItems(updatedCart);
    }
    closeAddonsModal();
  };
  const getAddonPrice = (addon, quantity) => (addonPrices?.[addon] || 0) * quantity;
  const getTotalAddonsPrice = (itemAddons) => {
    if (!itemAddons) return 0;
    return Object.entries(itemAddons).reduce((total, [addon, quantity]) => total + getAddonPrice(addon, quantity), 0);
  };
  const getSubtotal = () => cartItems.reduce((acc, item) => acc + (item.price + getTotalAddonsPrice(item.addons)) * item.quantity, 0);
  const getDiscount = (discountsList = appliedDiscounts) => {
    const subtotal = getSubtotal();
    let totalDiscount = 0;
    discountsList.forEach(discountId => {
      const discount = availableDiscounts.find(d => d.id === discountId);
      if (discount && (!discount.minAmount || subtotal >= discount.minAmount)) {
        totalDiscount += discount.type === 'percentage' ? (subtotal * discount.value) / 100 : discount.value;
      }
    });
    return Math.min(totalDiscount, subtotal);
  };
  const getTotal = () => Math.max(0, getSubtotal() - getDiscount());
  const updateQuantity = (index, amount) => {
    setCartItems(prev => {
      const updated = [...prev];
      updated[index].quantity += amount;
      return updated[index].quantity <= 0 ? updated.filter((_, i) => i !== index) : updated;
    });
  };
  const removeFromCart = (index) => { setCartItems(prev => prev.filter((_, i) => i !== index)); };

  const handleProcessTransaction = async () => {
    if (cartItems.length === 0) {
      alert("Cart is empty. Please add items to proceed.");
      return;
    }
    const token = localStorage.getItem('authToken'); 
    if (!token) {
      alert("Authentication error: You are not logged in. Please log in to continue.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const cleanAppliedDiscounts = appliedDiscounts.filter(id => id && id.trim() !== '');

    const saleData = {
      cartItems: cartItems.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        category: item.category,
        addons: item.addons || { espressoShots: 0, seaSaltCream: 0, syrupSauces: 0 },
      })),
      orderType: orderType,
      paymentMethod: paymentMethod,
      appliedDiscounts: cleanAppliedDiscounts,
    };

    try {
     
      const url = `${API_URL}/auth/sales/`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(saleData),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Your session has expired or is invalid. Please log in again.");
        }
        throw new Error(result.detail || `HTTP error! Status: ${response.status}`);
      }

      alert(`Sale processed successfully! Sale ID: ${result.saleId}`);

      setCartItems([]);
      setAppliedDiscounts([]);
      setOrderType('Dine in');
      setPaymentMethod('Cash');

    } catch (err) {
      console.error("Failed to process sale:", err);
      setError(err.message);
      alert(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const AddonsModal = () => { /* ... Your Modal JSX ... */ };
  const DiscountsModal = () => { /* ... Your Modal JSX ... */ };

  return (
    <>
      <div className={`cart-panel ${isCartOpen ? 'open' : ''}`}>
       
        <div className="order-section">
          <h2>Order Details</h2>
          <div className="order-type-toggle">
            <button className={orderType === 'Dine in' ? 'active' : ''} onClick={() => setOrderType('Dine in')}>Dine in</button>
            <button className={orderType === 'Take out' ? 'active' : ''} onClick={() => setOrderType('Take out')}>Take out</button>
          </div>
          <div className="cart-items">
            {cartItems.length > 0 ? (
              cartItems.map((item, index) => (
                <div key={`${item.name}-${index}`} className="cart-item">
                  <img src={item.image || '/placeholder-image.png'} alt={item.name} />
                  <div className="item-details">
                    <div className="item-name">{item.name}</div>
                    {isDrinkItem(item) && (<div className="addons-link" onClick={() => openAddonsModal(index)}>Add ons</div>)}
                    {item.addons && getTotalAddonsPrice(item.addons) > 0 && (
                      <div className="addons-summary">
                        {item.addons.espressoShots > 0 && <span>+{item.addons.espressoShots} Espresso</span>}
                        {item.addons.seaSaltCream > 0 && <span>+{item.addons.seaSaltCream} Sea Salt Cream</span>}
                        {item.addons.syrupSauces > 0 && <span>+{item.addons.syrupSauces} Syrups</span>}
                      </div>
                    )}
                    <div className="flex-spacer" />
                    <div className="qty-price">
                      <button onClick={() => updateQuantity(index, -1)}><FiMinus /></button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(index, 1)}><FiPlus /></button>
                      <span className="item-price">₱{((item.price + getTotalAddonsPrice(item.addons)) * item.quantity).toFixed(0)}</span>
                    </div>
                  </div>
                  <button className="remove-item" onClick={() => removeFromCart(index)}><FontAwesomeIcon icon={faTrash} /></button>
                </div>
              ))
            ) : (<div className="empty-cart-message">No products added.</div>)}
          </div>
          <div className="discount-section">
            <div className="discount-input-wrapper" onClick={openDiscountsModal}>
              <input type="text" placeholder="Discounts and Promotions" value={appliedDiscounts.length > 0 ? `${appliedDiscounts.length} discount(s) applied` : ''} readOnly />
            </div>
            <div className="summary">
              <div className="line"><span>Subtotal:</span><span>₱{getSubtotal().toFixed(0)}</span></div>
              <div className="line"><span>Discount:</span><span>- ₱{getDiscount().toFixed(0)}</span></div>
              <hr />
              <div className="line total"><span>Total:</span><span>₱{getTotal().toFixed(0)}</span></div>
            </div>
          </div>
          <div className="payment-section">
            <h3>Payment Method</h3>
            <div className="payment-options">
              <button className={`cash ${paymentMethod === 'Cash' ? 'active' : ''}`} onClick={() => setPaymentMethod('Cash')}><FontAwesomeIcon icon={faMoneyBills} /><span>Cash</span></button>
              <button className={`ewallet ${paymentMethod === 'E-Wallet' ? 'active' : ''}`} onClick={() => setPaymentMethod('E-Wallet')}><FontAwesomeIcon icon={faQrcode} /><span>GCash</span></button>
            </div>
          </div>
          <button className="process-button" onClick={handleProcessTransaction} disabled={isLoading || cartItems.length === 0}>
            {isLoading ? 'Processing...' : 'Process Transaction'}
          </button>
          {error && <div className="error-message">{error}</div>}
        </div>
      </div>
      <AddonsModal />
      <DiscountsModal />
    </>
  );
};

export default CartPanel;