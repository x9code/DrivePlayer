import React, { useRef, useEffect, useState } from 'react';
import { FaPlay, FaPause, FaStepForward, FaStepBackward, FaVolumeUp, FaRandom, FaRedo, FaChevronDown } from 'react-icons/fa';

// Use environment variable for API URL in production (Vercel), fall back to relative path (proxy) in dev
const API_BASE = import.meta.env.VITE_API_URL || '';

const Player = ({ currentSong, isPlaying, setIsPlaying, onNext, onPrev, isShuffle, repeatMode, onShuffleToggle, onRepeatToggle, cleanTitle }) => {
    const audioRef = useRef(null);
    const prevVolumeRef = useRef(1);
    const [progress, setProgress] = React.useState(0);
    const [duration, setDuration] = React.useState(0);
    const [volume, setVolume] = React.useState(1);
    const [isExpanded, setIsExpanded] = useState(false);
    const [meta, setMeta] = useState({ title: null, artist: null });

    useEffect(() => {
        if (currentSong) {
            // Reset meta immediately
            setMeta({ title: null, artist: null });

            // Log for debugging
            // console.log("Fetching metadata for:", currentSong.name);

            fetch(`${API_BASE}/api/metadata/${currentSong.id}`)
                .then(res => res.json())
                .then(data => {
                    setMeta(data);
                })
                .catch(err => console.error("Metadata fetch error:", err));
        }
    }, [currentSong]);

    useEffect(() => {
        if (currentSong && audioRef.current) {
            // ... (playback effect remains)

            // ...

            {/* Song Meta */ }
            <div className={`${isExpanded ? 'text-center w-full' : 'w-1/3 ml-4 mr-auto overflow-hidden'}`}>
                <h3 className={`font-bold text-white truncate ${isExpanded ? 'text-3xl mb-2' : 'text-base'}`}>
                    {meta.title || (cleanTitle ? cleanTitle(currentSong.name) : currentSong.name)}
                </h3>
                <p className={`text-zinc-400 truncate ${isExpanded ? 'text-lg' : 'text-sm'}`}>
                    {meta.artist || 'Google Drive'}
                </p>
            </div>
            if (isPlaying) {
                audioRef.current.play().catch(e => console.error("Playback failed", e));
            } else {
                audioRef.current.pause();
            }

            // MediaSession API for Background Playback & Lock Screen Controls
            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: meta.title || (cleanTitle ? cleanTitle(currentSong.name) : currentSong.name),
                    artist: meta.artist || 'Google Drive',
                    album: meta.album || 'DrivePlayer',
                    artwork: [
                        { src: `${API_BASE}/api/thumbnail/${currentSong.id}`, sizes: '512x512', type: 'image/png' }
                    ]
                });

                navigator.mediaSession.setActionHandler('play', () => {
                    setIsPlaying(true);
                    audioRef.current.play();
                });
                navigator.mediaSession.setActionHandler('pause', () => {
                    setIsPlaying(false);
                    audioRef.current.pause();
                });
                navigator.mediaSession.setActionHandler('previoustrack', () => onPrev());
                navigator.mediaSession.setActionHandler('nexttrack', () => onNext(false));

                // Optional: Seek support
                navigator.mediaSession.setActionHandler('seekto', (details) => {
                    if (details.seekTime && audioRef.current) {
                        audioRef.current.currentTime = details.seekTime;
                        setProgress(details.seekTime);
                    }
                });
            }
        }
    }, [currentSong, isPlaying, meta, onNext, onPrev, setIsPlaying]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!currentSong || !audioRef.current) return;

            // Ignore if typing in an input
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    setIsPlaying(prev => !prev);
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    if (e.ctrlKey) {
                        onPrev();
                    } else {
                        audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5);
                        setProgress(audioRef.current.currentTime);
                    }
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    if (e.ctrlKey) {
                        onNext(false);
                    } else {
                        audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + 5);
                        setProgress(audioRef.current.currentTime);
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setVolume(prev => {
                        const newVol = Math.min(1, parseFloat((prev + 0.1).toFixed(2)));
                        audioRef.current.volume = newVol;
                        return newVol;
                    });
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setVolume(prev => {
                        const newVol = Math.max(0, parseFloat((prev - 0.1).toFixed(2)));
                        audioRef.current.volume = newVol;
                        return newVol;
                    });
                    break;
                case 'KeyM':
                    setVolume(prev => {
                        if (prev > 0) {
                            prevVolumeRef.current = prev;
                            audioRef.current.volume = 0;
                            return 0;
                        } else {
                            const restored = prevVolumeRef.current || 1;
                            audioRef.current.volume = restored;
                            return restored;
                        }
                    });
                    break;
                case 'KeyN':
                    onNext(false);
                    break;
                case 'KeyP':
                    onPrev();
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentSong, setIsPlaying, onNext, onPrev]);

    const handleTimeUpdate = () => {
        const current = audioRef.current.currentTime;
        const dur = audioRef.current.duration;
        setProgress(current);
        setDuration(dur);
    };

    const handleSeek = (e) => {
        const time = e.target.value;
        audioRef.current.currentTime = time;
        setProgress(time);
    };

    const handleVolume = (e) => {
        const vol = e.target.value;
        setVolume(vol);
        audioRef.current.volume = vol;
    };

    const togglePlay = (e) => {
        e.stopPropagation();
        setIsPlaying(!isPlaying);
    };

    const formatTime = (time) => {
        if (!time) return '0:00';
        const min = Math.floor(time / 60);
        const sec = Math.floor(time % 60);
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    };

    const handlePlayerClick = (e) => {
        // Don't toggle if clicking controls or range inputs
        if (e.target.closest('button') || e.target.closest('input')) return;

        if (isExpanded) {
            setIsExpanded(false);
        } else {
            setIsExpanded(true);
        }
    };

    const handleCollapse = (e) => {
        e.stopPropagation();
        setIsExpanded(false);
    }

    if (!currentSong) return null; // Or return simplified placeholder

    return (
        <div
            className={`fixed left-0 right-0 bottom-0 z-50 bg-black/95 backdrop-blur-2xl transition-all duration-500 cubic-bezier(0.32, 0.72, 0, 1) text-white overflow-hidden`}
            style={{
                height: isExpanded ? '100dvh' : '6rem',
                cursor: isExpanded ? 'default' : 'pointer'
            }}
            onClick={handlePlayerClick}
        >
            {/* --- MINI PLAYER VIEW (Always Rendered, Hidden when Expanded) --- */}
            <div
                className={`absolute inset-0 flex items-center justify-between px-6 transition-opacity duration-300 ${isExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            >
                {/* Left: Art + Meta */}
                <div className="flex items-center gap-4 min-w-[30%] max-w-[30%] overflow-hidden">
                    <div className="w-14 h-14 relative flex-shrink-0 rounded shadow-md overflow-hidden">
                        <img
                            src={`${API_BASE}/api/thumbnail/${currentSong.id}`}
                            alt="Art"
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; }}
                            onLoad={(e) => e.target.style.display = 'block'}
                        />
                    </div>
                    <div className="flex flex-col justify-center overflow-hidden">
                        <h3 className="font-bold text-sm truncate hover:underline cursor-pointer">
                            {cleanTitle ? cleanTitle(currentSong.name) : currentSong.name}
                        </h3>
                        <p className="text-zinc-400 text-xs truncate hover:text-white hover:underline cursor-pointer">
                            {meta.artist || 'Google Drive'}
                        </p>
                    </div>
                </div>

                {/* Center: Controls + Mini Progress */}
                <div className="flex flex-col items-center justify-center flex-1 max-w-[40%] gap-1">
                    <div className="flex items-center gap-4 md:gap-6">
                        <button
                            onClick={(e) => { e.stopPropagation(); onShuffleToggle(); }}
                            className={`hidden md:flex transition-colors ${isShuffle ? 'text-green-500' : 'text-zinc-400 hover:text-white'}`}
                        >
                            <FaRandom size={16} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="hidden sm:block text-zinc-400 hover:text-white"><FaStepBackward size={20} /></button>

                        <button
                            onClick={(e) => { e.stopPropagation(); togglePlay(e); }}
                            className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform"
                        >
                            {isPlaying ? <FaPause size={14} /> : <FaPlay size={14} className="ml-0.5" />}
                        </button>

                        <button onClick={(e) => { e.stopPropagation(); onNext(false); }} className="text-zinc-400 hover:text-white"><FaStepForward size={20} /></button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onRepeatToggle(); }}
                            className={`hidden md:flex transition-colors ${repeatMode > 0 ? 'text-green-500' : 'text-zinc-400 hover:text-white'}`}
                        >
                            <FaRedo size={16} />
                        </button>
                    </div>

                    {/* Mini Progress Bar */}
                    <div className="hidden md:flex w-full items-center gap-2 text-xs text-zinc-400 font-mono mt-1 group" onClick={(e) => e.stopPropagation()}>
                        <span className="min-w-[40px] text-right">{formatTime(progress)}</span>
                        <div className="flex-1 h-1 bg-zinc-600 rounded-lg cursor-pointer relative group-hover:h-1.5 transition-all">
                            <input
                                type="range"
                                min="0"
                                max={duration || 0}
                                value={progress}
                                onChange={handleSeek}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div
                                className="h-full bg-white rounded-lg relative group-hover:bg-green-500 transition-colors"
                                style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }}
                            ></div>
                        </div>
                        <span className="min-w-[40px]">{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Right: Volume */}
                <div className="hidden md:flex flex-shrink-0 w-28 justify-end items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <FaVolumeUp className="text-zinc-400 text-xs" />
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={handleVolume}
                        className="w-16 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer hover:bg-green-500"
                    />
                </div>
            </div>


            {/* --- FULL SCREEN VIEW (Absolute Overlay, Fades In) --- */}
            <div
                className={`absolute inset-0 flex flex-col items-center justify-center p-8 transition-opacity duration-300 delay-100 ${isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
                {/* Header */}
                <div className="absolute top-6 left-6 right-6 flex justify-between items-center text-zinc-400">
                    <button onClick={handleCollapse} className="hover:text-white p-2">
                        <FaChevronDown size={24} />
                    </button>
                    <span className="text-xs font-bold tracking-widest uppercase">Now Playing</span>
                    <div className="w-8"></div>
                </div>

                {/* Content */}
                <div className="flex flex-col items-center w-full max-w-md gap-6">
                    {/* Art */}
                    <div className="w-64 h-64 lg:w-80 lg:h-80 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden relative">
                        <img
                            src={`${API_BASE}/api/thumbnail/${currentSong.id}`}
                            alt="Art"
                            className="w-full h-full object-cover"
                        />
                    </div>

                    {/* Meta */}
                    <div className="text-center w-full">
                        <h3 className="font-bold text-white truncate text-2xl mb-1">
                            {meta.title || (cleanTitle ? cleanTitle(currentSong.name) : currentSong.name)}
                        </h3>
                        <p className="text-zinc-400 truncate text-base">
                            {meta.artist || 'Google Drive'}
                        </p>
                    </div>

                    {/* Progress */}
                    <div className="w-full flex flex-col gap-2">
                        <div className="w-full h-1 bg-gray-600 rounded-lg cursor-pointer group relative">
                            <input
                                type="range"
                                min="0"
                                max={duration || 0}
                                value={progress || 0}
                                onChange={handleSeek}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div
                                className="h-full bg-green-500 rounded-lg relative"
                                style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }}
                            >
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"></div>
                            </div>
                        </div>
                        <div className="flex justify-between text-xs text-zinc-400 font-mono">
                            <span>{formatTime(progress)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-6 justify-center w-full">
                        <button
                            onClick={(e) => { e.stopPropagation(); onShuffleToggle(); }}
                            className={`transition-colors relative ${isShuffle ? 'text-green-500' : 'text-zinc-400 hover:text-white'}`}
                        >
                            <FaRandom size={18} />
                            {isShuffle && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-green-500 rounded-full"></div>}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="text-zinc-200 hover:text-white"><FaStepBackward size={24} /></button>
                        <button onClick={(e) => { e.stopPropagation(); togglePlay(e); }} className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform">
                            {isPlaying ? <FaPause size={20} /> : <FaPlay size={20} className="ml-1" />}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onNext(false); }} className="text-zinc-200 hover:text-white"><FaStepForward size={24} /></button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onRepeatToggle(); }}
                            className={`transition-colors relative ${repeatMode > 0 ? 'text-green-500' : 'text-zinc-400 hover:text-white'}`}
                        >
                            <FaRedo size={18} />
                            {repeatMode === 2 && <span className="absolute -top-1.5 -right-1.5 text-[10px] font-bold bg-zinc-800 text-green-500 px-1 rounded-full">1</span>}
                            {repeatMode > 0 && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-green-500 rounded-full"></div>}
                        </button>
                    </div>

                    {/* Volume */}
                    <div className="w-full max-w-sm flex items-center gap-4 mt-6" onClick={(e) => e.stopPropagation()}>
                        <FaVolumeUp className="text-zinc-400" />
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={handleVolume}
                            className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer hover:bg-green-500 accent-white"
                            style={{
                                background: `linear-gradient(to right, #ffffff ${volume * 100}%, #4b5563 0)`
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Hidden Audio Element */}
            {currentSong && (
                <audio
                    ref={audioRef}
                    src={`${API_BASE}/api/stream/${currentSong.id}`}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={() => onNext(true)}
                    autoPlay
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                />
            )}
        </div>
    );
};

export default Player;
