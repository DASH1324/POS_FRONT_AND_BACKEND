import React, { useState } from 'react';
import Navbar from '../navbar';
import './menu.css';

const categories = {
  DRINKS: [
    'Barista Choice',
    'Specialty Coffee',
    'Premium Coffee',
    'Non-Coffee',
    'Frappe',
    'Sparkling Series',
    'Milktea',
  ],
  FOOD: ['Pasta', 'Sandwich', 'Rice Meals', 'Snacks'],
  MERCHANDISE: ['Merch'],
};

const mockProducts = [
  { name: 'Espresso', category: 'Specialty Coffee' },
  { name: 'Iced Latte', category: 'Premium Coffee' },
  { name: 'Matcha Frappe', category: 'Frappe' },
  { name: 'Carbonara', category: 'Pasta' },
  { name: 'Club Sandwich', category: 'Sandwich' },
  { name: 'Merch Mug', category: 'Merch' },
  { name: 'House Blend', category: 'Barista Choice' },
  { name: 'Sparkling Lemon', category: 'Sparkling Series' },
  { name: 'Classic Milk Tea', category: 'Milktea' },
  { name: 'Americano', category: 'Specialty Coffee' },
];

function Menu() {
  const [selectedFilter, setSelectedFilter] = useState({ type: '', value: '' });

  const filterProducts = () => {
    if (selectedFilter.type === 'group') {
      return mockProducts.filter(product =>
        categories[selectedFilter.value].includes(product.category)
      );
    } else if (selectedFilter.type === 'item') {
      return mockProducts.filter(product => product.category === selectedFilter.value);
    }
    return [];
  };

  const filteredProducts = filterProducts();

  return (
    <div className='menu'>
      <Navbar />
      <div className='menu-content'>
        <div className='category'>
          {Object.entries(categories).map(([group, items]) => (
            <div className='group' key={group}>
              <div
                className={`group-title ${
                  selectedFilter.type === 'group' && selectedFilter.value === group
                    ? 'active'
                    : ''
                }`}
                onClick={() => setSelectedFilter({ type: 'group', value: group })}
              >
                {group}
              </div>
              {items.map(item => (
                <div
                  key={item}
                  className={`item ${
                    selectedFilter.type === 'item' && selectedFilter.value === item
                      ? 'active'
                      : ''
                  }`}
                  onClick={() => setSelectedFilter({ type: 'item', value: item })}
                >
                  {item}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Product display */}
        <div className='product-list'>
          {selectedFilter.value ? (
            filteredProducts.length > 0 ? (
              filteredProducts.map((product, index) => (
                <div key={index} className='product-item'>
                  {product.name}
                </div>
              ))
            ) : (
              <div>No items in this category.</div>
            )
          ) : (
            <div>Select a category to view items.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Menu;