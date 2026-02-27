import React from 'react';
import { getAllFaculties, getDepartmentsByFaculty } from '../utils/facultyData';

const FacultyDepartmentSelector = ({
  selectedFaculty,
  selectedDepartment,
  onFacultyChange,
  onDepartmentChange,
  facultyError,
  departmentError,
  facultyRequired = true,
  departmentRequired = true,
  showDepartment = true
}) => {
  const departments = selectedFaculty ? getDepartmentsByFaculty(selectedFaculty) : [];

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">คณะ</label>
        <select
          value={selectedFaculty}
          onChange={(e) => {
            onFacultyChange(e.target.value);
            onDepartmentChange('');
          }}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a7f42] bg-white"
          required={facultyRequired}
        >
          <option value="">เลือกคณะ</option>
          {getAllFaculties().map((faculty) => (
            <option key={faculty} value={faculty}>
              {faculty}
            </option>
          ))}
        </select>
        {facultyError && <div className="text-red-500 text-sm mt-1">{facultyError}</div>}
      </div>

      {showDepartment && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">ภาควิชา</label>
          <select
            value={selectedDepartment}
            onChange={(e) => onDepartmentChange(e.target.value)}
            disabled={!selectedFaculty}
            className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a7f42] ${
              !selectedFaculty ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'bg-white'
            }`}
            required={departmentRequired}
          >
            <option value="">{!selectedFaculty ? 'กรุณาเลือกคณะก่อน' : 'เลือกภาควิชา'}</option>
            {departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
          {departmentError && <div className="text-red-500 text-sm mt-1">{departmentError}</div>}
        </div>
      )}
    </div>
  );
};

export default FacultyDepartmentSelector;
