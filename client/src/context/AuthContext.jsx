import React, { createContext, useContext, useState } from 'react';
import toast from 'react-hot-toast';

// ✅ 1. เติมคำว่า export ตรงนี้ เพื่อให้ไฟล์อื่นดึงไปใช้ได้
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const login = (usernameInput, password) => {
    const username = usernameInput.toLowerCase().trim();
    console.log("Attempting Login with:", username);

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
    else if (username === 'sub_dean') {
      setUser({ name: 'Asst. Prof. Malee', role: 'SUB_DEAN', id: 'sd001' });
      toast.success('Login Success: Sub-Dean');
      return true;
    }
    else if (username === 'dean') {
      setUser({ name: 'Assoc. Prof. Dean', role: 'DEAN', id: 'dn001' });
      toast.success('Login Success: Dean');
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
      toast.error('User not found');
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

// ✅ 2. Export useAuth ไว้ใช้งานด้วย
export const useAuth = () => useContext(AuthContext);