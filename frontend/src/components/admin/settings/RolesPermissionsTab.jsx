import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { tabVariants } from '../../../data/adminSettings';
import { Toggle } from './SettingControls';

export default function RolesPermissionsTab({ data, onChange, direction, styles, T }) {
  const update = (key, val) => onChange({ ...data, [key]: val });

  return (
    <motion.div custom={direction} variants={tabVariants} initial="initial" animate="animate" exit="exit" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={styles.card}>
        <div>
          <h3 style={styles.sectionTitle}><Users size={18} color={T.blue} /><span>Instructor & Student Role Scopes</span></h3>
          <p style={styles.sectionSub}>Configure granular permissions for secondary roles across the institution.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Toggle
              on={data.allowManageStudents}
              onToggle={() => update('allowManageStudents', !data.allowManageStudents)}
              label="Allow Instructors to Add/Enroll Students"
              subtext="Instructors can manually add and invite students to their own classes."
              T={T}
            />
            <Toggle
              on={data.allowDeleteCourses}
              onToggle={() => update('allowDeleteCourses', !data.allowDeleteCourses)}
              label="Allow Instructors to Delete Classrooms"
              subtext="WARNING: Instructors can permanently remove entire classes and associated submission records."
              accent={T.red}
              T={T}
            />
            <Toggle
              on={data.requireAdminApproval}
              onToggle={() => update('requireAdminApproval', !data.requireAdminApproval)}
              label="Require Admin Approval for New Instructor Accounts"
              subtext="Self-registered teachers cannot access the dashboard until an Admin explicitly approves them."
              T={T}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

