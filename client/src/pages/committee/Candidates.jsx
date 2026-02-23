import React from 'react';
import { useNavigate } from 'react-router-dom';

// Mock data for candidates
const candidates = [
  {
    id: '6430214521',
    name: 'Somsri Wirat',
    category: 'Academic',
    approved: 342,
    rejected: 47,
    avatar: 'https://randomuser.me/api/portraits/women/1.jpg',
  },
  {
    id: '6430559281',
    name: 'Kittipong J.',
    category: 'Sports',
    approved: 892,
    rejected: 45,
    avatar: 'https://randomuser.me/api/portraits/men/2.jpg',
  },
  {
    id: '6430112233',
    name: 'Naree S.',
    category: 'Social',
    approved: 145,
    rejected: 89,
    avatar: 'https://randomuser.me/api/portraits/women/3.jpg',
  },
  {
    id: '6430227855',
    name: 'T. W.',
    category: 'Social',
    approved: 412,
    rejected: 36,
    avatar: '',
  },
  {
    id: '',
    name: 'Araya M.',
    category: 'Academic',
    approved: 210,
    rejected: 60,
    avatar: 'https://randomuser.me/api/portraits/women/4.jpg',
  },
  {
    id: '',
    name: 'P. Chaiya',
    category: 'Arts',
    approved: 98,
    rejected: 120,
    avatar: '',
  },
];

const getCategoryColor = (category) => {
  switch (category) {
    case 'Academic': return 'bg-green-100 text-green-700';
    case 'Sports': return 'bg-blue-100 text-blue-700';
    case 'Social': return 'bg-purple-100 text-purple-700';
    case 'Arts': return 'bg-orange-100 text-orange-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const CandidateCard = ({ candidate, onViewDetail }) => {
  const total = candidate.approved + candidate.rejected;
  const approvePercent = total ? Math.round((candidate.approved / total) * 100) : 0;
  const rejectPercent = 100 - approvePercent;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4 min-w-[320px]">
      <div className="flex items-center gap-4">
        {candidate.avatar ? (
          <img src={candidate.avatar} alt={candidate.name} className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center font-bold text-lg text-gray-600">
            {candidate.name.split(' ').map(n => n[0]).join('')}
          </div>
        )}
        <div>
          <div className="font-bold text-lg text-gray-800">{candidate.name}</div>
          <div className="text-xs text-gray-500">ID: {candidate.id || '-'}</div>
        </div>
        <span className={`ml-auto px-3 py-1 rounded-full text-xs font-bold ${getCategoryColor(candidate.category)}`}>{candidate.category}</span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs font-bold">
          <span className="text-green-700">{approvePercent}%</span>
          <span className="text-red-600">{rejectPercent}%</span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden flex">
          <div className="bg-green-500 h-full" style={{ width: `${approvePercent}%` }} />
          <div className="bg-red-500 h-full" style={{ width: `${rejectPercent}%` }} />
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-green-700">{candidate.approved} Approved</span>
          <span className="text-red-600">{candidate.rejected} Rejected</span>
        </div>
      </div>
      <button
        className="mt-2 text-ku-main font-semibold flex items-center gap-1 hover:underline"
        onClick={onViewDetail}
      >
        View Details <span aria-hidden>→</span>
      </button>
    </div>
  );
};

const CommitteeCandidates = () => {
  const navigate = useNavigate();

  const handleViewDetail = (id) => {
    navigate(`/committee/vote/${id}`);
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-ku-main">Live Vote Progress</h1>
          <p className="text-gray-500">Real-time verification tracking for Nominated Candidates.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id + candidate.name}
            candidate={candidate}
            onViewDetail={() => handleViewDetail(candidate.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default CommitteeCandidates;
