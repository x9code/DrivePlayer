import React, { useRef, useEffect, useState } from 'react';
import { FaPlay, FaPause, FaStepForward, FaStepBackward, FaVolumeUp, FaRandom, FaRedo, FaChevronDown } from 'react-icons/fa';

const Player = ({ currentSong, isPlaying, setIsPlaying, onNext, onPrev, isShuffle, repeatMode, onShuffleToggle, onRepeatToggle }) => {
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

            fetch(`http://localhost:5000/api/metadata/${currentSong.id}`)
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
                    {meta.title || currentSong.name}
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
        }
    }, [currentSong, isPlaying]);

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

    const handleExpandToggle = (e) => {
        // Don't expand if clicking controls
        if (e.target.closest('button') || e.target.closest('input')) return;
        setIsExpanded(true);
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
            onClick={!isExpanded ? handleExpandToggle : undefined}
            style={{ cursor: !isExpanded ? 'pointer' : 'default' }}
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
            <div className={`flex ${isExpanded ? 'flex-col items-center w-full max-w-md gap-6' : 'w-full flex-row items-center justify-between'}`}>

                {/* Album Art */}
                <div className={`relative shadow-2xl overflow-hidden rounded-md transition-all duration-300
                    ${isExpanded ? 'w-56 h-56 md:w-64 md:h-64 lg:w-80 lg:h-80 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]' : 'w-14 h-14 shrink-0'}`
                }>
                    <img
                        src={`http://localhost:5000/api/thumbnail/${currentSong.id}`}
                        alt="Art"
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                        onLoad={(e) => e.target.style.display = 'block'}
                    />
                    {/* Fallback gradient if img fails (hidden by img usually) */}
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-black -z-10"></div>
                </div>

                {/* Song Meta */}
                <div className={`${isExpanded ? 'text-center w-full' : 'w-1/3 ml-4 mr-auto overflow-hidden'}`}>
                    <h3 className={`font-bold text-white truncate ${isExpanded ? 'text-2xl mb-1' : 'text-base'}`}>
                        {meta.title || currentSong.name}
                    </h3>
                    <p className={`text-zinc-400 truncate ${isExpanded ? 'text-base' : 'text-sm'}`}>
                        {meta.artist || 'Google Drive'}
                    </p>
                </div>

                {/* Progress Bar (Full Screen only, otherwise it's in controls group) */}
                {isExpanded && (
                    <div className="w-full flex flex-col gap-2">
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

                {/* Controls Section */}
                <div className={`${isExpanded ? 'w-full flex justify-between items-center max-w-sm' : 'flex flex-col items-center w-1/3 gap-2'}`}>

                    {/* Extra Controls Wrapper for Full Screen Layout */}
                    {isExpanded ? (
                        <>
                            <div className="flex items-center gap-6 justify-center w-full">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onShuffleToggle(); }}
                                    className={`transition-colors relative ${isShuffle ? 'text-green-500' : 'text-zinc-400 hover:text-white'}`}
                                >
                                    <FaRandom size={18} />
                                    {isShuffle && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-green-500 rounded-full"></div>}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="text-zinc-200 hover:text-white transition-colors"><FaStepBackward size={24} /></button>
                                <button onClick={(e) => { e.stopPropagation(); togglePlay(e); }} className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform">
                                    {isPlaying ? <FaPause size={20} /> : <FaPlay size={20} className="ml-1" />}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); onNext(false); }} className="text-zinc-200 hover:text-white transition-colors"><FaStepForward size={24} /></button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRepeatToggle(); }}
                                    className={`transition-colors relative ${repeatMode > 0 ? 'text-green-500' : 'text-zinc-400 hover:text-white'}`}
                                >
                                    <FaRedo size={18} />
                                    {repeatMode === 2 && <span className="absolute -top-1.5 -right-1.5 text-[10px] font-bold bg-zinc-800 text-green-500 px-1 rounded-full">1</span>}
                                    {repeatMode > 0 && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-green-500 rounded-full"></div>}
                                </button>
                            </div>
                        </>
                    ) : (
                        /* Mini Player Controls */
                        <>
                            <div className="flex items-center gap-6">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onShuffleToggle(); }}
                                    className={`transition-colors flex items-center justify-center w-8 h-8 rounded-full ${isShuffle ? 'text-green-500' : 'text-zinc-400 hover:text-white'}`}
                                >
                                    <FaRandom size={16} />
                                    {isShuffle && <div className="absolute -bottom-1 w-1 h-1 bg-green-500 rounded-full"></div>}
                                </button>

                                <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="text-zinc-400 hover:text-white transition-colors"><FaStepBackward size={20} /></button>

                                <button
                                    onClick={togglePlay}
                                    className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform"
                                    disabled={!currentSong}
                                >
                                    {isPlaying ? <FaPause size={16} /> : <FaPlay size={16} className="ml-0.5" />}
                                </button>

                                <button onClick={(e) => { e.stopPropagation(); onNext(false); }} className="text-zinc-400 hover:text-white transition-colors"><FaStepForward size={20} /></button>

                                <button
                                    onClick={(e) => { e.stopPropagation(); onRepeatToggle(); }}
                                    className={`transition-colors relative flex items-center justify-center w-8 h-8 rounded-full ${repeatMode > 0 ? 'text-green-500' : 'text-zinc-400 hover:text-white'}`}
                                >
                                    <FaRedo size={16} />
                                    {repeatMode === 2 && <span className="absolute -top-1 right-0 text-[10px] font-bold bg-black text-green-500 px-0.5" style={{ lineHeight: '10px' }}>1</span>}
                                    {repeatMode > 0 && <div className="absolute -bottom-1 w-1 h-1 bg-green-500 rounded-full"></div>}
                                </button>
                            </div>

                            {/* Mini Progress Bar */}
                            <div className="w-full flex items-center gap-3 text-xs text-zinc-400 font-mono" onClick={(e) => e.stopPropagation()}>
                                <span>{formatTime(progress)}</span>
                                <input
                                    type="range"
                                    min="0"
                                    max={duration || 0}
                                    value={progress}
                                    onChange={handleSeek}
                                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer hover:bg-green-500 accent-white"
                                    style={{
                                        background: `linear-gradient(to right, #22c55e ${duration ? (progress / duration) * 100 : 0}%, #4b5563 0)`
                                    }}
                                />
                                <span>{formatTime(duration)}</span>
                            </div>
                        </>
                    )}
                </div>

                {/* Volume (Mini Only - typically full screen hides or puts elsewhere, or we can keep it?) */}
                {!isExpanded && (
                    <div className="w-1/3 flex justify-end items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <FaVolumeUp className="text-light" />
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={handleVolume}
                            className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer hover:bg-primary/50"
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
                    src={`http://localhost:5000/api/stream/${currentSong.id}`}
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
