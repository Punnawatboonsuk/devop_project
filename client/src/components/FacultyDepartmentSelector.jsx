import React from 'react';
import { getAllFaculties, getDepartmentsByFaculty } from '../utils/facultyData';

const FacultyDepartmentSelector = ({ 
  selectedFaculty, 
  selectedDepartment, 
  onFacultyChange, 
  onDepartmentChange,
  facultyError,
  departmentError 
}) => {
  const departments = selectedFaculty ? getDepartmentsByFaculty(selectedFaculty) : [];

  return (
    <div className="space-y-4">
      {/* Faculty Dropdown */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Faculty
        </label>
        <select
          value={selectedFaculty}
          onChange={(e) => {
            onFacultyChange(e.target.value);
            // Reset department when faculty changes
            onDepartmentChange('');
          }}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a7f42] bg-white"
          required
        >
          <option value="">Select Faculty</option>
          {getAllFaculties().map((faculty) => (
            <option key={faculty} value={faculty}>
              {faculty}
            </option>
          ))}
        </select>
        {facultyError && <div className="text-red-500 text-sm mt-1">{facultyError}</div>}
      </div>

      {/* Department Dropdown */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Department
        </label>
        <select
          value={selectedDepartment}
          onChange={(e) => onDepartmentChange(e.target.value)}
          disabled={!selectedFaculty || selectedFaculty === ""}
          className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a7f42] ${
            !selectedFaculty || selectedFaculty === "" 
              ? 'bg-gray-100 cursor-not-allowed text-gray-500' 
              : 'bg-white'
          }`}
          required
        >
          <option value="">
            {!selectedFaculty || selectedFaculty === "" ? 'Please select a faculty first' : 'Select Department'}
          </option>
          {departments.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </select>
        {departmentError && <div className="text-red-500 text-sm mt-1">{departmentError}</div>}
        
        {/* Helper text */}
        {!selectedFaculty && (
          <div className="text-gray-500 text-sm mt-1">
            Department selection will be enabled after selecting a faculty
          </div>
        )}
      </div>
    </div>
  );
};

export default FacultyDepartmentSelector;