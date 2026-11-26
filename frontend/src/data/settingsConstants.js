import {
  User, BookOpen, ShieldCheck, SlidersHorizontal, Bell,
  GraduationCap, Moon, Camera, RefreshCw
} from 'lucide-react';

export const PRESET_AVATARS = [
  {
    id: 'emerald',
    name: 'Emerald Scholar',
    bg: '#10b981',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%2310b981"/><stop offset="100%" stop-color="%23047857"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(%23g1)"/><circle cx="50" cy="40" r="18" fill="%23ffffff" opacity="0.95"/><path d="M22 82 C22 64 34 58 50 58 C66 58 78 64 78 82 Z" fill="%23ffffff" opacity="0.95"/><polygon points="50,16 68,26 50,36 32,26" fill="%23fef08a"/><path d="M68 26 L68 38" stroke="%23fef08a" stroke-width="2"/></svg>`
  },
  {
    id: 'coder',
    name: 'Neon Coder',
    bg: '#06b6d4',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%2306b6d4"/><stop offset="100%" stop-color="%230284c7"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(%23g2)"/><rect x="22" y="24" width="56" height="42" rx="8" fill="%230f172a"/><path d="M34 38 L28 44 L34 50 M44 52 L48 36 M58 38 L64 44 L58 50" stroke="%2338bdf8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/><rect x="38" y="66" width="24" height="6" rx="2" fill="%23cbd5e1"/><rect x="32" y="72" width="36" height="4" rx="2" fill="%2394a3b8"/></svg>`
  },
  {
    id: 'orbit',
    name: 'Cosmic Orbit',
    bg: '#6366f1',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g3" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%236366f1"/><stop offset="100%" stop-color="%234338ca"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(%23g3)"/><ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="%23a5b4fc" stroke-width="3" transform="rotate(-25 50 50)"/><circle cx="50" cy="50" r="18" fill="%23fbbf24"/><circle cx="76" cy="40" r="6" fill="%2338bdf8"/><circle cx="28" cy="62" r="4" fill="%23f43f5e"/></svg>`
  },
  {
    id: 'fox',
    name: 'Amber Fox',
    bg: '#f59e0b',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g4" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23f59e0b"/><stop offset="100%" stop-color="%23d97706"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(%23g4)"/><polygon points="26,24 40,46 22,46" fill="%23b45309"/><polygon points="74,24 78,46 60,46" fill="%23b45309"/><polygon points="50,30 24,54 50,84 76,54" fill="%23fed7aa"/><polygon points="50,42 34,58 50,78 66,58" fill="%23ffffff"/><circle cx="40" cy="54" r="3.5" fill="%231e293b"/><circle cx="60" cy="54" r="3.5" fill="%231e293b"/><polygon points="50,68 45,63 55,63" fill="%231e293b"/></svg>`
  },
  {
    id: 'gem',
    name: 'Amethyst Crystal',
    bg: '#a855f7',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g5" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23a855f7"/><stop offset="100%" stop-color="%237e22ce"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(%23g5)"/><polygon points="50,20 74,38 64,74 36,74 26,38" fill="%23f3e8ff"/><polygon points="50,20 64,38 36,38" fill="%23e9d5ff"/><polygon points="36,38 26,38 36,74" fill="%23d8b4fe"/><polygon points="64,38 74,38 64,74" fill="%23c084fc"/><polygon points="36,38 50,78 64,38" fill="%23a855f7"/></svg>`
  },
  {
    id: 'innovator',
    name: 'Rose Innovator',
    bg: '#f43f5e',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g6" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23f43f5e"/><stop offset="100%" stop-color="%23be123c"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(%23g6)"/><circle cx="50" cy="42" r="16" fill="%23fff1f2"/><path d="M50 28 L50 22 M36 34 L30 30 M64 34 L70 30" stroke="%23fecdd3" stroke-width="2.5" stroke-linecap="round"/><path d="M26 80 C26 64 36 58 50 58 C64 58 74 64 74 80 Z" fill="%23ffffff" opacity="0.95"/><path d="M46 44 L50 48 L58 40" stroke="%2310b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`
  }
];

export const APPEARANCE_SECTION = {
  icon: Moon,
  title: 'Appearance & Display',
  blurb: 'Customize the visual theme and interface appearance across your Verity workspace.',
  fields: [
    { label: 'Dark Mode', type: 'dark_toggle' },
  ],
};

export const PROFILE_PICTURE_SECTION = {
  icon: Camera,
  title: 'Profile Picture',
  blurb: 'Update your profile photo and choose a personalized avatar.',
  fields: [],
};

export const SOFTWARE_UPDATE_SECTION = {
  icon: RefreshCw,
  title: 'Check for Updates',
  blurb: 'Keep The Verity up to date with the latest features, security patches, and improvements.',
  fields: [
    { label: 'Check for Updates', type: 'check_update' },
  ],
};

export const SECTIONS = {
  Student: [
    APPEARANCE_SECTION,
    PROFILE_PICTURE_SECTION,
    {
      icon: User,
      title: 'User Details',
      blurb: 'Update your display name, email, and password credentials.',
      fields: [
        { label: 'First Name', placeholder: 'Juan' },
        { label: 'Last Name', placeholder: 'Dela Cruz' },
        { label: 'Email Address', placeholder: 'student@verity.edu', type: 'email_with_change' },
        { label: 'Password', placeholder: '••••••••', type: 'password_with_change' },
      ],
    },
    {
      icon: GraduationCap,
      title: 'Student Details',
      blurb: 'Manage your contact number and parent or guardian emergency details.',
      fields: [
        { label: 'Contact Number', placeholder: '+63 900 000 0000' },
        { label: 'Parent / Guardian Name', placeholder: 'Maria Dela Cruz' },
        { label: 'Parent / Guardian Contact', placeholder: '+63 900 000 0000' },
      ],
    },
    {
      icon: Bell,
      title: 'Notifications',
      blurb: 'Manage preferences for receiving email alerts for classwork, materials, upcoming deadlines, and missed activities.',
      fields: [
        { label: 'New Classwork Email Alerts', type: 'toggle', default: true },
        { label: 'New Materials Email Alerts', type: 'toggle', default: true },
        { label: 'Upcoming Deadline Alerts', type: 'toggle', default: true },
        { label: 'Missed Activity Alerts', type: 'toggle', default: true },
        { label: 'Grade Notifications', type: 'toggle', default: true },
        { label: 'Instructor Announcements', type: 'toggle', default: false },
        { label: 'Reminder Lead Time', placeholder: 'e.g. 24 hours before' },
      ],
    },
    SOFTWARE_UPDATE_SECTION,
  ],
  Instructor: [
    APPEARANCE_SECTION,
    PROFILE_PICTURE_SECTION,
    {
      icon: User,
      title: 'User Details',
      blurb: 'Update your instructor credentials and contact details.',
      fields: [
        { label: 'First Name', placeholder: 'Maria' },
        { label: 'Last Name', placeholder: 'Santos' },
        { label: 'Email Address', placeholder: 'instructor@verity.edu', type: 'email_with_change' },
        { label: 'Department / Specialization', placeholder: 'Computer Science & Engineering' },
        { label: 'Password', placeholder: '••••••••', type: 'password_with_change' },
      ],
    },
    {
      icon: BookOpen,
      title: 'Course & Content Management',
      blurb: 'Define course structures, upload reusable content templates, and configure grading scales or rubrics.',
      fields: [
        { label: 'Default Course Structure', placeholder: 'e.g. Lectures → Labs → Exams' },
        { label: 'Reusable Content Template', placeholder: 'Upload a template (.docx, .pdf)', type: 'file' },
        { label: 'Grading Scale', placeholder: 'e.g. 1.00 – 5.00 / A – F' },
        { label: 'Rubric Name', placeholder: 'e.g. Programming Project Rubric' },
      ],
    },
    {
      icon: GraduationCap,
      title: 'Classroom Management',
      blurb: 'Manage enrollment requests, set assignment deadlines, and configure visibility / release schedules for materials.',
      fields: [
        { label: 'Enrollment Requests', placeholder: 'e.g. Require approval' },
        { label: 'Default Assignment Deadline', placeholder: 'e.g. 7 days after release' },
        { label: 'Material Visibility', placeholder: 'e.g. Visible / Hidden' },
        { label: 'Release Schedule', placeholder: 'e.g. Release on Mondays 8:00 AM' },
      ],
    },
    SOFTWARE_UPDATE_SECTION,
  ],
  Administrator: [
    APPEARANCE_SECTION,
    PROFILE_PICTURE_SECTION,
    {
      icon: User,
      title: 'User Details',
      blurb: 'Update your administrative security credentials.',
      fields: [
        { label: 'First Name', placeholder: 'System' },
        { label: 'Last Name', placeholder: 'Administrator' },
        { label: 'Email Address', placeholder: 'admin@verity.edu', type: 'email_with_change' },
        { label: 'Emergency Contact', placeholder: '+63 900 000 0000' },
        { label: 'Password', placeholder: '••••••••', type: 'password_with_change' },
      ],
    },
    {
      icon: ShieldCheck,
      title: 'User & Role Management',
      blurb: 'Provision new accounts, define role-based access control (RBAC) permissions, and handle bulk user imports.',
      fields: [
        { label: 'New Account Email', placeholder: 'newuser@verity.edu' },
        { label: 'Assign Role', placeholder: 'Student / Instructor / Administrator' },
        { label: 'RBAC Permission Set', placeholder: 'e.g. read:classrooms, write:grades' },
        { label: 'Bulk User Import', placeholder: 'Upload a .csv of users', type: 'file' },
      ],
    },
    {
      icon: SlidersHorizontal,
      title: 'System Configuration',
      blurb: 'Customize branding (logos, colors) and define academic calendars (terms, holidays).',
      fields: [
        { label: 'Institution Logo', placeholder: 'Upload a logo (.png, .svg)', type: 'file' },
        { label: 'Primary Brand Color', placeholder: '#10b981' },
        { label: 'Academic Term', placeholder: 'e.g. 1st Semester 2026–2027' },
        { label: 'Holidays / Non-working Days', placeholder: 'e.g. Dec 25, Jan 1' },
      ],
    },
    SOFTWARE_UPDATE_SECTION,
  ],
};

