import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from 'react-router-dom';
import "../admin/employeeRecords.css";
import Sidebar from "../sidebar";
import { FaChevronDown, FaBell, FaEdit, FaArchive, FaPlus, FaFolderOpen } from "react-icons/fa";
import DataTable from "react-data-table-component";

const API_BASE_URL = "http://127.0.0.1:9000/employee-accounts";
const IMAGE_BASE_URL = "http://127.0.0.1:9000/uploads";
export const DEFAULT_PROFILE_IMAGE = "https://media-hosting.imagekit.io/1123dd6cf5c544aa/screenshot_1746457481487.png?Expires=1841065483&Key-Pair-Id=K2ZIVPTIP2VGHC&Signature=kiHcXbHpirt9QHbMA4by~Kd4b2BrczywyVUfZZpks5ga3tnO8KlP8s5tdDpZQqinqOG30tGn0tgSCwVausjJ1OJ9~e6qPVjLXbglD-65hmsehYCZgEzeyGPPE-rOlyGJCgJC~GCZOu0jDKKcu2fefrClaqBBT3jaXoK4qhDPfjIFa2GCMfetybNs0RF8BtyKLgFGeEkvibaXhYxmzO8tksUKaLAMLbsPWvHBNuzV6Ar3mj~lllq7r7nrynNfdvbtuED7OGczSqZ8H-iopheAUhaWZftAh9tX2vYZCZZ8UztSEO3XUgLxMMtv9NnTei1omK00iJv1fgBjwR2lSqRk7w__";

const getAuthToken = () => {
    return localStorage.getItem("access_token");
};

