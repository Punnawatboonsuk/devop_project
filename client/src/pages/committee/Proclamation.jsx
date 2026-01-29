import React from 'react';
import { FileCheck, Download, Printer } from 'lucide-react';

const Proclamation = () => {
  // Mock Data: ผู้ที่ผ่านการโหวตแล้ว (Status: approved)
  const winners = [
    { id: 1, name: 'Nattapong Srisuk', category: 'Academic', score: 98.50 },
    { id: 2, name: 'Araya Jai-dee', category: 'Innovation', score: 96.20 },
    { id: 3, name: 'Kittipong T.', category: 'Sports', score: 95.80 },
  ];

  const handleSignAndAnnounce = () => {
    if (window.confirm('Are you sure you want to officially announce these winners? This will notify all students.')) {
      alert('Announcement Published Successfully!');
      // Update status to 'announced'
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tight">Final Proclamation</h1>
          <p className="text-gray-500">Sign and announce the official "Nisit Deeden" for Semester 1/2024.</p>
        </div>
        <button 
          onClick={handleSignAndAnnounce}
          className="bg-ku-main text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-xl hover:bg-green-800 transition transform active:scale-95"
        >
          <FileCheck size={20} /> Sign & Announce Results
        </button>
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
    </div>
  );
};

export default Proclamation;