import React, { useState } from 'react';
import { Check, X, Clock, FileText, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const VotingBallot = () => {
  const navigate = useNavigate();
  const [voted, setVoted] = useState(false);

  // ข้อมูลจำลองของผู้เข้าชิง (Candidate)
  const candidate = {
    name: "Somsri Jai-dee",
    faculty: "Agro-Industry",
    department: "Food Science",
    gpa: 3.85,
    activitiesScore: 92,
    achievements: [
      "Published Research on Bio-Plastics in International Journal",
      "President of the Volunteer Club (200+ members)",
      "National Science Award Finalist 2023"
    ]
  };

  const handleVote = (type) => {
    console.log(`Committee voted: ${type}`);
    setVoted(true);
    // ในระบบจริงจะส่ง API แล้วเปลี่ยนไป Candidate คนถัดไป
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      {/* Top Header: Progress Indicator */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-ku-main">
          <ChevronLeft size={20} /> Back to List
        </button>
        <div className="text-sm font-medium text-gray-500">
          Reviewing Candidate <span className="text-ku-main font-bold">3 of 12</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left & Center: Candidate Profile & Achievements */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Card */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-8">
            <div className="w-32 h-32 bg-gray-200 rounded-xl overflow-hidden shadow-inner">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Somsri" alt="profile" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{candidate.name}</h1>
              <p className="text-gray-500 flex items-center gap-2 mt-1">
                <span className="font-medium text-ku-main">{candidate.faculty}</span> • {candidate.department}
              </p>
              <div className="mt-4 flex gap-4">
                <div className="bg-green-50 px-4 py-2 rounded-xl">
                  <p className="text-xs text-green-600 font-bold">Current GPA</p>
                  <p className="text-xl font-black text-green-700">{candidate.gpa}</p>
                </div>
                <div className="bg-orange-50 px-4 py-2 rounded-xl">
                  <p className="text-xs text-orange-600 font-bold">Activities Score</p>
                  <p className="text-xl font-black text-orange-700">{candidate.activitiesScore}/100</p>
                </div>
              </div>
            </div>
          </div>

          {/* Achievements List */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Star size={20} className="text-ku-accent fill-ku-accent" /> Key Achievements
            </h3>
            <ul className="space-y-4">
              {candidate.achievements.map((item, i) => (
                <li key={i} className="flex items-start gap-4 p-4 rounded-xl hover:bg-gray-50 transition">
                  <div className="mt-1 w-2 h-2 bg-ku-main rounded-full"></div>
                  <p className="text-gray-700 font-medium leading-relaxed">{item}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: Evidence & Voting */}
        <div className="lg:col-span-1 space-y-6">
          {/* Evidence Preview */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FileText size={18} /> Evidence Preview
            </h3>
            <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-200 group cursor-pointer hover:border-ku-main transition">
              <p className="text-xs text-gray-400 group-hover:text-ku-main">Click to view Official_Portfolio.pdf</p>
            </div>
          </div>

          {/* Vote Action Panel */}
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 ring-1 ring-black/5">
            <h3 className="font-bold text-gray-800 mb-6">Cast Your Vote</h3>
            <div className="space-y-3">
              <button 
                onClick={() => handleVote('approve')}
                className="w-full py-4 bg-ku-main text-white rounded-xl font-black flex items-center justify-center gap-2 hover:bg-green-800 transition shadow-lg shadow-green-900/20"
              >
                <Check size={20} /> APPROVE CANDIDATE
              </button>
              <button 
                onClick={() => handleVote('reject')}
                className="w-full py-4 bg-white text-red-600 border-2 border-red-100 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition"
              >
                <X size={20} /> REJECT
              </button>
              <button className="w-full py-3 text-gray-400 text-sm font-medium hover:text-gray-600 transition">
                Defer Decision (Skip for now)
              </button>
            </div>
            {voted && (
              <p className="mt-4 text-center text-xs text-green-600 font-bold bg-green-50 py-2 rounded-lg">
                Your vote has been recorded securely.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VotingBallot;