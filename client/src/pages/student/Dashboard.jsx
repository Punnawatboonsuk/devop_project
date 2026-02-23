import React, { useState } from 'react';
import { Plus, FileText, Clock, CheckCircle, AlertTriangle, Edit, Lock, XCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
    <div>
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
    </div>
    <div className={`p-3 rounded-full ${color}`}>
      <Icon size={24} />
    </div>
  </div>
);

const StudentDashboard = () => {
  const navigate = useNavigate();

  // ------------------------------------------------------------------
  // 💡 MOCK STATE: ลองเปลี่ยนค่าพวกนี้เพื่อเทสหน้าจอแต่ละแบบดูครับ
  // ------------------------------------------------------------------
  
  // 1. สถานะของระบบ (Phase) -> 'NOMINATION' (เปิดรับ) หรือ 'CLOSED_NOMINATION' (ปิดรับ)
  const systemPhase = 'NOMINATION'; 

  // 2. สถานะใบสมัครของนิสิต -> null (ยังไม่สมัคร), 'pending' (รอตรวจ), 'reject' (โดนตีกลับ), 'approved' (ผ่าน)
  /*const activeTicket = {
    id: 'APP-2024-001',
    title: 'นวัตกรรมเครื่องสีข้าวขนาดเล็ก',
    category: 'Innovation (นวัตกรรม)',
    status: 'approved', // <-- ลองเปลี่ยนเป็น 'pending', 'reject', 'approved', หรือตั้งเป็น null 
    rejectReason: 'ไฟล์ใบรับรองอาจารย์ที่ปรึกษาไม่ชัดเจน และขาดรูปถ่ายผลงานประกอบการพิจารณา โปรดแก้ไขและส่งใหม่',
    rejectedBy: 'Staff ID: ST001 (เจ้าหน้าที่คณะ)',
    lastUpdate: '2 hours ago'
  };*/
  
  const activeTicket = null; // ถ้ายกเลิกคอมเมนต์บรรทัดนี้ จะเป็นการจำลองว่า "นิสิตยังไม่เคยสมัคร"

  // ------------------------------------------------------------------

  // ฟังก์ชันเช็คปุ่ม "สร้างใบสมัครใหม่"
  const renderApplyButton = () => {
    if (systemPhase === 'CLOSED_NOMINATION') {
      return (
        <button disabled className="flex items-center gap-2 bg-gray-200 text-gray-500 px-5 py-2.5 rounded-lg cursor-not-allowed font-medium shadow-sm">
          <Lock size={18} /> ปิดรับการเสนอชื่อ
        </button>
      );
    }
    if (activeTicket) {
      // ถ้ามีใบสมัครอยู่แล้ว ให้ซ่อนปุ่ม (หรือไม่ให้กด) เพื่อกันการส่งซ้ำในรายการเดิม
      return null; 
    }
    return (
      <Link to="/student/create" className="flex items-center gap-2 bg-ku-main text-white px-5 py-2.5 rounded-lg hover:bg-green-800 transition shadow-md font-medium">
        <Plus size={20} />
        <span>สร้างใบเสนอชื่อ (New Application)</span>
      </Link>
    );
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-10">
      {/* --- Header Section --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">สวัสดี, สมชาย ขยันเรียน 👋</h1>
          <p className="text-gray-500 mt-1 flex items-center gap-2">
            <span className="font-mono text-sm bg-gray-100 px-2 py-0.5 rounded text-gray-600">642011xxxx</span>
            วิศวกรรมศาสตร์ • วิศวกรรมเครื่องกล
          </p>
        </div>
        <div>
          {renderApplyButton()}
        </div>
      </div>

      {/* --- Alert Section (แสดงเมื่อโดน Reject) --- */}
      {activeTicket?.status === 'reject' && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-red-500"></div>
          <div className="flex items-start gap-4">
            <div className="bg-red-100 p-3 rounded-full text-red-600 shrink-0 mt-1">
              <AlertTriangle size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-800">ใบสมัครของคุณถูกส่งกลับเพื่อแก้ไข!</h3>
              <p className="text-red-600 text-sm mt-1">โปรดตรวจสอบข้อเสนอแนะด้านล่าง และทำการแก้ไขเอกสารให้สมบูรณ์เพื่อส่งพิจารณาอีกครั้ง</p>
              
              <div className="mt-4 bg-white p-4 rounded-xl border border-red-100 shadow-sm">
                <p className="text-sm font-bold text-gray-800">เหตุผลที่ถูกตีกลับ:</p>
                <p className="text-gray-600 text-sm mt-1 leading-relaxed">"{activeTicket.rejectReason}"</p>
                <p className="text-xs text-gray-400 mt-3 font-medium">ส่งกลับโดย: {activeTicket.rejectedBy}</p>
              </div>

              <div className="mt-4">
                <button 
                  onClick={() => navigate(`/student/edit/${activeTicket.id}`)}
                  className="flex items-center gap-2 bg-red-600 text-white px-6 py-2.5 rounded-lg hover:bg-red-700 transition shadow-md font-bold text-sm"
                >
                  <Edit size={16} /> ดำเนินการแก้ไขใบสมัคร (Edit Ticket)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Stats Grid --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="ประวัติการส่งทั้งหมด" value="1" icon={FileText} color="bg-blue-50 text-blue-600" />
        <StatCard title="รอการตรวจสอบ" value={activeTicket?.status === 'pending' ? '1' : '0'} icon={Clock} color="bg-orange-50 text-orange-600" />
        <StatCard title="อนุมัติแล้ว" value={activeTicket?.status === 'approved' ? '1' : '0'} icon={CheckCircle} color="bg-green-50 text-green-600" />
      </div>

      {/* --- Active Application Card --- */}
      {activeTicket && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <FileText size={18} className="text-ku-main"/> รายการที่กำลังดำเนินการ (Active Ticket)
            </h3>
            <Link to="/student/tracking" className="text-sm font-bold text-ku-main hover:underline bg-ku-light px-4 py-1.5 rounded-lg">
              ติดตามสถานะ
            </Link>
          </div>
          <div className="p-6 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-xl border-2 shrink-0
              ${activeTicket.status === 'reject' ? 'bg-red-50 text-red-500 border-red-100' : 
                activeTicket.status === 'approved' ? 'bg-green-50 text-green-500 border-green-100' : 
                'bg-blue-50 text-blue-500 border-blue-100'}`}>
              {activeTicket.category.charAt(0)}
            </div>
            <div className="flex-1">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{activeTicket.category}</span>
              <h4 className="font-bold text-gray-800 text-lg leading-tight mt-1">{activeTicket.title}</h4>
              <p className="text-sm text-gray-400 font-mono mt-1">Ticket ID: {activeTicket.id}</p>
            </div>
            <div className="text-right">
              {/* Status Badge */}
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border
                ${activeTicket.status === 'reject' ? 'bg-red-50 text-red-700 border-red-200' : 
                  activeTicket.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' : 
                  'bg-orange-50 text-orange-700 border-orange-200'}`}>
                {activeTicket.status === 'reject' ? <XCircle size={14}/> : 
                 activeTicket.status === 'approved' ? <CheckCircle size={14}/> : <Clock size={14}/>}
                {activeTicket.status === 'reject' ? 'รอการแก้ไข' : 
                 activeTicket.status === 'approved' ? 'ผ่านการอนุมัติ' : 'รอการตรวจสอบ (Pending)'}
              </div>
              <p className="text-xs text-gray-400 mt-2">อัปเดตล่าสุด: {activeTicket.lastUpdate}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;