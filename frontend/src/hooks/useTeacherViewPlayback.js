import { useState, useEffect, useRef, useMemo } from 'react';
import { formatTimeMs } from '../utils/teacherViewUtils';

export function useTeacherViewPlayback({ history, hasPlayback, selectedStudentId, mode }) {
  const [playbackIndex, setPlaybackIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const playbackSpeedRef = useRef(1);
  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  const playbackIndexRef = useRef(playbackIndex);
  useEffect(() => {
    playbackIndexRef.current = playbackIndex;
  }, [playbackIndex]);

  const animFrameRef = useRef(null);
  const progressLineRef = useRef(null);
  const progressThumbRef = useRef(null);
  const timeDisplayRef = useRef(null);
  const smoothProgressRef = useRef(0);
  const currentIdxRef = useRef(0);
  const currentAnimTimeRef = useRef(0);

  const resetPlaybackKey = `${selectedStudentId ?? ''}|${mode}`;
  const [prevResetPlaybackKey, setPrevResetPlaybackKey] = useState(resetPlaybackKey);
  if (resetPlaybackKey !== prevResetPlaybackKey) {
    setPrevResetPlaybackKey(resetPlaybackKey);
    setPlaybackIndex(-1);
    setIsPlaying(false);
  }

  // Reset refs and DOM indicators when active student or mode changes
  useEffect(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    currentAnimTimeRef.current = 0;
    smoothProgressRef.current = 0;
    if (progressLineRef.current) progressLineRef.current.style.width = '0%';
    if (progressThumbRef.current) progressThumbRef.current.style.left = '0%';
  }, [selectedStudentId, mode]);

  // Precompute cumulative timeline preserving real typing cadence
  const cumulativeTimes = useMemo(() => {
    if (!history || history.length < 2) return [0];
    const times = [0];
    const MAX_PAUSE_MS = 8000;

    for (let i = 0; i < history.length - 1; i++) {
      const t1 = history[i]?.time ? Number(history[i].time) : 0;
      const t2 = history[i + 1]?.time ? Number(history[i + 1].time) : 0;
      const rawGap = t1 > 0 && t2 > 0 ? t2 - t1 : 0;

      let stepDuration;
      if (rawGap <= 0) {
        stepDuration = 50;
      } else if (rawGap > MAX_PAUSE_MS) {
        stepDuration = MAX_PAUSE_MS;
      } else {
        stepDuration = Math.max(rawGap, 35);
      }
      times.push(times[i] + stepDuration);
    }
    return times;
  }, [history]);

  const totalPlaybackDuration = cumulativeTimes[cumulativeTimes.length - 1] || 1;

  // Animation frame playback loop
  const canPlay = hasPlayback && history.length >= 2;
  useEffect(() => {
    if (!isPlaying || !canPlay) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const maxIndex = Math.max(history.length - 1, 1);
    let currentAnimTime = currentAnimTimeRef.current;
    const latestPlaybackIndex = playbackIndexRef.current;
    const currentIdx = latestPlaybackIndex < 0 ? 0 : Math.min(latestPlaybackIndex, maxIndex);
    const stepStart = cumulativeTimes[currentIdx] || 0;
    const stepEnd = cumulativeTimes[currentIdx + 1] ?? stepStart + 1000;

    if (
      typeof currentAnimTime !== 'number' ||
      currentAnimTime < 0 ||
      currentAnimTime >= totalPlaybackDuration ||
      currentAnimTime < stepStart ||
      currentAnimTime > stepEnd + 100
    ) {
      currentAnimTime = stepStart;
    }
    currentAnimTimeRef.current = currentAnimTime;

    let lastFrameTimestamp = performance.now();
    currentIdxRef.current = latestPlaybackIndex < 0 ? 0 : latestPlaybackIndex;

    const animate = (now) => {
      const delta = now - lastFrameTimestamp;
      lastFrameTimestamp = now;

      currentAnimTime += delta * (playbackSpeedRef.current || 1);
      currentAnimTimeRef.current = currentAnimTime;

      if (currentAnimTime >= totalPlaybackDuration) {
        smoothProgressRef.current = 100;
        currentAnimTimeRef.current = totalPlaybackDuration;
        if (progressLineRef.current) progressLineRef.current.style.width = '100%';
        if (progressThumbRef.current) progressThumbRef.current.style.left = '100%';
        if (timeDisplayRef.current) {
          timeDisplayRef.current.innerText = `Keystroke ${maxIndex + 1} / ${history.length} (${formatTimeMs(totalPlaybackDuration)} / ${formatTimeMs(totalPlaybackDuration)})`;
        }
        setPlaybackIndex(maxIndex);
        setIsPlaying(false);
        return;
      }

      const progressPercent = Math.min(Math.max((currentAnimTime / totalPlaybackDuration) * 100, 0), 100);
      smoothProgressRef.current = progressPercent;

      if (progressLineRef.current) progressLineRef.current.style.width = `${progressPercent}%`;
      if (progressThumbRef.current) progressThumbRef.current.style.left = `${progressPercent}%`;

      let idx = 0;
      while (idx < cumulativeTimes.length - 1 && cumulativeTimes[idx + 1] <= currentAnimTime) {
        idx++;
      }
      idx = Math.min(idx, maxIndex);

      if (idx !== currentIdxRef.current) {
        currentIdxRef.current = idx;
        setPlaybackIndex(idx);
      }

      if (timeDisplayRef.current) {
        timeDisplayRef.current.innerText = `Keystroke ${idx + 1} / ${history.length} (${formatTimeMs(currentAnimTime)} / ${formatTimeMs(totalPlaybackDuration)})`;
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, canPlay, history, cumulativeTimes, totalPlaybackDuration]);

  const togglePlay = () => {
    if (!canPlay) {
      setIsPlaying(false);
      return;
    }
    if (!isPlaying) {
      const maxIndex = Math.max(history.length - 1, 1);
      if (
        playbackIndex >= maxIndex ||
        currentAnimTimeRef.current >= totalPlaybackDuration ||
        playbackIndex < 0
      ) {
        setPlaybackIndex(0);
        currentIdxRef.current = 0;
        currentAnimTimeRef.current = 0;
        smoothProgressRef.current = 0;
        if (progressLineRef.current) progressLineRef.current.style.width = '0%';
        if (progressThumbRef.current) progressThumbRef.current.style.left = '0%';
        if (timeDisplayRef.current) {
          timeDisplayRef.current.innerText = `Keystroke 1 / ${history.length} (00:00 / ${formatTimeMs(totalPlaybackDuration)})`;
        }
      }
      setIsPlaying(true);
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setIsPlaying(false);
    }
  };

  const handleScrub = (targetTime) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setIsPlaying(false);

    const clampedTime = Math.min(Math.max(targetTime, 0), totalPlaybackDuration);
    currentAnimTimeRef.current = clampedTime;

    const maxIndex = Math.max(history.length - 1, 0);
    let idx = 0;
    while (idx < cumulativeTimes.length - 1 && cumulativeTimes[idx + 1] <= clampedTime) {
      idx++;
    }
    idx = Math.min(idx, maxIndex);

    currentIdxRef.current = idx;
    setPlaybackIndex(idx);

    const percent = totalPlaybackDuration > 0
      ? Math.min(Math.max((clampedTime / totalPlaybackDuration) * 100, 0), 100)
      : 0;
    smoothProgressRef.current = percent;
    if (progressLineRef.current) progressLineRef.current.style.width = `${percent}%`;
    if (progressThumbRef.current) progressThumbRef.current.style.left = `${percent}%`;
    if (timeDisplayRef.current) {
      timeDisplayRef.current.innerText = `Keystroke ${idx + 1} / ${history.length} (${formatTimeMs(clampedTime)} / ${formatTimeMs(totalPlaybackDuration)})`;
    }
  };

  return {
    playbackIndex,
    setPlaybackIndex,
    isPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    playbackSpeedRef,
    cumulativeTimes,
    totalPlaybackDuration,
    togglePlay,
    handleScrub,
    progressLineRef,
    progressThumbRef,
    timeDisplayRef,
    smoothProgressRef,
    currentAnimTimeRef
  };
}
