import React from 'react';
import { FileCheck, Download, Printer, Check } from 'lucide-react';

const Proclamation = () => {
  // Mock Data: ผู้ที่ผ่านการโหวตแล้ว (Status: approved)
  const winners = [
    { id: 1, name: 'Nattapong Srisuk', category: 'Academic', score: 98.50 },
    { id: 2, name: 'Araya Jai-dee', category: 'Innovation', score: 96.20 },
    { id: 3, name: 'Kittipong T.', category: 'Sports', score: 95.80 },
  ];

  // Mock history data
  const history = [
    {
      semester: '2/2023',
      winners: [
        { id: 1, name: 'Somchai R.', category: 'Academic', score: 97.10 },
        { id: 2, name: 'Pimchanok S.', category: 'Innovation', score: 95.80 },
        { id: 3, name: 'Surasak T.', category: 'Sports', score: 94.50 },
      ]
    },
    {
      semester: '1/2023',
      winners: [
        { id: 1, name: 'Napat J.', category: 'Academic', score: 96.00 },
        { id: 2, name: 'Chaiyaporn K.', category: 'Innovation', score: 94.70 },
        { id: 3, name: 'Suda P.', category: 'Sports', score: 93.90 },
      ]
    }
  ];

  const [showHistory, setShowHistory] = React.useState(false);
  const [selectedSemesterIdx, setSelectedSemesterIdx] = React.useState(0);

  // Helper for dropdown
  const semesterOptions = history.map((item, idx) => ({ label: item.semester, value: idx }));

  const handlePrev = () => {
    setSelectedSemesterIdx((prev) => (prev < history.length - 1 ? prev + 1 : prev));
  };
  const handleNext = () => {
    setSelectedSemesterIdx((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const handleSignAndAnnounce = () => {
    if (window.confirm('Are you sure you want to officially announce these winners? This will notify all students.')) {
      alert('Announcement Published Successfully!');
      // Update status to 'announced'
    }
  };

  return (
    <div className={`space-y-8 relative ${showHistory ? 'overflow-hidden' : ''}`}> 
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tight">Final Proclamation</h1>
          <p className="text-gray-500">Sign and announce the official "Nisit Deeden" for Semester 1/2024.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleSignAndAnnounce}
            className="bg-ku-main text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-xl hover:bg-green-800 transition transform active:scale-95"
          >
            <FileCheck size={20} /> Sign & Announce Results
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className="bg-gray-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow hover:bg-gray-700 transition transform active:scale-95"
          >
            🕑 View Previous Proclamations
          </button>
        </div>
      </div>

      {/* Winners Summary Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h3 className="font-bold text-gray-700">Verified Winners List</h3>
            <div className="flex gap-2">
                <button className="p-2 text-gray-500 hover:bg-white rounded border border-gray-200"><Download size={18} /></button>
                <button className="p-2 text-gray-500 hover:bg-white rounded border border-gray-200"><Printer size={18} /></button>
            </div>
        </div>
        <table className="w-full text-left">
          <thead className="bg-white border-b border-gray-100 text-xs uppercase text-gray-400 font-bold">
            <tr>
              <th className="p-6">Rank</th>
              <th className="p-6">Full Name</th>
              <th className="p-6">Category</th>
              <th className="p-6">Total Score</th>
              <th className="p-6">Verification</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {winners.map((winner, index) => (
              <tr key={winner.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-6 font-black text-ku-main text-xl">#{index + 1}</td>
                <td className="p-6 font-bold text-gray-800">{winner.name}</td>
                <td className="p-6"><span className="px-3 py-1 bg-ku-light text-ku-main rounded-full text-xs font-bold">{winner.category}</span></td>
                <td className="p-6 font-mono font-bold text-gray-600">{winner.score.toFixed(2)}</td>
                <td className="p-6">
                  <div className="flex items-center gap-2 text-green-600 text-sm font-bold">
                    <Check size={16} /> Verified
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* History Modal */}
      {showHistory && (
        <>
          {/* Overlay: darken and blur background */}
          <div className="fixed left-64 top-0 right-0 bottom-0 bg-white bg-opacity-30 backdrop-blur-md z-40" />
          <div className="fixed left-64 top-0 right-0 bottom-0 flex items-center justify-center z-50">
            <div className="bg-white bg-opacity-90 rounded-2xl shadow-xl p-8 w-[500px] max-w-full relative">
              <button
                onClick={() => setShowHistory(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-red-500 text-xl font-bold"
              >✕</button>
              <h2 className="text-2xl font-black mb-4 text-ku-main">Previous Proclamations</h2>
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={handlePrev}
                  className={`px-3 py-1 rounded bg-gray-200 text-gray-700 font-bold ${selectedSemesterIdx === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'}`}
                  disabled={selectedSemesterIdx === 0}
                >Prev</button>
                <select
                  value={selectedSemesterIdx}
                  onChange={e => setSelectedSemesterIdx(Number(e.target.value))}
                  className="px-3 py-1 rounded bg-gray-100 text-gray-700 font-bold border border-gray-300"
                >
                  {semesterOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleNext}
                  className={`px-3 py-1 rounded bg-gray-200 text-gray-700 font-bold ${selectedSemesterIdx === history.length - 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'}`}
                  disabled={selectedSemesterIdx === history.length - 1}
                >Next</button>
              </div>
              <div className="mb-6">
                <h3 className="font-bold text-gray-700 mb-2">Semester {history[selectedSemesterIdx].semester}</h3>
                <table className="w-full text-left mb-2">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-400 font-bold">
                    <tr>
                      <th className="p-2">Rank</th>
                      <th className="p-2">Full Name</th>
                      <th className="p-2">Category</th>
                      <th className="p-2">Total Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history[selectedSemesterIdx].winners.map((winner, idx) => (
                      <tr key={winner.id} className="hover:bg-gray-100">
                        <td className="p-2 font-black text-ku-main">#{idx + 1}</td>
                        <td className="p-2 font-bold text-gray-800">{winner.name}</td>
                        <td className="p-2"><span className="px-2 py-1 bg-ku-light text-ku-main rounded-full text-xs font-bold">{winner.category}</span></td>
                        <td className="p-2 font-mono font-bold text-gray-600">{winner.score.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Proclamation;