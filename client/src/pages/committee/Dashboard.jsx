import React from 'react';
import { FileText, Users, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

// Mock data for award categories and application counts
const awardCategories = [
	{ name: 'Academic', applications: 5 },
	{ name: 'Innovation', applications: 3 },
	{ name: 'Activity', applications: 2 },
];

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


// Mock pending approvals data
const pendingApprovals = [
	{
		id: '6430214521',
		name: 'Somsri Wirat',
		category: 'Academic',
		date: '2024-01-28',
		status: 'Wait: Staff',
	},
	{
		id: '6430559281',
		name: 'Kittipong J.',
		category: 'Innovation',
		date: '2024-01-29',
		status: 'Wait: Staff',
	},
	{
		id: '6430112233',
		name: 'Naree S.',
		category: 'Activity',
		date: '2024-01-30',
		status: 'Wait: Sub-Dean',
	},
];

function CommitteeDashboard() {
	const navigate = useNavigate();
	const { user } = useAuth();
	const totalApplications = awardCategories.reduce((sum, cat) => sum + cat.applications, 0);

	return (
		<div className="space-y-8">
			{/* Header Section */}
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-2xl font-bold text-ku-main">
						Welcome, {user?.fullname || 'Committee'} 👋
					</h1>
					<p className="text-gray-500">Committee Dashboard • Award Management</p>
				</div>
			</div>

			{/* Stats Grid */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<StatCard title="Total Applications" value={totalApplications} icon={FileText} color="bg-blue-50 text-blue-600" />
				<StatCard title="Award Categories" value={awardCategories.length} icon={Award} color="bg-yellow-50 text-yellow-600" />
				<StatCard title="Committee Members" value={5} icon={Users} color="bg-green-50 text-green-600" />
			</div>

			{/* (Removed duplicate Current Award Categories table) */}

			{/* Pending Vote List */}
			<div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
				<div className="p-6 border-b border-gray-100 flex justify-between items-center">
					<h3 className="font-bold text-lg">Pending Vote</h3>
				</div>
				<table className="w-full text-left">
					<thead className="bg-white border-b border-gray-100 text-xs uppercase text-gray-400 font-bold">
						<tr>
							<th className="p-4">Student Info</th>
							<th className="p-4">Category</th>
							<th className="p-4">Submission Date</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-50">
						{pendingApprovals.map((item) => (
							<tr
								key={item.id}
								className="hover:bg-ku-light cursor-pointer transition-colors"
								onClick={() => navigate(`/committee/vote/${item.id}`)}
							>
								<td className="p-4">
									<div className="font-bold text-gray-800">{item.name}</div>
									<div className="text-xs text-gray-500">ID: {item.id}</div>
								</td>
								<td className="p-4">{item.category}</td>
								<td className="p-4">{item.date}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{/* Award Categories Table */}
			<div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
				<div className="p-6 border-b border-gray-100 flex justify-between items-center">
					<h3 className="font-bold text-lg">Current Award Categories</h3>
				</div>
				<table className="w-full text-left">
					<thead className="bg-white border-b border-gray-100 text-xs uppercase text-gray-400 font-bold">
						<tr>
							<th className="p-6">Category</th>
							<th className="p-6"># Candidates</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-50">
						{awardCategories.map((cat) => (
							<tr key={cat.name} className="hover:bg-gray-50 transition-colors">
								<td className="p-6 font-bold text-gray-800">{cat.name}</td>
								<td className="p-6 font-mono font-bold text-ku-main">{cat.applications}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

export default CommitteeDashboard;