import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import KULogo from '../assets/KU_Logo_PNG.png';
import FacultyDepartmentSelector from '../components/FacultyDepartmentSelector';
import { useAuth } from '../hooks/useAuth';

const SSOProfileSetup = () => {
  const { user, completeProfile } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    ku_id: user?.ku_id || '',
    faculty: user?.faculty || '',
    department: user?.department || '',
  });

  const canAccess = useMemo(() => {
    return user?.primary_role === 'STUDENT' && user?.needs_profile_completion;
  }, [user]);

  useEffect(() => {
    if (user && !canAccess) {
      navigate('/student/dashboard', { replace: true });
    }
  }, [user, canAccess, navigate]);

  if (!user) {
    return null;
  }

  if (!canAccess) {
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.ku_id.trim() || !form.faculty.trim() || !form.department.trim()) {
      setError('Please fill KU ID, faculty, and department');
      return;
    }

    setSubmitting(true);
    const result = await completeProfile({
      ku_id: form.ku_id.trim(),
      faculty: form.faculty.trim(),
      department: form.department.trim(),
    });
    setSubmitting(false);

    if (result.success) {
      navigate(result.redirect || '/student/dashboard', { replace: true });
    } else {
      setError(result.message || 'Failed to complete profile');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7faf7] relative">
      <div className="absolute top-6 left-8 flex items-center">
        <img src={KULogo} alt="KU Logo" className="w-12 h-12 mr-3" />
        <div>
          <span className="text-[#1a7f42] font-bold text-xl">Kasetsart University</span>
          <div className="text-[#1a7f42] text-sm opacity-80">Faculty of Science</div>
        </div>
      </div>

      <div className="absolute top-6 right-8 text-gray-400 text-sm select-none">TH / EN</div>

      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md flex flex-col items-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-1 text-center">Complete Student Profile</h2>
        <p className="text-green-700 text-sm text-center mb-6">
          Welcome, {user.fullname || user.email}
          <br />
          <span className="font-semibold text-green-800">Please complete required student information</span>
        </p>

        <form onSubmit={handleSubmit} className="w-full mt-2">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">KU Student ID</label>
            <input
              name="ku_id"
              type="text"
              placeholder="KU Student ID"
              value={form.ku_id}
              onChange={(e) => setForm((prev) => ({ ...prev, ku_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a7f42]"
              required
            />
          </div>

          <FacultyDepartmentSelector
            selectedFaculty={form.faculty}
            selectedDepartment={form.department}
            onFacultyChange={(faculty) => setForm((prev) => ({ ...prev, faculty }))}
            onDepartmentChange={(department) => setForm((prev) => ({ ...prev, department }))}
            facultyError={error && !form.faculty ? 'Faculty is required' : ''}
            departmentError={error && !form.department ? 'Department is required' : ''}
          />

          {error && <div className="text-red-500 text-sm mb-2">{error}</div>}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-[#1a7f42] to-[#2d9e5a] text-white py-3 rounded-lg font-bold mt-4 hover:from-[#166a37] hover:to-[#25824a] transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={submitting}
          >
            {submitting ? 'Saving...' : 'Complete Setup'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SSOProfileSetup;
