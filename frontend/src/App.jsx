import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import CustomerDashboard from './pages/CustomerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import './app.css'

// Temporary Admin Placeholder to prevent routing crashes
// const AdminDashboard = () => <div style={{padding: "2rem"}}><h2>Admin Dashboard Placeholder</h2></div>;

// Simple protection wrapper
const PrivateRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    return token ? children : <Navigate to="/" />;
};

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/register" element={<Register />} />
                
                <Route 
                    path="/customer-dashboard" 
                    element={
                        <PrivateRoute>
                            <CustomerDashboard />
                        </PrivateRoute>
                    } 
                />
                
                <Route 
                    path="/admin-dashboard" 
                    element={
                        <PrivateRoute>
                            <AdminDashboard />
                        </PrivateRoute>
                    } 
                />
            </Routes>
        </BrowserRouter>
    );
}

export default App;