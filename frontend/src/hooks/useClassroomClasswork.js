import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../data/api';

const isLegacyHardcoded = (item) => (item?.id === 1 || item?.id === 2) && (item?.title?.startsWith('Activity 1:') || item?.title?.startsWith('Activity 2:'));

export const isMaterialItem = (item) => Boolean(item && (item.activityType === 'Material' || String(item.activityType || '').toLowerCase() === 'material' || String(item.type || '').toLowerCase() === 'material'));

export function useClassroomClasswork({ classroom, currentUser, socket, activeTab }) {
  const classroomId = classroom?.id ?? 'default';
  const storageKey = `verity_classwork_${classroomId}`;

  const [expandedId, setExpandedId] = useState(null);
  const [expandedInstructionId, setExpandedInstructionId] = useState(null);
  const [assignments, setAssignments] = useState(() => {
    try {
      const saved = localStorage.getItem(`verity_classwork_${classroom?.id ?? 'default'}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter(item => !item.archived && !isLegacyHardcoded(item));
        }
      }
    } catch {}
    return [];
  });
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  const visibleClasswork = useMemo(() => assignments.filter(item => !isMaterialItem(item)), [assignments]);
  const visibleMaterials = useMemo(() => assignments.filter(item => isMaterialItem(item)), [assignments]);

  const seenMaterialsKey = `verity_seen_materials_${classroom?.id ?? 'default'}_${currentUser?.email || currentUser?.id || 'anon'}`;
  const [seenMaterialIds, setSeenMaterialIds] = useState(() => {
    try {
      const saved = localStorage.getItem(seenMaterialsKey);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(seenMaterialsKey);
      setSeenMaterialIds(saved ? JSON.parse(saved) : []);
    } catch {
      setSeenMaterialIds([]);
    }
  }, [seenMaterialsKey]);

  const unseenMaterials = useMemo(() => {
    return visibleMaterials.filter(m => !seenMaterialIds.includes(m.id));
  }, [visibleMaterials, seenMaterialIds]);

  const hasUnseenMaterials = unseenMaterials.length > 0;

  const markMaterialsAsSeen = () => {
    try {
      const allIds = visibleMaterials.map(m => m.id);
      setSeenMaterialIds(allIds);
      localStorage.setItem(seenMaterialsKey, JSON.stringify(allIds));
    } catch {}
  };

  const markSingleMaterialAsSeen = (id) => {
    if (!id) return;
    try {
      setSeenMaterialIds(prev => {
        if (prev.includes(id)) return prev;
        const updated = [...prev, id];
        localStorage.setItem(seenMaterialsKey, JSON.stringify(updated));
        return updated;
      });
    } catch {}
  };

  useEffect(() => {
    if (activeTab === 'materials' && visibleMaterials.length > 0 && hasUnseenMaterials) {
      markMaterialsAsSeen();
    }
  }, [activeTab, visibleMaterials.length, hasUnseenMaterials]);

  useEffect(() => {
    const applyList = (list) => {
      if (Array.isArray(list) && list.length > 0) {
        setAssignments(list.filter(item => !item.archived && !isLegacyHardcoded(item)));
      }
    };

    const loadFromLocal = () => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            applyList(parsed);
            return;
          }
        }
        if (window.electronAPI?.localDB?.getCachedClasswork) {
          window.electronAPI.localDB.getCachedClasswork(classroomId)
            .then(cached => {
              if (Array.isArray(cached) && cached.length > 0) {
                applyList(cached);
                return;
              }
            })
            .catch(() => {});
        }
        const userKey = currentUser?.id || currentUser?.email || 'default';
        const globalCached = localStorage.getItem('verity_cached_classwork') || localStorage.getItem(`verity_cached_classwork_${userKey}`);
        if (globalCached) {
          const parsedGlobal = JSON.parse(globalCached);
          if (Array.isArray(parsedGlobal)) {
            const matching = parsedGlobal.filter(item => String(item.classroom_id || item.classroomId) === String(classroomId));
            if (matching.length > 0) {
              applyList(matching);
              return;
            }
          }
        }
        const upcomingCached = localStorage.getItem(`verity_cached_upcoming_activities_${userKey}`);
        if (upcomingCached) {
          const parsedUpcoming = JSON.parse(upcomingCached);
          if (Array.isArray(parsedUpcoming)) {
            const matching = parsedUpcoming.filter(item => String(item.classroom_id || item.classroomId) === String(classroomId));
            if (matching.length > 0) {
              applyList(matching);
              return;
            }
          }
        }
      } catch {}
    };

    loadFromLocal();

    let cancelled = false;
    apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/classwork/${classroomId}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        if (Array.isArray(data.classwork) && data.classwork.length > 0) {
          let localItems = [];
          try {
            const raw = localStorage.getItem(storageKey);
            if (raw) localItems = JSON.parse(raw);
          } catch (_) {}
          const serverIds = new Set(data.classwork.map(item => String(item.id)));
          const unuploadedLocal = (Array.isArray(localItems) ? localItems : []).filter(item => item && item.id && !serverIds.has(String(item.id)));
          const merged = [...data.classwork, ...unuploadedLocal];
          applyList(merged);
          try {
            localStorage.setItem(storageKey, JSON.stringify(merged));
          } catch (_) {}
          if (window.electronAPI?.localDB?.cacheClasswork) {
            window.electronAPI.localDB.cacheClasswork(classroomId, merged).catch(() => {});
          }
        } else {
          loadFromLocal();
        }
      })
      .catch(() => { if (!cancelled) loadFromLocal(); })
      .finally(() => { if (!cancelled) setLoadingAssignments(false); });

    const onClassworkChanged = (payload) => {
      if (String(payload?.classroomId) === String(classroomId) && Array.isArray(payload?.classwork)) {
        if (payload.classwork.length > 0) {
          let localItems = [];
          try {
            const raw = localStorage.getItem(storageKey);
            if (raw) localItems = JSON.parse(raw);
          } catch (_) {}
          const serverIds = new Set(payload.classwork.map(item => String(item.id)));
          const unuploadedLocal = (Array.isArray(localItems) ? localItems : []).filter(item => item && item.id && !serverIds.has(String(item.id)));
          const merged = [...payload.classwork, ...unuploadedLocal];
          applyList(merged);
          try {
            localStorage.setItem(storageKey, JSON.stringify(merged));
          } catch (e) {}
          if (window.electronAPI?.localDB?.cacheClasswork) {
            window.electronAPI.localDB.cacheClasswork(classroomId, merged).catch(() => {});
          }
        }
      }
    };
    if (socket) socket.on('classwork_changed', onClassworkChanged);

    const onStorage = (e) => { if (e.key === storageKey) loadFromLocal(); };
    window.addEventListener('storage', onStorage);

    return () => {
      cancelled = true;
      if (socket) socket.off('classwork_changed', onClassworkChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, [classroom, classroomId, socket, storageKey, currentUser]);

  return {
    assignments,
    visibleClasswork,
    visibleMaterials,
    unseenMaterials,
    hasUnseenMaterials,
    loadingAssignments,
    expandedId,
    setExpandedId,
    expandedInstructionId,
    setExpandedInstructionId,
    markMaterialsAsSeen,
    markSingleMaterialAsSeen
  };
}
