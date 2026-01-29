import React, { createContext, useContext, useState } from 'react';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // ✅ 1. เริ่มต้นเป็น null (เพื่อไม่ให้ Login ค้าง)
  const [user, setUser] = useState(null);

  const login = (usernameInput, password) => {
    // ปรับให้เป็นตัวพิมพ์เล็กทั้งหมดก่อนเช็ค และตัดช่องว่างหน้าหลัง
    const username = usernameInput.toLowerCase().trim();

    console.log("Attempting Login with:", username); // เช็คใน Console (F12)

    if (username === 'student') {
      setUser({ name: 'Nattapong S.', role: 'STUDENT', id: '643xxxxx' });
      toast.success('Login Success: Student');
      return true;
    } 
    else if (username === 'staff') {
      setUser({ name: 'Dr. Somsak', role: 'STAFF', id: 'st001' });
      toast.success('Login Success: Staff');
      return true;
    }
    else if (username === 'admin') {
      setUser({ name: 'Admin Officer', role: 'ADMIN', id: 'ad001' });
      toast.success('Login Success: Admin');
      return true;
    }
    else if (username === 'committee') {
      setUser({ name: 'Prof. Somchai', role: 'COMMITTEE', id: 'cm001' });
      toast.success('Login Success: Committee');
      return true;
    }
    else if (username === 'president') {
      setUser({ name: 'President', role: 'PRESIDENT', id: 'pr001' });
      toast.success('Login Success: President');
      return true;
    }
    else {
      console.log("Login Failed");
      toast.error('User not found (Try: student, staff, admin)');
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    toast.success('Logged out');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);