import React, { useState } from 'react';
import { Play, Square, Download, Users } from 'lucide-react';

const VotingControl = () => {
  const [isVotingOpen, setIsVotingOpen] = useState(false);

  // Mock Vote Data
  const candidates = [
    { id: 1, name: 'Somsri Wirat', category: 'Academic', approve: 8, reject: 2, totalCommittee: 12 },
    { id: 2, name: 'Kittipong J.', category: 'Sports', approve: 11, reject: 1, totalCommittee: 12 },
    { id: 3, name: 'Wichai K.', category: 'Innovation', approve: 5, reject: 5, totalCommittee: 12 }, // ยังไม่ผ่านครึ่ง
  ];

  const handleToggleVoting = () => {
    if(isVotingOpen) {
        if(window.confirm('Are you sure you want to CLOSE voting? This will calculate results.')) {
            setIsVotingOpen(false);
        }
    } else {
        setIsVotingOpen(true);
    }
  };

  return (
    <div className="space-y-8">
      {/* Control Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-800">Live Vote Control</h1>
            <p className="text-gray-500 flex items-center gap-2">
                Status: 
                <span className={`font-bold ${isVotingOpen ? 'text-green-600 animate-pulse' : 'text-red-500'}`}>
                    {isVotingOpen ? '● VOTING OPEN' : '● VOTING CLOSED'}
                </span>
            </p>
        </div>
        <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                <Download size={18} /> Export Log
            </button>
            <button 
                onClick={handleToggleVoting}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-white transition-all shadow-md
                ${isVotingOpen 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-green-600 hover:bg-green-700'}`}
            >
                {isVotingOpen ? <><Square size={18} fill="currentColor" /> Close Vote</> : <><Play size={18} /> Start Vote</>}
            </button>
        </div>
      </div>

      {/* Candidates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {candidates.map((candidate) => {
            const approvePercent = (candidate.approve / candidate.totalCommittee) * 100;
            const isPassed = candidate.approve > (candidate.totalCommittee / 2);

            return (
                <div key={candidate.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="font-bold text-lg text-gray-800">{candidate.name}</h3>
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">{candidate.category}</span>
                        </div>
                        {isVotingOpen && <span className="text-xs text-green-600 font-bold animate-pulse">Live</span>}
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-green-700 font-bold">{candidate.approve} Approve</span>
                            <span className="text-red-500 font-bold">{candidate.reject} Reject</span>
                        </div>
                        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
                            <div 
                                className="h-full bg-ku-main transition-all duration-1000" 
                                style={{ width: `${approvePercent}%` }}
                            ></div>
                            <div 
                                className="h-full bg-red-400 transition-all duration-1000" 
                                style={{ width: `${(candidate.reject / candidate.totalCommittee) * 100}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-center text-gray-400 mt-1">
                            {candidate.approve + candidate.reject} / {candidate.totalCommittee} Voted
                        </p>
                    </div>

                    {/* Result Prediction */}
                    {!isVotingOpen && (
                        <div className={`mt-4 text-center py-2 rounded-lg text-sm font-bold border
                            ${isPassed 
                                ? 'bg-green-50 text-green-700 border-green-200' 
                                : 'bg-red-50 text-red-700 border-red-200'}`}
                        >
                            {isPassed ? 'PASSED ✅' : 'DISQUALIFIED ❌'}
                        </div>
                    )}
                </div>
            );
        })}
      </div>
    </div>
  );
};

export default VotingControl;