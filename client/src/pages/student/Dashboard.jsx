import React from 'react';
import { Plus, FileText, Clock, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

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
  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-ku-main">Welcome, Nattapong 👋</h1>
          <p className="text-gray-500">Computer Science • Faculty of Science</p>
        </div>
        <Link to="/student/create" className="flex items-center gap-2 bg-ku-main text-white px-5 py-2.5 rounded-lg hover:bg-green-800 transition shadow-md">
          <Plus size={20} />
          <span>New Application</span>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Total Applications" value="2" icon={FileText} color="bg-blue-50 text-blue-600" />
        <StatCard title="In Progress" value="1" icon={Clock} color="bg-orange-50 text-orange-600" />
        <StatCard title="Approved" value="0" icon={CheckCircle} color="bg-green-50 text-green-600" />
      </div>

      {/* Active Application Card (Mock Data) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-lg">Active Application</h3>
          <Link to="/student/tracking" className="text-sm text-ku-main hover:underline">View Tracking</Link>
        </div>
        <div className="p-6 flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-ku-light flex items-center justify-center text-ku-main font-bold text-xl">
            Ac
          </div>
          <div>
            <h4 className="font-bold text-gray-800">Academic Excellence Award</h4>
            <p className="text-sm text-gray-500 mt-1">Submission ID: #KU-2024-001</p>
            <div className="mt-3 flex items-center gap-2">
                <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded font-medium">Wait: Dean</span>
                <span className="text-xs text-gray-400">• Last update: 2 hours ago</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;