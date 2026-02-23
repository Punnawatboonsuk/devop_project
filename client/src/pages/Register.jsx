import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import KULogo from '../assets/KU_Logo_PNG.png';

const Register = () => {
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullname: "",
    ku_id: "",
    department: "",
    faculty: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuth();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    // Basic validation
    if (!form.email || !form.password || !form.fullname) {
      setError("Email, password, and full name are required");
      setLoading(false);
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    try {
      const result = await register(form);
      if (result.success) {
        // Registration successful, redirect to login
        setTimeout(() => {
          navigate("/login");
        }, 1500);
      } else {
        setError(result.message || "Registration failed");
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7faf7] relative">
      {/* Top left logo and university name */}
      <div className="absolute top-6 left-8 flex items-center">
        <img src={KULogo} alt="KU Logo" className="w-12 h-12 mr-3" />
        <div>
          <span className="text-[#1a7f42] font-bold text-xl">Kasetsart University</span>
          <div className="text-[#1a7f42] text-sm opacity-80">Faculty of Science</div>
        </div>
      </div>
      {/* Language switcher */}
      <div className="absolute top-6 right-8 text-gray-400 text-sm select-none">TH / EN</div>
      {/* Registration Card */}
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md flex flex-col items-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-1 text-center">Student Registration</h2>
        <p className="text-green-700 text-sm text-center mb-6">Create your account for<br /><span className="font-semibold text-green-800">Nisit Deeden Award System</span></p>
        <form onSubmit={handleSubmit} className="w-full mt-2">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input name="fullname" type="text" placeholder="Full Name" value={form.fullname} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a7f42]" required />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">KU Email</label>
            <input name="email" type="email" placeholder="KU Email" value={form.email} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a7f42]" required />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">KU Student ID</label>
            <input name="ku_id" type="text" placeholder="KU Student ID" value={form.ku_id} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a7f42]" />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Faculty</label>
            <input name="faculty" type="text" placeholder="Faculty" value={form.faculty} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a7f42]" />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input name="department" type="text" placeholder="Department" value={form.department} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a7f42]" />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a7f42]" required />
          </div>
          {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
          <button type="submit" className="w-full bg-gradient-to-r from-[#1a7f42] to-[#2d9e5a] text-white py-3 rounded-lg font-bold mt-4 hover:from-[#166a37] hover:to-[#25824a] transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" disabled={loading}>
            {loading ? "Registering..." : "Register"}
          </button>
        </form>
        <div className="mt-6 text-center text-sm">
          Already have an account? <button onClick={() => navigate('/login')} className="text-[#1a7f42] font-bold underline hover:text-[#166a37] transition-colors">Login</button>
        </div>
      </div>
      {/* Footer */}
      <div className="absolute bottom-4 left-0 w-full flex flex-col items-center text-xs text-gray-400 select-none">
        <div>© 2024 Kasetsart University. All rights reserved.</div>
      </div>
    </div>
  );
};

export default Register;
