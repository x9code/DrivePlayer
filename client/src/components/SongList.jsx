import React, { useState } from 'react';
import { FaPlay, FaFolder, FaArrowLeft, FaClock, FaSortAmountDown, FaSortAmountUp, FaFilter } from 'react-icons/fa';

const SongList = ({ files, currentSong, onPlay, onFolderClick, loading, onBack, canGoBack, onShufflePlay, sortOption, sortDirection, onSortChange }) => {

    const [showSortMenu, setShowSortMenu] = useState(false);

    // Separate content
    const folders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    const songs = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

    // Format Bytes
    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    // Clean Title Helper
    const cleanTitle = (fileName) => {
        let name = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
        name = name.replace(/^\d+[\.\-\s]+/, "");    // Remove initial numbering "01. "

        // Remove "Artist - " prefix if present (simple heuristic: looks for " - " separator)
        const parts = name.split(' - ');
        if (parts.length > 1) {
            return parts.slice(1).join(' - ');
        }

        return name;
    };

    return (
        <div className="w-full max-w-7xl mx-auto pb-32 pt-6 px-4 md:px-8">

            {/* Header */}
            <header className="mb-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    {canGoBack && (
                        <button onClick={onBack} className="p-3 bg-black/20 hover:bg-white/10 rounded-full transition-colors" title="Go Back">
                            <FaArrowLeft />
                        </button>
                    )}
                    <h2 className="text-3xl font-bold tracking-tight">Library</h2>
                </div>

                {songs.length > 0 && (
                    <div className="flex items-center gap-2">
                        {/* Sort Button */}
                        <div className="relative">
                            <button
                                onClick={() => setShowSortMenu(!showSortMenu)}
                                className="bg-white/10 hover:bg-white/20 text-white font-medium rounded-full px-4 py-2 transition-colors flex items-center gap-2"
                                title="Sort Songs"
                            >
                                <FaFilter size={14} />
                                <span className="text-sm hidden sm:inline">Sort</span>
                            </button>

                            {/* Dropdown */}
                            {showSortMenu && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-[#282828] rounded-md shadow-2xl z-50 border border-white/5 overflow-hidden">
                                    <div className="py-1">
                                        <p className="px-4 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Sort By</p>

                                        {['name', 'date', 'size'].map(opt => (
                                            <button
                                                key={opt}
                                                onClick={() => {
                                                    onSortChange(opt);
                                                    setShowSortMenu(false);
                                                }}
                                                className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between hover:bg-white/10 transition-colors
                                                    ${sortOption === opt ? 'text-green-500' : 'text-white'}
                                                `}
                                            >
                                                <span className="capitalize">{opt}</span>
                                                {sortOption === opt && (
                                                    sortDirection === 'asc' ? <FaSortAmountUp size={12} /> : <FaSortAmountDown size={12} />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Backdrop for closing menu */}
                            {showSortMenu && (
                                <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)}></div>
                            )}
                        </div>

                        {/* Shuffle Button */}
                        <button
                            onClick={onShufflePlay}
                            className="bg-green-500 hover:bg-green-400 text-black font-bold rounded-full p-4 transition-transform hover:scale-105 shadow-xl flex items-center justify-center"
                            title="Shuffle Play"
                        >
                            <FaPlay className="pl-1" size={20} />
                        </button>
                    </div>
                )}
            </header>

            {/* Folder Grid (Spotify Cards) */}
            {folders.length > 0 && (
                <div className="mb-12">
                    <h3 className="text-xl font-bold mb-4 text-white">Folders</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                        {folders.map(folder => {
                            // Deterministic cover selection
                            const hash = folder.name.split("").reduce((a, b) => {
                                a = ((a << 5) - a) + b.charCodeAt(0);
                                return a & a;
                            }, 0);
                            const coverIndex = (Math.abs(hash) % 4) + 1;

                            return (
                                <div
                                    key={folder.id}
                                    onClick={() => onFolderClick(folder.id)}
                                    className="group bg-[#181818] hover:bg-[#282828] transition-all duration-300 p-4 rounded-md cursor-pointer flex flex-col gap-4 shadow-lg hover:shadow-2xl"
                                >
                                    <div className="relative w-full aspect-square rounded-md shadow-lg flex items-center justify-center overflow-hidden bg-zinc-800">
                                        <img
                                            src={`/covers/${coverIndex}.png`}
                                            alt={folder.name}
                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                        />
                                        <div className="absolute right-2 bottom-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 shadow-xl z-10">
                                            <div className="bg-green-500 rounded-full p-3 text-black shadow-lg hover:scale-105 transition-transform">
                                                <FaFolder size={20} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <h4 className="font-bold text-white truncate w-full pb-1" title={folder.name}>{folder.name}</h4>
                                        <p className="text-sm text-zinc-400">Folder</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Song List Table */}
            {songs.length > 0 && (
                <div>
                    {/* Table Header */}
                    <div className="grid grid-cols-[16px_1fr_100px] md:grid-cols-[40px_1fr_120px] items-center gap-4 px-4 py-2 border-b border-white/10 text-zinc-400 text-sm font-medium mb-4 sticky top-16 bg-[#121212] z-10 uppercase tracking-wider">
                        <span className="text-center">#</span>
                        <span className="pl-2">Title</span>
                        <span className="text-right flex items-center justify-end gap-2"><FaClock size={14} /> Size</span>
                    </div>

                    <div className="flex flex-col">
                        {songs.map((file, index) => {
                            const isCurrent = currentSong?.id === file.id;
                            return (
                                <div
                                    key={file.id}
                                    onClick={() => onPlay(file)}
                                    className={`group grid grid-cols-[16px_1fr_100px] md:grid-cols-[40px_1fr_120px] items-center gap-4 px-4 py-2 rounded-md cursor-pointer transition-colors 
                                        ${isCurrent ? 'bg-white/10' : 'hover:bg-white/5'}
                                    `}
                                >
                                    {/* Play/Index Column */}
                                    <div className="text-zinc-400 text-center text-sm font-mono flex justify-center items-center h-full">
                                        {isCurrent ? (
                                            <img src="https://open.spotifycdn.com/cdn/images/equaliser-animated-green.f93a2ef4.gif" className="h-4 w-4" alt="Playing" />
                                        ) : (
                                            <>
                                                <span className="group-hover:hidden">{index + 1}</span>
                                                <FaPlay size={10} className="hidden group-hover:block text-white ml-0.5" />
                                            </>
                                        )}
                                    </div>

                                    {/* Title Column */}
                                    <div className="flex items-center gap-4 min-w-0">
                                        {/* Optional: Add custom small thumbnail if available, otherwise just text */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className={`truncate font-medium text-[15px] ${isCurrent ? 'text-green-500' : 'text-white'}`}>
                                                {cleanTitle(file.name)}
                                            </h4>
                                            {/* Subtitle placeholder (Artist) - for now just hide or show name */}
                                            {/* <span className="text-xs text-zinc-400 group-hover:text-white transition-colors">Unknown Artist</span> */}
                                        </div>
                                    </div>

                                    {/* Size/Duration Column */}
                                    <div className="text-sm text-zinc-400 text-right font-variant-numeric tabular-nums">
                                        {formatSize(file.size)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {loading && (
                <div className="text-center py-20 text-zinc-500 flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-zinc-600 border-t-green-500 rounded-full animate-spin"></div>
                </div>
            )}

            {!loading && files.length === 0 && (
                <div className="text-center py-32 text-zinc-500">
                    <p className="text-lg font-medium">No contents found</p>
                    <p className="text-sm">Try exploring other folders</p>
                </div>
            )}
        </div>
    );
};

export default SongList;
