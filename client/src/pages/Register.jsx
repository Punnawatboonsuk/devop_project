import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import KULogo from '../assets/KU_Logo_PNG.png';
import FacultyDepartmentSelector from "../components/FacultyDepartmentSelector";

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
      setError("กรุณากรอกอีเมล รหัสผ่าน และชื่อ-นามสกุล");
      setLoading(false);
      return;
    }

    if (form.password.length < 8) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
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
        setError(result.message || "สมัครสมาชิกไม่สำเร็จ");
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError("เกิดข้อผิดพลาดเครือข่าย กรุณาลองใหม่");
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
          <span className="text-[#1a7f42] font-bold text-xl">มหาวิทยาลัยเกษตรศาสตร์</span>
          <div className="text-[#1a7f42] text-sm opacity-80">คณะวิทยาศาสตร์</div>
        </div>
      </div>
      {/* Language switcher */}
      <div className="absolute top-6 right-8 text-gray-400 text-sm select-none">ภาษาไทย</div>
      {/* Registration Card */}
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md flex flex-col items-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-1 text-center">สมัครสมาชิกนิสิต</h2>
        <p className="text-green-700 text-sm text-center mb-6">สร้างบัญชีผู้ใช้งานสำหรับ<br /><span className="font-semibold text-green-800">ระบบรางวัลนิสิตดีเด่น</span></p>
        <form onSubmit={handleSubmit} className="w-full mt-2">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล</label>
            <input name="fullname" type="text" placeholder="ชื่อ-นามสกุล" value={form.fullname} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a7f42]" required />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล KU</label>
            <input name="email" type="email" placeholder="อีเมล KU" value={form.email} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a7f42]" required />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">รหัสนิสิต KU</label>
            <input name="ku_id" type="text" placeholder="รหัสนิสิต KU" value={form.ku_id} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a7f42]" />
          </div>
          <FacultyDepartmentSelector
            selectedFaculty={form.faculty}
            selectedDepartment={form.department}
            onFacultyChange={(faculty) => setForm(prevForm => ({ ...prevForm, faculty }))}
            onDepartmentChange={(department) => setForm(prevForm => ({ ...prevForm, department }))}
            facultyError={error && !form.faculty ? "กรุณาเลือกคณะ" : ""}
            departmentError={error && !form.department ? "กรุณาเลือกภาควิชา" : ""}
          />
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
            <input name="password" type="password" placeholder="รหัสผ่าน" value={form.password} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a7f42]" required />
          </div>
          {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
          <button type="submit" className="w-full bg-gradient-to-r from-[#1a7f42] to-[#2d9e5a] text-white py-3 rounded-lg font-bold mt-4 hover:from-[#166a37] hover:to-[#25824a] transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" disabled={loading}>
            {loading ? "กำลังสมัครสมาชิก..." : "สมัครสมาชิก"}
          </button>
        </form>
        <div className="mt-6 text-center text-sm">
          มีบัญชีอยู่แล้ว? <button onClick={() => navigate('/login')} className="text-[#1a7f42] font-bold underline hover:text-[#166a37] transition-colors">เข้าสู่ระบบ</button>
        </div>
      </div>
      {/* Footer */}
      <div className="absolute bottom-4 left-0 w-full flex flex-col items-center text-xs text-gray-400 select-none">
        <div>© 2024 มหาวิทยาลัยเกษตรศาสตร์ สงวนลิขสิทธิ์</div>
      </div>
    </div>
  );
};

export default Register;
