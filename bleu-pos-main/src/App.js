import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/login';
import CashierLogin from './components/CashierLogin';
import Dashboard from './components/admin/dashboard';
import SalesMonitoring from './components/admin/salesMon';
import TransactionHistory from './components/admin/transHis';
import Products from './components/admin/products';
import Discounts from './components/admin/discounts';
import SalesReports from './components/admin/salesRep';
import TransactionReports from './components/admin/transRep';
import EmployeeRecords from './components/admin/employeeRecords';
import Menu from './components/cashier/menu';

function RedirectToLoginSystem() {
  useEffect(() => {
    window.location.href = 'http://localhost:4002/';
  }, []);

  return null; // or return <p>Redirecting...</p> if you want to show something
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RedirectToLoginSystem />} />
        <Route path="/login" element={<Login />} />
        <Route path="/CashierLogin" element={<CashierLogin />} />
        <Route path="/admin/dashboard" element={<Dashboard />} />
        <Route path="/admin/salesMon" element={<SalesMonitoring />} />
        <Route path="/admin/transHis" element={<TransactionHistory />} />
        <Route path="/admin/products" element={<Products />} />
        <Route path="/admin/discounts" element={<Discounts />} />
        <Route path="/admin/salesRep" element={<SalesReports />} />
        <Route path="/admin/transRep" element={<TransactionReports />} />
        <Route path="/admin/employeeRecords" element={<EmployeeRecords />} />
        <Route path="/cashier/menu" element={<Menu />} />
      </Routes>
    </Router>
  );
}

export default App;
