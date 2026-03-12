import React, { useEffect, useMemo, useState } from 'react';
import { Edit3, Loader2, Plus, Search, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import FacultyDepartmentSelector from '../../components/FacultyDepartmentSelector';
import { authenticatedApiRequest } from '../../utils/api';
import { ROLE_LABELS, getRoleLabel } from '../../utils/roleLabels';

const CREATE_ROLE_OPTIONS = [
  { value: 'STUDENT', label: ROLE_LABELS.STUDENT },
  { value: 'STAFF', label: ROLE_LABELS.STAFF },
  { value: 'SUB_DEAN', label: ROLE_LABELS.SUB_DEAN },
  { value: 'DEAN', label: ROLE_LABELS.DEAN },
  { value: 'COMMITTEE', label: ROLE_LABELS.COMMITTEE },
  { value: 'COMMITTEE_PRESIDENT', label: ROLE_LABELS.COMMITTEE_PRESIDENT }
];

const EDIT_ROLE_OPTIONS = [
  { value: 'STUDENT', label: ROLE_LABELS.STUDENT },
  { value: 'STAFF', label: ROLE_LABELS.STAFF },
  { value: 'SUB_DEAN', label: ROLE_LABELS.SUB_DEAN },
  { value: 'DEAN', label: ROLE_LABELS.DEAN },
  { value: 'COMMITTEE', label: ROLE_LABELS.COMMITTEE },
  { value: 'COMMITTEE_PRESIDENT', label: ROLE_LABELS.COMMITTEE_PRESIDENT },
  { value: 'ADMIN', label: ROLE_LABELS.ADMIN }
];

const FACULTY_REQUIRED_ROLES = new Set(['STUDENT', 'STAFF', 'SUB_DEAN', 'DEAN']);
const DEPARTMENT_REQUIRED_ROLES = new Set(['STUDENT', 'STAFF']);
const KU_ID_REQUIRED_ROLES = new Set(['STUDENT']);

const createInitial = {
  fullname: '',
  ku_id: '',
  email: '',
  password: '',
  role: 'STAFF',
  faculty: '',
  department: ''
};

const editInitial = {
  id: null,
  fullname: '',
  ku_id: '',
  role: 'STUDENT',
  faculty: '',
  department: '',
  password: ''
};

const AccountCreation = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(createInitial);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [editForm, setEditForm] = useState(editInitial);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const createNeedFaculty = FACULTY_REQUIRED_ROLES.has(createForm.role);
  const createNeedDepartment = DEPARTMENT_REQUIRED_ROLES.has(createForm.role);
  const createNeedKuId = KU_ID_REQUIRED_ROLES.has(createForm.role);

  const editNeedFaculty = FACULTY_REQUIRED_ROLES.has(editForm.role);
  const editNeedDepartment = DEPARTMENT_REQUIRED_ROLES.has(editForm.role);
  const editNeedKuId = KU_ID_REQUIRED_ROLES.has(editForm.role);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await authenticatedApiRequest('/api/admin/users');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'ไม่สามารถโหลดผู้ใช้ได้');
      }
      setUsers(Array.isArray(payload?.users) ? payload.users : []);
    } catch (loadError) {
      setError(loadError.message || 'ไม่สามารถโหลดผู้ใช้ได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((user) => {
      const text = [
        user.fullname,
        user.email,
        user.ku_id,
        user.primary_role,
        user.faculty,
        user.department
      ]
        .map((v) => String(v || '').toLowerCase())
        .join(' ');
      return text.includes(keyword);
    });
  }, [users, searchTerm]);

  const startEdit = (user) => {
    setEditForm({
      id: user.id,
      fullname: user.fullname || '',
      ku_id: user.ku_id || '',
      role: user.primary_role || 'STUDENT',
      faculty: user.faculty || '',
      department: user.department || '',
      password: ''
    });
  };

  const clearEdit = () => setEditForm(editInitial);

  const validateCreate = () => {
    if (!createForm.fullname.trim() || !createForm.email.trim() || !createForm.password || !createForm.role) {
      return 'กรุณากรอกชื่อ อีเมล รหัสผ่าน และบทบาทให้ครบ';
    }
    if (createForm.password.length < 8) {
      return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
    }
    if (createNeedKuId && !createForm.ku_id.trim()) {
      return 'นิสิตต้องระบุรหัสนิสิต KU';
    }
    if (createNeedFaculty && !createForm.faculty.trim()) {
      return 'บทบาทนี้ต้องระบุคณะ';
    }
    if (createNeedDepartment && !createForm.department.trim()) {
      return 'บทบาทนี้ต้องระบุภาควิชา';
    }
    return '';
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    const validationError = validateCreate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setCreateSubmitting(true);
    try {
      const response = await authenticatedApiRequest('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          fullname: createForm.fullname.trim(),
          ku_id: createNeedKuId ? createForm.ku_id.trim() : '',
          email: createForm.email.trim().toLowerCase(),
          password: createForm.password,
          role: createForm.role,
          faculty: createNeedFaculty ? createForm.faculty.trim() : '',
          department: createNeedDepartment ? createForm.department.trim() : ''
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'ไม่สามารถสร้างบัญชีได้');
      }

      toast.success(payload?.message || 'สร้างบัญชีเรียบร้อย');
      setCreateForm(createInitial);
      setShowCreate(false);
      await loadUsers();
    } catch (submitError) {
      toast.error(submitError.message || 'ไม่สามารถสร้างบัญชีได้');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const validateEdit = () => {
    if (!editForm.id || !editForm.fullname.trim() || !editForm.role) {
      return 'กรุณากรอกชื่อและบทบาท';
    }
    if (editNeedKuId && !editForm.ku_id.trim()) {
      return 'นิสิตต้องระบุรหัสนิสิต KU';
    }
    if (editNeedFaculty && !editForm.faculty.trim()) {
      return 'บทบาทนี้ต้องระบุคณะ';
    }
    if (editNeedDepartment && !editForm.department.trim()) {
      return 'บทบาทนี้ต้องระบุภาควิชา';
    }
    if (editForm.password && editForm.password.length < 8) {
      return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
    }
    return '';
  };

  const handleEditSave = async (event) => {
    event.preventDefault();
    const validationError = validateEdit();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setEditSubmitting(true);
    try {
      const response = await authenticatedApiRequest(`/api/admin/users/${editForm.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullname: editForm.fullname.trim(),
          role: editForm.role,
          ku_id: editNeedKuId ? editForm.ku_id.trim() : '',
          faculty: editNeedFaculty ? editForm.faculty.trim() : '',
          department: editNeedDepartment ? editForm.department.trim() : '',
          password: editForm.password ? editForm.password : ''
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'ไม่สามารถอัปเดตผู้ใช้ได้');
      }

      toast.success(payload?.message || 'อัปเดตผู้ใช้เรียบร้อย');
      clearEdit();
      await loadUsers();
    } catch (saveError) {
      toast.error(saveError.message || 'ไม่สามารถอัปเดตผู้ใช้ได้');
    } finally {
      setEditSubmitting(false);
    }
  };

  const getInitials = (name) => {
    const cleaned = String(name || '').trim();
    if (!cleaned) return 'U';
    const parts = cleaned.split(/\s+/).slice(0, 2);
    return parts.map((part) => part[0]?.toUpperCase() || '').join('') || 'U';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ku-main">จัดการบัญชีผู้ใช้</h1>
          <p className="text-gray-500">ดูแลและจัดการบัญชีผู้ใช้ทั้งหมดในระบบ</p>
        </div>
        <button
          onClick={() => setShowCreate((prev) => !prev)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-ku-main text-white hover:bg-green-800"
        >
          {showCreate ? <X size={16} /> : <Plus size={16} />}
          {showCreate ? 'ปิดฟอร์มสร้างบัญชี' : 'สร้างบัญชีใหม่'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-800">สร้างบัญชีผู้ใช้</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล</label>
            <input
              type="text"
              value={createForm.fullname}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, fullname: event.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-ku-main/30"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล KU</label>
              <input
                type="email"
                value={createForm.email}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-ku-main/30"
                placeholder="name@ku.th"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
              <input
                type="password"
                value={createForm.password}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-ku-main/30"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">บทบาท</label>
            <select
              value={createForm.role}
              onChange={(event) => {
                const role = event.target.value;
                setCreateForm((prev) => ({
                  ...prev,
                  role,
                  ku_id: KU_ID_REQUIRED_ROLES.has(role) ? prev.ku_id : '',
                  faculty: FACULTY_REQUIRED_ROLES.has(role) ? prev.faculty : '',
                  department: DEPARTMENT_REQUIRED_ROLES.has(role) ? prev.department : ''
                }));
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-ku-main/30"
              required
            >
              {CREATE_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {createNeedKuId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รหัสนิสิต KU</label>
              <input
                type="text"
                value={createForm.ku_id}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, ku_id: event.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-ku-main/30"
                required
              />
            </div>
          )}

          {createNeedFaculty && (
            <FacultyDepartmentSelector
              selectedFaculty={createForm.faculty}
              selectedDepartment={createForm.department}
              onFacultyChange={(faculty) => setCreateForm((prev) => ({ ...prev, faculty }))}
              onDepartmentChange={(department) => setCreateForm((prev) => ({ ...prev, department }))}
              facultyError=""
              departmentError=""
              showDepartment={createNeedDepartment}
              departmentRequired={createNeedDepartment}
            />
          )}

          <button
            type="submit"
            disabled={createSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-ku-main text-white font-semibold hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {createSubmitting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            สร้างบัญชี
          </button>
        </form>
      )}

      {editForm.id && (
        <form onSubmit={handleEditSave} className="bg-white border border-blue-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">แก้ไขผู้ใช้ #{editForm.id}</h2>
            <button type="button" onClick={clearEdit} className="text-sm text-gray-500 hover:text-gray-700">ยกเลิก</button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล</label>
            <input
              type="text"
              value={editForm.fullname}
              onChange={(event) => setEditForm((prev) => ({ ...prev, fullname: event.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-ku-main/30"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">บทบาท</label>
            <select
              value={editForm.role}
              onChange={(event) => {
                const role = event.target.value;
                setEditForm((prev) => ({
                  ...prev,
                  role,
                  ku_id: KU_ID_REQUIRED_ROLES.has(role) ? prev.ku_id : '',
                  faculty: FACULTY_REQUIRED_ROLES.has(role) ? prev.faculty : '',
                  department: DEPARTMENT_REQUIRED_ROLES.has(role) ? prev.department : ''
                }));
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-ku-main/30"
              required
            >
              {EDIT_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ตั้งรหัสผ่านใหม่ (ถ้าต้องการเปลี่ยน)</label>
            <input
              type="password"
              value={editForm.password}
              onChange={(event) => setEditForm((prev) => ({ ...prev, password: event.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-ku-main/30"
              placeholder="อย่างน้อย 8 ตัวอักษร"
            />
          </div>

          {editNeedKuId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รหัสนิสิต KU</label>
              <input
                type="text"
                value={editForm.ku_id}
                onChange={(event) => setEditForm((prev) => ({ ...prev, ku_id: event.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-ku-main/30"
                required
              />
            </div>
          )}

          {editNeedFaculty && (
            <FacultyDepartmentSelector
              selectedFaculty={editForm.faculty}
              selectedDepartment={editForm.department}
              onFacultyChange={(faculty) => setEditForm((prev) => ({ ...prev, faculty }))}
              onDepartmentChange={(department) => setEditForm((prev) => ({ ...prev, department }))}
              facultyError=""
              departmentError=""
              showDepartment={editNeedDepartment}
              departmentRequired={editNeedDepartment}
            />
          )}

          <button
            type="submit"
            disabled={editSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {editSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Edit3 size={16} />}
            บันทึกการเปลี่ยนแปลง
          </button>
        </form>
      )}

      <div className="bg-white p-4 rounded-xl border border-gray-200">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="ค้นหาด้วยชื่อ อีเมล บทบาท รหัสนิสิต คณะ หรือภาควิชา"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-ku-main/30"
          />
        </div>
      </div>

      {loading && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-gray-500 flex items-center gap-2">
          <Loader2 size={18} className="animate-spin" /> กำลังโหลดผู้ใช้...
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
              <tr>
                <th className="p-4">โปรไฟล์</th>
                <th className="p-4">ชื่อ</th>
                <th className="p-4">รหัสนิสิต KU</th>
                <th className="p-4">บทบาท</th>
                <th className="p-4">คณะ</th>
                <th className="p-4">ภาควิชา</th>
                <th className="p-4 text-right">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      {user.profile_picture ? (
                        <img
                          src={user.profile_picture}
                          alt={user.fullname || 'ผู้ใช้'}
                          className="w-10 h-10 rounded-full object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-ku-main text-white flex items-center justify-center text-xs font-bold">
                          {getInitials(user.fullname)}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <p className="font-semibold text-gray-800">{user.fullname || '-'}</p>
                      <p className="text-xs text-gray-500">{user.email || '-'}</p>
                    </td>
                    <td className="p-4 text-gray-600">{user.primary_role === 'STUDENT' ? (user.ku_id || '-') : '-'}</td>
                    <td className="p-4 text-gray-700">{getRoleLabel(user.primary_role)}</td>
                    <td className="p-4 text-gray-600">{user.faculty || '-'}</td>
                    <td className="p-4 text-gray-600">{user.department || '-'}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => startEdit(user)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm"
                      >
                        <Edit3 size={14} /> แก้ไข
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-sm text-gray-500">
                    ไม่พบผู้ใช้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AccountCreation;
