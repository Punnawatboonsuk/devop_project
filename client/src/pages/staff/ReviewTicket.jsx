import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // เอาไว้รับ ID จาก URL
import { ArrowLeft, FileText, ExternalLink } from 'lucide-react';
import ActionModal from '../../components/ActionModal';

const ReviewTicket = () => {
  const { id } = useParams(); // ดึง ID จาก URL
  const navigate = useNavigate();
  
  // State สำหรับ Modal
  const [modalType, setModalType] = useState(null); // 'approve' | 'reject' | null

  const handleAction = (reason) => {
    console.log(`Action: ${modalType}, Ticket ID: ${id}, Reason: ${reason}`);
    // ตรงนี้เดี๋ยวเราค่อยต่อ API จริงทีหลัง
    setModalType(null);
    alert(`Successfully ${modalType}ed!`);
    navigate('/staff/dashboard');
  };

  return (
    <div className="max-w-5xl mx-auto pb-20">
      {/* Header & Back Button */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-ku-main mb-6">
        <ArrowLeft size={20} /> Back to List
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Application Details */}
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">AI for Durian Grading</h1>
                        <span className="inline-block mt-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold uppercase">
                            Innovation Category
                        </span>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-500">Submitted by</p>
                        <p className="font-bold text-gray-800">Somsri Wirat</p>
                        <p className="text-xs text-gray-400">ID: 6430214521</p>
                    </div>
                </div>

                <div className="prose max-w-none text-gray-600">
                    <h3 className="text-lg font-bold text-gray-800 mb-2">Abstract</h3>
                    <p className="mb-4">
                        This project proposes a novel IoT-based soil monitoring system specifically calibrated for durian orchards in Nonthaburi...
                        (นี่คือข้อมูลจำลองที่นิสิตกรอกมา)
                    </p>
                    
                    <h3 className="text-lg font-bold text-gray-800 mb-2 mt-6">Expected Impact</h3>
                    <p>
                        The primary impact is economic sustainability for small-holder farmers...
                    </p>
                </div>
            </div>

            {/* Attached Files Mockup */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <FileText size={20} /> Attached Evidence
                </h3>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 text-red-500 rounded flex items-center justify-center font-bold text-xs">PDF</div>
                        <div>
                            <p className="text-sm font-medium text-gray-700">Project_Full_Report.pdf</p>
                            <p className="text-xs text-gray-400">2.4 MB • Uploaded 2 days ago</p>
                        </div>
                    </div>
                    <button className="text-ku-main hover:text-green-700 text-sm font-medium flex items-center gap-1">
                        View <ExternalLink size={14} />
                    </button>
                </div>
            </div>
        </div>

        {/* Right: Action Panel (Sticky) */}
        <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 sticky top-24">
                <h3 className="font-bold text-gray-800 mb-4">Reviewer Action</h3>
                <p className="text-sm text-gray-500 mb-6">
                    You are reviewing as <strong>Head of Department</strong>.
                    Approved items will be forwarded to the Sub-Dean.
                </p>
                
                <div className="space-y-3">
                    <button 
                        onClick={() => setModalType('approve')}
                        className="w-full py-3 bg-ku-main text-white rounded-xl font-bold hover:bg-green-800 transition shadow-lg shadow-green-900/10"
                    >
                        Approve Application
                    </button>
                    <button 
                        onClick={() => setModalType('reject')}
                        className="w-full py-3 bg-white text-red-600 border border-red-200 rounded-xl font-bold hover:bg-red-50 transition"
                    >
                        Reject
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* เรียกใช้ Modal ที่เราเตรียมไว้ */}
      <ActionModal 
        isOpen={!!modalType} 
        type={modalType}
        onClose={() => setModalType(null)}
        onConfirm={handleAction}
      />
    </div>
  );
};

export default ReviewTicket;