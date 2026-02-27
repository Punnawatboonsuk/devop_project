import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { authenticatedApiRequest } from '../utils/api';
import { getRoleLabel } from '../utils/roleLabels';

const PHASE_LABELS = {
  NOMINATION: 'เปิดรับสมัคร',
  REVIEW_END: 'รอตรวจสอบ',
  VOTING: 'เปิดโหวต',
  VOTING_END: 'ปิดโหวต',
  CERTIFICATE: 'ออกใบประกาศ'
};

const Navbar = () => {
  const { user } = useAuth();
  const [roundInfo, setRoundInfo] = useState(null);
  const [phase, setPhase] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchRoundPhase = async () => {
      try {
        const response = await authenticatedApiRequest('/api/auth/phase');
        if (!response.ok) return;

        const data = await response.json();
        if (!isMounted) return;

        setRoundInfo(data.round || null);
        setPhase(data.phase || null);
      } catch {
        // Keep navbar stable if phase API fails
      }
    };

    fetchRoundPhase();

    return () => {
      isMounted = false;
    };
  }, []);

  const academicLabel = useMemo(() => {
    if (!roundInfo) return 'รอบการศึกษา -';
    return `ปีการศึกษา ${roundInfo.academic_year} / ภาคเรียน ${roundInfo.semester}`;
  }, [roundInfo]);

  const userInitials = useMemo(() => {
    const fullname = String(user?.fullname || '').trim();
    if (!fullname) return 'U';
    const parts = fullname.split(/\s+/).slice(0, 2);
    return parts.map((part) => part[0]?.toUpperCase() || '').join('') || 'U';
  }, [user?.fullname]);

  const phaseLabel = useMemo(() => {
    const code = String(phase || '').toUpperCase();
    if (!code) return '';
    return PHASE_LABELS[code] ? `${code} (${PHASE_LABELS[code]})` : code;
  }, [phase]);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 fixed top-0 left-64 right-0 z-40">
      {/* Left: Breadcrumb or Title (Optional) */}
      <div className="text-sm text-gray-500">
        {academicLabel}
        <span className="text-ku-main font-semibold">{phaseLabel ? ` - ${phaseLabel}` : ''}</span>
      </div>

      {/* Right: User Profile */}
      <div className="flex items-center gap-6">
        
        <div className="flex items-center gap-3 pl-6 border-l border-gray-200">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-gray-800">{user?.fullname || 'ผู้ใช้'}</p>
            <p className="text-xs text-gray-500">{getRoleLabel(user?.primary_role) || 'บทบาท'}</p>
          </div>
          {user?.profile_picture ? (
            <img
              src={user.profile_picture}
              alt={user?.fullname || 'ผู้ใช้'}
              className="w-10 h-10 rounded-full object-cover border border-ku-main"
            />
          ) : (
            <div className="w-10 h-10 bg-ku-light text-ku-main rounded-full flex items-center justify-center font-bold border border-ku-main text-xs">
              {userInitials}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
