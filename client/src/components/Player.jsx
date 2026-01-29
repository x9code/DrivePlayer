import React, { useRef, useEffect, useState } from 'react';
import { FaPlay, FaPause, FaStepForward, FaStepBackward, FaVolumeUp, FaRandom, FaRedo, FaChevronDown } from 'react-icons/fa';

// Use environment variable for API URL in production (Vercel), fall back to relative path (proxy) in dev
const API_BASE = import.meta.env.VITE_API_URL || '';

const Player = ({ currentSong, isPlaying, setIsPlaying, onNext, onPrev, isShuffle, repeatMode, onShuffleToggle, onRepeatToggle, cleanTitle }) => {
    const audioRef = useRef(null);
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
            className={`fixed transition-all duration-300 ease-in-out z-50 bg-black/95 backdrop-blur-2xl
                ${isExpanded ? 'inset-0 flex flex-col items-center justify-center p-8' : 'bottom-0 left-0 right-0 h-24 border-t border-white/10 px-6 flex items-center justify-between'}`}
            onClick={handlePlayerClick}
            style={{ cursor: 'pointer' }}
        >
            {/* Full Screen Header */}
            {isExpanded && (
                <div className="absolute top-6 left-6 right-6 flex justify-between items-center text-zinc-400">
                    <button onClick={handleCollapse} className="hover:text-white p-2">
                        <FaChevronDown size={24} />
                    </button>
                    <span className="text-xs font-bold tracking-widest uppercase">Now Playing</span>
                    <div className="w-8"></div> {/* Spacer for center alignment */}
                </div>
            )}

            {/* Content Container */}
            <div className={`flex ${isExpanded ? 'flex-col items-center w-full max-w-md gap-6' : 'w-full flex-row items-center justify-between gap-2 md:gap-4'}`}>

                {/* Left Section: Album Art & Meta */}
                <div className={`flex items-center gap-4 ${isExpanded ? 'w-full justify-center flex-col' : 'min-w-[180px] w-[30%] max-w-[30%] overflow-hidden'}`}>
                    {/* Art */}
                    <div className={`relative shadow-2xl overflow-hidden rounded-md transition-all duration-300 flex-shrink-0
                        ${isExpanded ? 'w-64 h-64 lg:w-80 lg:h-80 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]' : 'w-14 h-14'}`
                    }>
                        <img
                            src={`${API_BASE}/api/thumbnail/${currentSong.id}`}
                            alt="Art"
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; }}
                            onLoad={(e) => e.target.style.display = 'block'}
                        />
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-black -z-10"></div>
                    </div>

                    {/* Meta */}
                    <div className={`${isExpanded ? 'text-center w-full' : 'flex flex-col justify-center overflow-hidden'}`}>
                        <h3 className={`font-bold text-white truncate hover:underline cursor-pointer ${isExpanded ? 'text-2xl mb-1' : 'text-sm'}`}>
                            {meta.title || (cleanTitle ? cleanTitle(currentSong.name) : currentSong.name)}
                        </h3>
                        <p className={`text-zinc-400 truncate hover:text-white hover:underline cursor-pointer ${isExpanded ? 'text-base' : 'text-xs'}`}>
                            {meta.artist || 'Google Drive'}
                        </p>
                    </div>


                </div>


                {/* Center Section: Controls & Progress Bar */}
                <div className={`flex flex-col items-center justify-center ${isExpanded ? 'w-full' : 'flex-1 max-w-[40%] gap-1'}`}>

                    {/* Controls Row */}
                    <div className="flex items-center gap-4 md:gap-6 justify-center w-full">
                        {/* Shuffle */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onShuffleToggle(); }}
                            className={`hidden md:flex transition-colors relative items-center justify-center ${isShuffle ? 'text-green-500' : 'text-zinc-400 hover:text-white'}`}
                            title="Shuffle"
                        >
                            <FaRandom size={16} />
                            {isShuffle && <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-green-500 rounded-full"></div>}
                        </button>

                        {/* Prev */}
                        <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="text-zinc-400 hover:text-white transition-colors"><FaStepBackward size={20} /></button>

                        {/* Play/Pause */}
                        <button
                            onClick={(e) => { e.stopPropagation(); togglePlay(e); }}
                            className="bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform w-8 h-8 md:w-9 md:h-9"
                        >
                            {isPlaying ? <FaPause size={14} /> : <FaPlay size={14} className="ml-0.5" />}
                        </button>

                        {/* Next */}
                        <button onClick={(e) => { e.stopPropagation(); onNext(false); }} className="text-zinc-400 hover:text-white transition-colors"><FaStepForward size={20} /></button>

                        {/* Repeat */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onRepeatToggle(); }}
                            className={`hidden md:flex transition-colors relative items-center justify-center ${repeatMode > 0 ? 'text-green-500' : 'text-zinc-400 hover:text-white'}`}
                            title="Repeat"
                        >
                            <FaRedo size={16} />
                            {repeatMode === 2 && <span className="absolute -top-1.5 -right-1 text-[8px] font-bold bg-zinc-800 text-green-500 px-0.5 rounded-full">1</span>}
                            {repeatMode > 0 && <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-green-500 rounded-full"></div>}
                        </button>
                    </div>

                    {/* Progress Bar Row (Desktop Only) */}
                    {!isExpanded && (
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
                                >
                                    {/* Handle (visible on hover) */}
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow-md"></div>
                                </div>
                            </div>

                            <span className="min-w-[40px]">{formatTime(duration)}</span>
                        </div>
                    )}
                </div>

                {/* Full Screen Progress (If Expanded) */}
                {isExpanded && (
                    <div className="w-full flex flex-col gap-2 mt-auto">
                        <div className="w-full h-1 bg-gray-600 rounded-lg cursor-pointer group relative">
                            <input
                                type="range"
                                min="0"
                                max={duration || 0}
                                value={progress}
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
                )}

                {/* Volume (Mini Only - Hidden on Mobile) */}
                {!isExpanded && (
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
                )}
                {/* Volume (Full Expanded - Bottom) */}
                {isExpanded && (
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
                )}
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
