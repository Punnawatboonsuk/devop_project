import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, X, FileText, Star } from 'lucide-react';

// Mock candidate data (should be replaced with real data source)
const mockCandidates = {
  '6430214521': {
    name: 'Somsri Jai-dee',
    faculty: 'Agro-Industry',
    department: 'Food Science',
    gpa: 3.85,
    activitiesScore: 92,
    achievements: [
      'Published Research on Bio-Plastics',
      'President of the Volunteer Club',
      'National Science Award Finalist',
    ],
    description: 'Specializing in sustainable food packaging solutions using agricultural by-products. Passionate about reducing plastic.',
    avatar: 'https://randomuser.me/api/portraits/women/1.jpg',
    evidence: [
      { type: 'pdf', name: 'Official_Portfolio_2024.pdf', size: '2.4 MB', date: 'Added 2 days ago' },
      { type: 'img', src: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb', alt: 'Lab Evidence' },
      { type: 'img', src: 'https://images.unsplash.com/photo-1519125323398-675f0ddb6308', alt: 'Teamwork' },
    ],
  },
  // Add more mock candidates as needed
};

const VotingBallot = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [voted, setVoted] = useState(null); // null, 'approve', 'reject', 'defer'

  // Fallback to first candidate if id not found
  const candidate = mockCandidates[id] || Object.values(mockCandidates)[0];

  const handleVote = (type) => {
    setVoted(type);
    // TODO: API call to submit vote
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-ku-main">Voting Ballot</h1>
          <p className="text-gray-500">Review candidate information and cast your vote</p>
        </div>
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-ku-main">
          <span className="font-bold">&#8592;</span> Back to Candidates
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile & Achievements */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Card */}
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-8">
            <div className="w-32 h-32 bg-gray-200 rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
              {candidate.avatar ? (
                <img src={candidate.avatar} alt={candidate.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-5xl font-bold text-gray-400">{candidate.name[0]}</span>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-800 mb-2">{candidate.name}</h1>
              <div className="flex flex-wrap gap-2 mb-2">
                <span className="bg-gray-100 px-3 py-1 rounded-full text-sm font-medium text-gray-700 flex items-center gap-1">
                  Faculty of {candidate.faculty}
                </span>
                <span className="bg-gray-100 px-3 py-1 rounded-full text-sm font-medium text-gray-700 flex items-center gap-1">
                  {candidate.department}
                </span>
              </div>
              <p className="text-gray-500 mb-2">{candidate.description}</p>
            </div>
          </div>

          {/* Achievements */}
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Star size={20} className="text-ku-accent fill-ku-accent" /> Key Achievements
            </h3>
            <ul className="space-y-4">
              {candidate.achievements.map((item, i) => (
                <li key={i} className="flex items-start gap-4 p-2 rounded-xl">
                  <div className="mt-2 w-2 h-2 bg-ku-main rounded-full"></div>
                  <div className="text-gray-700 font-medium leading-relaxed">{item}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Evidence & Voting */}
        <div className="lg:col-span-1 space-y-6">
          {/* GPA & Activities */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-6 flex flex-col items-center justify-center border border-gray-100">
              <div className="text-xs text-gray-500 mb-1">Current GPA</div>
              <div className="text-2xl font-bold text-green-700 flex items-center gap-1">{candidate.gpa}</div>
            </div>
            <div className="bg-white rounded-xl p-6 flex flex-col items-center justify-center border border-gray-100">
              <div className="text-xs text-gray-500 mb-1">Activities Score</div>
              <div className="text-2xl font-bold text-orange-600 flex items-center gap-1">{candidate.activitiesScore}<span className="text-sm">/100</span></div>
            </div>
          </div>

          {/* Evidence */}
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><FileText size={18} /> Evidence</h3>
            </div>
            <div className="space-y-2">
              {candidate.evidence && candidate.evidence.map((ev, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <FileText size={20} className="text-ku-main" />
                  <div className="font-semibold text-gray-800 text-sm">{ev.name || ev.src || 'Evidence File'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Voting Actions */}
          <div className="bg-white rounded-xl p-6 border border-gray-100 flex flex-col gap-4">
            <div className="flex gap-2">
              <button
                className={`flex-1 py-3 rounded-lg font-bold border ${voted === 'reject' ? 'bg-red-100 text-red-700 border-red-300' : 'bg-white text-red-600 border-red-200 hover:bg-red-50'}`}
                onClick={() => setVoted('reject')}
              >
                <X size={20} className="inline mr-1" /> Reject
              </button>
              <button
                className={`flex-1 py-3 rounded-lg font-bold border ${voted === 'approve' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-white text-green-600 border-green-200 hover:bg-green-50'}`}
                onClick={() => setVoted('approve')}
              >
                <Check size={20} className="inline mr-1" /> Approve Candidate
              </button>
            </div>
            <button
              className={`py-3 rounded-lg font-bold border ${voted === 'defer' ? 'bg-gray-100 text-gray-700 border-gray-300' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
              onClick={() => setVoted('defer')}
            >
              Defer Decision
            </button>
            {voted && (
              <button
                className="mt-2 py-3 rounded-lg font-bold bg-ku-main text-white hover:bg-green-800 transition"
                onClick={() => handleVote(voted)}
              >
                Confirm {voted.charAt(0).toUpperCase() + voted.slice(1)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VotingBallot;