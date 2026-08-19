import { useState, useRef, useEffect, useCallback } from "react";

const STORAGE_KEY_VOLUME = "captionly_player_volume";
const STORAGE_KEY_MUTED = "captionly_player_muted";

export interface UseStudioPlayerOptions {
  src: string;
  autoPlay?: boolean;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onError?: (error: MediaError | null) => void;
}

export interface StudioPlayerState {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  isBuffering: boolean;
  error: string | null;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  skip: (deltaSeconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  toggleFullscreen: () => void;
  retry: () => void;
}

export function useStudioPlayer(options: UseStudioPlayerOptions): StudioPlayerState {
  const {
    src,
    autoPlay = false,
    onTimeUpdate,
    onDurationChange,
    onPlay,
    onPause,
    onError,
  } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Initialize volume and mute from localStorage if available
  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VOLUME);
      return saved !== null ? Number(saved) : 1;
    } catch {
      return 1;
    }
  });

  const [isMuted, setIsMutedState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MUTED);
      return saved !== null ? saved === "true" : true; // default muted for browser autoplay policy
    } catch {
      return true;
    }
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to calculate buffered end time
  const updateBuffered = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.buffered.length === 0) return;
    try {
      const current = video.currentTime;
      for (let i = 0; i < video.buffered.length; i++) {
        if (video.buffered.start(i) <= current && current <= video.buffered.end(i)) {
          setBuffered(video.buffered.end(i));
          return;
        }
      }
      setBuffered(video.buffered.end(video.buffered.length - 1));
    } catch {
      // Ignore buffer query errors
    }
  }, []);

  // Sync initial volume and muted states with video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = isMuted;
  }, [volume, isMuted]);

  // Video event bindings
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsPlaying(true);
      setIsBuffering(false);
      onPlay?.();
    };

    const handlePause = () => {
      setIsPlaying(false);
      onPause?.();
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      updateBuffered();
      onTimeUpdate?.(video.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);
      setError(null);
      onDurationChange?.(video.duration || 0);
      updateBuffered();
    };

    const handleProgress = () => {
      updateBuffered();
    };

    const handleWaiting = () => {
      setIsBuffering(true);
    };

    const handlePlaying = () => {
      setIsBuffering(false);
    };

    const handleCanPlay = () => {
      setIsBuffering(false);
    };

    const handleError = () => {
      const err = video.error;
      const message = err?.message || "Failed to load video source";
      setError(message);
      setIsBuffering(false);
      setIsPlaying(false);
      onError?.(err);
    };

    const handleRateChange = () => {
      setPlaybackRateState(video.playbackRate);
    };

    const handleVolumeChange = () => {
      setVolumeState(video.volume);
      setIsMutedState(video.muted);
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("progress", handleProgress);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);
    video.addEventListener("ratechange", handleRateChange);
    video.addEventListener("volumechange", handleVolumeChange);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("progress", handleProgress);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
      video.removeEventListener("ratechange", handleRateChange);
      video.removeEventListener("volumechange", handleVolumeChange);
    };
  }, [onPlay, onPause, onTimeUpdate, onDurationChange, onError, updateBuffered]);

  // Imperative Actions
  const play = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
    } catch (e) {
      console.warn("Video playback was prevented:", e);
      setIsPlaying(false);
    }
  }, []);

  const pause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      play();
    } else {
      pause();
    }
  }, [play, pause]);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clampedTime = Math.max(0, Math.min(time, video.duration || 0));
    video.currentTime = clampedTime;
    setCurrentTime(clampedTime);
  }, []);

  const skip = useCallback(
    (deltaSeconds: number) => {
      const video = videoRef.current;
      if (!video) return;
      seek(video.currentTime + deltaSeconds);
    },
    [seek],
  );

  const setVolume = useCallback((newVolume: number) => {
    const video = videoRef.current;
    const clamped = Math.max(0, Math.min(1, newVolume));
    if (video) {
      video.volume = clamped;
      if (clamped > 0 && video.muted) {
        video.muted = false;
      }
    }
    setVolumeState(clamped);
    try {
      localStorage.setItem(STORAGE_KEY_VOLUME, String(clamped));
      if (clamped > 0) {
        localStorage.setItem(STORAGE_KEY_MUTED, "false");
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const newMuted = !video.muted;
    video.muted = newMuted;
    setIsMutedState(newMuted);
    try {
      localStorage.setItem(STORAGE_KEY_MUTED, String(newMuted));
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    // Enable pitch preservation across standard and vendor properties
    if ("preservesPitch" in video) {
      (video as HTMLVideoElement).preservesPitch = true;
    }
    setPlaybackRateState(rate);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen?.().catch((err) => {
        console.warn("Error entering fullscreen:", err);
      });
    } else {
      document.exitFullscreen?.().catch((err) => {
        console.warn("Error exiting fullscreen:", err);
      });
    }
  }, []);

  const retry = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    setIsBuffering(true);
    video.load();
    if (isPlaying) {
      play();
    }
  }, [isPlaying, play]);

  // Global keyboard shortcuts for video controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      switch (e.code) {
        case "Space":
        case "KeyK":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
        case "KeyJ":
          e.preventDefault();
          skip(-5);
          break;
        case "ArrowRight":
        case "KeyL":
          e.preventDefault();
          skip(5);
          break;
        case "ArrowUp":
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.05));
          break;
        case "ArrowDown":
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.05));
          break;
        case "KeyM":
          e.preventDefault();
          toggleMute();
          break;
        case "KeyF":
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [togglePlay, skip, setVolume, toggleMute, toggleFullscreen, volume]);

  return {
    videoRef,
    containerRef,
    isPlaying,
    currentTime,
    duration,
    buffered,
    volume,
    isMuted,
    playbackRate,
    isBuffering,
    error,
    play,
    pause,
    togglePlay,
    seek,
    skip,
    setVolume,
    toggleMute,
    setPlaybackRate,
    toggleFullscreen,
    retry,
  };
}
