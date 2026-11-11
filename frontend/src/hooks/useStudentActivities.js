import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiFetch } from '../data/api';
import { getCachedClassrooms } from '../data/classroomCache';
import { isPhantomClassroom } from '../utils/classroomList';
import { getLessonType } from '../utils/lessonType';
import { extractVideoTitle } from '../utils/videoTitle';
import { formatVideoTimestamp } from '../utils/videoTimestamp';

export function useStudentActivities({ currentUser, classrooms, activeClassrooms, onOpenAssignment }) {
  const getActivitiesStorageKey = useCallback((user) => {
    const id = user?.id || user?.email || 'anon';
    return `verity_cached_upcoming_activities_${id}`;
  }, []);

  const getClassworkStorageKey = useCallback((user) => {
    const id = user?.id || user?.email || 'anon';
    return `verity_cached_classwork_${id}`;
  }, []);

  const [upcomingActivities, setUpcomingActivities] = useState(() => {
    try {
      const raw = localStorage.getItem(getActivitiesStorageKey(currentUser));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const userClassrooms = getCachedClassrooms(currentUser, 'student').filter(c => !isPhantomClassroom(c));
          if (userClassrooms.length > 0) {
            const filtered = parsed.filter(item => userClassrooms.some(c => String(c.id) === String(item.classroom_id || item.classId)));
            return filtered.length > 0 ? filtered : parsed;
          }
          return parsed;
        }
      }
    } catch (_) {}
    return [];
  });

  const [allClasswork, setAllClasswork] = useState(() => {
    try {
      const raw = localStorage.getItem(getClassworkStorageKey(currentUser));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const userClassrooms = getCachedClassrooms(currentUser, 'student').filter(c => !isPhantomClassroom(c));
          if (userClassrooms.length > 0) {
            const filtered = parsed.filter(item => userClassrooms.some(c => String(c.id) === String(item.classroom_id || item.classId)));
            return filtered.length > 0 ? filtered : parsed;
          }
          return parsed;
        }
      }
    } catch (_) {}
    return [];
  });

  const [dashboardStats, setDashboardStats] = useState({ done: 0, dueSoon: 0, miss: 0 });
  const [loadingActivities, setLoadingActivities] = useState(() => {
    try {
      const raw = localStorage.getItem(getActivitiesStorageKey(currentUser));
      return !raw;
    } catch (_) {
      return true;
    }
  });

  useEffect(() => {
    try {
      const userClassrooms = getCachedClassrooms(currentUser, 'student').filter(c => !isPhantomClassroom(c));
      const rawAct = localStorage.getItem(getActivitiesStorageKey(currentUser));
      if (rawAct) {
        const parsed = JSON.parse(rawAct);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (userClassrooms.length > 0) {
            const filtered = parsed.filter(item => userClassrooms.some(c => String(c.id) === String(item.classroom_id || item.classId)));
            setUpcomingActivities(filtered.length > 0 ? filtered : parsed);
          } else {
            setUpcomingActivities(parsed);
          }
        }
      }
      const rawCw = localStorage.getItem(getClassworkStorageKey(currentUser));
      if (rawCw) {
        const parsed = JSON.parse(rawCw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (userClassrooms.length > 0) {
            const filtered = parsed.filter(item => userClassrooms.some(c => String(c.id) === String(item.classroom_id || item.classId)));
            setAllClasswork(filtered.length > 0 ? filtered : parsed);
          } else {
            setAllClasswork(parsed);
          }
        }
      }
    } catch (_) {}
  }, [currentUser, getActivitiesStorageKey, getClassworkStorageKey]);

  const displayedUpcomingActivities = useMemo(() => {
    if (!Array.isArray(upcomingActivities) || upcomingActivities.length === 0) return [];
    if (!Array.isArray(classrooms) || classrooms.length === 0) return upcomingActivities;
    const filtered = upcomingActivities.filter(act => classrooms.some(c => String(c.id) === String(act.classroom_id || act.classId)));
    return filtered.length > 0 ? filtered : upcomingActivities;
  }, [upcomingActivities, classrooms]);

  useEffect(() => {
    let active = true;
    const fetchAllActivities = async () => {
      try {
        const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/classwork`);
        if (res.ok && active) {
          const data = await res.json();
          if (data && Array.isArray(data.classwork)) {
            if (data.classwork.length === 0) return;

            const classList = (Array.isArray(classrooms) && classrooms.length > 0)
              ? classrooms
              : getCachedClassrooms(currentUser, 'student').filter(c => !isPhantomClassroom(c));
            const isLegacyHardcoded = (item) => (item?.id === 1 || item?.id === 2) && (item?.title?.startsWith('Activity 1:') || item?.title?.startsWith('Activity 2:'));

            const enrolled = data.classwork.filter(
              item => !item.archived && !isLegacyHardcoded(item) && (
                classList.length === 0 || classList.some(c => String(c.id) === String(item.classroom_id || item.classId))
              )
            );

            const activitiesToSave = enrolled.length > 0 ? enrolled : (data.classwork.length > 0 ? data.classwork.filter(item => !item.archived && !isLegacyHardcoded(item)) : []);
            if (activitiesToSave.length > 0) {
              setAllClasswork(activitiesToSave);
              try {
                localStorage.setItem(getClassworkStorageKey(currentUser), JSON.stringify(activitiesToSave));
              } catch (_) {}

              const sortedActivities = [...activitiesToSave].sort((a, b) => {
                if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
                if (a.dueDate) return -1;
                if (b.dueDate) return 1;
                return new Date(b.posted || b.id || 0) - new Date(a.posted || a.id || 0);
              });
              setUpcomingActivities(sortedActivities);
              try {
                localStorage.setItem(getActivitiesStorageKey(currentUser), JSON.stringify(sortedActivities));
              } catch (_) {}

              try {
                const subRes = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/student/submissions`);
                if (subRes.ok && active) {
                  const subData = await subRes.json();
                  const submittedAssignmentIds = new Set((subData.submissions || []).map(s => String(s.assignment_id)));
                  let done = 0, dueSoon = 0, miss = 0;
                  const now = new Date();
                  sortedActivities.forEach(cw => {
                    if (submittedAssignmentIds.has(String(cw.id))) {
                      done++;
                    } else {
                      const due = cw.dueDate ? new Date(cw.dueDate) : null;
                      if (due && due < now) {
                        miss++;
                      } else {
                        dueSoon++;
                      }
                    }
                  });
                  setDashboardStats({ done, dueSoon, miss });
                }
              } catch (e) {
                console.warn('Failed to fetch submissions for stats', e);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch classwork:', err);
      } finally {
        if (active) setLoadingActivities(false);
      }
    };
    fetchAllActivities();
    return () => { active = false; };
  }, [classrooms, currentUser, getActivitiesStorageKey, getClassworkStorageKey]);

  const [videoDurations, setVideoDurations] = useState(() => {
    try {
      const saved = localStorage.getItem('verity_video_durations');
      return saved ? JSON.parse(saved) : {};
    } catch (_) {
      return {};
    }
  });

  const handleVideoDurationLoaded = useCallback((videoSrc, durationInSec) => {
    const formatted = formatVideoTimestamp(durationInSec);
    if (formatted && videoSrc) {
      setVideoDurations(prev => {
        if (prev[videoSrc] === formatted) return prev;
        const updated = { ...prev, [videoSrc]: formatted };
        try { localStorage.setItem('verity_video_durations', JSON.stringify(updated)); } catch (_) {}
        return updated;
      });
    }
  }, []);

  const videoLessons = useMemo(() => {
    const list = [];
    const classList = (Array.isArray(activeClassrooms) && activeClassrooms.length > 0)
      ? activeClassrooms
      : getCachedClassrooms(currentUser, 'student').filter(c => !isPhantomClassroom(c) && !c.archived);

    allClasswork.forEach(item => {
      const classObj = classList.find(c => String(c.id) === String(item.classroom_id || item.classId));
      if (classList.length > 0 && !classObj) return;

      if (getLessonType(item) === 'video') {
        const videoAttachment = item.attachments?.find(a =>
          a?.type === 'video' ||
          a?.type === 'youtube' ||
          /\.(mp4|webm|mov|m4v|mkv|avi)(\?|$)/i.test(a?.url || '') ||
          /\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(a?.name || '')
        );
        const match = (item.details || item.instruction || '').match(/<video[^>]*src="([^"]+)"/);
        const ytMatch = (item.details || item.instruction || '').match(/(?:src="|href=")([^"]*(?:youtube\.com|youtu\.be)[^"]*)"/);
        const src = videoAttachment?.url || (match ? match[1] : '') || (ytMatch ? ytMatch[1] : '');
        if (!src) return;

        const title = extractVideoTitle(src, videoAttachment, item.title);

        list.push({
          id: String(item.id),
          title,
          subject: (classObj?.name || classObj?.subject || 'COURSE').toUpperCase(),
          duration: formatVideoTimestamp(item.duration) || (src?.includes('1792768564903_HCI_Lesson_1_ITEC_80') ? '52:21' : null) || '52:21',
          src,
          item,
          classObj
        });
      }
    });

    return list;
  }, [allClasswork, activeClassrooms, currentUser]);

  const [seenVideoMap, setSeenVideoMap] = useState({});

  useEffect(() => {
    const uid = currentUser?.id || 'anon';
    const map = {};
    videoLessons.forEach(v => {
      const key = `verity_seen_video_${uid}_${v.id}`;
      map[v.id] = localStorage.getItem(key) === 'true';
    });
    setSeenVideoMap(map);
  }, [videoLessons, currentUser]);

  const unseenVideo = useMemo(() => {
    return videoLessons.find(v => !seenVideoMap[v.id]) || null;
  }, [videoLessons, seenVideoMap]);

  const currentVideoDuration = useMemo(() => {
    if (!unseenVideo) return '52:21';
    if (unseenVideo.src && videoDurations[unseenVideo.src]) {
      return videoDurations[unseenVideo.src];
    }
    const formatted = formatVideoTimestamp(unseenVideo.duration);
    if (formatted) return formatted;
    if (unseenVideo.src?.includes('1792768564903_HCI_Lesson_1_ITEC_80')) {
      return '52:21';
    }
    return unseenVideo.duration && unseenVideo.duration !== '25 min' ? unseenVideo.duration : '52:21';
  }, [unseenVideo, videoDurations]);

  const [activePlayingVideo, setActivePlayingVideo] = useState(null);

  const handleStartSession = useCallback((videoToPlay) => {
    const target = videoToPlay || unseenVideo;
    if (!target) return;
    setActivePlayingVideo(target);

    const uid = currentUser?.id || 'anon';
    const key = `verity_seen_video_${uid}_${target.id}`;
    try {
      localStorage.setItem(key, 'true');
    } catch (_) {}
    setSeenVideoMap(prev => ({ ...prev, [target.id]: true }));
  }, [unseenVideo, currentUser]);

  return {
    dashboardStats,
    loadingActivities,
    displayedUpcomingActivities,
    videoLessons,
    unseenVideo,
    currentVideoDuration,
    activePlayingVideo,
    setActivePlayingVideo,
    handleStartSession,
    handleVideoDurationLoaded,
  };
}