function EmployeeRecords() {
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [roleFilter, setRoleFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [viewingEmployee, setViewingEmployee] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [activeTab, setActiveTab] = useState("employees");
    const navigate = useNavigate();

    const initialFormData = {
        id: null, name: "", username: "", email: "", phone: "", role: "",
        hireDate: "", status: "Active", image: DEFAULT_PROFILE_IMAGE,
        imageFile: null, password: "",
    };
    const [formData, setFormData] = useState(initialFormData);
    const fileInputRef = useRef(null);

    const mapBackendToFrontend = (empFromBackend) => ({
        id: empFromBackend.userID,
        name: empFromBackend.fullName,
        username: empFromBackend.username || (empFromBackend.userRole === 'cashier' ? 'cashier' : ''),
        email: empFromBackend.emailAddress || "N/A",
        role: empFromBackend.userRole,
        phone: empFromBackend.phoneNumber || "N/A",
        status: "Active", 
        hireDate: empFromBackend.hireDate ? empFromBackend.hireDate.split("T")[0] : "",
        image: empFromBackend.uploadImage ? `${IMAGE_BASE_URL}/${empFromBackend.uploadImage}` : DEFAULT_PROFILE_IMAGE,
    });

    const fetchEmployees = useCallback(async () => {
        const token = getAuthToken();
        if (!token) {
            alert("Authentication token not found. Please log in.");
            navigate('/login');
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/list-employee-accounts`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (response.status === 401) {
                alert("Session expired or unauthorized. Please log in again.");
                localStorage.removeItem('access_token');
                navigate('/login');
                return;
            }
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
                throw new Error(errorData.detail || "Failed to fetch employees");
            }
            const data = await response.json();
            setEmployees(data.map(mapBackendToFrontend));
        } catch (error) {
            console.error("Error fetching employees:", error);
            alert(`Error fetching employees: ${error.message}`);
        }
    }, [navigate]);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);


    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData(prev => ({ ...prev, image: URL.createObjectURL(file), imageFile: file }));
        }
    };

    const toggleDropdown = () => setDropdownOpen(!isDropdownOpen);
    const currentDate = new Date().toLocaleString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
        hour: "numeric", minute: "numeric", second: "numeric",
    });

    const [loggedInUserDisplay, setLoggedInUserDisplay] = useState({ role: "User", name: "Current User" });

    useEffect(() => {
        const token = getAuthToken();
        if (token) {
            try {
                const decodedToken = JSON.parse(atob(token.split('.')[1]));
                setLoggedInUserDisplay({
                    name: decodedToken.sub || "Current User",
                    role: decodedToken.role || "User"
                });
            } catch (error) {
                console.error("Error decoding token for display:", error);
            }
        }
    }, []);


    const handleModalClose = () => {
        setShowModal(false);
        setEditingEmployee(null);
        setViewingEmployee(null);
        setFormData(initialFormData);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSaveEmployee = async () => {
        const token = getAuthToken();
        if (!token) {
            alert("Authentication token not found. Please log in.");
            navigate('/login');
            return;
        }

        if (!formData.name || formData.name.trim() === "") {
            alert("Full Name is required."); return;
        }
        if (!formData.email || formData.email.trim() === "") {
            alert("Email Address is required."); return;
        }
        if (!formData.role) {
            alert("Role is required."); return;
        }

        let passwordToSend = null;

        if (formData.password && formData.password.trim() !== "") {
            if (formData.role === 'cashier') {
                if (!/^\d{6}$/.test(formData.password)) {
                    alert("Passcode for Cashier must be exactly 6 digits.");
                    return;
                }
            }
            passwordToSend = formData.password;
        } else {
            if (!editingEmployee) {
                if (formData.role === 'cashier') {
                    alert("Passcode is required for new Cashier."); return;
                } else if (formData.role === 'admin' || formData.role === 'manager') {
                    alert("Password is required for new Admin/Manager."); return;
                }
            } else {
                const originalRole = editingEmployee.role;
                const newRole = formData.role;

                if (newRole === 'cashier' && originalRole !== 'cashier') {
                    alert("A 6-digit passcode is required when changing role to Cashier."); return;
                }
                if ((newRole === 'admin' || newRole === 'manager') && originalRole === 'cashier') {
                    alert("A new password is required when changing role from Cashier to Admin/Manager."); return;
                }
            }
        }

        let usernameToSend = formData.username;
        if (formData.role === 'admin' || formData.role === 'manager') {
            if (!formData.username || formData.username.trim() === '') {
                alert("Username is required for Admin/Manager roles.");
                return;
            }
            if (formData.username.toLowerCase() === 'cashier') {
                alert("'cashier' is a reserved username and cannot be used for Admin/Manager roles.");
                return;
            }
        } else if (formData.role === 'cashier') {
            usernameToSend = 'cashier';
        }


        const apiFormData = new FormData();
        apiFormData.append('fullName', formData.name);
        apiFormData.append('userRole', formData.role);
        apiFormData.append('emailAddress', formData.email);

        if (usernameToSend) {
            apiFormData.append('username', usernameToSend);
        }

        if (passwordToSend) {
            apiFormData.append('password', passwordToSend);
        }

        if (formData.phone && formData.phone.trim() !== "" && formData.phone !== "N/A") {
            apiFormData.append('phoneNumber', formData.phone);
        } else if (formData.phone.trim() === "" && editingEmployee && editingEmployee.phone !== "N/A") { // Send empty string to clear if it was previously set
             apiFormData.append('phoneNumber', "");
        }


        if (formData.hireDate) {
            apiFormData.append('hireDate', formData.hireDate);
        }

        if (formData.imageFile) {
            apiFormData.append('uploadImage', formData.imageFile);
        }

        try {
            let response;
            const headers = { 'Authorization': `Bearer ${token}` };

            if (editingEmployee) {
                if (!editingEmployee.id) {
                    alert("Error: Employee ID is missing for update."); return;
                }
                response = await fetch(`${API_BASE_URL}/update/${editingEmployee.id}`, {
                    method: "PUT", body: apiFormData, headers: headers,
                });
            } else {
                response = await fetch(`${API_BASE_URL}/create`, {
                    method: "POST", body: apiFormData, headers: headers,
                });
            }

            if (response.status === 401) {
                alert("Session expired or unauthorized. Please log in again.");
                localStorage.removeItem('access_token');
                navigate('/login');
                return;
            }

            const responseData = await response.json();

            if (!response.ok) {
                const errorMessage = responseData.detail || `Failed to ${editingEmployee ? 'update' : 'add'} employee. Status: ${response.status}`;
                throw new Error(errorMessage);
            }

            alert(`Employee ${editingEmployee ? 'updated' : 'added'} successfully!`);
            fetchEmployees();
            handleModalClose();

        } catch (error) {
            console.error(`Error saving employee:`, error);
            alert(`Error: ${error.message}`);
        }
    };

    const handleViewEmployee = (emp) => {
        setViewingEmployee(emp);
    };

    const handleEditEmployee = (emp) => {
        setEditingEmployee(emp);
        setFormData({
            id: emp.id,
            name: emp.name,
            username: emp.username || (emp.role === 'cashier' ? 'cashier' : ''),
            email: emp.email,
            phone: emp.phone === "N/A" ? "" : emp.phone,
            role: emp.role,
            hireDate: emp.hireDate,
            status: emp.status,
            image: emp.image,
            imageFile: null,
            password: "", 
        });
        setShowModal(true);
    };

    const handleDeleteEmployee = async (empId) => {
        const token = getAuthToken();
        if (!token) {
            alert("Authentication token not found. Please log in.");
            navigate('/login');
            return;
        }
        if (!empId) { alert("Error: Employee ID is missing."); return; }
        const confirmDelete = window.confirm("Are you sure you want to soft delete this employee?");
        if (confirmDelete) {
            try {
                const response = await fetch(`${API_BASE_URL}/delete/${empId}`, {
                    method: "DELETE",
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                if (response.status === 401) {
                    alert("Session expired or unauthorized. Please log in again.");
                    localStorage.removeItem('access_token');
                    navigate('/login');
                    return;
                }
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
                    throw new Error(errorData.detail || "Failed to delete employee");
                }
                alert("Employee deleted successfully!");
                fetchEmployees();
            } catch (error) {
                console.error("Error deleting employee:", error);
                alert(`Error deleting employee: ${error.message}`);
            }
        }
    };

    const filteredData = employees.filter(emp => {
        const nameMatch = emp.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const emailMatch = emp.email?.toLowerCase().includes(searchTerm.toLowerCase());
        const roleMatch = roleFilter ? emp.role === roleFilter : true;
        const statusMatch = statusFilter ? emp.status === statusFilter : true;
        return (nameMatch || emailMatch) && roleMatch && statusMatch;
    });

    const columns = [
        {
            name: "EMPLOYEE",
            selector: row => (
                <div className="employee-info">
                    <img
                        src={row.image || DEFAULT_PROFILE_IMAGE}
                        alt={row.name}
                        className="employee-photo"
                        onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_PROFILE_IMAGE; }}
                    />
                    <div>
                        <div className="employee-name">{row.name}</div>
                    </div>
                </div>
            ),
            sortable: false, width: '20%',
        },
        { name: "EMAIL", selector: row => row.email, sortable: false, width: '20%' },
        { name: "ROLE", selector: row => row.role, sortable: false, width: '10%' },
        { name: "PHONE", selector: row => row.phone, width: '13%' },
        {
            name: "STATUS",
            selector: row => (<span className={`status-badge ${row.status === "Active" ? "active" : "inactive"}`}>{row.status}</span>),
            width: '10%',
        },
        { name: "HIRE DATE", selector: row => row.hireDate, width: '12%' },
        {
            name: "ACTION",
            cell: row => (
                <div className="action-buttons">
                    <button className="view-button" onClick={() => handleViewEmployee(row)}><FaFolderOpen /></button>
                    <button className="edit-button" onClick={() => handleEditEmployee(row)}><FaEdit /></button>
                    <button className="delete-button" onClick={() => handleDeleteEmployee(row.id)}><FaArchive /></button>
                </div>
            ),
            width: '15%',
        },
    ];

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        
        setFormData(prevFormData => {
            const newFormData = { ...prevFormData, [name]: value };

            if (name === "role") {
                const previousRole = prevFormData.role;
                const newRole = value; 

                if (previousRole === 'cashier' && (newRole === 'admin' || newRole === 'manager')) {
                    newFormData.username = ''; 
                } else if ((previousRole === 'admin' || previousRole === 'manager') && newRole === 'cashier') {
                    newFormData.username = 'cashier'; 
                }
            }
            
            if (name === "password") {
                if (newFormData.role === 'cashier') {
                    const numericValue = value.replace(/[^0-9]/g, '');
                    newFormData.password = numericValue.slice(0, 6);
                } else {
                    newFormData.password = value; 
                }
            }
            return newFormData;
        });
    };

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        navigate('/');
    };

     const [roles] = useState([
        { id: 1, name: "Admin", description: "Full system access with all permissions", users: employees.filter(e => e.role === 'admin').length },
        { id: 2, name: "Manager", description: "Store management with limited admin access", users: employees.filter(e => e.role === 'manager').length },
        { id: 3, name: "Cashier", description: "Point of sale and basic inventory functions", users: employees.filter(e => e.role === 'cashier').length },
    ]);

     useEffect(() => {
     }, [employees]);


    const columnRoles = [
        { name: "ROLE NAME", selector: (row) => row.name, sortable: true, width: "33%" },
        { name: "DESCRIPTION", selector: (row) => row.description, wrap: true, width: "34%" },
        { name: "USERS", selector: (row) => employees.filter(emp => emp.role === row.name.toLowerCase()).length, center: true, width: "33%" },
    ];

    let passwordIsRequiredForDisplay = false;
    let passwordHintText = "";

    if (showModal) { 
        if (!editingEmployee) { 
            passwordIsRequiredForDisplay = true;
        } else { 
            const originalRole = editingEmployee.role; 
            const currentFormRole = formData.role;    

            if (currentFormRole === 'cashier' && originalRole !== 'cashier') {
                passwordIsRequiredForDisplay = true; 
            } else if ((currentFormRole === 'admin' || currentFormRole === 'manager') && originalRole === 'cashier') {
                passwordIsRequiredForDisplay = true; 
            }
            
            if (!passwordIsRequiredForDisplay) { 
                passwordHintText = "(leave blank to keep current)";
            }
        }
    }

    return (
        <div className="empRecords">
            <Sidebar />
            <div className="employees">
                <header className="header">
                    <div className="header-left"> <h2 className="page-title">Employee Records</h2> </div>
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
                            <ul>
                                <li onClick={handleLogout}>Logout</li>
                            </ul>
                            </div>
                        )}
                        </div>
                    </div>
                </header>

                <div className="empRecords-content">
                    <div className="tabs">
                        <button
                            className={activeTab === "employees" ? "tab active-tab" : "tab"}
                            onClick={() => setActiveTab("employees")}
                        >
                            Employees
                        </button>
                        <button
                            className={activeTab === "roles" ? "tab active-tab" : "tab"}
                            onClick={() => setActiveTab("roles")}
                        >
                            Roles
                        </button>
                    </div>

                {activeTab === "employees" && (
                    <>
                    <div className="filter-bar">
                        <input
                            type="text"
                            placeholder="Search Employees..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                            <option value="">Role: All</option>
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="cashier">Cashier</option>
                        </select>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="">Status: All</option>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option> 
                        </select>
                        <button className="add-btn" onClick={() => { setFormData(initialFormData); setEditingEmployee(null); setShowModal(true); }}>
                            <FaPlus /> Add Employee
                        </button>
                    </div>

                    {showModal && (
                        <div className="modal-overlay">
                            <div className="modal-container"> 
                                <div className="modal-header">
                                    <h2>{editingEmployee ? "Edit Employee" : "Add Employee"}</h2>
                                    <button className="modal-close" onClick={handleModalClose}>×</button>
                                </div>
                                <div className="modal-body">
                                    <div className="profile-upload-wrapper">
                                        <div className="profile-upload" onClick={() => fileInputRef.current.click()}>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleImageChange}
                                                accept="image/*"
                                                style={{ display: "none" }}
                                            />
                                            <img
                                                src={formData.image || DEFAULT_PROFILE_IMAGE}
                                                alt="Profile Preview"
                                                className="profile-image"
                                                onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_PROFILE_IMAGE; }}
                                            />
                                            {!formData.imageFile && !editingEmployee?.image && (!formData.image || formData.image === DEFAULT_PROFILE_IMAGE) && <div className="upload-placeholder">Upload Image</div>}
                                            {(editingEmployee?.image || formData.imageFile) && <div className="upload-placeholder">Change Image</div>}
                                        </div>
                                    </div>
                                    <form className="form-grid" onSubmit={(e) => { e.preventDefault(); handleSaveEmployee(); }}>
                                        <label>Full Name<span className="required">*</span></label>
                                        <input
                                            type="text"
                                            name="name"
                                            placeholder="Full Name"
                                            value={formData.name}
                                            onChange={handleFormChange}
                                            required
                                        />

                                        {/* Row for Email and Phone */}
                                        <div className="row">
                                            <div>
                                                <label>Email Address<span className="required">*</span></label>
                                                <input
                                                    type="email"
                                                    name="email"
                                                    placeholder="Email"
                                                    value={formData.email}
                                                    onChange={handleFormChange}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label>Phone Number</label>
                                                <input
                                                    type="tel"
                                                    name="phone"
                                                    placeholder="Phone Number"
                                                    value={formData.phone}
                                                    onChange={handleFormChange}
                                                />
                                            </div>
                                        </div>

                                        {/* Row for Role and Hire Date */}
                                        <div className="row">
                                            <div>
                                                <label>Role<span className="required">*</span></label>
                                                <select name="role" value={formData.role} onChange={handleFormChange} required>
                                                    <option value="">Select Role</option>
                                                    <option value="admin">Admin</option>
                                                    <option value="manager">Manager</option>
                                                    <option value="cashier">Cashier</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label>Hire Date</label>
                                                <input
                                                    type="date"
                                                    name="hireDate"
                                                    value={formData.hireDate}
                                                    onChange={handleFormChange}
                                                />
                                            </div>
                                        </div>
                                        
                                        {(formData.role === 'admin' || formData.role === 'manager') && (
                                            <>
                                                <label>Username<span className="required">*</span></label>
                                                <input
                                                    type="text"
                                                    name="username"
                                                    placeholder="Username"
                                                    value={formData.username}
                                                    onChange={handleFormChange}
                                                />
                                            </>
                                        )}
                                        
                                        <label>
                                            {formData.role === 'cashier' ? 'Passcode (6 digits)' : 'Password'}
                                            {passwordIsRequiredForDisplay && <span className="required">*</span>}
                                            <span className="password-hint"> {passwordHintText}</span>
                                        </label>
                                        <input
                                            type={formData.role === 'cashier' ? "tel" : "password"} 
                                            name="password"
                                            placeholder={formData.role === 'cashier' ? '6-digit Passcode' : 'Password'}
                                            value={formData.password}
                                            onChange={handleFormChange}
                                            required={passwordIsRequiredForDisplay} 
                                            maxLength={formData.role === 'cashier' ? 6 : undefined}
                                            pattern={formData.role === 'cashier' ? "[0-9]*" : undefined}
                                            inputMode={formData.role === 'cashier' ? "numeric" : undefined}
                                        />
                                        
                                        <button type="submit" className="save-btn">Save Employee</button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )}

                    {viewingEmployee && (
                        <div className="modal-overlay">
                            <div className="modal-container">
                                <div className="modal-header">
                                    <h2>Employee Details</h2>
                                    <button className="modal-close" onClick={() => setViewingEmployee(null)}>×</button>
                                </div>
                                <div className="modal-body">
                                    <div className="profile-upload-wrapper">
                                        <div className="profile-view"> 
                                            <img
                                                src={viewingEmployee.image || DEFAULT_PROFILE_IMAGE}
                                                alt={viewingEmployee.name}
                                                className="profile-image"
                                                onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_PROFILE_IMAGE; }}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-grid view-mode">
                                        <div className="row">
                                            <div><label>Employee ID</label><input type="text" value={viewingEmployee.id} disabled /></div>
                                            <div><label>Full Name</label><input type="text" value={viewingEmployee.name} disabled /></div>
                                        </div>
                                        <div className="row">
                                            <div>
                                                <label>Email Address</label><input type="email" value={viewingEmployee.email} disabled />
                                            </div>
                                            <div>
                                                <label>Phone Number</label><input type="tel" value={viewingEmployee.phone} disabled />
                                            </div>
                                        </div>
                                        
                                        {(viewingEmployee.role === 'admin' || viewingEmployee.role === 'manager' || viewingEmployee.username === 'cashier') && (
                                            <div><label>Username</label><input type="text" value={viewingEmployee.username} disabled /></div>
                                        )}
                                        
                                        <div className="row">
                                            <div><label>Role</label><input type="text" value={viewingEmployee.role} disabled /></div>
                                            <div><label>Hire Date</label><input type="date" value={viewingEmployee.hireDate} disabled /></div>
                                        </div>
                                        <div><label>Status</label><input type="text" value={viewingEmployee.status} disabled /></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DataTable
                        columns={columns}
                        data={filteredData}
                        pagination
                        highlightOnHover
                        responsive
                        customStyles={{
                            headCells: { style: { backgroundColor: '#4B929D', color: '#fff', fontWeight: '600', fontSize: '14px', padding: '12px', textTransform: 'uppercase', textAlign: 'center', letterSpacing: '1px' } },
                            header: { style: { minHeight: '60px', paddingTop: '10px', paddingBottom: '10px' } },
                            rows: { style: { minHeight: '55px', padding: '5px' } }
                        }}
                    />
                </>
                )}

                {activeTab === "roles" && (
                <div className="roleManagement">
                    <div className="roles">
                        <div className="roleManagement-content">
                            <DataTable
                                columns={columnRoles}
                                data={roles.map(role => ({
                                    ...role,
                                    users: employees.filter(emp => emp.role === role.name.toLowerCase()).length
                                }))} 
                                striped
                                highlightOnHover
                                responsive
                                pagination
                                customStyles={{
                                    headCells: {
                                        style: {
                                            backgroundColor: "#4B929D",
                                            color: "#fff",
                                            fontWeight: "600",
                                            fontSize: "14px",
                                            padding: "12px",
                                            textTransform: "uppercase",
                                            textAlign: "center",
                                            letterSpacing: "1px",
                                        },
                                    },
                                    rows: {
                                        style: {
                                            minHeight: "55px",
                                            padding: "5px",
                                        },
                                    },
                                }}
                            />
                        </div>
                    </div>
                </div>
                )}
                </div>
            </div>
        </div>
    );
}

export default EmployeeRecords;